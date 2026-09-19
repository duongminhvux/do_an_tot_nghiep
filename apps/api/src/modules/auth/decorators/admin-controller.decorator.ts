import { applyDecorators, Controller, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../guards/roles.guard.js';
import { Roles } from './roles.decorator.js';


export function AdminController(prefix: string) {
  return applyDecorators(
    Controller(`admin/${prefix}`), // Tự động thêm tiền tố /admin/ vào đường dẫn
    UseGuards(RolesGuard), // Tự động gắn Guard kiểm tra Token
    Roles('ADMIN') // Tự động gắn nhãn yêu cầu quyền ADMIN
  );
}
