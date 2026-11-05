import * as WebBrowser from 'expo-web-browser';

import { ADS_CONFIG } from '../ads/ads-config';
import { runExternalActivity } from './external-activity';

/**
 * Opens the privacy policy in the in-app browser.
 * The URL always exists (ads-config falls back to the default web root), so a tap never does nothing.
 * Returns false when the browser could not be opened so the caller can show an error.
 */
export async function openPrivacyPolicy(): Promise<boolean> {
  const url = ADS_CONFIG.urls.privacy;
  if (!url) return false;
  try {
    await runExternalActivity('browser', () => WebBrowser.openBrowserAsync(url));
    return true;
  } catch {
    return false;
  }
}
