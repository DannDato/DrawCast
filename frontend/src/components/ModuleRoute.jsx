import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getSystemModules } from '../api/systemModules';

export default function ModuleRoute({ moduleKey, fallback = '/', children }) {
  const [enabled, setEnabled] = useState(null);

  useEffect(() => {
    let active = true;
    getSystemModules()
      .then((modules) => { if (active) setEnabled(modules?.[moduleKey]?.enabled !== false); })
      .catch(() => { if (active) setEnabled(false); });
    return () => { active = false; };
  }, [moduleKey]);

  if (enabled == null) return null;
  if (!enabled) return <Navigate to={fallback} replace />;
  return children;
}
