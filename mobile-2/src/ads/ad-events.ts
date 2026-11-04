/**
 * Central Ad Events Dispatcher (Playbook §2.1, §11.1)
 *
 * Pitfall 1: SDK listeners are global. MAX keeps one listener per event per format.
 * This module registers each SDK listener ONCE and dispatches by adUnitId.
 * Each subscriber is wrapped in try/catch to isolate failures.
 */

export interface AdInfo {
  adUnitId: string;
  adFormat?: string;
  networkName?: string;
  networkPlacement?: string;
  creativeId?: string;
  placement?: string;
  revenue?: number;
  revenuePrecision?: string;
  dspName?: string;
}

export interface AdError {
  code: number;
  message: string;
  adLoadFailureInfo?: string;
}

export interface AdRewardItem {
  label: string;
  amount: number;
}

export type AdEventType =
  | 'loaded'
  | 'load_failed'
  | 'displayed'
  | 'display_failed'
  | 'hidden'
  | 'clicked'
  | 'revenue_paid'
  | 'user_rewarded';

export type AdEventFormat = 'banner' | 'interstitial' | 'rewarded' | 'native' | 'mrec';

type AdEventListener = (...args: any[]) => void;

const listeners = new Map<string, Set<AdEventListener>>();

function buildKey(format: AdEventFormat, adUnitId: string, event: AdEventType): string {
  return `${format}:${adUnitId.toLowerCase()}:${event}`;
}

/**
 * Subscribe to an ad event for a specific format and adUnitId.
 * Returns an unsubscribe function.
 */
export function subscribeAdEvent(
  format: AdEventFormat,
  adUnitId: string,
  event: AdEventType,
  listener: AdEventListener
): () => void {
  const key = buildKey(format, adUnitId, event);
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);

  return () => {
    const current = listeners.get(key);
    if (current) {
      current.delete(listener);
      if (current.size === 0) {
        listeners.delete(key);
      }
    }
  };
}

/**
 * Dispatches an event received from the SDK to all matching registered subscribers.
 * Wraps each subscriber execution in try/catch (Pitfall §11.1).
 */
export function dispatchAdEvent(
  format: AdEventFormat,
  adUnitId: string,
  event: AdEventType,
  ...args: any[]
): void {
  const key = buildKey(format, adUnitId, event);
  const matched = listeners.get(key);
  if (!matched || matched.size === 0) {
    return;
  }

  for (const fn of [...matched]) {
    try {
      fn(...args);
    } catch (err) {
      // Isolate subscriber error without breaking other listeners
      if (typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production') {
        console.warn(`[AdEvents] Listener error for ${key}:`, err);
      }
    }
  }
}

/**
 * Resets all listeners (for unit testing).
 */
export function resetAdEvents(): void {
  listeners.clear();
}
