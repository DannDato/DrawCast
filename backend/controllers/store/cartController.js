import { changeUserCart, getUserCart, reviewUserCart } from '../../services/storeCartService.js';

export class CartController {
  static async get(req, res) {
    res.json(await getUserCart(req.user.id));
  }

  static async add(req, res) {
    res.json(await changeUserCart(req.user.id, { productUuid: req.body?.productUuid, quantity: req.body?.quantity ?? 1, action: 'add' }));
  }

  static async update(req, res) {
    res.json(await changeUserCart(req.user.id, { productUuid: req.params.productUuid, quantity: req.body?.quantity, action: 'set' }));
  }

  static async remove(req, res) {
    res.json(await changeUserCart(req.user.id, { productUuid: req.params.productUuid, action: 'remove' }));
  }

  static async review(req, res) {
    res.json(await reviewUserCart(req.user.id));
  }
}
