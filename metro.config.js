const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Configure Metro to treat WebAssembly (.wasm) files as static binary assets (like images/mp3s)
// instead of JavaScript source files, avoiding syntax parsing errors.
if (config.resolver) {
  config.resolver.sourceExts = config.resolver.sourceExts.filter(ext => ext !== 'wasm');
  config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];
}

// Resolve `lucide-react-native/icons/<file>` to that single icon so only the icons the app
// uses get bundled, instead of all ~1,700 from the package index (see src/components/icons.ts).
const LUCIDE_ICONS_DIR = path.join(__dirname, 'node_modules/lucide-react-native/dist/esm/icons');
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const match = /^lucide-react-native\/icons\/([a-z0-9-]+)$/.exec(moduleName);
  if (match) {
    return { type: 'sourceFile', filePath: path.join(LUCIDE_ICONS_DIR, `${match[1]}.mjs`) };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
