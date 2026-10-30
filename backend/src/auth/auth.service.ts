import {
  Injectable,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { InjectModel, InjectConnection } from "@nestjs/mongoose";
import { Model, Connection, ClientSession } from "mongoose";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as crypto from "crypto";
import * as argon2 from "argon2";

import {
  RegisterRequestDto,
  RegisterResponseDto,
  ResendVerificationRequestDto,
  LoginRequestDto,
  AuthResponseDto,
  RefreshTokenResponseDto,
  CreditTransactionType,
  ReferralStatus,
  CREDIT_AMOUNTS,
  AuthProvider,
  DeletedIdentityKind,
  ReadingStatus,
} from "@palmsight/shared";

import {
  PendingRegistration,
  PendingRegistrationDocument,
} from "../schemas/pending-registration.schema";
import { User, UserDocument } from "../schemas/user.schema";
import { Session, SessionDocument } from "../schemas/session.schema";
import { Referral, ReferralDocument } from "../schemas/referral.schema";
import {
  DeletedIdentity,
  DeletedIdentityDocument,
} from "../schemas/deleted-identity.schema";
import { Reading, ReadingDocument } from "../schemas/reading.schema";
import { GuestTrial, GuestTrialDocument } from "../schemas/guest-trial.schema";
import { MailService } from "../mail/mail.service";
import { CreditLedgerService } from "../credits/credit-ledger.service";
import type { GoogleProfile } from "./google-auth.verifier";
import type { FacebookProfile } from "./facebook-auth.verifier";
import { unauthenticated } from "./guards/jwt-auth.guard";

const REFERRAL_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AuthService {
  private readonly failedLogins = new Map<string, number[]>();

  constructor(
    @InjectModel(PendingRegistration.name)
    private readonly pendingModel: Model<PendingRegistrationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Referral.name)
    private readonly referralModel: Model<ReferralDocument>,
    @InjectModel(DeletedIdentity.name)
    private readonly deletedIdentityModel: Model<DeletedIdentityDocument>,
    @InjectModel(Reading.name)
    private readonly readingModel: Model<ReadingDocument>,
    @InjectModel(GuestTrial.name)
    private readonly guestTrialModel: Model<GuestTrialDocument>,
    private readonly mailService: MailService,
    private readonly creditLedgerService: CreditLedgerService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectConnection() private readonly connection: Connection
  ) {}

  private checkLoginRateLimit(key: string): void {
    const now = Date.now();
    const timestamps = (this.failedLogins.get(key) ?? []).filter(
      (t) => now - t < 15 * 60 * 1000
    );
    if (timestamps.length >= 5) {
      throw new HttpException(
        {
          code: "RATE_LIMITED",
          message:
            "Bạn đã gửi quá số lần cho phép. Vui lòng thử lại sau ít phút.",
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    if (timestamps.length) this.failedLogins.set(key, timestamps);
    else this.failedLogins.delete(key);
  }

  private recordFailedLogin(key: string): void {
    const now = Date.now();
    const timestamps = (this.failedLogins.get(key) ?? []).filter(
      (t) => now - t < 15 * 60 * 1000
    );
    timestamps.push(now);
    this.failedLogins.set(key, timestamps);
  }

  async login(
    dto: LoginRequestDto,
    currentRefreshToken?: string,
    clientIp?: string
  ): Promise<{ authResponse: AuthResponseDto; rawRefreshToken: string }> {
    const normalizedLogin = dto.login.trim().toLowerCase();
    const rateLimitKey = `${clientIp || "127.0.0.1"}:${normalizedLogin}`;
    this.checkLoginRateLimit(rateLimitKey);

    const isEmail = normalizedLogin.includes("@");
    const user = await this.userModel.findOne(
      isEmail ? { email: normalizedLogin } : { username: normalizedLogin }
    );

    if (
      user &&
      !user.deletedAt &&
      user.passwordHash &&
      (await this.verifyPassword(dto.password, user.passwordHash))
    ) {
      this.failedLogins.delete(rateLimitKey);
      await this.revokeSession(currentRefreshToken);
      return this.createAuthSession(user, false);
    }

    const pending = await this.pendingModel.findOne({
      $or: [{ email: normalizedLogin }, { username: normalizedLogin }],
      expiresAt: { $gt: new Date() },
    });
    if (
      pending &&
      (await this.verifyPassword(dto.password, pending.passwordHash))
    ) {
      throw new ForbiddenException({
        code: "EMAIL_NOT_VERIFIED",
        message: "Tài khoản chưa được xác minh email.",
        details: { email: pending.email },
      });
    }

    this.recordFailedLogin(rateLimitKey);
    throw new UnauthorizedException({
      code: "INVALID_CREDENTIALS",
      message: "Thông tin đăng nhập không chính xác.",
    });
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  generateVerificationToken(): { rawToken: string; tokenHash: string } {
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    return { rawToken, tokenHash };
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

  async register(dto: RegisterRequestDto): Promise<RegisterResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();
    const displayName = dto.displayName.trim();
    const referralCode = dto.referralCode
      ? dto.referralCode.trim().toUpperCase()
      : null;

    const existingUser = await this.userModel.findOne({
      $or: [{ email }, { username }],
    });
    if (existingUser) {
      if (existingUser.email === email) {
        const message = existingUser.passwordHash
          ? "Email này đã được sử dụng."
          : "Email này đã được liên kết với tài khoản Google hoặc Facebook. Vui lòng đăng nhập.";
        throw new ConflictException({ code: "EMAIL_TAKEN", message });
      }
      if (existingUser.username === username) {
        throw new ConflictException({
          code: "USERNAME_TAKEN",
          message: "Tên người dùng đã được sử dụng.",
        });
      }
    }

    const pendingWithUsername = await this.pendingModel.findOne({
      username,
      email: { $ne: email },
      expiresAt: { $gt: new Date() },
    });
    if (pendingWithUsername) {
      throw new ConflictException({
        code: "USERNAME_TAKEN",
        message: "Tên người dùng đã được sử dụng.",
      });
    }

    const passwordHash = await this.hashPassword(dto.password);
    const { rawToken, tokenHash } = this.generateVerificationToken();
    const ttlHours = Number(
      this.configService.get("EMAIL_VERIFY_TTL_HOURS", 24)
    );
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    const claimToken = dto.claimToken ? dto.claimToken.trim() : null;

    try {
      await this.pendingModel.findOneAndUpdate(
        { email },
        {
          email,
          username,
          displayName,
          passwordHash,
          tokenHash,
          expiresAt,
          referralCode,
          claimToken,
          lastSentAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error: any) {
      this.handleDuplicateKey(error);
      throw error;
    }

    await this.mailService.sendVerificationEmail(email, displayName, rawToken);
    return { email, verificationExpiresAt: expiresAt.toISOString() };
  }

  async resendVerification(dto: ResendVerificationRequestDto): Promise<void> {
    const email = dto.email.trim().toLowerCase();
    const pending = await this.pendingModel.findOne({
      email,
      expiresAt: { $gt: new Date() },
    });
    if (!pending) return;

    const { rawToken, tokenHash } = this.generateVerificationToken();
    const ttlHours = Number(
      this.configService.get("EMAIL_VERIFY_TTL_HOURS", 24)
    );
    pending.tokenHash = tokenHash;
    pending.expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    pending.lastSentAt = new Date();
    await pending.save();

    await this.mailService.sendVerificationEmail(
      email,
      pending.displayName,
      rawToken
    );
  }

  async verifyEmail(
    token: string,
    explicitClaimToken?: string
  ): Promise<{ authResponse: AuthResponseDto; rawRefreshToken: string }> {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const session = await this.connection.startSession();
    session.startTransaction();

    let verifiedUser: UserDocument;
    let isNewUser = false;
    let claimedReadingId: string | null = null;
    let claimFailed: boolean | undefined = undefined;

    try {
      const pending = await this.pendingModel
        .findOne({ tokenHash, expiresAt: { $gt: new Date() } })
        .session(session);

      if (!pending) {
        throw new BadRequestException({
          code: "VERIFICATION_TOKEN_INVALID",
          message: "Liên kết xác minh không hợp lệ hoặc đã hết hạn.",
        });
      }

      const existingUser = await this.userModel
        .findOne({ email: pending.email })
        .session(session);

      if (existingUser) {
        if (existingUser.passwordHash) {
          throw new ConflictException({
            code: "EMAIL_TAKEN",
            message: "Email này đã được sử dụng.",
          });
        }
        existingUser.username = pending.username;
        existingUser.passwordHash = pending.passwordHash;
        existingUser.passwordUpdatedAt = new Date();
        await existingUser.save({ session });
        verifiedUser = existingUser;
      } else {
        const isDeleted = await this.isDeletedIdentity(
          [{ kind: DeletedIdentityKind.EMAIL, value: pending.email }],
          session
        );
        const newUser = await this.createUserWithBonus(
          {
            displayName: pending.displayName,
            username: pending.username,
            email: pending.email,
            passwordHash: pending.passwordHash,
            passwordUpdatedAt: new Date(),
          },
          isDeleted,
          session
        );

        if (!isDeleted && pending.referralCode) {
          await this.processReferralReward(
            newUser,
            pending.referralCode,
            session
          );
        }

        verifiedUser = newUser;
        isNewUser = true;
      }

      const claimToken = explicitClaimToken || pending.claimToken;
      if (claimToken) {
        const claimResult = await this.handleTrialClaim(
          verifiedUser,
          claimToken,
          session
        );
        if (claimResult) {
          claimedReadingId = claimResult.claimedReadingId;
          claimFailed = claimResult.claimFailed;
        }
      }

      await this.pendingModel.deleteOne({ _id: pending._id }).session(session);
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      this.handleVerificationError(error);
    } finally {
      await session.endSession();
    }

    return this.createAuthSession(
      verifiedUser!,
      isNewUser,
      claimedReadingId,
      claimFailed
    );
  }

  async googleLogin(
    profile: GoogleProfile,
    currentRefreshToken?: string,
    claimToken?: string,
    isRetry = false
  ): Promise<{ authResponse: AuthResponseDto; rawRefreshToken: string }> {
    return this.socialLogin(
      AuthProvider.GOOGLE,
      DeletedIdentityKind.GOOGLE,
      "Người dùng Google",
      profile,
      currentRefreshToken,
      claimToken,
      isRetry
    );
  }

  async facebookLogin(
    profile: FacebookProfile,
    currentRefreshToken?: string,
    claimToken?: string,
    isRetry = false
  ): Promise<{ authResponse: AuthResponseDto; rawRefreshToken: string }> {
    return this.socialLogin(
      AuthProvider.FACEBOOK,
      DeletedIdentityKind.FACEBOOK,
      "Người dùng Facebook",
      profile,
      currentRefreshToken,
      claimToken,
      isRetry
    );
  }

  private async socialLogin(
    provider: AuthProvider,
    deletedIdentityKind: DeletedIdentityKind,
    defaultDisplayName: string,
    profile: GoogleProfile | FacebookProfile,
    currentRefreshToken?: string,
    claimToken?: string,
    isRetry = false
  ): Promise<{ authResponse: AuthResponseDto; rawRefreshToken: string }> {
    if (!isRetry) await this.revokeSession(currentRefreshToken);

    const session = await this.connection.startSession();
    session.startTransaction();

    let user: UserDocument;
    let isNewUser = false;
    let claimedReadingId: string | null = null;
    let claimFailed: boolean | undefined = undefined;

    try {
      const linkedUser = await this.userModel
        .findOne({
          identities: { $elemMatch: { provider, providerUserId: profile.sub } },
          deletedAt: null,
        })
        .session(session);

      const verifiedEmail = profile.emailVerified ? profile.email : null;
      const emailUser =
        !linkedUser && verifiedEmail
          ? await this.userModel
              .findOne({ email: verifiedEmail, deletedAt: null })
              .session(session)
          : null;

      if (linkedUser) {
        if (profile.picture) linkedUser.avatarUrl = profile.picture;
        await linkedUser.save({ session });
        user = linkedUser;
      } else if (emailUser) {
        emailUser.identities.push({
          provider,
          providerUserId: profile.sub,
          email: verifiedEmail,
          linkedAt: new Date(),
        });
        if (!emailUser.avatarUrl && profile.picture)
          emailUser.avatarUrl = profile.picture;
        await emailUser.save({ session });
        user = emailUser;
      } else {
        const deletedChecks = [
          { kind: deletedIdentityKind, value: profile.sub },
        ];
        if (verifiedEmail)
          deletedChecks.push({
            kind: DeletedIdentityKind.EMAIL,
            value: verifiedEmail,
          });
        const isDeleted = await this.isDeletedIdentity(deletedChecks, session);

        const fallbackName = verifiedEmail?.split("@")[0] || defaultDisplayName;
        user = await this.createUserWithBonus(
          {
            displayName: (profile.name?.trim() || fallbackName).slice(0, 50),
            email: verifiedEmail,
            avatarUrl: profile.picture,
            identities: [
              {
                provider,
                providerUserId: profile.sub,
                email: verifiedEmail,
                linkedAt: new Date(),
              },
            ],
          },
          isDeleted,
          session
        );
        isNewUser = true;
      }

      if (claimToken) {
        const claimResult = await this.handleTrialClaim(
          user,
          claimToken,
          session
        );
        if (claimResult) {
          claimedReadingId = claimResult.claimedReadingId;
          claimFailed = claimResult.claimFailed;
        }
      }

      await session.commitTransaction();
    } catch (error: any) {
      await session.abortTransaction();
      if (
        !isRetry &&
        (error?.code === 11000 ||
          error?.hasErrorLabel?.("TransientTransactionError"))
      ) {
        return this.socialLogin(
          provider,
          deletedIdentityKind,
          defaultDisplayName,
          profile,
          undefined,
          claimToken,
          true
        );
      }
      throw error;
    } finally {
      await session.endSession();
    }

    return this.createAuthSession(
      user,
      isNewUser,
      claimedReadingId,
      claimFailed
    );
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

  async logout(rawRefreshToken?: string): Promise<void> {
    await this.revokeSession(rawRefreshToken);
  }

  private async revokeSession(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) return;
    await this.sessionModel.deleteOne({
      refreshTokenHash: this.hashToken(rawRefreshToken),
    });
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
    const [newUser] = await this.userModel.create(
      [
        {
          ...data,
          referralCode,
          creditBalance: isDeletedIdentity ? 0 : CREDIT_AMOUNTS.SIGNUP_BONUS,
          referralBlocked: isDeletedIdentity,
        },
      ],
      { session }
    );

    if (!isDeletedIdentity) {
      await this.creditLedgerService.recordWithSession(
        {
          userId: newUser._id,
          amount: CREDIT_AMOUNTS.SIGNUP_BONUS,
          type: CreditTransactionType.SIGNUP_BONUS,
          balanceAfter: CREDIT_AMOUNTS.SIGNUP_BONUS,
        },
        session
      );
    }

    return newUser;
  }

  private identityHmac(kind: DeletedIdentityKind, value: string): string {
    const secret = this.configService.get<string>(
      "IDENTITY_HASH_SECRET",
      "palmsight-identity-secret"
    );
    const input =
      kind === DeletedIdentityKind.EMAIL
        ? value.toLowerCase()
        : `${kind}:${value}`;
    return crypto.createHmac("sha256", secret).update(input).digest("hex");
  }

  private async isDeletedIdentity(
    identities: Array<{ kind: DeletedIdentityKind; value: string }>,
    session: ClientSession
  ): Promise<boolean> {
    const hmacs = identities.map(({ kind, value }) =>
      this.identityHmac(kind, value)
    );
    const exists = await this.deletedIdentityModel
      .exists({ valueHmac: { $in: hmacs } })
      .session(session);
    return !!exists;
  }

  private async processReferralReward(
    referee: UserDocument,
    referralCode: string,
    session: ClientSession
  ): Promise<void> {
    const referrer = await this.userModel
      .findOne({ referralCode })
      .session(session);
    if (!referrer || referrer._id.toString() === referee._id.toString()) return;

    referee.creditBalance += CREDIT_AMOUNTS.REFEREE_REWARD;
    await referee.save({ session });
    await this.creditLedgerService.recordWithSession(
      {
        userId: referee._id,
        amount: CREDIT_AMOUNTS.REFEREE_REWARD,
        type: CreditTransactionType.REFEREE_BONUS,
        balanceAfter: referee.creditBalance,
      },
      session
    );

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayRewarded = await this.referralModel
      .countDocuments({
        referrerId: referrer._id,
        status: ReferralStatus.REWARDED,
        createdAt: { $gte: todayStart },
      })
      .session(session);
    const dailyCap = Number(
      this.configService.get(
        "REFERRAL_DAILY_CAP",
        CREDIT_AMOUNTS.REFERRAL_DAILY_CAP
      )
    );

    if (todayRewarded >= dailyCap) {
      await this.referralModel.create(
        [
          {
            referrerId: referrer._id,
            refereeId: referee._id,
            codeUsed: referralCode,
            status: ReferralStatus.CAPPED,
          },
        ],
        { session }
      );
      return;
    }

    referrer.creditBalance += CREDIT_AMOUNTS.REFERRAL_REWARD;
    await referrer.save({ session });
    const [referralDoc] = await this.referralModel.create(
      [
        {
          referrerId: referrer._id,
          refereeId: referee._id,
          codeUsed: referralCode,
          status: ReferralStatus.REWARDED,
        },
      ],
      { session }
    );
    await this.creditLedgerService.recordWithSession(
      {
        userId: referrer._id,
        amount: CREDIT_AMOUNTS.REFERRAL_REWARD,
        type: CreditTransactionType.REFERRAL_BONUS,
        balanceAfter: referrer.creditBalance,
        referralId: referralDoc._id,
      },
      session
    );
  }

  private async handleTrialClaim(
    verifiedUser: UserDocument,
    claimToken: string,
    session: ClientSession
  ): Promise<{ claimedReadingId: string | null; claimFailed: boolean } | null> {
    if (!UUID_V4_REGEX.test(claimToken)) {
      return { claimedReadingId: null, claimFailed: true };
    }

    const guestTokenHash = crypto
      .createHash("sha256")
      .update(claimToken)
      .digest("hex");
    const trialReading = await this.readingModel
      .findOne({
        guestTokenHash,
        status: ReadingStatus.GUEST_PREVIEW,
        previewExpiresAt: { $gt: new Date() },
      })
      .session(session);

    if (!trialReading) {
      return { claimedReadingId: null, claimFailed: true };
    }

    await this.creditLedgerService.spendForReading(
      verifiedUser._id,
      trialReading._id,
      session
    );

    trialReading.userId = verifiedUser._id;
    trialReading.claimedByUserId = verifiedUser._id;
    trialReading.claimedAt = new Date();
    trialReading.status = ReadingStatus.DONE;
    trialReading.previewExpiresAt = null;
    await trialReading.save({ session });

    await this.guestTrialModel.updateOne(
      { guestTokenHash },
      {
        $set: {
          isClaimed: true,
          claimedByUserId: verifiedUser._id,
          claimedAt: new Date(),
        },
      },
      { session }
    );

    verifiedUser.creditBalance -= CREDIT_AMOUNTS.READING_COST;
    return {
      claimedReadingId: trialReading._id.toString(),
      claimFailed: false,
    };
  }

  private async createAuthSession(
    user: UserDocument,
    isNewUser: boolean,
    claimedReadingId?: string | null,
    claimFailed?: boolean
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
        ...(claimedReadingId !== undefined ? { claimedReadingId } : {}),
        ...(claimFailed ? { claimFailed: true } : {}),
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

  private handleDuplicateKey(err: any): void {
    if (err?.code === 11000) {
      if (err.keyPattern?.username || err.message?.includes("username")) {
        throw new ConflictException({
          code: "USERNAME_TAKEN",
          message: "Tên người dùng đã được sử dụng.",
        });
      }
      if (err.keyPattern?.email || err.message?.includes("email")) {
        throw new ConflictException({
          code: "EMAIL_TAKEN",
          message: "Email này đã được sử dụng.",
        });
      }
    }
  }

  private handleVerificationError(error: any): never {
    this.handleDuplicateKey(error);
    if (
      error?.code === 112 ||
      error?.code === 24 ||
      error?.hasErrorLabel?.("TransientTransactionError")
    ) {
      throw new BadRequestException({
        code: "VERIFICATION_TOKEN_INVALID",
        message: "Liên kết xác minh không hợp lệ hoặc đã hết hạn.",
      });
    }
    throw error;
  }
}
