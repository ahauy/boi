import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';

const DEFAULT_KEYS_URL = 'https://gstatic.com/admob/reward/verifier-keys.json';
/** Google xoay khoá định kỳ; quá 24 giờ là phải nạp lại, lấy mốc an toàn thấp hơn. */
const KEYS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SIGNATURE_PARAM = 'signature';
const KEY_ID_PARAM = 'key_id';

export interface ParsedSsvCallback {
  /** Toàn bộ query params đã giải mã, giữ theo đúng thứ tự trên URL gốc. */
  pairs: Array<[string, string]>;
  signature?: string;
  keyId?: string;
}

type HttpGet = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/**
 * Xác minh callback server-side verification (SSV) của AdMob cho rewarded ad.
 *
 * AdMob ký bằng ECDSA P-256/SHA-256 trên chính query string của callback, nên backend không giữ
 * secret nào cả — khoá để xác minh là khoá công khai Google phát hành công khai. Vì nội dung ký
 * là chuỗi truy vấn thô, mọi thứ phải đọc từ `req.url` chứ không từ `req.query`: bộ tách query
 * của Express có thể sắp xếp lại hoặc nhân đôi tham số, và chỉ cần một byte khác là chữ ký lệch.
 */
@Injectable()
export class RewardedAdSsvVerifier {
  private readonly logger = new Logger(RewardedAdSsvVerifier.name);
  private keys = new Map<string, string>();
  private keysFetchedAt = 0;

  // Không inject hàm fetch qua constructor: tham số kiểu hàm làm Nest hỏng quá trình resolve metadata
  private readonly httpGet: HttpGet = (url) => fetch(url);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Trả về `true` chỉ khi chữ ký khớp. Mọi lỗi (thiếu tham số, key_id lạ, không tải được khoá,
   * chữ ký sai) đều trả `false` để endpoint từ chối cấp credit — fail closed, vì phần thưởng ở
   * đây là credit thật và một lần bỏ qua là một lỗfarm.
   */
  async verifyCallback(rawUrl: string): Promise<ParsedSsvCallback | null> {
    const parsed = parseSsvUrl(rawUrl);
    if (!parsed.signature || !parsed.keyId) return null;

    const content = buildSignedContent(parsed.pairs);
    const publicKey = await this.getPublicKey(parsed.keyId);
    if (!publicKey) return null;

    return this.verifySignature(publicKey, parsed.signature, content) ? parsed : null;
  }

  /** `AD_SSV_KEYS_URL` chỉ để test đi qua một server giả; production dùng địa chỉ của Google. */
  private keysUrl(): string {
    return this.configService.get<string>('AD_SSV_KEYS_URL', DEFAULT_KEYS_URL);
  }

  private async getPublicKey(keyId: string): Promise<string | null> {
    const now = Date.now();
    if (!this.keys.size || now - this.keysFetchedAt > KEYS_CACHE_TTL_MS) {
      await this.refreshKeys(now);
    }

    const cached = this.keys.get(keyId);
    if (cached) return cached;

    // key_id lạ: nhiều khả năng Google vừa xoay khoá hơn là tấn công, nạp lại một lần rồi mới kết luận
    await this.refreshKeys(Date.now());
    return this.keys.get(keyId) ?? null;
  }

  private async refreshKeys(now: number): Promise<void> {
    try {
      const response = await this.httpGet(this.keysUrl());
      if (!response.ok) {
        this.logger.warn(`Không tải được khoá xác minh AdMob: HTTP ${response.status}`);
        return;
      }

      const payload = (await response.json()) as { keys?: Array<{ keyId?: number; pem?: string }> };
      const next = new Map<string, string>();
      for (const key of payload?.keys ?? []) {
        if (key.keyId !== undefined && typeof key.pem === 'string') {
          next.set(String(key.keyId), key.pem);
        }
      }

      if (next.size) {
        this.keys = next;
        this.keysFetchedAt = now;
      }
    } catch (error) {
      this.logger.warn(`Không tải được khoá xác minh AdMob: ${(error as Error).message}`);
    }
  }

  private verifySignature(publicKeyPem: string, signature: string, content: string): boolean {
    try {
      return crypto.verify(
        'sha256',
        Buffer.from(content, 'utf8'),
        crypto.createPublicKey(publicKeyPem),
        // AdMob gửi chữ ký base64url, DER; Buffer bỏ qua padding thiếu
        Buffer.from(signature, 'base64url')
      );
    } catch (error) {
      this.logger.debug(`Chữ ký SSV không parse được: ${(error as Error).message}`);
      return false;
    }
  }
}

/** Tách query string thô thành các cặp key/value đã giải mã. */
export function parseSsvUrl(rawUrl: string): ParsedSsvCallback {
  const queryStart = rawUrl.indexOf('?');
  const rawQuery = queryStart === -1 ? rawUrl : rawUrl.slice(queryStart + 1);
  const pairs: Array<[string, string]> = [];

  for (const segment of rawQuery.split('&')) {
    if (!segment) continue;
    const eq = segment.indexOf('=');
    const rawKey = eq === -1 ? segment : segment.slice(0, eq);
    const rawValue = eq === -1 ? '' : segment.slice(eq + 1);
    pairs.push([decode(rawKey), decode(rawValue)]);
  }

  const asRecord = new Map(pairs);
  return {
    pairs,
    signature: asRecord.get(SIGNATURE_PARAM),
    keyId: asRecord.get(KEY_ID_PARAM),
  };
}

/**
 * Nội dung ký: toàn bộ query params trừ `signature` và `key_id`, sắp xếp theo tên tham số,
 * giá trị đã giải mã, nối bằng `&`. Không có scheme/host/path.
 */
export function buildSignedContent(pairs: Array<[string, string]>): string {
  return pairs
    .filter(([key]) => key !== SIGNATURE_PARAM && key !== KEY_ID_PARAM)
    // Array.sort ổn định từ V8, nên các giá trị trùng tên giữ nguyên thứ tự trên URL gốc
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

function decode(value: string): string {
  try {
    // Không đổi '+' sang dấu cách: AdMob mã hoá khoảng trắng thành %20, nên '+' thô là ký tự thật
    return decodeURIComponent(value);
  } catch {
    // Chuỗi % độc hại tới từ attacker, không phải từ Google: giữ nguyên để chữ ký tự sai
    return value;
  }
}
