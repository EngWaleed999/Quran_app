const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Support bundling .db files as assets for SQLite
config.resolver.assetExts.push('db');

module.exports = config;

