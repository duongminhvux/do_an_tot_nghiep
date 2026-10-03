import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Admin, AdminDocument } from './schema/admin.schema.js';
import { comparePassword, hashPassword } from '../../common/bcrypt.js';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class AdminsService implements OnModuleInit {
  private readonly logger = new Logger(AdminsService.name);

  constructor(
    @InjectModel(Admin.name) private readonly adminModel: Model<Admin>,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultAdmin();
  }

  private getDefaultAdminCredentials() {
    return {
      email: (
        this.configService.get<string>('DEFAULT_ADMIN_EMAIL') ||
        'admin@gmail.com'
      )
        .trim()
        .toLowerCase(),
      username: (
        this.configService.get<string>('DEFAULT_ADMIN_USERNAME') || 'admin'
      ).trim(),
      // Keep this in sync with src/scripts/seed-admin.mjs.
      password:
        this.configService.get<string>('DEFAULT_ADMIN_PASSWORD') || 'admin123',
    };
  }

  private async seedDefaultAdmin() {
    try {
      const { email, username, password } = this.getDefaultAdminCredentials();
      const existing = await this.adminModel.findOne({
        $or: [{ email }, { username }],
      });

      if (!existing) {
        const hashedPassword = await hashPassword(password);
        await this.adminModel.create({
          email,
          username,
          password: hashedPassword,
          isDeleted: false,
        });

        this.logger.log(
          `Initialized default administrator account: ${email} (${username})`,
        );
        return;
      }

      // Do not silently reset an existing admin password on every restart.
      // When explicitly enabled, this is useful for local Docker recovery.
      const syncPassword =
        this.configService.get<string>('DEFAULT_ADMIN_SYNC_PASSWORD') === 'true';

      if (syncPassword) {
        const passwordMatches = await comparePassword(password, existing.password);
        const needsMetadataSync =
          existing.email !== email ||
          existing.username !== username ||
          existing.isDeleted;

        if (!passwordMatches || needsMetadataSync) {
          existing.email = email;
          existing.username = username;
          existing.password = await hashPassword(password);
          existing.isDeleted = false;
          existing.deletedAt = undefined;
          await existing.save();
          this.logger.warn(
            `Synchronized default administrator credentials for ${email}`,
          );
        }
      }
    } catch (err) {
      this.logger.error('Failed to seed default admin', err);
    }
  }

  async findByEmail(email: string): Promise<AdminDocument | null> {
    const admin = await this.adminModel.findOne({ email: email.toLowerCase() });
    if (!admin) return null;
    return admin.toObject() as AdminDocument;
  }

  async findById(id: string): Promise<AdminDocument | null> {
    const admin = await this.adminModel.findById(id);
    if (!admin) return null;
    return admin.toObject() as AdminDocument;
  }

  async findByUsername(username: string): Promise<AdminDocument | null> {
    const admin = await this.adminModel.findOne({ username });
    if (!admin) return null;
    return admin.toObject() as AdminDocument;
  }

  async validateAdmin(
    identifier: string,
    pass: string,
  ): Promise<AdminDocument> {
    const trimmed = identifier.trim();
    const admin = await this.adminModel.findOne({
      $or: [{ email: trimmed.toLowerCase() }, { username: trimmed }],
    });

    if (!admin) {
      throw new UnauthorizedException(
        await this.i18n.t('auth.INVALID_CREDENTIALS'),
      );
    }

    if (admin.isDeleted) {
      throw new UnauthorizedException(
        await this.i18n.t('auth.ACCOUNT_DELETED'),
      );
    }

    const isMatch = await comparePassword(pass, admin.password);
    if (!isMatch) {
      throw new UnauthorizedException(
        await this.i18n.t('auth.INVALID_CREDENTIALS'),
      );
    }

    const { password: _password, ...safeAdmin } = admin.toObject();
    return safeAdmin as AdminDocument;
  }
}
