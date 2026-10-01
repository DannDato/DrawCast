import { getStoreSettings } from '../../services/storeSettingsService.js';
import {
  getStoreCatalogForUser,
  getUserInventory,
  publicStoreProduct,
  publicUserLicense
} from '../../services/storeCatalogService.js';
import { assignLicenseToChannel, releaseLicenseAssignment, simulateStorePurchase, storeSimulationEnabled } from '../../services/storeLicenseService.js';
import { completeApprovedStoreOrder } from '../../services/storeOrderService.js';
import { stripeEnabled } from '../../services/stripePaymentService.js';
import { publicChannelEntitlements } from '../../services/channelEntitlementAccessService.js';
import { broadcastChannelEntitlements } from '../../services/channelEntitlementBroadcastService.js';

export class StoreController {
  static async catalog(req, res) {
    const { entries, intelligence } = await getStoreCatalogForUser(req.user.id);
    res.json({
      checkoutEnabled: stripeEnabled(),
      simulationEnabled: storeSimulationEnabled(),
      currency: getStoreSettings().currency,
      intelligence,
      products: entries.map(({ product, eligibility }) => publicStoreProduct(product, { eligibility }))
    });
  }

  static async licenses(req, res) {
    const inventory = await getUserInventory(req.user.id);
    res.json({
      licenses: inventory.map(({ license, eligibleChannelUuids }) => publicUserLicense(license, { eligibleChannelUuids }))
    });
  }

  static async simulatePurchase(req, res) {
    const license = await simulateStorePurchase(req.user.id, req.body?.productUuid, {
      acknowledgeUnmetRequirements: req.body?.acknowledgeUnmetRequirements === true
    });
    res.status(201).json({ license: publicUserLicense(license) });
  }


  static async approveOrderPaymentDev(req, res) {
    if (!storeSimulationEnabled()) {
      return res.status(404).json({ error: 'La aprobación simulada de pago no está disponible.', code: 'STORE_SIMULATION_DISABLED' });
    }
    const result = await completeApprovedStoreOrder(req.user.id, req.params.orderUuid, {
      provider: 'dev',
      paymentRef: `dev:${req.params.orderUuid}`
    });
    res.status(result.alreadyCompleted ? 200 : 201).json({
      order: { uuid: result.order.uuid, status: result.order.status },
      licenseCount: result.licenses.length,
      inventoryReady: true
    });
  }

  static async assignLicense(req, res) {
    const result = await assignLicenseToChannel(req.user.id, req.params.licenseUuid, req.body?.channelUuid);
    await broadcastChannelEntitlements(req, result.channel.id, result.entitlements);
    res.status(201).json({
      license: publicUserLicense(result.license),
      channel: { uuid: result.channel.uuid, name: result.channel.name },
      entitlements: publicChannelEntitlements(result.entitlements)
    });
  }

  static async releaseLicense(req, res) {
    await releaseLicenseAssignment();
  }
}
