import { getOrCreateStripeCheckoutSession, getStoreOrderPaymentStatus, handleStripeEvent, verifyStripeWebhook } from '../../services/stripePaymentService.js';

export class StripeController {
  static async checkoutSession(req, res) {
    res.json(await getOrCreateStripeCheckoutSession(req.user.id, req.params.orderUuid));
  }

  static async orderStatus(req, res) {
    res.json(await getStoreOrderPaymentStatus(req.user.id, req.params.orderUuid));
  }

  static async webhook(req, res) {
    const event = verifyStripeWebhook(req.body, req.get('stripe-signature'));
    await handleStripeEvent(event);
    res.status(200).json({ received: true });
  }
}
