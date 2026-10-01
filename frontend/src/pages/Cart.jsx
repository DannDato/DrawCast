import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useCart } from '../context/cartContext';
import InventoryProductIcon from '../components/inventory/InventoryProductIcon';
import { createStripeCheckoutSession, getOrderPaymentStatus } from '../api/cart';

const money = (cents, currency = 'MXN') => new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(cents / 100);
const period = (value) => value === 'one_time' ? 'Pago único' : value === 'year' ? 'Por año' : 'Por mes';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Cart() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { cart, loading, busy, error, refresh, update, remove, checkout: prepareCheckout } = useCart();
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [confirmingReturn, setConfirmingReturn] = useState(false);

  useEffect(() => { void refresh(); }, [refresh]);

  const finishPayment = useCallback(async () => {
    await refresh();
    navigate('/app/inventory', { replace: true });
  }, [navigate, refresh]);

  useEffect(() => {
    const orderUuid = searchParams.get('order');
    const stripeState = searchParams.get('stripe');
    if (!orderUuid || !stripeState) return;
    let active = true;

    if (stripeState === 'cancel') {
      Promise.resolve().then(() => {
        if (!active) return;
        setPaymentError('El pago fue cancelado. Tu carrito sigue intacto.');
        navigate('/app/cart', { replace: true });
      });
      return () => { active = false; };
    }

    if (stripeState !== 'success') return;
    Promise.resolve().then(() => active && setConfirmingReturn(true));
    (async () => {
      try {
        for (let attempt = 0; attempt < 15 && active; attempt += 1) {
          const status = await getOrderPaymentStatus(orderUuid);
          if (status.status === 'PAID') { await finishPayment(); return; }
          await sleep(800);
        }
        if (active) setPaymentError('Stripe recibió el pago, pero la confirmación final aún no llega. Puedes actualizar esta página para consultar de nuevo.');
      } catch (reason) {
        if (active) setPaymentError(reason?.response?.data?.message || 'No se pudo confirmar el estado del pago.');
      } finally {
        if (active) setConfirmingReturn(false);
      }
    })();
    return () => { active = false; };
  }, [finishPayment, navigate, searchParams]);

  const continuePurchase = async () => {
    if (paying) return;
    setPaying(true);
    setPaymentError('');
    try {
      const result = await prepareCheckout();
      if (!result) { void refresh(); return; }
      if (!result.paymentAvailable) {
        setPaymentError('Stripe todavía no está disponible en este entorno.');
        return;
      }
      const session = await createStripeCheckoutSession(result.checkout.orderUuid);
      if (session.status === 'PAID') { await finishPayment(); return; }
      if (session.url) {
        window.location.assign(session.url);
        return;
      }
      setPaymentError('Stripe ya recibió esta compra. Estamos esperando la confirmación final.');
    } catch (reason) {
      setPaymentError(reason?.response?.data?.message || reason?.message || 'No se pudo iniciar el pago.');
    } finally {
      setPaying(false);
    }
  };

  const removeItem = (item) => {
    if (!busy) void remove(item.productUuid);
  };

  if (confirmingReturn) {
    return <div className="dc-app-page dc-cart-page"><div className="dc-store-state" role="status">Confirmando tu pago con Stripe…</div></div>;
  }

  return (
    <div className="dc-app-page dc-cart-page">
      <header className="dc-cart-heading">
        <div><h1 className="dc-page-title">TU CARRITO</h1><p>Las mejoras que elegiste para tu cuenta y tus lienzos.</p></div>
        <Link to="/app/store"><ArrowLeft size={16} /> Seguir comprando</Link>
      </header>
      {loading && <div className="dc-store-state">Cargando carrito…</div>}
      {error && <div className="dc-store-state error" role="alert">{error} <button type="button" onClick={refresh} disabled={busy}>Actualizar</button></div>}
      {paymentError && <div className="dc-store-state error" role="alert">{paymentError}</div>}
      {!loading && cart && (cart.items.length ? (
        <div className="dc-cart-layout">
          <div className="dc-cart-items">
            {cart.items.map((item) => (
              <article className="dc-cart-item" key={item.productUuid}>
                <InventoryProductIcon product={item.product} size={30} />
                <div className="dc-cart-item-copy">
                  <h2>{item.product?.name || 'Producto no disponible'}</h2>
                  {item.product && <p>{money(item.product.priceCents, item.product.currency)} · {period(item.product.billingInterval)} · por licencia</p>}
                  {item.unavailableReason && <p className="dc-cart-warning">{item.unavailableReason}</p>}
                  {item.requiresBase && (
                    <div className="dc-cart-base-warning" role="note">
                      <b>Necesita herramienta base</b>
                      <span>Puedes comprar esta expansión y guardarla en Inventario, pero no podrás usarla hasta tener la herramienta base correspondiente o Lienzo Plus.</span>
                    </div>
                  )}
                </div>
                <div className="dc-cart-quantity-wrap">
                  <span>Licencias</span>
                  <div className="dc-cart-quantity" aria-label={`Licencias de ${item.product?.name || 'producto'}: ${item.quantity}`}>
                    <button type="button" aria-label="Reducir licencias" disabled={busy || paying || item.quantity <= 1} onClick={() => update(item.productUuid, item.quantity - 1)}><Minus size={14} /></button>
                    <strong>{item.quantity}</strong>
                    <button type="button" aria-label="Aumentar licencias" disabled={busy || paying || item.quantity >= 99 || Boolean(item.unavailableReason)} onClick={() => update(item.productUuid, item.quantity + 1)}><Plus size={14} /></button>
                  </div>
                </div>
                <strong>{money(item.lineTotalCents, cart.currency)}</strong>
                <button type="button" className="dc-cart-remove" aria-label={`Quitar ${item.product?.name || 'producto'}`} disabled={busy || paying} onClick={() => removeItem(item)}><Trash2 size={17} /></button>
              </article>
            ))}
          </div>
          <aside className="dc-cart-summary">
            <h2>{cart.itemCount} {cart.itemCount === 1 ? 'licencia' : 'licencias'}</h2>
            <div><span>Subtotal</span><strong>{money(cart.subtotalCents, cart.currency)} {cart.currency}</strong></div>
            <p>Compra mínima: {money(cart.minimumPurchaseCents, cart.currency)} {cart.currency}.</p>
            {cart.remainingCents > 0 && <p className="dc-cart-warning">Agrega {money(cart.remainingCents, cart.currency)} más para continuar.</p>}
            {cart.items.some((item) => item.unavailableReason) && <p className="dc-cart-warning">Retira los productos no disponibles para continuar.</p>}
            {cart.items.some((item) => item.requiresBase) && (
              <div className="dc-cart-summary-warning" role="note">
                <b>Hay expansiones que aún no puedes usar</b>
                <span>Podrás comprarlas y conservarlas en Inventario; se activarán cuando tengas la herramienta base o Lienzo Plus.</span>
              </div>
            )}
            <p>Al continuar irás directo al pago seguro de Stripe.</p>
            <button type="button" className="primary" disabled={busy || paying || !cart.canContinue} onClick={continuePurchase}>{busy || paying ? 'Preparando pago…' : 'Continuar'}</button>
          </aside>
        </div>
      ) : (
        <div className="dc-inventory-empty"><ShoppingCart size={36} /><div><b>Tu carrito está vacío</b><span>Encuentra herramientas, packs y expansiones en </span><Link to="/app/store" className="text-sm ">la Tienda</Link></div></div>
      ))}
    </div>
  );
}
