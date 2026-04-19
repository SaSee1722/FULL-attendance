/**
 * Custom Expo Config Plugin: Enable ABI Split APKs
 *
 * This plugin patches the generated android/app/build.gradle during EAS Build
 * to enable building separate APKs per CPU architecture:
 *   - arm64-v8a  (64-bit ARM – most modern Android phones)
 *   - armeabi-v7a (32-bit ARM – older devices)
 *   - x86_64     (64-bit x86 – emulators)
 *   - x86        (32-bit x86 – older emulators)
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withAbiSplits(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    // Enable separate build per CPU architecture (default is false in Expo template)
    if (contents.includes('def enableSeparateBuildPerCPUArchitecture = false')) {
      config.modResults.contents = contents.replace(
        'def enableSeparateBuildPerCPUArchitecture = false',
        'def enableSeparateBuildPerCPUArchitecture = true'
      );
    } else if (contents.includes('enableSeparateBuildPerCPUArchitecture = false')) {
      // Handle Kotlin DSL variant
      config.modResults.contents = contents.replace(
        'enableSeparateBuildPerCPUArchitecture = false',
        'enableSeparateBuildPerCPUArchitecture = true'
      );
    }

    return config;
  });
};
