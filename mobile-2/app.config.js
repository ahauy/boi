const fs = require('fs');
const path = require('path');
const appJson = require('./app.json');
const { ADMOB_APP_ID, validateReleaseHygiene } = require('./plugins/withMonetization');

/**
 * Dynamic Expo Configuration (Playbook §1.2, §11.11)
 *
 * - Reads base configuration from app.json.
 * - Injects APPLOVIN_SDK_KEY from env into extra.applovinSdkKey (never hard-coded in source).
 * - Injects public AdMob App ID into AndroidManifest via `./plugins/withMonetization`.
 * - Enforces §11.11 production build hygiene: test device IDs empty in production, Adjust `production`.
 * - Wires `google-services.json` only if present on disk so builds succeed before Firebase file is added.
 */
module.exports = ({ config } = {}) => {
  const baseExpo = {
    ...appJson.expo,
    ...(config || {}),
  };

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.EAS_BUILD_PROFILE === 'production' ||
    process.env.EXPO_PUBLIC_ADJUST_ENVIRONMENT === 'production';

  const hygiene = validateReleaseHygiene(process.env, isProduction);
  const applovinSdkKey = process.env.APPLOVIN_SDK_KEY || '';

  // .env.local is git-ignored, so EAS workers only see variables set in EAS itself.
  if (process.env.EAS_BUILD === 'true' && isProduction && !applovinSdkKey) {
    throw new Error('APPLOVIN_SDK_KEY is not set in EAS for this production build');
  }

  const googleServicesPath = path.resolve(__dirname, 'google-services.json');
  const hasGoogleServicesFile = fs.existsSync(googleServicesPath);

  const androidConfig = {
    ...(baseExpo.android || {}),
    ...(hasGoogleServicesFile ? { googleServicesFile: './google-services.json' } : {}),
  };

  const rawPlugins = Array.isArray(baseExpo.plugins) ? [...baseExpo.plugins] : [];
  const existingPlugins = rawPlugins.filter((p) => {
    const pluginName = Array.isArray(p) ? p[0] : p;
    if (typeof pluginName !== 'string') return true;
    if (pluginName.startsWith('.')) return true;
    try {
      require.resolve(pluginName, { paths: [__dirname] });
      return true;
    } catch {
      return false;
    }
  });
  const hasMonetizationPlugin = existingPlugins.some((p) => {
    const pluginName = Array.isArray(p) ? p[0] : p;
    return (
      pluginName === './plugins/withMonetization' ||
      pluginName === './plugins/withMonetization.js'
    );
  });

  // These plugins fail prebuild without google-services.json; analytics stays off until it is added.
  if (hasGoogleServicesFile) {
    existingPlugins.push('@react-native-firebase/app', '@react-native-firebase/crashlytics');
  }

  if (!hasMonetizationPlugin) {
    existingPlugins.push([
      './plugins/withMonetization',
      {
        applovinSdkKey,
        admobAppId: ADMOB_APP_ID,
      },
    ]);
  }

  return {
    ...baseExpo,
    android: androidConfig,
    plugins: existingPlugins,
    extra: {
      ...(baseExpo.extra || {}),
      applovinSdkKey,
      admobAppId: hygiene.admobAppId,
      adjustEnvironment: hygiene.adjustEnvironment,
      maxTestDeviceIds: hygiene.testDeviceIds,
      googleWebClientId: hygiene.googleWebClientId,
    },
  };
};
