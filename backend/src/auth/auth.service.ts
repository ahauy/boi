import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { InjectModel, InjectConnection } from "@nestjs/mongoose";
import { Model, Connection, ClientSession } from "mongoose";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as crypto from "crypto";

import {
  ECONOMY_DEFAULTS,
  DeviceSessionRequestDto,
  AuthResponseDto,
  RefreshTokenResponseDto,
} from "@palmsight/shared";

import { User, UserDocument } from "../schemas/user.schema";
import {
  computeDeviceIdHash,
  DEFAULT_IDENTITY_HASH_SECRET,
} from "../common/device-id-hash.util";
import { hashIp } from "../common/client-ip.util";
import { Session, SessionDocument } from "../schemas/session.schema";
import { Referral, ReferralDocument } from "../schemas/referral.schema";
import { Device, DeviceDocument } from "../schemas/device.schema";
import { CreditLedgerService } from "../credits/credit-ledger.service";
import { unauthenticated } from "./guards/jwt-auth.guard";

const REFERRAL_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Chỉ còn phiên khách theo thiết bị (`/auth/device`) và làm mới phiên (`/auth/refresh`).
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Referral.name)
    private readonly referralModel: Model<ReferralDocument>,
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
    private readonly creditLedgerService: CreditLedgerService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectConnection() private readonly connection: Connection
  ) {}

  /**
   * Mobile không có đăng ký/đăng nhập: mỗi thiết bị nhận một tài khoản ẩn danh gắn với
   * deviceId (Android ID trên Android, mã lưu trong SecureStore trên iOS). Gọi lại cùng deviceId
   * sẽ mở lại đúng tài khoản đó, kể cả sau khi cài lại app trên Android.
   */
  async createDeviceSession(
    dto: DeviceSessionRequestDto,
    clientIp?: string
  ): Promise<{ authResponse: AuthResponseDto; rawRefreshToken: string }> {
    const deviceIdHash = this.hashDeviceId(dto.deviceId.trim());
    const existing = await this.userModel.findOne({ deviceIdHash });
    if (existing && !existing.deletedAt) {
      return this.createAuthSession(existing, false);
    }

    const signupIpHash = hashIp(
      this.configService.get<string>(
        "IDENTITY_HASH_SECRET",
        DEFAULT_IDENTITY_HASH_SECRET
      ),
      clientIp || "127.0.0.1"
    );
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // CGNAT của mạng di động khiến nhiều người dùng chung một IP, nên mốc phải đủ rộng
    const dailyCap = Number(
      this.configService.get("ANONYMOUS_SIGNUP_DAILY_CAP", 20)
    );
    const createdFromIp = await this.userModel.countDocuments({
      isAnonymous: true,
      signupIpHash,
      createdAt: { $gte: since },
    });
    if (createdFromIp >= dailyCap) {
      throw new HttpException(
        {
          code: "DEVICE_SESSION_LIMIT_REACHED",
          message:
            "Đã đạt giới hạn tạo tài khoản khách từ mạng này. Vui lòng thử lại sau.",
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const session = await this.connection.startSession();
    let newUser: UserDocument | null = null;
    let liveUser: UserDocument | null = null;
    try {
      await session.withTransaction(async () => {
        newUser = null;
        liveUser = null;

        // Đọc lại trong transaction: lần retry sau xung đột phải thấy guest bên kia vừa tạo
        const current = await this.userModel
          .findOne({ deviceIdHash })
          .session(session);
        if (current && !current.deletedAt) {
          liveUser = current;
          return;
        }

        // Guest mới có _id riêng nên không thừa hưởng dữ liệu của bản ghi đã xoá. Hash được chuyển
        // sang field khác để nhường unique index; đánh dấu trên `devices` vẫn giữ nguyên.
        if (current) {
          await this.userModel.updateOne(
            { _id: current._id },
            { $set: { deviceIdHash: null, deletedDeviceIdHash: deviceIdHash } },
            { session }
          );
          // Lượt nhập trước khi có dấu thiết bị chỉ truy được qua hash vừa chuyển đi
          if (await this.referralModel.exists({ refereeId: current._id }).session(session)) {
            await this.deviceModel.updateOne(
              { deviceIdHash, referralRedeemedAt: null },
              {
                $set: {
                  referralRedeemedAt: new Date(),
                  referralRedeemedUserId: current._id,
                },
              },
              { session }
            );
          }
        }

        newUser = await this.createUserWithBonus(
          {
            displayName: "Khách",
            isAnonymous: true,
            deviceIdHash,
            signupIpHash,
          },
          !!current,
          session
        );
      });
    } catch (error: any) {
      // Hai lần mở app cùng lúc trên cùng thiết bị: một bên đã tạo xong trước
      if (error?.code === 11000) {
        const raced = await this.userModel.findOne({ deviceIdHash });
        if (raced && !raced.deletedAt) return this.createAuthSession(raced, false);
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (liveUser) return this.createAuthSession(liveUser, false);
    return this.createAuthSession(newUser!, true);
  }

  private hashDeviceId(value: string): string {
    return computeDeviceIdHash(
      this.configService.get<string>(
        "IDENTITY_HASH_SECRET",
        DEFAULT_IDENTITY_HASH_SECRET
      ),
      value
    );
  }

  async generateReferralCode(session?: ClientSession): Promise<string> {
    for (let attempts = 0; attempts < 20; attempts++) {
      const bytes = crypto.randomBytes(8);
      const code = Array.from(
        bytes,
        (b) => REFERRAL_CHARSET[b % REFERRAL_CHARSET.length]
      ).join("");
      const query = this.userModel.exists({ referralCode: code });
      if (session) query.session(session);
      if (!(await query)) return code;
    }
    throw new Error("Could not generate unique referral code");
  }

  async refresh(
    rawRefreshToken?: string
  ): Promise<{ tokens: RefreshTokenResponseDto; rawRefreshToken: string }> {
    if (!rawRefreshToken) throw unauthenticated();
    const refreshTokenHash = this.hashToken(rawRefreshToken);
    const now = new Date();

    const claimed = await this.sessionModel.findOneAndUpdate(
      { refreshTokenHash, revokedAt: null, expiresAt: { $gt: now } },
      { $set: { revokedAt: now } }
    );

    if (!claimed) {
      const rotated = await this.sessionModel.findOne({
        refreshTokenHash,
        revokedAt: { $ne: null },
      });
      if (rotated)
        await this.sessionModel.deleteMany({ userId: rotated.userId });
      throw unauthenticated();
    }

    const user = await this.userModel.findOne({
      _id: claimed.userId,
      deletedAt: null,
    });
    if (!user) {
      await this.sessionModel.deleteOne({ _id: claimed._id });
      throw unauthenticated();
    }

    const {
      accessToken,
      expiresIn,
      rawRefreshToken: newRawRefreshToken,
    } = await this.issueTokens(user);
    return {
      tokens: { accessToken, expiresIn },
      rawRefreshToken: newRawRefreshToken,
    };
  }

  private hashToken(rawToken: string): string {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
  }

  private async createUserWithBonus(
    data: Partial<User>,
    isDeletedIdentity: boolean,
    session: ClientSession
  ): Promise<UserDocument> {
    const referralCode = await this.generateReferralCode(session);

    let canGrantStarter = !isDeletedIdentity;
    const deviceIdHash = data.deviceIdHash;
    const signupIpHash = data.signupIpHash;

    if (canGrantStarter && deviceIdHash) {
      const existingDevice = await this.deviceModel
        .findOne({ deviceIdHash })
        .session(session);
      if (existingDevice && existingDevice.starterGrantedAt) {
        canGrantStarter = false;
      }
    }

    if (canGrantStarter && signupIpHash) {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const starterNetworkDailyCap = Number(
        this.configService.get(
          "STARTER_NETWORK_DAILY_CAP",
          ECONOMY_DEFAULTS.STARTER_NETWORK_DAILY_CAP
        )
      );
      const networkGrantsCount = await this.userModel
        .countDocuments({
          signupIpHash,
          starterGrantedAt: { $gte: since24h },
        })
        .session(session);

      if (networkGrantsCount >= starterNetworkDailyCap) {
        canGrantStarter = false;
      }
    }

    const [newUser] = await this.userModel.create(
      [
        {
          ...data,
          referralCode,
          creditBalance: 0,
          referralBlocked: isDeletedIdentity,
          starterGrantedAt: null,
        },
      ],
      { session }
    );

    if (canGrantStarter) {
      const bonusTx = await this.creditLedgerService.grantSignupBonus(newUser._id, session);
      newUser.creditBalance = bonusTx.balanceAfter;
      newUser.starterGrantedAt = new Date();
      if (deviceIdHash) {
        await this.deviceModel.updateOne(
          { deviceIdHash },
          {
            $set: {
              deviceIdHash,
              starterGrantedAt: new Date(),
              starterUserId: newUser._id,
              starterIpHash: signupIpHash || null,
            },
          },
          { upsert: true, session }
        );
      }
    } else if (deviceIdHash) {
      await this.deviceModel.updateOne(
        { deviceIdHash },
        {
          $setOnInsert: {
            deviceIdHash,
            starterGrantedAt: null,
            starterUserId: null,
            starterIpHash: signupIpHash || null,
          },
        },
        { upsert: true, session }
      );
    }

    return newUser;
  }

  private async createAuthSession(
    user: UserDocument,
    isNewUser: boolean
  ): Promise<{ authResponse: AuthResponseDto; rawRefreshToken: string }> {
    const { accessToken, expiresIn, rawRefreshToken } = await this.issueTokens(
      user
    );

    return {
      authResponse: {
        accessToken,
        expiresIn,
        isNewUser,
        user: {
          id: user._id.toString(),
          displayName: user.displayName,
          username: user.username ?? null,
          avatarUrl: user.avatarUrl ?? null,
          creditBalance: user.creditBalance,
          referralCode: user.referralCode,
        },
      },
      rawRefreshToken,
    };
  }

  private async issueTokens(
    user: UserDocument
  ): Promise<{
    accessToken: string;
    expiresIn: number;
    rawRefreshToken: string;
  }> {
    const rawRefreshToken = crypto.randomBytes(32).toString("base64url");
    const refreshTokenHash = this.hashToken(rawRefreshToken);
    const refreshTtlDays = Number(
      this.configService.get("REFRESH_TOKEN_TTL_DAYS", 30)
    );
    const sessionExpiresAt = new Date(
      Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000
    );

    const authSession = await this.sessionModel.create({
      userId: user._id,
      refreshTokenHash,
      expiresAt: sessionExpiresAt,
    });

    const jwtTtl = Number(
      this.configService.get("JWT_ACCESS_TTL_SECONDS", 900)
    );
    const accessToken = this.jwtService.sign(
      {
        sub: user._id.toString(),
        sid: authSession._id.toString(),
        email: user.email,
        username: user.username,
      },
      { expiresIn: jwtTtl }
    );

    return { accessToken, expiresIn: jwtTtl, rawRefreshToken };
  }
}
