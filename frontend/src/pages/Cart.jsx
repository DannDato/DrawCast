import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useCart } from '../context/cartContext';
import InventoryProductIcon from '../components/inventory/InventoryProductIcon';
import { useSystemAlert } from '../components/ui/SystemAlert';

const money = (cents, currency = 'MXN') => new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(cents / 100);
const period = (value) => value === 'one_time' ? 'Pago único' : value === 'year' ? 'Por año' : 'Por mes';

export default function Cart() {
  const { confirmDialog } = useSystemAlert();
  const { cart, loading, busy, error, refresh, update, remove, review } = useCart();
  const [reviewed, setReviewed] = useState(null);

  useEffect(() => { void refresh(); }, [refresh]);

  const continuePurchase = async () => {
    const result = await review();
    if (result) setReviewed(result);
    else { setReviewed(null); void refresh(); }
  };
  const reviewing = reviewed && reviewed === cart;

  const removeItem = async (item) => {
    if (busy) return;
    const name = item.product?.name || 'este producto';
    const confirmed = await confirmDialog({
      tone: 'danger',
      title: '¿Seguro que quieres quitar este producto?',
      message: item.quantity > 1
        ? `Se quitarán las ${item.quantity} unidades de ${name} de tu carrito. Puedes volver a agregarlas desde la tienda.`
        : `Se quitará ${name} de tu carrito. Puedes volver a agregarlo desde la tienda.`,
      confirmLabel: 'Sí, quitar del carrito',
      cancelLabel: 'Conservar producto'
    });
    if (confirmed) await remove(item.productUuid);
  };

  return (
    <div className="dc-app-page dc-cart-page">
      <header className="dc-cart-heading">
        <div><h1 className="dc-page-title">{reviewing ? 'RESUMEN DE COMPRA' : 'TU CARRITO'}</h1><p>Las mejoras que elegiste para tu cuenta y tus lienzos.</p></div>
        <Link to="/app/store"><ArrowLeft size={16} /> Seguir comprando</Link>
      </header>
      {loading && <div className="dc-store-state">Cargando carrito…</div>}
      {error && <div className="dc-store-state error" role="alert">{error} <button type="button" onClick={refresh} disabled={busy}>Actualizar</button></div>}
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
                  {item.requiresBase && <p className="dc-cart-warning">Requiere una herramienta base o Lienzo Plus. La expansión no incluye esa herramienta.</p>}
                </div>
                <div className="dc-cart-quantity" aria-label={`Cantidad de ${item.product?.name || 'producto'}`}>
                  <button type="button" aria-label="Reducir cantidad" disabled={busy || reviewing || item.quantity <= 1} onClick={() => update(item.productUuid, item.quantity - 1)}><Minus size={14} /></button>
                  <span>{item.quantity}</span>
                  <button type="button" aria-label="Aumentar cantidad" disabled={busy || reviewing || item.quantity >= 99 || Boolean(item.unavailableReason)} onClick={() => update(item.productUuid, item.quantity + 1)}><Plus size={14} /></button>
                </div>
                <strong>{money(item.lineTotalCents, cart.currency)}</strong>
                {!reviewing && <button type="button" className="dc-cart-remove" aria-label={`Quitar ${item.product?.name || 'producto'}`} disabled={busy} onClick={() => removeItem(item)}><Trash2 size={17} /></button>}
              </article>
            ))}
          </div>
          <aside className="dc-cart-summary">
            <h2>{cart.itemCount} {cart.itemCount === 1 ? 'producto' : 'productos'}</h2>
            <div><span>Subtotal</span><strong>{money(cart.subtotalCents, cart.currency)} {cart.currency}</strong></div>
            <p>Compra mínima: {money(cart.minimumPurchaseCents, cart.currency)} {cart.currency}.</p>
            {cart.remainingCents > 0 && <p className="dc-cart-warning">Agrega {money(cart.remainingCents, cart.currency)} más para continuar.</p>}
            {cart.items.some((item) => item.unavailableReason) && <p className="dc-cart-warning">Retira los productos no disponibles para continuar.</p>}
            <p>El subtotal reúne las licencias seleccionadas. Cada producto conserva el periodo indicado.</p>
            {reviewing ? <>
              <p role="status">Tu carrito está listo. El pago en línea aún no está disponible. Tus productos seguirán guardados y no se ha realizado ningún cargo.</p>
              <button type="button" onClick={() => setReviewed(null)}>Volver al carrito</button>
            </> : <button type="button" className="primary" disabled={busy || !cart.canContinue} onClick={continuePurchase}>{busy ? 'Actualizando…' : 'Continuar'}</button>}
          </aside>
        </div>
      ) : (
        <div className="dc-inventory-empty"><ShoppingCart size={36} /><div><b>Tu carrito está vacío</b><span>Encuentra herramientas, packs y expansiones en </span><Link to="/app/store" className="text-sm ">la Tienda</Link></div></div>
      ))}
    </div>
  );
}
