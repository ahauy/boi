import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Types } from 'mongoose';
import type {
  RewardedAdAvailabilityDto,
  RewardedAdClaimStatusDto,
  RewardedAdIntentRequestDto,
  RewardedAdIntentResponseDto,
} from '@palmsight/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRateLimit, UserRateLimitGuard } from '../auth/guards/user-rate-limit.guard';
import { RewardedAdsService } from './rewarded-ads.service';
import { rewardedAdIntentBodySchema } from './schemas';

@Controller('ads/rewarded')
@UseGuards(JwtAuthGuard)
export class RewardedAdsController {
  constructor(private readonly rewardedAdsService: RewardedAdsService) {}

  @Get('availability')
  getAvailability(
    @CurrentUser('sub') userId: string
  ): Promise<RewardedAdAvailabilityDto> {
    return this.rewardedAdsService.getAvailability(new Types.ObjectId(userId));
  }

  @Post('intent')
  @UseGuards(UserRateLimitGuard)
  @UserRateLimit({ limit: 5, windowMs: 60 * 1000 })
  async createIntent(
    @CurrentUser('sub') userId: string,
    @Body() body: RewardedAdIntentRequestDto
  ): Promise<RewardedAdIntentResponseDto> {
    const validated = await rewardedAdIntentBodySchema.validate(body, {
      abortEarly: false,
    });
    return this.rewardedAdsService.createIntent(
      new Types.ObjectId(userId),
      validated.placement
    );
  }

  @Get('status')
  getStatus(
    @CurrentUser('sub') userId: string,
    @Query('nonce') nonce: string
  ): Promise<RewardedAdClaimStatusDto> {
    return this.rewardedAdsService.getClaimStatus(new Types.ObjectId(userId), nonce ?? '');
  }
}

/**
 * Google gọi route này, không có token của user nên không thể bọc trong JwtAuthGuard.
 *
 * Không áp giới hạn theo IP ở đây dù api-contract.md nói "endpoint không cần đăng nhập đếm theo IP":
 * callback của nhiều user khác nhau chui ra từ một dải IP egress của Google, nên chặn theo IP sẽ
 * làm mất lượt thưởng của user thật. Chữ ký ECDSA đã tự chứng thực nguồn gửi, và khoá được cache.
 */
@Controller('ads/rewarded')
export class RewardedAdSsvController {
  constructor(private readonly rewardedAdsService: RewardedAdsService) {}

  @Get('verify')
  @HttpCode(200)
  async verify(@Req() req: Request): Promise<void> {
    await this.rewardedAdsService.redeemFromCallback(req.originalUrl);
  }
}
