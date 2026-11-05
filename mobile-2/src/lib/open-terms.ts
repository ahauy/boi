import * as WebBrowser from 'expo-web-browser';

import { ADS_CONFIG } from '../ads/ads-config';
import { runExternalActivity } from './external-activity';

/**
 * Opens the terms of service in the in-app browser.
 * The URL always exists (ads-config holds the web root). Returns false when the browser
 * could not be opened so the caller can show an error.
 */
export async function openTerms(): Promise<boolean> {
  const url = ADS_CONFIG.urls.terms;
  if (!url) return false;
  try {
    await runExternalActivity('browser', () => WebBrowser.openBrowserAsync(url));
    return true;
  } catch {
    return false;
  }
}
