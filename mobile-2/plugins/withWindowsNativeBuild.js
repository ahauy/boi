/**
 * Expo Config Plugin: withWindowsNativeBuild
 *
 * Khắc phục hai giới hạn khi build native trên Windows:
 * 1. SDK nằm dưới đường dẫn có dấu cách: CMake gọi clang++ bằng tên ngắn `CLANG_~1.EXE`, clang
 *    không vào chế độ C++ nên không link libc++. Ghi `sdk.dir` trỏ tới junction không có dấu
 *    cách. File này được ưu tiên hơn ANDROID_HOME nên không phụ thuộc biến môi trường của terminal.
 * 2. Đường dẫn CMake của module `app` vượt giới hạn của ninja: chuyển sang thư mục ngắn `C:/cx`.
 *
 * Chỉ áp dụng khi prebuild trên Windows, không ảnh hưởng tới EAS.
 * Tạo junction một lần (PowerShell):
 *   New-Item -ItemType Junction -Path C:\AndroidSdk -Target "$env:LOCALAPPDATA\Android\Sdk"
 */
const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');

const SDK_JUNCTION = 'C:\\AndroidSdk';
const MARKER = 'buildStagingDirectory';
const STAGING_BLOCK = `
android { externalNativeBuild { cmake { ${MARKER} = file('C:/cx') } } }
`;

function withWindowsNativeBuild(config) {
  if (process.platform !== 'win32') return config;

  const withStaging = withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes(MARKER)) {
      mod.modResults.contents += STAGING_BLOCK;
    }
    return mod;
  });

  return withDangerousMod(withStaging, [
    'android',
    (mod) => {
      if (fs.existsSync(SDK_JUNCTION)) {
        const file = path.join(mod.modRequest.platformProjectRoot, 'local.properties');
        fs.writeFileSync(file, 'sdk.dir=C\\:\\\\AndroidSdk\n');
      }
      return mod;
    },
  ]);
}

module.exports = withWindowsNativeBuild;
