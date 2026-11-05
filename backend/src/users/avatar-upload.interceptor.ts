import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import multer from 'multer';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1, fields: 0, parts: 2 },
}).single('avatar');

// Tự gọi multer thay cho FileInterceptor: interceptor của Nest đổi LIMIT_FILE_SIZE thành
// 413 không có `code`, ApiExceptionFilter sẽ trả code chung "ERROR" thay vì AVATAR_TOO_LARGE.
@Injectable()
export class AvatarUploadInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    await new Promise<void>((resolve, reject) => {
      upload(http.getRequest<Request>(), http.getResponse<Response>(), (err?: unknown) =>
        err ? reject(this.toHttpException(err)) : resolve(),
      );
    });
    return next.handle();
  }

  private toHttpException(err: unknown): HttpException {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return new HttpException(
          { code: 'AVATAR_TOO_LARGE', message: 'Ảnh đại diện tối đa 5 MB.' },
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
      return new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: 'Dữ liệu gửi lên không hợp lệ.',
          details: { fields: [{ field: err.field || 'avatar', message: 'Chỉ gửi một ảnh ở trường "avatar".' }] },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    // Lỗi parse multipart (body hỏng, thiếu boundary)
    return new HttpException(
      { code: 'VALIDATION_ERROR', message: 'Dữ liệu gửi lên không hợp lệ.' },
      HttpStatus.BAD_REQUEST,
    );
  }
}
