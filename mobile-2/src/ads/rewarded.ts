import { AdRewardStatus } from '@palmsight/shared';
import type { AdRewardClaimResponseDto, AdRewardKind } from '@palmsight/shared';
import { ensureRewardedReady, showRewardedAd } from './ads-service';
import { runExternalActivity } from '../lib/external-activity';
import { ApiError } from '../lib/api';
import { claimAdReward, createAdReward, releaseAdReward } from '../earn/earn-api';

/**
 * Rewarded Ads Manager (Playbook §5.5)
 *
 * - `watch(placement, kind)`: the ticketed currency flow.
 * - `watchForAction(placement)`: Save/Share. Same ad steps, no ticket and no currency.
 *
 * Both share the "one rewarded at a time" lock.
 */

export type WatchStatus = 'rewarded' | 'capped' | 'no_ad' | 'closed' | 'refused';

export interface WatchResult {
  status: WatchStatus;
  /** Present for 'rewarded' and 'capped'. */
  claim?: AdRewardClaimResponseDto;
  /** Server error code and message for 'refused'. */
  errorCode?: string;
  errorMessage?: string;
}

export type ActionStatus = 'completed' | 'closed' | 'no_ad' | 'unmounted';

export type BalanceListener = (balance: number) => void;

let rewardedInProgress = false;
let balanceListener: BalanceListener | null = null;

/** The auth provider registers here so a claimed balance reaches the `/v1/me` cache at once. */
export function setRewardedBalanceListener(listener: BalanceListener | null): void {
  balanceListener = listener;
}

export function resetRewardedForTests(): void {
  rewardedInProgress = false;
  balanceListener = null;
}

function refusal(err: unknown): WatchResult {
  return {
    status: 'refused',
    errorCode: err instanceof ApiError ? err.code : undefined,
    errorMessage: err instanceof Error ? err.message : undefined,
  };
}

function retryAfterSeconds(err: unknown): number | null {
  if (!(err instanceof ApiError) || err.code !== 'ad_not_finished') return null;
  const retryAfter = Number(err.details.retryAfter);
  return Number.isFinite(retryAfter) ? Math.max(0, retryAfter) : null;
}

/** §5.5 step 4: `ad_not_finished` is retried once after `retryAfter`. */
async function claimWithRetry(ticketId: string): Promise<AdRewardClaimResponseDto> {
  try {
    return await claimAdReward(ticketId);
  } catch (err) {
    const retryAfter = retryAfterSeconds(err);
    if (retryAfter === null) throw err;
    await new Promise<void>((resolve) => setTimeout(resolve, retryAfter * 1000));
    return claimAdReward(ticketId);
  }
}

async function runTicketFlow(placement: string, kind: AdRewardKind): Promise<WatchResult> {
  if (!(await ensureRewardedReady())) {
    return { status: 'no_ad' };
  }

  let ticketId: string;
  try {
    ticketId = (await createAdReward(kind)).id;
  } catch (err) {
    return refusal(err);
  }

  let claimPromise = null as Promise<AdRewardClaimResponseDto> | null;
  const shown = await runExternalActivity('rewarded_ad', () =>
    showRewardedAd({
      placement,
      customData: ticketId,
      onReward: () => {
        claimPromise ??= claimWithRetry(ticketId);
      },
    })
  );

  if (!claimPromise) {
    await releaseAdReward(ticketId).catch(() => undefined);
    return { status: shown === 'failed' ? 'no_ad' : 'closed' };
  }

  try {
    const claim = await claimPromise;
    balanceListener?.(claim.balance);
    return { status: claim.status === AdRewardStatus.CAPPED ? 'capped' : 'rewarded', claim };
  } catch (err) {
    await releaseAdReward(ticketId).catch(() => undefined);
    return refusal(err);
  }
}

export async function watch(placement: string, kind: AdRewardKind): Promise<WatchResult> {
  if (rewardedInProgress) return { status: 'no_ad' };
  rewardedInProgress = true;
  try {
    return await runTicketFlow(placement, kind);
  } finally {
    rewardedInProgress = false;
  }
}

/** `beforeShow` runs right before the ad opens; returning false drops it (§5.5). */
export async function watchForAction(
  placement: string,
  beforeShow: () => boolean = () => true
): Promise<ActionStatus> {
  if (rewardedInProgress) return 'no_ad';
  rewardedInProgress = true;
  try {
    if (!(await ensureRewardedReady())) return 'no_ad';
    if (!beforeShow()) return 'unmounted';

    const shown = await runExternalActivity('rewarded_ad', () => showRewardedAd({ placement }));
    if (shown === 'rewarded') return 'completed';
    return shown === 'failed' ? 'no_ad' : 'closed';
  } finally {
    rewardedInProgress = false;
  }
}
