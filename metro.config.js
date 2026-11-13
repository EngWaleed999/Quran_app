const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Support bundling .db and .txt files as assets for SQLite and Quran text
config.resolver.assetExts.push('db');
if (!config.resolver.assetExts.includes('txt')) {
  config.resolver.assetExts.push('txt');
}

module.exports = config;

