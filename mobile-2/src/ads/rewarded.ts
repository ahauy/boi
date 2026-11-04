import { showMaxRewarded } from './ads-service';
import { recordAdShown } from './ads-store';
import { runExternalActivity } from '../lib/external-activity';
import { createAdReward, claimAdReward, releaseAdReward } from '../earn/earn-api';

/**
 * Rewarded Ads Manager (Playbook §5.3, §5.5, §12 Phase 6)
 *
 * Implements two variants:
 * 1. `watch(placement, kind)`: Currency / streak restore flow with server-side nonce ticket
 * 2. `watchForAction(placement)`: Save/Share or wheel spin gate without currency tickets
 */

export const REWARDED_COOLDOWN_MS = 10_000;

export type RewardedKind = 'ad_reward' | 'streak_restore' | string;
export type ActionPlacement = 'lucky_wheel' | 'save_share' | string;

export interface WatchRewardedResult {
  success: boolean;
  claimed?: any;
  error?: string;
}

let lastAdRewardCompletedAt = 0;
let isRewardedShowing = false;

/**
 * Returns remaining milliseconds for client cooldown between `ad_reward` watches (§5.3).
 */
export function getRewardedCooldownRemainingMs(now: number = Date.now()): number {
  if (lastAdRewardCompletedAt <= 0) return 0;
  const elapsed = now - lastAdRewardCompletedAt;
  return elapsed < REWARDED_COOLDOWN_MS ? REWARDED_COOLDOWN_MS - elapsed : 0;
}

export function resetRewardedForTests(): void {
  lastAdRewardCompletedAt = 0;
  isRewardedShowing = false;
}

export function setLastAdRewardCompletedAtForTests(time: number): void {
  lastAdRewardCompletedAt = time;
}

/**
 * Currency flow for rewarded ads (§5.3, §5.5):
 * 1. When `kind === 'ad_reward'`, enforces 10s cooldown.
 * 2. Calls POST /api/v1/currency/ad-rewards ({ kind, placement }) -> { nonceId, expiresAt }.
 * 3. Shows MAX rewarded ad inside runExternalActivity('rewarded_ad') and calls recordAdShown().
 * 4. On rewarded === true -> claims nonce via POST /api/v1/currency/ad-rewards/:nonceId/claim.
 * 5. On early close / display failure -> cancels nonce via DELETE /api/v1/currency/ad-rewards/:nonceId.
 */
export async function watch(
  placement: string,
  kind: RewardedKind = 'ad_reward'
): Promise<WatchRewardedResult> {
  if (kind === 'ad_reward') {
    const remaining = getRewardedCooldownRemainingMs();
    if (remaining > 0) {
      throw new Error(`Rewarded cooldown active. Wait ${Math.ceil(remaining / 1000)}s.`);
    }
  }

  if (isRewardedShowing) {
    throw new Error('Another rewarded ad is already in progress');
  }

  // 1. Create ticket
  const ticket = await createAdReward(kind, placement);
  const nonceId = ticket.nonceId;
  if (!nonceId) {
    throw new Error('Failed to obtain ad reward nonce ticket');
  }

  isRewardedShowing = true;
  try {
    // 2. Show MAX ad
    const adResult = await runExternalActivity('rewarded_ad', async () => {
      recordAdShown();
      return await showMaxRewarded(placement);
    });

    // 3. Claim if completed
    if (adResult?.rewarded) {
      const claimResult = await claimAdReward(nonceId);
      if (kind === 'ad_reward') {
        lastAdRewardCompletedAt = Date.now();
      }
      return { success: true, claimed: claimResult };
    } else {
      // 4. Release if closed early
      await releaseAdReward(nonceId).catch(() => undefined);
      return { success: false, error: 'ad_closed_early' };
    }
  } catch (err) {
    await releaseAdReward(nonceId).catch(() => undefined);
    throw err;
  } finally {
    isRewardedShowing = false;
  }
}

/**
 * Action gate flow for rewarded ads (e.g. lucky wheel, save/share) (§5.3, §6.3):
 * Shows MAX rewarded ad inside runExternalActivity('rewarded_ad'), calls recordAdShown(),
 * and resolves { completed: boolean }.
 */
export async function watchForAction(
  placement: ActionPlacement
): Promise<{ completed: boolean }> {
  if (isRewardedShowing) {
    return { completed: false };
  }

  isRewardedShowing = true;
  try {
    const result = await runExternalActivity('rewarded_ad', async () => {
      recordAdShown();
      return await showMaxRewarded(placement);
    });
    return { completed: Boolean(result?.rewarded || result?.completed) };
  } finally {
    isRewardedShowing = false;
  }
}
