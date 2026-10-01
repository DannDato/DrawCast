import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, permission, role, explicitPermission = false }) {
  const { user, loading, hasPermission } = useAuth();
  if (loading) return <div className="p-8 text-[var(--dc-accent-four)]">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role?.key !== role) return <Navigate to="/app" replace />;
  if (permission) {
    const allowed = explicitPermission ? user.permissions?.includes(permission) : hasPermission(permission);
    if (!allowed) return <Navigate to="/app" replace />;
  }
  return children;
}
