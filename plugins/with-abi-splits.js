/**
 * Custom Expo Config Plugin: Enable ABI Split APKs
 *
 * When enabled, running assembleRelease produces multiple APKs:
 *   app-arm64-v8a-release.apk   (modern phones)
 *   app-armeabi-v7a-release.apk (older phones)
 *   app-x86_64-release.apk      (emulators)
 *   app-x86-release.apk         (old emulators)
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withAbiSplits(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // Pattern 1: Standard RN Groovy DSL template (most common)
    if (contents.includes('def enableSeparateBuildPerCPUArchitecture = false')) {
      contents = contents.replace(
        'def enableSeparateBuildPerCPUArchitecture = false',
        'def enableSeparateBuildPerCPUArchitecture = true'
      );
      console.log('[with-abi-splits] ✅ Enabled ABI splits (pattern 1)');
    }
    // Pattern 2: Regex fallback for any whitespace variation
    else if (/enableSeparateBuildPerCPUArchitecture\s*=\s*false/.test(contents)) {
      contents = contents.replace(
        /enableSeparateBuildPerCPUArchitecture\s*=\s*false/,
        'enableSeparateBuildPerCPUArchitecture = true'
      );
      console.log('[with-abi-splits] ✅ Enabled ABI splits (pattern 2)');
    }
    // Pattern 3: If the variable doesn't exist, inject it into the android block
    else if (!contents.includes('enableSeparateBuildPerCPUArchitecture')) {
      // Inject before the splits block if it exists
      if (contents.includes('splits {')) {
        contents = contents.replace(
          'splits {',
          'def enableSeparateBuildPerCPUArchitecture = true\n    splits {'
        );
        console.log('[with-abi-splits] ✅ Injected ABI splits variable');
      } else {
        console.log('[with-abi-splits] ⚠️ Could not find splits block - skipping');
      }
    }

    config.modResults.contents = contents;
    return config;
  });
};
