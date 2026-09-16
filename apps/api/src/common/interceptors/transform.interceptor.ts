import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  statusCode: number;
  message?: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const response = context.switchToHttp().getResponse();
    const statusCode = response.statusCode;

    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'message' in data && Object.keys(data).length === 1) {
          return {
            statusCode,
            message: data.message,
            data: null as any,
          };
        }

        if (data && typeof data === 'object' && 'message' in data) {
          const { message, ...rest } = data;
          return {
            statusCode,
            message,
            data: Object.keys(rest).length === 1 && 'data' in rest ? rest.data : rest,
          };
        }

        return {
          statusCode,
          message: 'SUCCESS',
          data: data ?? null,
        };
      }),
    );
  }
}
