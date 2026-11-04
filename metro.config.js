// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// toastify-react-native require()s ten icon families so a toast *could* use
// any of them, which bundled ~2 MB of icon fonts we never show. The app only
// uses its default (Ionicons), so for imports coming from that package the
// other families resolve to Ionicons and their fonts stay out of the bundle.
const OTHER_ICON_FAMILY = /^react-native-vector-icons\/(?!Ionicons$)[A-Za-z0-9]+$/;
const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromToastify = /[\\/]toastify-react-native[\\/]/.test(context.originModulePath || "");
  const target =
    fromToastify && OTHER_ICON_FAMILY.test(moduleName)
      ? "react-native-vector-icons/Ionicons"
      : moduleName;
  return upstreamResolve
    ? upstreamResolve(context, target, platform)
    : context.resolveRequest(context, target, platform);
};

module.exports = config;
