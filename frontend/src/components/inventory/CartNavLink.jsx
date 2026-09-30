import { ShoppingCart } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useCart } from '../../context/cartContext';

export default function CartNavLink({ className = '', onClick }) {
  const { cart } = useCart();
  const count = cart?.itemCount || 0;
  if (count === 0) return null;
  return (
    <NavLink to="/app/cart" onClick={onClick} className={`dc-cart-nav ${className}`} title="Carrito" aria-label={`Carrito, ${count} productos`}>
      <ShoppingCart size={22} />
      {count > 0 && <span>{count > 99 ? '99+' : count}</span>}
    </NavLink>
  );
}
