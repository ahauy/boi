import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  AdRewardClaimResponseDto,
  AdRewardKind,
  AdRewardReleaseResponseDto,
  AdRewardTicketDto,
  CheckinClaimResponseDto,
  CheckinRestoreResponseDto,
  CreateAdRewardRequestDto,
  CurrencyEarnResponseDto,
  WheelSpinResponseDto,
} from '@palmsight/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserDocument } from '../schemas/user.schema';
import { CurrencyService } from './currency.service';

@Controller('currency')
@UseGuards(JwtAuthGuard)
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get('earn')
  getEarn(
    @CurrentUser() user: UserDocument,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<CurrencyEarnResponseDto> {
    return this.currencyService.getEarnState(user, deviceId);
  }

  @Post('checkin')
  @HttpCode(HttpStatus.OK)
  checkin(
    @CurrentUser() user: UserDocument,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<CheckinClaimResponseDto> {
    return this.currencyService.claimCheckin(user._id, deviceId);
  }

  @Post('checkin/restore')
  @HttpCode(HttpStatus.OK)
  restoreCheckin(
    @CurrentUser() user: UserDocument,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<CheckinRestoreResponseDto> {
    return this.currencyService.restoreCheckin(user._id, deviceId);
  }

  @Post('spin')
  @HttpCode(HttpStatus.OK)
  spin(
    @CurrentUser() user: UserDocument,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<WheelSpinResponseDto> {
    return this.currencyService.spinFreeWheel(user._id, deviceId);
  }

  @Post('paid-spin')
  @HttpCode(HttpStatus.OK)
  paidSpin(
    @CurrentUser() user: UserDocument,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<WheelSpinResponseDto> {
    return this.currencyService.spinPaidWheel(user._id, deviceId);
  }

  @Post('ad-rewards')
  @HttpCode(HttpStatus.CREATED)
  createAdReward(
    @CurrentUser() user: UserDocument,
    @Body() body: CreateAdRewardRequestDto,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<AdRewardTicketDto> {
    return this.currencyService.createAdRewardTicket(
      user._id,
      body?.kind as AdRewardKind,
      deviceId,
    );
  }

  @Post('ad-rewards/:id/claim')
  @HttpCode(HttpStatus.OK)
  claimAdReward(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<AdRewardClaimResponseDto> {
    return this.currencyService.claimAdRewardTicket(user._id, id, deviceId);
  }

  @Delete('ad-rewards/:id')
  @HttpCode(HttpStatus.OK)
  releaseAdReward(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
  ): Promise<AdRewardReleaseResponseDto> {
    return this.currencyService.releaseAdRewardTicket(user._id, id);
  }
}
