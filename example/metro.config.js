const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the root package folder for live changes
config.watchFolders = [workspaceRoot];

// 2. Block Metro from crawling the root node_modules directory
// This prevents picking up duplicate react, react-native, or outdated TurboModules
config.resolver.blockList = [
  new RegExp(`^${escape(path.resolve(workspaceRoot, 'node_modules'))}/.*$`),
];

// 3. Pin critical peer dependencies strictly to example's node_modules
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => {
      if (target[name]) return target[name];
      return path.join(projectRoot, 'node_modules', name);
    },
  }
);

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

function escape(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = config;
