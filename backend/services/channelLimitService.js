import { resolveAccountEntitlements } from './entitlementCatalogService.js';

export async function getCanvasLimitForUser(user) {
  const userId = Number(user?.id);
  if (!Number.isInteger(userId) || userId <= 0) return 1;
  const entitlements = await resolveAccountEntitlements(userId);
  const limit = Number(entitlements?.limits?.['account.canvas_slots'] || 1);
  return Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 1;
}
