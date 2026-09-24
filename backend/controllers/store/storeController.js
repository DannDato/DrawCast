import { getStoreCatalog, getUserLicenses, publicStoreProduct, publicUserLicense } from '../../services/storeCatalogService.js';

export class StoreController {
  static async catalog(req, res) {
    const products = await getStoreCatalog();
    res.json({
      checkoutEnabled: false,
      currency: 'USD',
      products: products.map(publicStoreProduct)
    });
  }

  static async licenses(req, res) {
    const licenses = await getUserLicenses(req.user.id);
    res.json({ licenses: licenses.map(publicUserLicense) });
  }
}
