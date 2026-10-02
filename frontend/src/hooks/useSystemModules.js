import { useEffect, useState } from 'react';
import { getSystemModules } from '../api/systemModules';

export default function useSystemModules() {
  const [modules, setModules] = useState(null);

  useEffect(() => {
    let active = true;

    getSystemModules()
      .then((nextModules) => {
        if (active) setModules(nextModules || {});
      })
      .catch(() => {
        if (active) setModules({});
      });

    const handleModulesChanged = (event) => {
      const moduleKey = event?.detail?.moduleKey;
      if (!moduleKey) return;

      setModules((current) => ({
        ...(current || {}),
        [moduleKey]: {
          ...(current?.[moduleKey] || {}),
          enabled: event.detail.enabled !== false,
        },
      }));
    };

    window.addEventListener('TRAZIO:system-modules-changed', handleModulesChanged);

    return () => {
      active = false;
      window.removeEventListener('TRAZIO:system-modules-changed', handleModulesChanged);
    };
  }, []);

  const isEnabled = (moduleKey) => {
    if (modules === null) return false;
    return modules?.[moduleKey]?.enabled !== false;
  };

  return { modules, isEnabled };
}
