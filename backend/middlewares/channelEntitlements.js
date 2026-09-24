import { getChannelEntitlements, hasFeature, entitlementError } from '../services/channelEntitlementAccessService.js';

export function requireChannelFeature(featureKey, { message = null } = {}) {
  return async function channelFeatureMiddleware(req, _res, next) {
    const entitlements = req.channelEntitlements || await getChannelEntitlements(req.channel?.id);
    req.channelEntitlements = entitlements;
    if (!hasFeature(entitlements, featureKey)) throw entitlementError(featureKey, message);
    next();
  };
}
