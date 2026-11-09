import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import * as bcrypt from 'bcrypt';
import {
  InjectPgConnection,
  withPgTransaction,
  type PgConnection,
} from '../../postgres/connection.js';
import { NotificationClient } from '../../common/clients/notification-client.js';
import { AdminAuthorizationService } from './admin-authorization.service.js';
import { iamId, iamObject, iamText } from './admin-iam.validation.js';

export const ACTIVATION_EVENT = 'identity.admin.activation_email_requested.v1';
export const ACTIVATION_SUBJECT =
  '[English Learning Platform] Kích hoạt tài khoản quản trị viên';
const invalid = () =>
  new BadRequestException('Activation link is invalid or unavailable');
const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );

@Injectable()
export class AdminActivationService {
  constructor(
    @InjectPgConnection() private readonly connection: PgConnection,
    private readonly config: ConfigService,
    private readonly authorization: AdminAuthorizationService,
    private readonly notification: NotificationClient,
  ) {}
  enabled() {
    return (
      this.config.get<string>('ADMIN_ACTIVATION_DELIVERY_ENABLED') === 'true'
    );
  }
  private raw(id: string, adminId: string) {
    const key = this.config.get<string>('ADMIN_ACTIVATION_TOKEN_KEY') || '';
    if (!/^[a-f0-9]{64}$/i.test(key))
      throw new ServiceUnavailableException(
        'Activation configuration unavailable',
      );
    return (
      id +
      '.' +
      createHmac('sha256', Buffer.from(key, 'hex'))
        .update('admin-activation:v1:' + adminId + ':' + id)
        .digest('base64url')
    );
  }
  private hash(token: string) {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
  private urls() {
    try {
      const base = new URL(this.config.get<string>('ADMIN_WEB_URL') || '');
      if (
        base.protocol !== 'https:' ||
        base.username ||
        base.password ||
        base.search ||
        base.hash
      )
        throw Error();
      return {
        activation: new URL('activate', base.href.replace(/\/?$/, '/')),
        login: new URL('login', base.href.replace(/\/?$/, '/')).href,
      };
    } catch {
      throw new ServiceUnavailableException('Admin web URL unavailable');
    }
  }
  /** Caller owns admin lock and transaction; no raw token is persisted or returned. */
  async issue(db: PgConnection, adminId: string, actorId: string) {
    if (!this.enabled())
      throw new ServiceUnavailableException(
        'Activation delivery is not enabled',
      );
    if (this.config.get<string>('ADMIN_ACTIVATION_CONSUMER_READY') !== 'true')
      throw new ServiceUnavailableException(
        'Activation consumer rollout is not confirmed',
      );
    this.urls();
    // Shared issuance limit also covers changing a pending email through profile update.
    const {
      rows: [recent],
    } = await db.query(
      `SELECT EXISTS(SELECT 1 FROM public.admin_activation_tokens WHERE admin_id=$1::uuid AND created_at>clock_timestamp()-interval '60 seconds') AS limited`,
      [adminId],
    );
    if (recent.limited)
      throw new HttpException(
        'Please wait before requesting another invitation',
        429,
      );
    const id = randomUUID(),
      tokenHash = this.hash(this.raw(id, adminId));
    await db.query(
      'UPDATE public.admin_activation_tokens SET revoked_at=clock_timestamp() WHERE admin_id=$1::uuid AND used_at IS NULL AND revoked_at IS NULL',
      [adminId],
    );
    const {
      rows: [token],
    } = await db.query(
      `INSERT INTO public.admin_activation_tokens(id,admin_id,token_hash,created_by,created_at,expires_at)
      SELECT $1,$2,$3,$4,issued,issued+interval '60 minutes' FROM (SELECT clock_timestamp() AS issued) stamp RETURNING id,expires_at AS "expiresAt"`,
      [id, adminId, tokenHash, actorId],
    );
    await db.query(
      `INSERT INTO public.outbox_events(event_id,event_type,aggregate_type,aggregate_id,payload)
      VALUES($1,$2,'admin-activation',$3,$4::jsonb)`,
      [
        randomUUID(),
        ACTIVATION_EVENT,
        adminId,
        JSON.stringify({ tokenId: id, adminId, expiresAt: token.expiresAt }),
      ],
    );
    return { ...token, delivery: 'QUEUED' };
  }
  async reinvite(actor: any, adminId: string) {
    iamId(adminId);
    return this.authorization.runIamTransaction(
      actor,
      'admins.reinvite',
      async (db) => {
        const {
          rows: [admin],
        } = await db.query(
          'SELECT status,is_deleted FROM public.admins WHERE id=$1::uuid FOR UPDATE',
          [adminId],
        );
        if (!admin || admin.is_deleted || admin.status !== 'PENDING_ACTIVATION')
          throw invalid();
        const {
          rows: [recent],
        } = await db.query(
          `SELECT EXISTS(SELECT 1 FROM public.admin_activation_tokens WHERE admin_id=$1::uuid AND created_at>clock_timestamp()-interval '60 seconds') AS limited`,
          [adminId],
        );
        if (recent.limited)
          throw new HttpException(
            'Please wait before requesting another invitation',
            429,
          );
        const issued = await this.issue(db, adminId, actor._id);
        await db.query(
          'UPDATE public.admins SET auth_version=auth_version+1 WHERE id=$1::uuid',
          [adminId],
        );
        await this.authorization.recordAudit(
          db,
          actor,
          'ADMIN_REINVITED',
          adminId,
          null,
          { activationTokenId: issued.id, expiresAt: issued.expiresAt },
        );
        return { expiresAt: issued.expiresAt, delivery: issued.delivery };
      },
    );
  }
  private parse(body: unknown, password: boolean) {
    const input = iamObject(
      body,
      password ? ['token', 'password', 'confirmPassword'] : ['token'],
    );
    if (
      typeof input.token !== 'string' ||
      !/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/.test(input.token)
    )
      throw invalid();
    const id = iamId(input.token.split('.')[0]);
    return { input, id, token: input.token };
  }
  private async locked<T>(
    id: string,
    work: (db: PgConnection, admin: any, token: any) => Promise<T>,
  ) {
    return withPgTransaction(this.connection, async (db) => {
      const {
        rows: [reference],
      } = await db.query(
        'SELECT admin_id FROM public.admin_activation_tokens WHERE id=$1::uuid',
        [id],
      );
      if (!reference) throw invalid();
      const {
        rows: [admin],
      } = await db.query(
        'SELECT id,email,username,status,is_deleted FROM public.admins WHERE id=$1::uuid FOR UPDATE',
        [reference.admin_id],
      );
      const {
        rows: [token],
      } = await db.query(
        'SELECT *,clock_timestamp()<expires_at AS unexpired FROM public.admin_activation_tokens WHERE id=$1::uuid FOR UPDATE',
        [id],
      );
      if (
        !admin ||
        admin.is_deleted ||
        admin.status !== 'PENDING_ACTIVATION' ||
        !token ||
        !token.unexpired ||
        token.used_at ||
        token.revoked_at
      )
        throw invalid();
      return work(db, admin, token);
    });
  }
  private matches(raw: string, hash: string) {
    return timingSafeEqual(
      Buffer.from(this.hash(raw), 'hex'),
      Buffer.from(hash, 'hex'),
    );
  }
  async inspect(body: unknown) {
    const { id, token } = this.parse(body, false);
    return this.locked(id, async (_db, _admin, record) => {
      if (!this.matches(token, record.token_hash)) throw invalid();
      return { valid: true, expiresAt: record.expires_at };
    });
  }
  async activate(body: unknown) {
    const { id, token, input } = this.parse(body, true);
    const password = iamText(input.password, 'password', 72);
    // bcrypt considers at most 72 UTF-8 bytes; reject instead of silently truncating.
    if (
      password !== input.password ||
      Buffer.byteLength(password, 'utf8') > 72 ||
      password.length < 12 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      password !== input.confirmPassword
    )
      throw new BadRequestException(
        'Password must match confirmation and contain 12–72 characters, uppercase, lowercase and a number',
      );
    await this.inspect({ token }); // cheap validity before expensive bcrypt
    const digest = await bcrypt.hash(password, 10);
    return this.locked(id, async (db, admin, record) => {
      if (!this.matches(token, record.token_hash)) throw invalid();
      const updated = await db.query(
        `UPDATE public.admin_activation_tokens SET used_at=clock_timestamp() WHERE id=$1::uuid AND clock_timestamp()<expires_at AND used_at IS NULL AND revoked_at IS NULL RETURNING id`,
        [id],
      );
      if (!updated.rowCount) throw invalid();
      await db.query(
        `UPDATE public.admins SET password_hash=$2,status='ACTIVE',activated_at=clock_timestamp(),auth_version=auth_version+1 WHERE id=$1::uuid`,
        [admin.id, digest],
      );
      await this.authorization.recordAudit(
        db,
        { _id: admin.id },
        'ADMIN_ACTIVATED',
        admin.id,
        { status: 'PENDING_ACTIVATION' },
        { status: 'ACTIVE', activationTokenId: id },
      );
      return { activated: true, loginUrl: this.urls().login };
    });
  }
  /** Trusted notification worker requests dispatch, never receives the bearer link. */
  async deliver(id: string) {
    iamId(id);
    try {
      return await this.locked(id, async (db, admin, record) => {
        const raw = this.raw(record.id, admin.id);
        if (!this.matches(raw, record.token_hash))
          return { delivery: 'CANCELLED' };
        const { activation } = this.urls();
        activation.hash = new URLSearchParams({ token: raw }).toString();
        const html = `<p>Xin chào ${escapeHtml(admin.username)},</p><p>Bạn được cấp tài khoản quản trị viên tại English Learning Platform.</p><p><a href="${escapeHtml(activation.href)}">Kích hoạt tài khoản</a></p><p>Liên kết có hiệu lực 60 phút kể từ khi phát hành. Nếu hết hạn, vui lòng liên hệ Super Admin để được cấp lại.</p><p>Nếu không nhận ra lời mời này, hãy bỏ qua email.</p>`;
        // Recheck real time immediately before dispatch; admin/token locks prevent revoke/consume during SMTP.
        const {
          rows: [live],
        } = await db.query(
          'SELECT clock_timestamp()<expires_at AS valid FROM public.admin_activation_tokens WHERE id=$1',
          [id],
        );
        if (!live.valid) return { delivery: 'CANCELLED' };
        try {
          await this.notification.sendEmail(
            admin.email,
            ACTIVATION_SUBJECT,
            html,
          );
        } catch {
          throw new ServiceUnavailableException(
            'Activation email transport unavailable',
          );
        }
        return { delivery: 'SENT' };
      });
    } catch (error) {
      if (error instanceof BadRequestException)
        return { delivery: 'CANCELLED' };
      throw error;
    }
  }
}
