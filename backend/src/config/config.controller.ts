import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfigResponseDto, ECONOMY_DEFAULTS } from '@palmsight/shared';

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getConfig(): AppConfigResponseDto {
    const baseUrl = this.configService
      .get<string>('PUBLIC_BASE_URL', 'http://localhost:5173')
      .replace(/\/+$/, '');

    const currency = this.configService.get<string>(
      'CURRENCY',
      ECONOMY_DEFAULTS.CURRENCY,
    );
    const pricePerAction = Number(
      this.configService.get(
        'PRICE_PER_ACTION',
        this.configService.get('READING_COST_CREDITS', ECONOMY_DEFAULTS.PRICE_PER_ACTION),
      ),
    );
    const maxActionsPerTap = Number(
      this.configService.get(
        'MAX_ACTIONS_PER_TAP',
        ECONOMY_DEFAULTS.MAX_ACTIONS_PER_TAP,
      ),
    );
    const starterGrant = Number(
      this.configService.get(
        'STARTER_GRANT',
        this.configService.get('SIGNUP_BONUS_CREDITS', ECONOMY_DEFAULTS.STARTER_GRANT),
      ),
    );
    const rewardTz = this.configService.get<string>(
      'REWARD_TZ',
      ECONOMY_DEFAULTS.REWARD_TZ,
    );
    const streakLength = Number(
      this.configService.get('STREAK_LENGTH', ECONOMY_DEFAULTS.STREAK_LENGTH),
    );
    const restoreCostPerDay = Number(
      this.configService.get(
        'RESTORE_COST_PER_DAY',
        ECONOMY_DEFAULTS.RESTORE_COST_PER_DAY,
      ),
    );
    const restoreMaxMissed = Number(
      this.configService.get(
        'RESTORE_MAX_MISSED',
        ECONOMY_DEFAULTS.RESTORE_MAX_MISSED,
      ),
    );
    const freeSpins = Number(
      this.configService.get('FREE_SPINS', ECONOMY_DEFAULTS.FREE_SPINS),
    );
    const adSpins = Number(
      this.configService.get('AD_SPINS', ECONOMY_DEFAULTS.AD_SPINS),
    );
    const gemSpinCost = Number(
      this.configService.get(
        'CURRENCY_SPIN_COST',
        ECONOMY_DEFAULTS.CURRENCY_SPIN_COST,
      ),
    );
    const checkinDoubleCap = Number(
      this.configService.get(
        'CHECKIN_DOUBLE_CAP',
        ECONOMY_DEFAULTS.CHECKIN_DOUBLE_CAP,
      ),
    );
    const bonusAdAmount = Number(
      this.configService.get(
        'BONUS_AD_AMOUNT',
        ECONOMY_DEFAULTS.BONUS_AD_AMOUNT,
      ),
    );
    const bonusAdCap = Number(
      this.configService.get('BONUS_AD_CAP', ECONOMY_DEFAULTS.BONUS_AD_CAP),
    );
    const vipDaily = Number(
      this.configService.get('VIP_DAILY', ECONOMY_DEFAULTS.VIP_DAILY),
    );
    const minAdWatchSeconds = Number(
      this.configService.get(
        'MIN_AD_WATCH_SECONDS',
        ECONOMY_DEFAULTS.MIN_AD_WATCH_SECONDS,
      ),
    );

    return {
      currency,
      pricePerAction,
      maxActionsPerTap,
      starterGrant,
      rewardTz,
      checkinLadder: [...ECONOMY_DEFAULTS.CHECKIN_LADDER],
      streakLength,
      milestones: { ...ECONOMY_DEFAULTS.MILESTONES },
      restoreCostPerDay,
      restoreMaxMissed,
      wheelPrizes: [...ECONOMY_DEFAULTS.WHEEL_PRIZES],
      freeSpins,
      adSpins,
      gemSpinCost,
      checkinDoubleCap,
      bonusAdAmount,
      bonusAdCap,
      vipDaily,
      minAdWatchSeconds,
      legalUrls: {
        privacyUrl: `${baseUrl}/privacy`,
        termsUrl: `${baseUrl}/terms`,
      },
    };
  }
}
