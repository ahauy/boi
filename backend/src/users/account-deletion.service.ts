import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { UserDocument } from '../schemas/user.schema';
import { CloudinaryService } from '../readings/cloudinary.service';
import { deleteUserAccount } from './account-deletion';

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly cloudinary: CloudinaryService,
    private readonly configService: ConfigService,
  ) {}

  /** Người dùng tự xoá chính mình: id luôn lấy từ token, không nhận từ client. */
  async deleteMyAccount(user: UserDocument): Promise<void> {
    let result;
    try {
      result = await deleteUserAccount(
        this.connection,
        user._id,
        'self-service',
        this.configService.get<string>('IDENTITY_HASH_SECRET', 'palmsight-identity-secret'),
        this.cloudinary,
      );
    } catch (error) {
      if (/not found or already deleted/i.test((error as Error).message)) {
        throw new HttpException(
          { code: 'NOT_FOUND', message: 'Tài khoản không tồn tại hoặc đã bị xoá.' },
          HttpStatus.NOT_FOUND,
        );
      }
      throw error;
    }

    if (!result.deleted) {
      this.logger.warn(`Xoá tài khoản ${user._id.toString()} dừng vì ảnh chưa gỡ được: ${(result.unremovedImages ?? []).length} ảnh`);
      throw new HttpException(
        {
          code: 'IMAGE_DELETE_FAILED',
          message: 'Không xoá được ảnh trên hệ thống lưu trữ nên tài khoản chưa bị xoá. Vui lòng thử lại.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
