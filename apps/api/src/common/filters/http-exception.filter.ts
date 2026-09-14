import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";

interface ExceptionBody {
  code?: string;
  message?: string | string[];
  details?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { requestId?: string }>();
    const response = http.getResponse<Response>();
    const requestId = request.requestId ?? randomUUID();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw =
      exception instanceof HttpException
        ? exception.getResponse()
        : { code: "INTERNAL_ERROR", message: "An unexpected error occurred." };
    const body: ExceptionBody =
      typeof raw === "string" ? { message: raw } : (raw as ExceptionBody);
    const message = Array.isArray(body.message)
      ? body.message.join("; ")
      : body.message ?? "Request failed.";

    if (statusCode >= 500) {
      this.logger.error(
        JSON.stringify({
          requestId,
          method: request.method,
          path: request.originalUrl,
          error: exception instanceof Error ? exception.message : "Unknown error",
        }),
      );
    }

    response.status(statusCode).json({
      statusCode,
      code: body.code ?? this.codeForStatus(statusCode),
      message,
      details: body.details ?? null,
      requestId,
    });
  }

  private codeForStatus(status: number): string {
    return (
      {
        400: "VALIDATION_ERROR",
        401: "UNAUTHENTICATED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        429: "RATE_LIMITED",
      }[status] ?? "REQUEST_FAILED"
    );
  }
}
