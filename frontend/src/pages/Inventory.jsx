import { useEffect, useState } from 'react';
import { Boxes, PackageOpen } from 'lucide-react';
import { getStoreLicenses } from '../api/store';

function activeAssignment(license) {
  return license.assignments?.find((item) => item.status === 'ACTIVE') || null;
}

export default function Inventory() {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getStoreLicenses()
      .then((result) => active && setLicenses(result?.licenses || []))
      .catch((reason) => active && setError(reason?.response?.data?.message || reason?.message || 'No se pudo cargar el inventario.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <div className="dc-inventory-page">
      <div className="dc-store-page-bg" aria-hidden="true" />
      <div className="dc-store-shell">
        <header className="dc-store-page-head">
          <div>
            <span className="dc-store-eyebrow"><Boxes size={14} /> INVENTARIO</span>
            <h1>TUS <strong>//</strong> MEJORAS</h1>
            <p>Aquí vivirán las licencias que compres y el lienzo donde estén aplicadas.</p>
          </div>
        </header>

        {loading && <div className="dc-store-state">Cargando inventario…</div>}
        {error && <div className="dc-store-state error">{error}</div>}

        {!loading && !error && (licenses.length ? (
          <div className="dc-inventory-grid">
            {licenses.map((license) => {
              const assignment = activeAssignment(license);
              return (
                <article className="dc-inventory-card" key={license.uuid}>
                  <div>
                    <span className="dc-store-eyebrow">{license.status}</span>
                    <h2>{license.product?.name || 'Licencia TRAZIO'}</h2>
                  </div>
                  <p>{assignment?.channel?.name || 'Disponible para asignar'}</p>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="dc-inventory-empty">
            <PackageOpen size={34} />
            <div><b>Aún no tienes mejoras</b><span>Las compras aparecerán aquí.</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
