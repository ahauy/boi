import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import {
  AdRewardClaimResponseDto,
  AdRewardKind,
  AdRewardReleaseResponseDto,
  AdRewardStatus,
  AdRewardTicketDto,
  CheckinClaimResponseDto,
  CheckinMilestoneTargetDto,
  CheckinRestoreOfferDto,
  CheckinRestoreResponseDto,
  CreditTransactionType,
  CurrencyEarnResponseDto,
  ECONOMY_DEFAULTS,
  WheelSpinResponseDto,
} from '@palmsight/shared';
import { User, UserDocument } from '../schemas/user.schema';
import { Device, DeviceDocument } from '../schemas/device.schema';
import { AdReward, AdRewardDocument } from '../schemas/ad-reward.schema';
import { CreditLedgerService } from '../credits/credit-ledger.service';
import {
  diffRewardDays,
  getNextRewardReset,
  getRewardDay,
} from './reward-day.util';

/**
 * Server-side weights for `[2, 3, 5, 10, 20, 50]` (Playbook §1.1 & §7.3:
 * heavily weighted to small prizes, never exposed to clients).
 */
const WHEEL_WEIGHTS = [450, 320, 150, 55, 20, 5] as const;

@Injectable()
export class CurrencyService {
  private clockFn: () => Date = () => new Date();
  private prizePickerFn: () => number = () => this.defaultPickWheelPrizeIndex();

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
    @InjectModel(AdReward.name)
    private readonly adRewardModel: Model<AdRewardDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly configService: ConfigService,
    private readonly creditLedgerService: CreditLedgerService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Drop legacy deviceId_1 index if present from older schema versions
    await this.deviceModel.collection.dropIndex('deviceId_1').catch(() => undefined);
  }

  setClock(fn: () => Date): void {
    this.clockFn = fn;
  }

  resetClock(): void {
    this.clockFn = () => new Date();
  }

  setPrizePicker(fn: () => number): void {
    this.prizePickerFn = fn;
  }

  resetPrizePicker(): void {
    this.prizePickerFn = () => this.defaultPickWheelPrizeIndex();
  }

  private now(): Date {
    return this.clockFn();
  }

  private defaultPickWheelPrizeIndex(): number {
    const totalWeight = WHEEL_WEIGHTS.reduce((acc, w) => acc + w, 0);
    const roll = crypto.randomInt(0, totalWeight);
    let cumulative = 0;
    for (let i = 0; i < WHEEL_WEIGHTS.length; i++) {
      cumulative += WHEEL_WEIGHTS[i];
      if (roll < cumulative) {
        return i;
      }
    }
    return 0;
  }

  pickWheelPrizeIndex(): number {
    return this.prizePickerFn();
  }

  getRewardTz(): string {
    return this.configService.get<string>(
      'REWARD_TZ',
      ECONOMY_DEFAULTS.REWARD_TZ,
    );
  }

  isRewardedAdsEnabled(): boolean {
    const raw = this.configService.get<string | boolean>(
      'REWARDED_ADS_ENABLED',
      'true',
    );
    return raw !== false && raw !== 'false';
  }

  getMinAdWatchSeconds(): number {
    return Number(
      this.configService.get(
        'MIN_AD_WATCH_SECONDS',
        ECONOMY_DEFAULTS.MIN_AD_WATCH_SECONDS,
      ),
    );
  }

  getRestoreCostPerDay(): number {
    return Number(
      this.configService.get(
        'RESTORE_COST_PER_DAY',
        ECONOMY_DEFAULTS.RESTORE_COST_PER_DAY,
      ),
    );
  }

  getRestoreMaxMissed(): number {
    return Number(
      this.configService.get(
        'RESTORE_MAX_MISSED',
        ECONOMY_DEFAULTS.RESTORE_MAX_MISSED,
      ),
    );
  }

  getGemSpinCost(): number {
    return Number(
      this.configService.get(
        'CURRENCY_SPIN_COST',
        ECONOMY_DEFAULTS.CURRENCY_SPIN_COST,
      ),
    );
  }

  getFreeSpinsCap(): number {
    return Number(
      this.configService.get('FREE_SPINS', ECONOMY_DEFAULTS.FREE_SPINS),
    );
  }

  getAdSpinsCap(): number {
    return Number(
      this.configService.get('AD_SPINS', ECONOMY_DEFAULTS.AD_SPINS),
    );
  }

  getCheckinDoubleCap(): number {
    return Number(
      this.configService.get(
        'CHECKIN_DOUBLE_CAP',
        ECONOMY_DEFAULTS.CHECKIN_DOUBLE_CAP,
      ),
    );
  }

  getBonusAdAmount(): number {
    return Number(
      this.configService.get(
        'BONUS_AD_AMOUNT',
        ECONOMY_DEFAULTS.BONUS_AD_AMOUNT,
      ),
    );
  }

  getBonusAdCap(): number {
    return Number(
      this.configService.get('BONUS_AD_CAP', ECONOMY_DEFAULTS.BONUS_AD_CAP),
    );
  }

  getCapForKind(kind: AdRewardKind): number {
    switch (kind) {
      case AdRewardKind.CHECKIN:
        return this.getCheckinDoubleCap();
      case AdRewardKind.SPIN:
        return this.getAdSpinsCap();
      case AdRewardKind.BONUS:
        return this.getBonusAdCap();
    }
  }

  hashDeviceId(rawDeviceId: string): string {
    const secret = this.configService.get<string>(
      'IDENTITY_HASH_SECRET',
      'palmsight-identity-secret',
    );
    return crypto
      .createHmac('sha256', secret)
      .update(`device:${rawDeviceId.trim()}`)
      .digest('hex');
  }

  resolveDeviceIdHash(
    user: { deviceIdHash?: string | null },
    rawDeviceHeader?: string | null,
  ): string | null {
    if (rawDeviceHeader && rawDeviceHeader.trim().length > 0) {
      return this.hashDeviceId(rawDeviceHeader);
    }
    return user.deviceIdHash ?? null;
  }

  /**
   * Acquires write locks in canonical order: User document first, then Device document.
   */
  private async lockUserAndDevice(
    userId: Types.ObjectId,
    rawDeviceHeader: string | undefined,
    session: ClientSession,
    now: Date,
  ): Promise<{
    user: UserDocument;
    device: DeviceDocument | null;
    deviceIdHash: string | null;
  }> {
    const user = await this.userModel.findOneAndUpdate(
      { _id: userId, deletedAt: null },
      { $set: { updatedAt: now } },
      { session, new: true },
    );

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Người dùng không tồn tại.',
      });
    }

    const deviceIdHash = this.resolveDeviceIdHash(user, rawDeviceHeader);
    let device: DeviceDocument | null = null;

    if (deviceIdHash) {
      device = await this.deviceModel.findOneAndUpdate(
        { deviceIdHash },
        {
          $setOnInsert: { deviceIdHash },
          $set: { updatedAt: now },
        },
        { session, upsert: true, new: true },
      );
    }

    return { user, device, deviceIdHash };
  }

  private computeNextMilestone(
    currentOrNextStreak: number,
  ): CheckinMilestoneTargetDto | null {
    const entries = Object.entries(ECONOMY_DEFAULTS.MILESTONES)
      .map(([day, bonus]) => ({ day: Number(day), bonus: Number(bonus) }))
      .sort((a, b) => a.day - b.day);

    for (const item of entries) {
      if (item.day > currentOrNextStreak) {
        return item;
      }
    }
    return entries[0] ?? null;
  }

  private evaluateCheckinState(
    user: {
      _id: Types.ObjectId;
      checkinDay?: string | null;
      checkinStreak?: number;
      lastCheckinAmount?: number;
    },
    device: {
      checkinDay?: string | null;
      checkinUserId?: Types.ObjectId | null;
    } | null,
    today: string,
  ): {
    checkedInToday: boolean;
    deviceUsedToday: boolean;
    streakDays: number;
    nextDay: number;
    todayAmount: number;
    restoreOffer: CheckinRestoreOfferDto | null;
  } {
    const ladder = ECONOMY_DEFAULTS.CHECKIN_LADDER;
    const streakLength = ECONOMY_DEFAULTS.STREAK_LENGTH;
    const restoreCostPerDay = this.getRestoreCostPerDay();
    const restoreMaxMissed = this.getRestoreMaxMissed();

    const lastDay = user.checkinDay ?? null;
    const lastStreak = user.checkinStreak ?? 0;

    const deviceUsedToday = Boolean(
      device &&
        device.checkinDay === today &&
        device.checkinUserId &&
        device.checkinUserId.toString() !== user._id.toString(),
    );

    if (lastDay === today) {
      const effectiveStreak = Math.max(1, lastStreak);
      const todayAmount =
        user.lastCheckinAmount && user.lastCheckinAmount > 0
          ? user.lastCheckinAmount
          : ladder[(effectiveStreak - 1) % ladder.length];
      return {
        checkedInToday: true,
        deviceUsedToday,
        streakDays: effectiveStreak,
        nextDay: effectiveStreak,
        todayAmount,
        restoreOffer: null,
      };
    }

    if (!lastDay || lastStreak <= 0) {
      return {
        checkedInToday: false,
        deviceUsedToday,
        streakDays: 0,
        nextDay: 1,
        todayAmount: ladder[0],
        restoreOffer: null,
      };
    }

    const diff = diffRewardDays(lastDay, today);
    if (diff <= 0) {
      const effectiveStreak = Math.max(1, lastStreak);
      return {
        checkedInToday: true,
        deviceUsedToday,
        streakDays: effectiveStreak,
        nextDay: effectiveStreak,
        todayAmount: ladder[(effectiveStreak - 1) % ladder.length],
        restoreOffer: null,
      };
    }

    if (diff === 1) {
      const nextDay = lastStreak >= streakLength ? 1 : lastStreak + 1;
      return {
        checkedInToday: false,
        deviceUsedToday,
        streakDays: lastStreak,
        nextDay,
        todayAmount: ladder[(nextDay - 1) % ladder.length],
        restoreOffer: null,
      };
    }

    const missedDays = diff - 1;
    if (missedDays <= restoreMaxMissed && lastStreak < streakLength) {
      return {
        checkedInToday: false,
        deviceUsedToday,
        streakDays: lastStreak,
        nextDay: 1,
        todayAmount: ladder[0],
        restoreOffer: {
          missedDays,
          cost: missedDays * restoreCostPerDay,
          costPerDay: restoreCostPerDay,
          streakToKeep: lastStreak,
        },
      };
    }

    return {
      checkedInToday: false,
      deviceUsedToday,
      streakDays: 0,
      nextDay: 1,
      todayAmount: ladder[0],
      restoreOffer: null,
    };
  }

  private async countRewardedUsedToday(
    userId: Types.ObjectId,
    deviceIdHash: string | null,
    rewardDay: string,
    kind: AdRewardKind,
    session?: ClientSession,
  ): Promise<number> {
    const userQuery = this.adRewardModel.countDocuments({
      userId,
      rewardDay,
      kind,
      status: AdRewardStatus.REWARDED,
    });
    if (session) userQuery.session(session);
    const userCount = await userQuery;

    if (!deviceIdHash) {
      return userCount;
    }

    const deviceQuery = this.adRewardModel.countDocuments({
      deviceIdHash,
      rewardDay,
      kind,
      status: AdRewardStatus.REWARDED,
    });
    if (session) deviceQuery.session(session);
    const deviceCount = await deviceQuery;

    return Math.max(userCount, deviceCount);
  }

  async getEarnState(
    user: UserDocument,
    rawDeviceHeader?: string,
  ): Promise<CurrencyEarnResponseDto> {
    const now = this.now();
    const rewardTz = this.getRewardTz();
    const today = getRewardDay(now, rewardTz);
    const { nextResetAt, secondsUntilReset } = getNextRewardReset(now, rewardTz);

    const freshUser = (await this.userModel.findById(user._id).lean()) ?? user;
    const deviceIdHash = this.resolveDeviceIdHash(freshUser, rawDeviceHeader);
    const device = deviceIdHash
      ? await this.deviceModel.findOne({ deviceIdHash }).lean()
      : null;

    const checkinEval = this.evaluateCheckinState(freshUser, device, today);
    const weekNumber = Math.floor((checkinEval.nextDay - 1) / 7) + 1;
    const dayInWeek = ((checkinEval.nextDay - 1) % 7) + 1;

    const [checkinDoubleUsed, adSpinUsed, bonusUsed] = await Promise.all([
      this.countRewardedUsedToday(
        freshUser._id,
        deviceIdHash,
        today,
        AdRewardKind.CHECKIN,
      ),
      this.countRewardedUsedToday(
        freshUser._id,
        deviceIdHash,
        today,
        AdRewardKind.SPIN,
      ),
      this.countRewardedUsedToday(
        freshUser._id,
        deviceIdHash,
        today,
        AdRewardKind.BONUS,
      ),
    ]);

    const checkinDoubleCap = this.getCheckinDoubleCap();
    const adSpinsCap = this.getAdSpinsCap();
    const bonusAdCap = this.getBonusAdCap();
    const bonusAdAmount = this.getBonusAdAmount();
    const freeSpinsCap = this.getFreeSpinsCap();
    const gemSpinCost = this.getGemSpinCost();
    const adsEnabled = this.isRewardedAdsEnabled();

    const userUsedFreeSpin = freshUser.freeSpinDay === today;
    const deviceUsedFreeSpin = Boolean(
      device &&
        device.freeSpinDay === today &&
        device.freeSpinUserId &&
        device.freeSpinUserId.toString() !== freshUser._id.toString(),
    );
    const freeSpinAvailable =
      freeSpinsCap > 0 && !userUsedFreeSpin && !deviceUsedFreeSpin;
    const freeSpinsUsedToday =
      userUsedFreeSpin || deviceUsedFreeSpin ? 1 : 0;

    const checkinDoubleRemaining = Math.max(
      0,
      checkinDoubleCap - checkinDoubleUsed,
    );
    const adSpinsRemaining = Math.max(0, adSpinsCap - adSpinUsed);
    const bonusRemaining = Math.max(0, bonusAdCap - bonusUsed);

    return {
      balance: freshUser.creditBalance,
      rewardDay: today,
      nextResetAt,
      secondsUntilReset,
      gemSpinCost,
      checkin: {
        checkedInToday: checkinEval.checkedInToday,
        deviceUsedToday: checkinEval.deviceUsedToday,
        streakDays: checkinEval.streakDays,
        nextDay: checkinEval.nextDay,
        weekNumber,
        dayInWeek,
        todayAmount: checkinEval.todayAmount,
        ladder: [...ECONOMY_DEFAULTS.CHECKIN_LADDER],
        streakLength: ECONOMY_DEFAULTS.STREAK_LENGTH,
        milestones: { ...ECONOMY_DEFAULTS.MILESTONES },
        nextMilestone: this.computeNextMilestone(checkinEval.streakDays),
        restoreOffer: checkinEval.restoreOffer,
        doubleAd: {
          usedToday: checkinDoubleUsed,
          cap: checkinDoubleCap,
          remaining: checkinDoubleRemaining,
          available:
            adsEnabled &&
            checkinDoubleRemaining > 0 &&
            !checkinEval.deviceUsedToday,
        },
      },
      wheel: {
        prizes: [...ECONOMY_DEFAULTS.WHEEL_PRIZES],
        freeSpinAvailable,
        freeSpinUsedByDevice: deviceUsedFreeSpin,
        freeSpinsUsedToday,
        freeSpinsCap,
        adSpinsUsedToday: adSpinUsed,
        adSpinsCap,
        adSpinsRemaining,
        gemSpinCost,
      },
      rewarded: {
        enabled: adsEnabled,
        minWatchSeconds: this.getMinAdWatchSeconds(),
        checkinDouble: {
          usedToday: checkinDoubleUsed,
          cap: checkinDoubleCap,
          remaining: checkinDoubleRemaining,
        },
        adSpin: {
          usedToday: adSpinUsed,
          cap: adSpinsCap,
          remaining: adSpinsRemaining,
        },
        bonus: {
          amount: bonusAdAmount,
          usedToday: bonusUsed,
          cap: bonusAdCap,
          remaining: bonusRemaining,
        },
      },
    };
  }

  async claimCheckin(
    userId: Types.ObjectId,
    rawDeviceHeader?: string,
  ): Promise<CheckinClaimResponseDto> {
    const now = this.now();
    const today = getRewardDay(now, this.getRewardTz());
    const ladder = ECONOMY_DEFAULTS.CHECKIN_LADDER;
    const streakLength = ECONOMY_DEFAULTS.STREAK_LENGTH;
    const milestones = ECONOMY_DEFAULTS.MILESTONES as Record<number, number>;

    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const { user, device, deviceIdHash } = await this.lockUserAndDevice(
        userId,
        rawDeviceHeader,
        session,
        now,
      );

      // Idempotent if already claimed today by this account
      if (user.checkinDay === today) {
        await session.commitTransaction();
        const streakDays = Math.max(1, user.checkinStreak ?? 1);
        const amount =
          user.lastCheckinAmount && user.lastCheckinAmount > 0
            ? user.lastCheckinAmount
            : ladder[(streakDays - 1) % ladder.length];
        return {
          amount,
          streakDays,
          milestoneBonus: 0,
          balance: user.creditBalance,
          rewardDay: today,
          alreadyClaimed: true,
        };
      }

      // One-per-device rule (§2.2)
      if (
        device &&
        device.checkinDay === today &&
        device.checkinUserId &&
        device.checkinUserId.toString() !== user._id.toString()
      ) {
        throw new ConflictException({
          code: 'device_used',
          message: 'Thiết bị này đã điểm danh hôm nay trên tài khoản khác.',
        });
      }

      let newStreak = 1;
      if (
        user.checkinDay &&
        (user.checkinStreak ?? 0) > 0 &&
        diffRewardDays(user.checkinDay, today) === 1
      ) {
        newStreak =
          user.checkinStreak! >= streakLength ? 1 : user.checkinStreak! + 1;
      }

      const amount = ladder[(newStreak - 1) % ladder.length];
      const milestoneBonus = milestones[newStreak] ?? 0;

      const checkinTx = await this.creditLedgerService.credit(
        {
          userId: user._id,
          amount,
          type: CreditTransactionType.CHECKIN,
          reason: 'checkin',
          extraUserSet: {
            checkinDay: today,
            checkinStreak: newStreak,
            lastCheckinAmount: amount,
          },
        },
        session,
      );

      let finalBalance = checkinTx.balanceAfter;

      if (milestoneBonus > 0) {
        const milestoneTx = await this.creditLedgerService.credit(
          {
            userId: user._id,
            amount: milestoneBonus,
            type: CreditTransactionType.CHECKIN_MILESTONE,
            reason: 'checkin_milestone',
          },
          session,
        );
        finalBalance = milestoneTx.balanceAfter;
      }

      if (deviceIdHash) {
        await this.deviceModel.updateOne(
          { deviceIdHash },
          {
            $set: {
              checkinDay: today,
              checkinUserId: user._id,
            },
          },
          { session },
        );
      }

      await session.commitTransaction();
      return {
        amount,
        streakDays: newStreak,
        milestoneBonus,
        balance: finalBalance,
        rewardDay: today,
        alreadyClaimed: false,
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async restoreCheckin(
    userId: Types.ObjectId,
    rawDeviceHeader?: string,
  ): Promise<CheckinRestoreResponseDto> {
    const now = this.now();
    const today = getRewardDay(now, this.getRewardTz());
    const ladder = ECONOMY_DEFAULTS.CHECKIN_LADDER;
    const streakLength = ECONOMY_DEFAULTS.STREAK_LENGTH;
    const milestones = ECONOMY_DEFAULTS.MILESTONES as Record<number, number>;

    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const { user, device, deviceIdHash } = await this.lockUserAndDevice(
        userId,
        rawDeviceHeader,
        session,
        now,
      );

      const vipActive = Boolean(
        user.vipExpiresAt && user.vipExpiresAt.getTime() > now.getTime(),
      );
      if (!vipActive) {
        throw new ForbiddenException({
          code: 'vip_required',
          message: 'Chỉ thành viên VIP mới có thể khôi phục chuỗi điểm danh.',
        });
      }

      const evalState = this.evaluateCheckinState(user, device, today);
      if (evalState.checkedInToday || !evalState.restoreOffer) {
        throw new BadRequestException({
          code: 'streak_not_restorable',
          message: 'Chuỗi điểm danh không thể khôi phục.',
        });
      }

      if (evalState.deviceUsedToday) {
        throw new ConflictException({
          code: 'device_used',
          message: 'Thiết bị này đã điểm danh hôm nay trên tài khoản khác.',
        });
      }

      const { missedDays, cost, streakToKeep } = evalState.restoreOffer;

      // Debit the streak restore cost first (throws 402 if balance is short)
      await this.creditLedgerService.debit(
        {
          userId: user._id,
          amount: cost,
          type: CreditTransactionType.CHECKIN_RESTORE,
          reason: 'checkin_restore',
        },
        session,
      );

      // Continues as day S + m + 1 (§7.2)
      const rawNewStreak = streakToKeep + missedDays + 1;
      const newStreak =
        rawNewStreak > streakLength
          ? ((rawNewStreak - 1) % streakLength) + 1
          : rawNewStreak;
      const amount = ladder[(newStreak - 1) % ladder.length];
      const milestoneBonus = milestones[newStreak] ?? 0;

      const checkinTx = await this.creditLedgerService.credit(
        {
          userId: user._id,
          amount,
          type: CreditTransactionType.CHECKIN,
          reason: 'checkin',
          extraUserSet: {
            checkinDay: today,
            checkinStreak: newStreak,
            lastCheckinAmount: amount,
          },
        },
        session,
      );

      let finalBalance = checkinTx.balanceAfter;

      if (milestoneBonus > 0) {
        const milestoneTx = await this.creditLedgerService.credit(
          {
            userId: user._id,
            amount: milestoneBonus,
            type: CreditTransactionType.CHECKIN_MILESTONE,
            reason: 'checkin_milestone',
          },
          session,
        );
        finalBalance = milestoneTx.balanceAfter;
      }

      if (deviceIdHash) {
        await this.deviceModel.updateOne(
          { deviceIdHash },
          {
            $set: {
              checkinDay: today,
              checkinUserId: user._id,
            },
          },
          { session },
        );
      }

      await session.commitTransaction();
      return {
        costPaid: cost,
        amount,
        streakDays: newStreak,
        milestoneBonus,
        balance: finalBalance,
        rewardDay: today,
        checkedInToday: true,
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async spinFreeWheel(
    userId: Types.ObjectId,
    rawDeviceHeader?: string,
  ): Promise<WheelSpinResponseDto> {
    const now = this.now();
    const today = getRewardDay(now, this.getRewardTz());
    const prizes = ECONOMY_DEFAULTS.WHEEL_PRIZES;

    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const { user, device, deviceIdHash } = await this.lockUserAndDevice(
        userId,
        rawDeviceHeader,
        session,
        now,
      );

      if (user.freeSpinDay === today) {
        throw new ConflictException({
          code: 'free_spin_used',
          message: 'Bạn đã dùng lượt quay miễn phí hôm nay.',
        });
      }

      if (device && device.freeSpinDay === today) {
        throw new ConflictException({
          code: 'device_used',
          message: 'Thiết bị này đã dùng lượt quay miễn phí hôm nay.',
        });
      }

      const prizeIndex = this.pickWheelPrizeIndex();
      const amount = prizes[prizeIndex];

      const tx = await this.creditLedgerService.credit(
        {
          userId: user._id,
          amount,
          type: CreditTransactionType.WHEEL,
          reason: 'wheel',
          extraUserSet: { freeSpinDay: today },
        },
        session,
      );

      if (deviceIdHash) {
        await this.deviceModel.updateOne(
          { deviceIdHash },
          {
            $set: {
              freeSpinDay: today,
              freeSpinUserId: user._id,
            },
          },
          { session },
        );
      }

      await session.commitTransaction();
      return {
        prizeIndex,
        amount,
        balance: tx.balanceAfter,
        rewardDay: today,
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async spinPaidWheel(
    userId: Types.ObjectId,
    rawDeviceHeader?: string,
  ): Promise<WheelSpinResponseDto> {
    const now = this.now();
    const today = getRewardDay(now, this.getRewardTz());
    const prizes = ECONOMY_DEFAULTS.WHEEL_PRIZES;
    const cost = this.getGemSpinCost();

    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const { user, device } = await this.lockUserAndDevice(
        userId,
        rawDeviceHeader,
        session,
        now,
      );

      const freeSpinUsedByUser = user.freeSpinDay === today;
      const freeSpinUsedByDevice = Boolean(
        device && device.freeSpinDay === today,
      );

      if (!freeSpinUsedByUser && !freeSpinUsedByDevice) {
        throw new ConflictException({
          code: 'free_spin_available',
          message: 'Bạn vẫn còn lượt quay miễn phí hôm nay.',
        });
      }

      if (user.creditBalance < cost) {
        throw new HttpException(
          {
            code: 'gems_insufficient',
            message: 'Bạn không đủ GEM để quay.',
            details: {
              required: cost,
              balance: user.creditBalance,
            },
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      await this.creditLedgerService.debit(
        {
          userId: user._id,
          amount: cost,
          type: CreditTransactionType.WHEEL_SPIN,
          reason: 'wheel_spin',
        },
        session,
      );

      const prizeIndex = this.pickWheelPrizeIndex();
      const amount = prizes[prizeIndex];

      const creditTx = await this.creditLedgerService.credit(
        {
          userId: user._id,
          amount,
          type: CreditTransactionType.WHEEL,
          reason: 'wheel',
        },
        session,
      );

      await session.commitTransaction();
      return {
        prizeIndex,
        amount,
        cost,
        balance: creditTx.balanceAfter,
        rewardDay: today,
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async createAdRewardTicket(
    userId: Types.ObjectId,
    kind: AdRewardKind,
    rawDeviceHeader?: string,
  ): Promise<AdRewardTicketDto> {
    if (!Object.values(AdRewardKind).includes(kind)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Loại vé thưởng quảng cáo không hợp lệ.',
      });
    }

    if (!this.isRewardedAdsEnabled()) {
      throw new HttpException(
        {
          code: 'ads_unavailable',
          message: 'Quảng cáo nhận thưởng hiện đang tắt.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const now = this.now();
    const today = getRewardDay(now, this.getRewardTz());
    const minWatchSeconds = this.getMinAdWatchSeconds();
    const cap = this.getCapForKind(kind);

    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const { user, device, deviceIdHash } = await this.lockUserAndDevice(
        userId,
        rawDeviceHeader,
        session,
        now,
      );

      // Check kind preconditions (ad_reward_locked)
      if (kind === AdRewardKind.CHECKIN) {
        if (user.checkinDay !== today) {
          throw new ConflictException({
            code: 'ad_reward_locked',
            message: 'Vui lòng điểm danh hôm nay trước khi nhân đôi phần thưởng.',
          });
        }
      } else if (kind === AdRewardKind.SPIN) {
        const freeUsed =
          user.freeSpinDay === today ||
          Boolean(device && device.freeSpinDay === today);
        if (!freeUsed) {
          throw new ConflictException({
            code: 'ad_reward_locked',
            message: 'Vui lòng dùng lượt quay miễn phí trước.',
          });
        }
      }

      // Check cap per kind, per account AND per device at create time (§2.2)
      const usedToday = await this.countRewardedUsedToday(
        user._id,
        deviceIdHash,
        today,
        kind,
        session,
      );
      if (usedToday >= cap) {
        throw new HttpException(
          {
            code: 'ad_limit_reached',
            message: 'Đã đạt giới hạn nhận thưởng quảng cáo hôm nay.',
            details: { kind, cap, usedToday },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Release any previous pending tickets for this user
      await this.adRewardModel.updateMany(
        {
          userId: user._id,
          status: AdRewardStatus.PENDING,
        },
        {
          $set: {
            status: AdRewardStatus.RELEASED,
            releasedAt: now,
          },
        },
        { session },
      );

      let amount = 0;
      let prizeIndex: number | null = null;
      const ladder = ECONOMY_DEFAULTS.CHECKIN_LADDER;
      const prizes = ECONOMY_DEFAULTS.WHEEL_PRIZES;

      if (kind === AdRewardKind.CHECKIN) {
        const streak = Math.max(1, user.checkinStreak ?? 1);
        amount =
          user.lastCheckinAmount && user.lastCheckinAmount > 0
            ? user.lastCheckinAmount
            : ladder[(streak - 1) % ladder.length];
      } else if (kind === AdRewardKind.SPIN) {
        prizeIndex = this.pickWheelPrizeIndex();
        amount = prizes[prizeIndex];
      } else {
        amount = this.getBonusAdAmount();
      }

      const [ticket] = await this.adRewardModel.create(
        [
          {
            userId: user._id,
            deviceIdHash,
            kind,
            status: AdRewardStatus.PENDING,
            rewardDay: today,
            amount,
            prizeIndex,
            createdAt: now,
            updatedAt: now,
            purgeAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
          },
        ],
        { session },
      );

      await session.commitTransaction();
      return {
        id: ticket._id.toString(),
        ticketId: ticket._id.toString(),
        kind: ticket.kind,
        status: ticket.status,
        rewardDay: ticket.rewardDay,
        minWatchSeconds,
        createdAt: ticket.createdAt.toISOString(),
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async claimAdRewardTicket(
    userId: Types.ObjectId,
    ticketIdStr: string,
    rawDeviceHeader?: string,
  ): Promise<AdRewardClaimResponseDto> {
    if (!Types.ObjectId.isValid(ticketIdStr)) {
      throw new NotFoundException({
        code: 'ticket_not_found',
        message: 'Vé thưởng quảng cáo không tồn tại.',
      });
    }

    const ticketId = new Types.ObjectId(ticketIdStr);
    const now = this.now();
    const minWatchSeconds = this.getMinAdWatchSeconds();

    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const { user, deviceIdHash: resolvedDeviceHash } =
        await this.lockUserAndDevice(userId, rawDeviceHeader, session, now);

      const ticket = await this.adRewardModel
        .findOne({ _id: ticketId, userId: user._id })
        .session(session);

      if (!ticket) {
        throw new NotFoundException({
          code: 'ticket_not_found',
          message: 'Vé thưởng quảng cáo không tồn tại.',
        });
      }

      // Idempotent claim if already rewarded or capped (§12)
      if (
        ticket.status === AdRewardStatus.REWARDED ||
        ticket.status === AdRewardStatus.CAPPED
      ) {
        await session.commitTransaction();
        return {
          id: ticket._id.toString(),
          kind: ticket.kind,
          status: ticket.status,
          amount: ticket.status === AdRewardStatus.REWARDED ? ticket.amount : 0,
          prizeIndex:
            ticket.status === AdRewardStatus.REWARDED
              ? (ticket.prizeIndex ?? null)
              : null,
          balance: user.creditBalance,
          rewardDay: ticket.rewardDay,
        };
      }

      if (ticket.status === AdRewardStatus.RELEASED) {
        throw new ConflictException({
          code: 'ticket_released',
          message: 'Vé thưởng quảng cáo này đã bị huỷ.',
        });
      }

      const elapsedMs = now.getTime() - ticket.createdAt.getTime();
      const requiredMs = minWatchSeconds * 1000;
      if (elapsedMs < requiredMs) {
        const retryAfter = Math.max(
          1,
          Math.ceil((requiredMs - elapsedMs) / 1000),
        );
        throw new HttpException(
          {
            code: 'ad_not_finished',
            message: 'Chưa đủ thời gian xem quảng cáo.',
            retryAfter,
            details: { retryAfter },
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const effectiveDeviceHash = ticket.deviceIdHash ?? resolvedDeviceHash;
      const cap = this.getCapForKind(ticket.kind);
      const usedInRewardDay = await this.countRewardedUsedToday(
        user._id,
        effectiveDeviceHash,
        ticket.rewardDay,
        ticket.kind,
        session,
      );

      if (usedInRewardDay >= cap) {
        ticket.status = AdRewardStatus.CAPPED;
        ticket.claimedAt = now;
        await ticket.save({ session });
        await session.commitTransaction();

        return {
          id: ticket._id.toString(),
          kind: ticket.kind,
          status: AdRewardStatus.CAPPED,
          amount: 0,
          prizeIndex: null,
          balance: user.creditBalance,
          rewardDay: ticket.rewardDay,
        };
      }

      ticket.status = AdRewardStatus.REWARDED;
      ticket.claimedAt = now;
      if (effectiveDeviceHash && !ticket.deviceIdHash) {
        ticket.deviceIdHash = effectiveDeviceHash;
      }
      await ticket.save({ session });

      const tx = await this.creditLedgerService.credit(
        {
          userId: user._id,
          amount: ticket.amount,
          type: CreditTransactionType.AD_REWARD,
          reason: 'ad_reward',
          adClaimId: ticket._id,
        },
        session,
      );

      await session.commitTransaction();
      return {
        id: ticket._id.toString(),
        kind: ticket.kind,
        status: AdRewardStatus.REWARDED,
        amount: ticket.amount,
        prizeIndex: ticket.prizeIndex ?? null,
        balance: tx.balanceAfter,
        rewardDay: ticket.rewardDay,
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async releaseAdRewardTicket(
    userId: Types.ObjectId,
    ticketIdStr: string,
  ): Promise<AdRewardReleaseResponseDto> {
    if (!Types.ObjectId.isValid(ticketIdStr)) {
      throw new NotFoundException({
        code: 'ticket_not_found',
        message: 'Vé thưởng quảng cáo không tồn tại.',
      });
    }

    const ticketId = new Types.ObjectId(ticketIdStr);
    const now = this.now();

    const ticket = await this.adRewardModel.findOne({
      _id: ticketId,
      userId,
    });

    if (!ticket) {
      throw new NotFoundException({
        code: 'ticket_not_found',
        message: 'Vé thưởng quảng cáo không tồn tại.',
      });
    }

    if (ticket.status === AdRewardStatus.PENDING) {
      ticket.status = AdRewardStatus.RELEASED;
      ticket.releasedAt = now;
      await ticket.save();
    }

    return {
      id: ticket._id.toString(),
      status: ticket.status,
    };
  }
}
