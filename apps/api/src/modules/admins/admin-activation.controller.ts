import {
  Body,
  Controller,
  Headers,
  Injectable,
  HttpException,
  Post,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../auth/decorators/public.decorator.js';
import {
  PermissionExemption,
  RequirePermissions,
} from '../auth/decorators/require-permissions.decorator.js';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { AdminActivationService } from './admin-activation.service.js';
import { Param } from '@nestjs/common';

@Injectable()
export class ActivationRateLimiter {
  private readonly windows = new Map<
    string,
    { until: number; count: number }
  >();
  check(ip: string, action: string) {
    const now = Date.now(),
      key = action + ':' + ip,
      old = this.windows.get(key);
    if (this.windows.size >= 10000) {
      for (const [k, v] of this.windows)
        if (v.until <= now) this.windows.delete(k);
      if (this.windows.size >= 10000 && !old)
        throw new HttpException('Too many requests', 429);
    }
    const window =
      old && old.until > now ? old : { until: now + 60000, count: 0 };
    if (++window.count > 20) throw new HttpException('Too many requests', 429);
    this.windows.set(key, window);
  }
}
@Controller('admin/activation')
export class AdminActivationController {
  constructor(
    private readonly activation: AdminActivationService,
    private readonly limiter: ActivationRateLimiter,
  ) {}
  @Public()
  @PermissionExemption('E7')
  @Post('status')
  status(@Req() req: any, @Body() body: Record<string, unknown>) {
    this.limiter.check(req.ip || 'unknown', 'status');
    return this.activation.inspect(body);
  }
  @Public()
  @PermissionExemption('E7')
  @Post('activate')
  activate(@Req() req: any, @Body() body: Record<string, unknown>) {
    this.limiter.check(req.ip || 'unknown', 'activate');
    return this.activation.activate(body);
  }
}
@AdminController('admins')
export class AdminReinviteController {
  constructor(private readonly activation: AdminActivationService) {}
  @RequirePermissions('admins.reinvite')
  @Post(':id/reinvite')
  reinvite(@Req() req: any, @Param('id') id: string) {
    return this.activation.reinvite(req.user, id);
  }
}
@Controller('_internal/identity/admin-activation')
export class AdminActivationDeliveryController {
  constructor(
    private readonly activation: AdminActivationService,
    private readonly config: ConfigService,
  ) {}
  @Public()
  @Post('deliver')
  deliver(
    @Headers('x-internal-token') supplied: string,
    @Body('tokenId') tokenId: string,
  ) {
    const expected = this.config.get<string>('INTERNAL_SERVICE_TOKEN') || '';
    const bytes = Buffer.from(typeof supplied === 'string' ? supplied : '');
    const secret = Buffer.from(expected);
    if (
      secret.length < 24 ||
      bytes.length !== secret.length ||
      !timingSafeEqual(bytes, secret)
    )
      throw new ForbiddenException();
    return this.activation.deliver(tokenId);
  }
}
