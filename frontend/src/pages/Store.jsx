import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  AudioLines,
  Check,
  Layers3,
  LayoutTemplate,
  LockKeyhole,
  PanelsTopLeft,
  ScanLine,
  Shapes,
  ShoppingBag,
  Sparkles,
  Timer,
  Type,
  Upload,
  Volume2,
  X
} from 'lucide-react';
import { getStoreCatalog } from '../api/store';

const ICONS = {
  sparkles: Sparkles,
  'panels-top-left': PanelsTopLeft,
  type: Type,
  shapes: Shapes,
  timer: Timer,
  'scan-line': ScanLine,
  'audio-lines': AudioLines,
  'layers-3': Layers3,
  'layout-template': LayoutTemplate,
  'volume-2': Volume2,
  upload: Upload
};

const SECTION_COPY = {
  tools: { title: 'Herramientas', copy: 'Desbloquea sólo lo que necesitas.' },
  expansions: { title: 'Expansiones', copy: 'Aumentan los límites de un lienzo compatible.' },
  canvases: { title: 'Lienzos', copy: 'Capacidad adicional para tu cuenta.' }
};

function money(product) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: product.currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format((product.priceCents || 0) / 100);
}

function intervalLabel(product) {
  if (product.billingInterval === 'one_time') return 'una vez';
  if (product.billingInterval === 'year') return '/ año';
  return '/ mes';
}

function productIcon(product, size = 22) {
  const Icon = ICONS[product?.metadata?.icon] || ShoppingBag;
  return <Icon size={size} />;
}

function requirementCopy(product) {
  const descriptions = [...new Set((product.requirements || []).map((item) => item.description).filter(Boolean))];
  if (!descriptions.length) return '';
  return descriptions.find((text) => /Plus o/i.test(text)) || descriptions[0];
}

function StoreProductCard({ product, onOpen }) {
  const locked = (product.requirements || []).length > 0;
  return (
    <article className={`dc-store-product ${locked ? 'is-locked' : ''}`}>
      <div className="dc-store-product-preview" aria-hidden="true">
        <span>{productIcon(product, 27)}</span>
      </div>
      {locked && <span className="dc-store-product-lock"><LockKeyhole size={14} /> BLOQUEADO</span>}
      <div className="dc-store-product-copy">
        <div className="dc-store-product-title-row">
          <div>
            {product.badge && <span className="dc-store-mini-badge">{product.badge}</span>}
            <h3>{product.name}</h3>
          </div>
          <div className="dc-store-price"><b>{money(product)}</b><span>{intervalLabel(product)}</span></div>
        </div>
        <p>{product.description}</p>
        {locked && <div className="dc-store-requirement"><LockKeyhole size={14} /> {requirementCopy(product)}</div>}
        <button type="button" className={locked ? 'secondary' : 'primary'} onClick={() => onOpen(product)}>
          {locked ? 'Ver requisito' : 'Ver producto'} <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
}

function PlusHero({ product, onOpen }) {
  if (!product) return null;
  return (
    <section className="dc-store-plus">
      <div className="dc-store-plus-glow" aria-hidden="true" />
      <div className="dc-store-plus-copy">
        <span className="dc-store-eyebrow"><Sparkles size={14} /> PRINCIPAL</span>
        <h1><span>LIENZO</span> <strong>PLUS</strong></h1>
        <p>{product.description}</p>
        <div className="dc-store-plus-highlights">
          {(product.metadata?.highlights || []).map((item) => <span key={item}><Check size={14} /> {item}</span>)}
        </div>
      </div>
      <div className="dc-store-plus-buy">
        <span>POR LIENZO</span>
        <div><b>{money(product)}</b><small>{intervalLabel(product)}</small></div>
        <button type="button" onClick={() => onOpen(product)}>Ver producto <ArrowRight size={16} /></button>
        <small>Las capacidades se comparten con todos los colaboradores del lienzo.</small>
      </div>
    </section>
  );
}

function StorePreviewModal({ product, checkoutEnabled, onClose }) {
  if (!product) return null;
  const locked = (product.requirements || []).length > 0;
  return (
    <div className="dc-store-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="dc-store-modal" role="dialog" aria-modal="true" aria-label={`Detalle de ${product.name}`} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div className="dc-store-modal-icon">{productIcon(product, 24)}</div>
          <div><span className="dc-store-eyebrow">PRODUCTO</span><h2>{product.name}</h2></div>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>
        <div className="dc-store-modal-body">
          <div className="dc-store-modal-price"><span>Cobro al activar</span><b>{money(product)} <small>{intervalLabel(product)}</small></b></div>
          <p>{product.description}</p>
          {locked && <div className="dc-store-modal-lock"><LockKeyhole size={18} /><div><b>Requisito</b><span>{requirementCopy(product)}</span></div></div>}
          <div className="dc-store-modal-note"><Sparkles size={17} /><span>Los cobros aún no están habilitados. Esta vista sirve para validar el catálogo y el flujo.</span></div>
        </div>
        <footer>
          <button type="button" onClick={onClose}>Cerrar</button>
          <button type="button" className="primary" disabled={!checkoutEnabled || locked}>{checkoutEnabled ? 'Continuar al pago' : 'Cobros próximamente'}</button>
        </footer>
      </section>
    </div>
  );
}

export default function Store() {
  const [catalog, setCatalog] = useState({ checkoutEnabled: false, products: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    let active = true;
    getStoreCatalog()
      .then((result) => active && setCatalog(result || { checkoutEnabled: false, products: [] }))
      .catch((reason) => active && setError(reason?.response?.data?.message || reason?.message || 'No se pudo cargar la tienda.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const plus = useMemo(() => catalog.products.find((product) => product.featured), [catalog.products]);
  const sections = useMemo(() => {
    const grouped = { tools: [], expansions: [], canvases: [] };
    catalog.products.filter((product) => !product.featured).forEach((product) => {
      const section = product.metadata?.section;
      if (grouped[section]) grouped[section].push(product);
    });
    return grouped;
  }, [catalog.products]);

  return (
    <div className="dc-store-page">
      <div className="dc-store-page-bg" aria-hidden="true" />
      <div className="dc-store-shell">
        <header className="dc-store-page-head">
          <div>
            <span className="dc-store-eyebrow"><ShoppingBag size={14} /> TIENDA</span>
            <h1>MEJORAS <strong>//</strong> TRAZIO</h1>
            <p>Las licencias pertenecen a tu cuenta. Las capacidades se aplican al lienzo.</p>
          </div>
          <span className="dc-store-billing-pill">PRECIOS BORRADOR · USD</span>
        </header>

        {loading && <div className="dc-store-state">Cargando catálogo…</div>}
        {error && <div className="dc-store-state error">{error}</div>}
        {!loading && !error && <>
          <PlusHero product={plus} onOpen={setSelectedProduct} />
          {Object.entries(sections).map(([key, products]) => products.length > 0 && (
            <section className="dc-store-section" key={key}>
              <div className="dc-store-section-head">
                <div><span className="dc-store-eyebrow">{key === 'expansions' ? 'REQUIEREN CAPACIDAD BASE' : 'CATÁLOGO'}</span><h2>{SECTION_COPY[key].title}</h2></div>
                <p>{SECTION_COPY[key].copy}</p>
              </div>
              <div className="dc-store-grid">{products.map((product) => <StoreProductCard key={product.uuid} product={product} onOpen={setSelectedProduct} />)}</div>
            </section>
          ))}
        </>}
      </div>
      <StorePreviewModal product={selectedProduct} checkoutEnabled={catalog.checkoutEnabled} onClose={() => setSelectedProduct(null)} />
    </div>
  );
}
