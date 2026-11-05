/**
 * Expo Config Plugin: withMonetization (Playbook §1.2, §11.11)
 *
 * Configures Android native manifest metadata, custom Maven repositories,
 * and all 9 required AppLovin MAX mediation adapters:
 *   1. Google AdMob (com.applovin.mediation:google-adapter)
 *   2. Meta Audience Network (com.applovin.mediation:facebook-adapter)
 *   3. Mintegral (com.applovin.mediation:mintegral-adapter + Mintegral Maven)
 *   4. Unity Ads (com.applovin.mediation:unityads-adapter)
 *   5. Liftoff / Vungle (com.applovin.mediation:vungle-adapter)
 *   6. DT Exchange / Fyber (com.applovin.mediation:fyber-adapter)
 *   7. Yandex (com.applovin.mediation:yandex-adapter)
 *   8. Bigo Ads (com.applovin.mediation:bigoads-adapter)
 *   9. Pangle (com.applovin.mediation:bytedance-adapter + Pangle Maven restricted to com.pangle.global)
 */

let configPlugins = null;
try {
  configPlugins = require('expo/config-plugins');
} catch {
  try {
    configPlugins = require('@expo/config-plugins');
  } catch {
    configPlugins = null;
  }
}

/**
 * Public AdMob App ID (Playbook §1.2 & §11.11: goes into AndroidManifest.xml, prevents crash on startup).
 */
const ADMOB_APP_ID = 'ca-app-pub-7441372574696038~4265117368';

/**
 * All 9 required mediation adapters (Playbook §1.2), pinned to versions compatible with MAX SDK.
 */
const MEDIATION_ADAPTERS = [
  {
    name: 'Google AdMob',
    coordinate: 'com.applovin.mediation:google-adapter:25.5.0.0',
    group: 'com.applovin.mediation:google-adapter',
  },
  {
    name: 'Meta Audience Network',
    coordinate: 'com.applovin.mediation:facebook-adapter:6.22.0.1',
    group: 'com.applovin.mediation:facebook-adapter',
  },
  {
    name: 'Mintegral',
    coordinate: 'com.applovin.mediation:mintegral-adapter:17.2.21.0',
    group: 'com.applovin.mediation:mintegral-adapter',
  },
  {
    name: 'Unity Ads',
    coordinate: 'com.applovin.mediation:unityads-adapter:4.21.0.1',
    group: 'com.applovin.mediation:unityads-adapter',
  },
  {
    name: 'Liftoff / Vungle',
    coordinate: 'com.applovin.mediation:vungle-adapter:7.7.9.1',
    group: 'com.applovin.mediation:vungle-adapter',
  },
  {
    name: 'DT Exchange / Fyber',
    coordinate: 'com.applovin.mediation:fyber-adapter:8.5.1.0',
    group: 'com.applovin.mediation:fyber-adapter',
  },
  {
    name: 'Yandex',
    coordinate: 'com.applovin.mediation:yandex-adapter:8.6.0.0',
    group: 'com.applovin.mediation:yandex-adapter',
  },
  {
    name: 'Bigo Ads',
    coordinate: 'com.applovin.mediation:bigoads-adapter:6.2.0.0',
    group: 'com.applovin.mediation:bigoads-adapter',
  },
  {
    name: 'Pangle',
    coordinate: 'com.applovin.mediation:bytedance-adapter:8.4.0.5.0',
    group: 'com.applovin.mediation:bytedance-adapter',
  },
];

/**
 * Custom Maven repositories required by Mintegral and Pangle (§1.2).
 * Pangle must be restricted to group `com.pangle.global`.
 */
const MAVEN_REPOSITORIES = {
  mintegral: {
    url: 'https://dl-maven-android.mintegral.com/repository/mbridge_android_sdk_oversea',
  },
  pangle: {
    url: 'https://artifact.bytedance.com/repository/pangle',
    includeGroup: 'com.pangle.global',
  },
};

/**
 * Upserts a <meta-data /> entry inside the <application> node of AndroidManifest.xml.
 */
function upsertMetaDataItem(applicationNode, name, value) {
  if (!applicationNode['meta-data']) {
    applicationNode['meta-data'] = [];
  }
  const existing = applicationNode['meta-data'].find(
    (item) => item.$ && item.$['android:name'] === name
  );
  if (existing) {
    existing.$['android:value'] = value;
  } else {
    applicationNode['meta-data'].push({
      $: {
        'android:name': name,
        'android:value': value,
      },
    });
  }
}

/**
 * Mutates an AndroidManifest JSON object to include AdMob App ID and AppLovin SDK Key.
 */
function injectManifestMetaData(androidManifest, options = {}) {
  const sdkKey = options.applovinSdkKey || process.env.APPLOVIN_SDK_KEY || '';
  const admobAppId = options.admobAppId || ADMOB_APP_ID;

  if (!androidManifest.manifest) {
    androidManifest.manifest = {};
  }
  if (!Array.isArray(androidManifest.manifest.application) || androidManifest.manifest.application.length === 0) {
    androidManifest.manifest.application = [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [] }];
  }

  const mainApp = androidManifest.manifest.application[0];

  // Always inject public AdMob App ID (§1.2 & §11.11: prevents crash when Google adapter is present)
  upsertMetaDataItem(mainApp, 'com.google.android.gms.ads.APPLICATION_ID', admobAppId);

  // Inject AppLovin SDK Key when provided
  if (sdkKey) {
    upsertMetaDataItem(mainApp, 'applovin.sdk.key', sdkKey);
  }

  return androidManifest;
}

/**
 * Injects Mintegral and Pangle (restricted to com.pangle.global) Maven repositories into project build.gradle.
 */
function injectProjectBuildGradleRepos(buildGradleSource) {
  if (typeof buildGradleSource !== 'string') return '';

  const repoBlock = [
    `        // PalmSight Monetization Mediation Repositories (Playbook §1.2)`,
    `        maven { url "${MAVEN_REPOSITORIES.mintegral.url}" }`,
    `        maven {`,
    `            url "${MAVEN_REPOSITORIES.pangle.url}"`,
    `            content {`,
    `                includeGroup "${MAVEN_REPOSITORIES.pangle.includeGroup}"`,
    `            }`,
    `        }`,
  ].join('\n');

  if (buildGradleSource.includes(MAVEN_REPOSITORIES.pangle.url)) {
    return buildGradleSource;
  }

  // Insert inside allprojects { repositories { ... } } if present
  const allProjectsRepoRegex = /(allprojects\s*\{[\s\S]*?repositories\s*\{)/m;
  if (allProjectsRepoRegex.test(buildGradleSource)) {
    return buildGradleSource.replace(allProjectsRepoRegex, `$1\n${repoBlock}`);
  }

  return `${buildGradleSource}\nallprojects {\n    repositories {\n${repoBlock}\n    }\n}\n`;
}

/**
 * Injects the 9 AppLovin MAX mediation adapter dependencies into app/build.gradle.
 */
function injectAppBuildGradleDependencies(appBuildGradleSource) {
  if (typeof appBuildGradleSource !== 'string') return '';

  const lines = [
    `    // PalmSight AppLovin MAX Mediation Adapters (Playbook §1.2)`,
    ...MEDIATION_ADAPTERS.map((adapter) => `    implementation("${adapter.coordinate}")`),
  ].join('\n');

  if (appBuildGradleSource.includes('com.applovin.mediation:google-adapter')) {
    return appBuildGradleSource;
  }

  const dependenciesRegex = /(dependencies\s*\{)/m;
  if (dependenciesRegex.test(appBuildGradleSource)) {
    return appBuildGradleSource.replace(dependenciesRegex, `$1\n${lines}`);
  }

  return `${appBuildGradleSource}\ndependencies {\n${lines}\n}\n`;
}

/**
 * Validates production build hygiene rules (Playbook §11.11).
 */
function validateReleaseHygiene(env = process.env, isProduction = false) {
  const rawTestIds = (env.EXPO_PUBLIC_MAX_TEST_DEVICE_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const testDeviceIds = isProduction ? [] : rawTestIds;
  const adjustEnvironment = isProduction
    ? 'production'
    : env.EXPO_PUBLIC_ADJUST_ENVIRONMENT || 'production';
  const admobAppId = ADMOB_APP_ID;
  const googleWebClientId = env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

  return {
    admobAppId,
    adjustEnvironment,
    testDeviceIds,
    googleWebClientId,
    isCleanForStore:
      testDeviceIds.length === 0 &&
      adjustEnvironment === 'production' &&
      admobAppId === ADMOB_APP_ID,
  };
}

/**
 * Main Expo config plugin entry point.
 */
function withMonetization(config, options = {}) {
  const sdkKey = options.applovinSdkKey ?? process.env.APPLOVIN_SDK_KEY ?? '';
  const admobAppId = options.admobAppId ?? ADMOB_APP_ID;

  // 1. Ensure extra holds monetization build metadata
  config.extra = {
    ...(config.extra || {}),
    applovinSdkKey: sdkKey,
    admobAppId,
  };

  // 2. Apply Expo config-plugins modifiers if running inside Expo prebuild
  if (configPlugins) {
    config = configPlugins.withAndroidManifest(config, (modConfig) => {
      modConfig.modResults = injectManifestMetaData(modConfig.modResults, {
        applovinSdkKey: sdkKey,
        admobAppId,
      });
      return modConfig;
    });

    config = configPlugins.withProjectBuildGradle(config, (modConfig) => {
      if (modConfig.modResults && typeof modConfig.modResults.contents === 'string') {
        modConfig.modResults.contents = injectProjectBuildGradleRepos(
          modConfig.modResults.contents
        );
      }
      return modConfig;
    });

    config = configPlugins.withAppBuildGradle(config, (modConfig) => {
      if (modConfig.modResults && typeof modConfig.modResults.contents === 'string') {
        modConfig.modResults.contents = injectAppBuildGradleDependencies(
          modConfig.modResults.contents
        );
      }
      return modConfig;
    });
  }

  return config;
}

module.exports = withMonetization;
module.exports.withMonetization = withMonetization;
module.exports.ADMOB_APP_ID = ADMOB_APP_ID;
module.exports.MEDIATION_ADAPTERS = MEDIATION_ADAPTERS;
module.exports.MAVEN_REPOSITORIES = MAVEN_REPOSITORIES;
module.exports.injectManifestMetaData = injectManifestMetaData;
module.exports.injectProjectBuildGradleRepos = injectProjectBuildGradleRepos;
module.exports.injectAppBuildGradleDependencies = injectAppBuildGradleDependencies;
module.exports.validateReleaseHygiene = validateReleaseHygiene;
