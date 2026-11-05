import { MongoMemoryReplSet } from "mongodb-memory-server";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import mongoose from "mongoose";
import * as crypto from "crypto";

import { ApiExceptionFilter } from "../src/common/filters/api-exception.filter";
import { AuthModule } from "../src/auth/auth.module";
import { UsersModule } from "../src/users/users.module";
import { CreditsModule } from "../src/credits/credits.module";
import { HealthModule } from "../src/health/health.module";
import { ReadingsModule } from "../src/readings/readings.module";
import { AppConfigModule } from "../src/config/app-config.module";
import { CurrencyModule } from "../src/currency/currency.module";
import { BillingModule } from "../src/billing/billing.module";
import { ReferralNetworkCounter } from "../src/schemas/referral-network-counter.schema";

export interface TestAppInstance {
  app: INestApplication;
  baseUrl: string;
  replSet: MongoMemoryReplSet;
  connection: mongoose.Connection;
}

export interface TestAppOptions {
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

  const moduleBuilder = Test.createTestingModule({
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
  });

  const moduleRef: TestingModule = await moduleBuilder.compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalFilters(new ApiExceptionFilter());
  app.setGlobalPrefix("api/v1");
  await app.listen(0);

  const baseUrl = await app.getUrl();

  const connection = moduleRef.get<mongoose.Connection>(getConnectionToken());

  const collectionNames = [
    "users",
    "sessions",
    "referrals",
    "credit_transactions",
    "deleted_identities",
    "readings",
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

export interface GuestSession {
  id: string;
  deviceId: string;
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
  user: {
    id: string;
    displayName: string;
    creditBalance: number;
    referralCode: string;
  };
}

/**
 * Mở phiên khách qua `/auth/device` như app thật (cách duy nhất còn lại để tạo người dùng).
 * Mỗi lần dùng một IP riêng để không chạm ANONYMOUS_SIGNUP_DAILY_CAP.
 */
export async function createGuest(
  instance: Pick<TestAppInstance, "baseUrl">,
  options: { deviceId?: string; ip?: string } = {}
): Promise<GuestSession> {
  const deviceId =
    options.deviceId ?? `android-${crypto.randomBytes(8).toString("hex")}`;
  const ip =
    options.ip ??
    `10.${crypto.randomInt(1, 250)}.${crypto.randomInt(1, 250)}.${crypto.randomInt(1, 250)}`;
  const res = await fetch(`${instance.baseUrl}/api/v1/auth/device`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client": "native",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({ deviceId }),
  });
  if (res.status !== 200) {
    throw new Error(`createGuest: /auth/device trả ${res.status}`);
  }
  const body = (await res.json()) as any;
  return {
    id: body.user.id,
    deviceId,
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    isNewUser: body.isNewUser,
    user: body.user,
  };
}
