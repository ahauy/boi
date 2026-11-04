import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { CREDIT_AMOUNTS } from '@palmsight/shared';
import {
  ReferralNetworkCounter,
  ReferralNetworkCounterDocument,
} from '../schemas/referral-network-counter.schema';
import { startOfReferralDay } from './referral-day.util';

const COUNTER_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

export interface ReferralNetworkSlot {
  ipHash: string;
  day: Date;
}

@Injectable()
export class ReferralNetworkQuotaService {
  private readonly logger = new Logger(ReferralNetworkQuotaService.name);

  constructor(
    @InjectModel(ReferralNetworkCounter.name)
    private readonly counterModel: Model<ReferralNetworkCounterDocument>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Gọi trước khi mở transaction. 11000 trong transaction không được retry,
   * và transaction không thấy document tạo sau snapshot của nó.
   * Không có IP thì trả về null: bên gọi không áp giới hạn mạng.
   */
  async prepare(ipHash: string | null): Promise<ReferralNetworkSlot | null> {
    if (!ipHash) {
      this.logger.warn('Không xác định được IP, bỏ qua giới hạn mạng cho lượt này');
      return null;
    }

    const day = startOfReferralDay();
    try {
      await this.counterModel.updateOne(
        { ipHash, day },
        {
          $setOnInsert: {
            ipHash,
            day,
            count: 0,
            expiresAt: new Date(day.getTime() + COUNTER_RETENTION_MS),
          },
        },
        { upsert: true },
      );
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
    }
    return { ipHash, day };
  }

  /** Chiếm một lượt trong transaction của bên gọi; rollback sẽ tự trả lượt. */
  async take(
    slot: ReferralNetworkSlot,
    session: ClientSession,
  ): Promise<boolean> {
    const cap = Number(
      this.configService.get('REFERRAL_NETWORK_DAILY_CAP') ??
        CREDIT_AMOUNTS.REFERRAL_NETWORK_DAILY_CAP,
    );
    const counter = await this.counterModel.findOneAndUpdate(
      { ipHash: slot.ipHash, day: slot.day, count: { $lt: cap } },
      { $inc: { count: 1 } },
      { session },
    );
    return counter !== null;
  }
}
