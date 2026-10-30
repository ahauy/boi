import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ValidationError as YupValidationError } from 'yup';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Handle Yup Validation Error
    if (exception instanceof YupValidationError) {
      const fields = (exception.inner?.length ? exception.inner : [exception]).map((err) => ({
        field: err.path || 'unknown',
        message: err.message,
      }));

      return response.status(HttpStatus.BAD_REQUEST).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dữ liệu gửi lên không hợp lệ.',
          details: { fields },
        },
      });
    }

    // Handle NestJS HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const errorObj = res as Record<string, unknown>;
        if (errorObj.code) {
          return response.status(status).json({
            error: {
              code: errorObj.code,
              message: errorObj.message || exception.message,
              details: errorObj.details,
            },
          });
        }
        if (errorObj.error && typeof errorObj.error === 'object') {
          return response.status(status).json(res);
        }
        if (errorObj.status === 'error') {
          return response.status(status).json(res);
        }
      }

      const defaultCodes: Record<number, string> = {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
        429: 'RATE_LIMITED',
        500: 'INTERNAL_SERVER_ERROR',
      };

      return response.status(status).json({
        error: {
          code: defaultCodes[status] || 'ERROR',
          message: exception.message,
        },
      });
    }

    // Unexpected errors
    console.error('Unhandled exception in ApiExceptionFilter:', exception);
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Đã có lỗi xảy ra từ máy chủ.',
      },
    });
  }
}
