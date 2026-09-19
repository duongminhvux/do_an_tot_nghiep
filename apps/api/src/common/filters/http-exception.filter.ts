import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nContext, I18nService } from 'nestjs-i18n';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly i18n?: I18nService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (response.headersSent) {
      return;
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse: any =
      exception instanceof HttpException
        ? exception.getResponse()
        : null;

    let message: any = 'INTERNAL_SERVER_ERROR';
    let error =
      exception instanceof HttpException
        ? (exceptionResponse?.error || exception.name.replace('Exception', ''))
        : 'Internal Server Error';

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      message = exceptionResponse.message || message;
      error = exceptionResponse.error || error;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Nếu message là key i18n dạng "auth.INVALID_CREDENTIALS" (không có khoảng trắng và có dấu chấm)
    if (typeof message === 'string' && !message.includes(' ') && message.includes('.')) {
      if (this.i18n) {
        try {
          const lang = I18nContext.current()?.lang || 'vi';
          const translated = await this.i18n.t(message, { lang });
          if (translated) {
            message = translated;
          }
        } catch {
          // giữ nguyên message nếu không tìm thấy key dịch
        }
      }
    }

    this.logger.error(
      `HTTP ${status} Error: ${JSON.stringify(message)} - Path: ${request.url}`,
    );

    response.status(status).json({
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
