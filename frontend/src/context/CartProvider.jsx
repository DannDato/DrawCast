import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { CartContext } from './cartContext';
import { addCartItem, getCart, prepareCheckout, removeCartItem, updateCartItem } from '../api/cart';

function UserCartProvider({ authenticated, children }) {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(authenticated);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const mutating = useRef(false);

  const refresh = useCallback(async () => {
    if (!authenticated || mutating.current) return;
    const request = ++sequence.current;
    try {
      const result = await getCart();
      if (request === sequence.current) { setCart(result); setError(''); }
    } catch (reason) {
      if (request === sequence.current) setError(reason?.response?.data?.message || 'No se pudo cargar el carrito.');
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    // refresh sólo actualiza el estado después de resolver la petición HTTP.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    window.addEventListener('focus', refresh);
    return () => { sequence.current += 1; window.removeEventListener('focus', refresh); };
  }, [refresh]);

  const mutate = async (action) => {
    if (!authenticated || mutating.current) return null;
    mutating.current = true;
    const request = ++sequence.current;
    setBusy(true);
    setError('');
    try {
      const result = await action();
      if (request === sequence.current) setCart(result);
      return result;
    } catch (reason) {
      if (request === sequence.current) setError(reason?.response?.data?.message || 'No se pudo actualizar el carrito.');
      return null;
    } finally {
      mutating.current = false;
      if (request === sequence.current) { setBusy(false); setLoading(false); }
    }
  };

  return (
    <CartContext.Provider value={{ cart, loading, busy, error, refresh, add: (uuid) => mutate(() => addCartItem(uuid)), update: (uuid, quantity) => mutate(() => updateCartItem(uuid, quantity)), remove: (uuid) => mutate(() => removeCartItem(uuid)), checkout: () => mutate(() => prepareCheckout(cart?.checkoutFingerprint)) }}>
      {children}
    </CartContext.Provider>
  );
}

export default function CartProvider({ children }) {
  const { user } = useAuth();
  return <UserCartProvider key={user?.uuid || user?.id || 'guest'} authenticated={Boolean(user)}>{children}</UserCartProvider>;
}
