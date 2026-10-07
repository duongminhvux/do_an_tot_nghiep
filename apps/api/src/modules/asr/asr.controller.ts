import { Get } from '@nestjs/common';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { AsrService } from './asr.service.js';

@AdminController('asr')
export class AsrController {
  constructor(private readonly asrService: AsrService) {}

  @Get('health')
  health() {
    return this.asrService.health();
  }
}
