import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-[var(--dc-accent-four)]">Cargando...</div>;
  if (user) return <Navigate to="/app" replace />;
  return children;
}
