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
  ) { }

  async onModuleInit() {
    await this.seedDefaultAdmin();
  }

  private async seedDefaultAdmin() {
    try {
      const count = await this.adminModel.countDocuments();
      if (count === 0) {
        const defaultEmail =
          this.configService.get<string>('DEFAULT_ADMIN_EMAIL') || 'admin@gmail.com';
        const defaultUsername =
          this.configService.get<string>('DEFAULT_ADMIN_USERNAME') || 'admin';
        const defaultPassword =
          this.configService.get<string>('DEFAULT_ADMIN_PASSWORD') || 'Password123@';

        const hashedPassword = await hashPassword(defaultPassword);

        await this.adminModel.create({
          email: defaultEmail.toLowerCase(),
          username: defaultUsername,
          password: hashedPassword,
          isDeleted: false,
        });

        this.logger.log(
          `Initialized default administrator account: ${defaultEmail} / ${defaultPassword}`,
        );
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
      $or: [
        { email: trimmed.toLowerCase() },
        { username: trimmed },
      ],
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

    const { password, ...safeAdmin } = admin.toObject();
    return safeAdmin as AdminDocument;
  }
}
