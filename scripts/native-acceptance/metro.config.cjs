/* global module */
/* eslint-disable @typescript-eslint/no-require-imports -- Metro loads configuration through CommonJS. */
const { getDefaultConfig } = require('expo/metro-config');
const { resolve } = require('node:path');
const config = getDefaultConfig(__dirname);
// The isolated app lives outside the declared pnpm app globs and reuses the
// frozen responder dependency tree through a junction/symlink.
config.watchFolders = [resolve(__dirname, '../..')];
config.resolver.nodeModulesPaths = [
  resolve(__dirname, 'node_modules'),
  resolve(__dirname, '../../node_modules'),
];
module.exports = config;
