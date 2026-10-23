import {
  Injectable,
  UnauthorizedException } from '@nestjs/common';
import { InjectPgModel } from '../../postgres/compat.js';
import type { Model } from '../../postgres/compat.js';
import { Admin, AdminDocument } from './schema/admin.schema.js';
import { comparePassword } from '../../common/bcrypt.js';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class AdminsService {
  constructor(
    @InjectPgModel(Admin.name) private readonly adminModel: Model<Admin>,
    private readonly i18n: I18nService,
  ) {}

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
      $or: [{ email: trimmed.toLowerCase() }, { username: trimmed }] });

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
