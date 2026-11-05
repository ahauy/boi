import { MongoMemoryReplSet } from "mongodb-memory-server";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";

import { ApiExceptionFilter } from "../src/common/filters/api-exception.filter";
import { AuthModule } from "../src/auth/auth.module";
import { UsersModule } from "../src/users/users.module";
import { CreditsModule } from "../src/credits/credits.module";
import { HealthModule } from "../src/health/health.module";
import { ReadingsModule } from "../src/readings/readings.module";
import { AppConfigModule } from "../src/config/app-config.module";
import { CurrencyModule } from "../src/currency/currency.module";
import { BillingModule } from "../src/billing/billing.module";
import { MailService } from "../src/mail/mail.service";
import { GoogleAuthVerifier } from "../src/auth/google-auth.verifier";
import { FacebookAuthVerifier } from "../src/auth/facebook-auth.verifier";
import { ReferralNetworkCounter } from "../src/schemas/referral-network-counter.schema";

export interface TestAppInstance {
  app: INestApplication;
  baseUrl: string;
  replSet: MongoMemoryReplSet;
  connection: mongoose.Connection;
  sentEmails: Array<{ to: string; displayName: string; rawToken: string }>;
  sentResetEmails: Array<{ to: string; displayName: string; rawToken: string }>;
  mailServiceMock: {
    sendVerificationEmail: (
      to: string,
      displayName: string,
      rawToken: string
    ) => Promise<void>;
    sendPasswordResetEmail: (
      to: string,
      displayName: string,
      rawToken: string
    ) => Promise<void>;
  };
}

export interface TestAppOptions {
  googleVerifier?: Pick<GoogleAuthVerifier, "verify"> &
    Partial<Pick<GoogleAuthVerifier, "verifyCode">>;
  facebookVerifier?: Pick<FacebookAuthVerifier, "verify">;
  /** Nơi test phục bộ khoá công khai giả để chạy thật logic xác minh chữ ký SSV. */
  rewardedAdsEnabled?: boolean;
  /** Bật cửa sau dev-grant, đường cấp credit không cần chữ ký dành cho máy dev. */
  starterGrant?: number;
  pricePerAction?: number;
  starterNetworkDailyCap?: number;
  anonymousSignupDailyCap?: number;
  referralNetworkDailyCap?: number;
}

export async function createTestApp(
  options: TestAppOptions = {}
): Promise<TestAppInstance> {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });

  try {
    return await startTestApp(replSet, options);
  } catch (error) {
    // Lỗi khởi động không tới được closeTestApp, nên phải dừng mongod ở đây
    await mongoose.disconnect().catch(() => undefined);
    await replSet.stop().catch(() => undefined);
    throw error;
  }
}

async function startTestApp(
  replSet: MongoMemoryReplSet,
  options: TestAppOptions
): Promise<TestAppInstance> {
  const mongoUri = replSet.getUri();

  const sentEmails: Array<{
    to: string;
    displayName: string;
    rawToken: string;
  }> = [];
  const sentResetEmails: Array<{
    to: string;
    displayName: string;
    rawToken: string;
  }> = [];
  const mailServiceMock = {
    sendVerificationEmail: async (
      to: string,
      displayName: string,
      rawToken: string
    ) => {
      sentEmails.push({ to, displayName, rawToken });
    },
    sendPasswordResetEmail: async (
      to: string,
      displayName: string,
      rawToken: string
    ) => {
      sentResetEmails.push({ to, displayName, rawToken });
    },
    renderVerificationEmailTemplate: (_params: any) => "mock-html",
  };

  let moduleBuilder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        // Không đọc backend/.env: test không được gọi dịch vụ thật như Cloudinary
        ignoreEnvFile: true,
        load: [
          () => ({
            MONGODB_URI: mongoUri,
            JWT_ACCESS_SECRET:
              "test-jwt-secret-palm-sight-at-least-32-chars-long",
            JWT_ACCESS_TTL_SECONDS: 900,
            REFRESH_TOKEN_TTL_DAYS: 30,
            EMAIL_VERIFY_TTL_HOURS: 24,
            IDENTITY_HASH_SECRET: "test-identity-secret-at-least-32-chars-long",
            SIGNUP_BONUS_CREDITS: options.starterGrant ?? 3,
            STARTER_GRANT: options.starterGrant ?? 3,
            READING_COST_CREDITS: options.pricePerAction ?? 1,
            PRICE_PER_ACTION: options.pricePerAction ?? 1,
            MAX_ACTIONS_PER_TAP: 5,
            STARTER_NETWORK_DAILY_CAP: options.starterNetworkDailyCap ?? 5,
            ANONYMOUS_SIGNUP_DAILY_CAP: options.anonymousSignupDailyCap ?? 3,
            REFERRAL_DAILY_CAP: 5,
            REFERRAL_NETWORK_DAILY_CAP: options.referralNetworkDailyCap ?? 5,
            // Request không gửi header này được coi là không có IP nên không tính giới hạn mạng.
            CLIENT_IP_HEADER: "cf-connecting-ip",
            PUBLIC_BASE_URL: "http://localhost:5173",
            GOOGLE_CLIENT_ID:
              "test-google-client-id.apps.googleusercontent.com",
            FACEBOOK_APP_ID: "test-facebook-app-id",
            FACEBOOK_APP_SECRET: "test-facebook-app-secret",
            REWARDED_ADS_ENABLED: options.rewardedAdsEnabled ? "true" : "false",
            NODE_ENV: "test",
            RTDN_PUSH_TOKEN: "test-rtdn-token",
          }),
        ],
      }),
      MongooseModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          uri: config.getOrThrow<string>("MONGODB_URI"),
          autoIndex: false,
        }),
      }),
      HealthModule,
      CreditsModule,
      AuthModule,
      UsersModule,
      ReadingsModule,
      AppConfigModule,
      CurrencyModule,
      BillingModule,
    ],
  })
    .overrideProvider(MailService)
    .useValue(mailServiceMock);

  if (options.googleVerifier) {
    moduleBuilder = moduleBuilder
      .overrideProvider(GoogleAuthVerifier)
      .useValue(options.googleVerifier);
  }

  if (options.facebookVerifier) {
    moduleBuilder = moduleBuilder
      .overrideProvider(FacebookAuthVerifier)
      .useValue(options.facebookVerifier);
  }

  const moduleRef: TestingModule = await moduleBuilder.compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser("ps-guest-trial-test-secret"));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.setGlobalPrefix("api/v1");
  await app.listen(0);

  const baseUrl = await app.getUrl();

  const connection = moduleRef.get<mongoose.Connection>(getConnectionToken());

  const collectionNames = [
    "pending_registrations",
    "users",
    "sessions",
    "referrals",
    "credit_transactions",
    "deleted_identities",
    "readings",
    "guest_trials",
    "rewarded_ad_claims",
    "devices",
    "ad_rewards",
    "play_subscriptions",
    "billing_events",
    "referral_network_counters",
  ];
  for (const col of collectionNames) {
    try {
      await connection.createCollection(col);
    } catch {
      continue;
    }
  }

  // autoIndex tắt, mà trần theo mạng cần unique index để upsert đồng thời không sinh hai bộ đếm.
  await connection.model(ReferralNetworkCounter.name).syncIndexes();

  return {
    app,
    baseUrl,
    replSet,
    connection,
    sentEmails,
    sentResetEmails,
    mailServiceMock,
  };
}

export async function closeTestApp(
  instance: TestAppInstance | undefined
): Promise<void> {
  if (!instance) return;
  if (instance.app) {
    await instance.app.close();
  }
  await mongoose.disconnect();
  if (instance.replSet) {
    await instance.replSet.stop();
  }
}
