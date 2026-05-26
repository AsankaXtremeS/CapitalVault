const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Configure Metro to treat WebAssembly (.wasm) files as static binary assets (like images/mp3s)
// instead of JavaScript source files, avoiding syntax parsing errors.
if (config.resolver) {
  config.resolver.sourceExts = config.resolver.sourceExts.filter(ext => ext !== 'wasm');
  config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];
}

module.exports = config;
