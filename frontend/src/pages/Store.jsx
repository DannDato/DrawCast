import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  AudioLines,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers3,
  LayoutTemplate,
  LockKeyhole,
  Package,
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
import { getStoreCatalog, simulateStorePurchase } from '../api/store';

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
  upload: Upload,
  package: Package
};

const SECTION_COPY = {
  packs: { title: 'Packs', copy: 'Varias capacidades en una sola licencia, sin lógica especial en el Editor.' },
  tools: { title: 'Herramientas', copy: 'Desbloquea sólo lo que necesitas.' },
  expansions: { title: 'Expansiones', copy: 'Aumentan los límites de un lienzo compatible.' },
  canvases: { title: 'Lienzos', copy: 'Capacidad adicional para tu cuenta.' }
};

const TAB_DEFINITIONS = [
  { id: 'all', label: 'Todo' },
  { id: 'packs', label: 'Packs' },
  { id: 'tools', label: 'Herramientas' },
  { id: 'expansions', label: 'Expansiones' }
];

const TAB_SECTIONS = {
  packs: ['packs'],
  tools: ['tools'],
  expansions: ['expansions', 'canvases']
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

function productImage(product) {
  const image = product?.metadata?.image;
  return typeof image === 'string' && image.trim() ? image.trim() : '';
}

function requirementCopy(product) {
  const descriptions = [...new Set((product.requirements || []).map((item) => item.description).filter(Boolean))];
  if (!descriptions.length) return 'Requiere la capacidad base o Lienzo Plus.';
  return descriptions.find((text) => /Plus o/i.test(text)) || descriptions[0];
}

function productState(product) {
  return product?.eligibility?.state || (product?.eligibility?.requirementsMet === false ? 'requires_base' : 'available');
}

function StoreProductStatus({ product, plusName }) {
  const state = productState(product);
  if (state === 'included_in_plus') return <div className="dc-store-product-status included"><Sparkles size={14} /> INCLUIDO EN {(plusName || 'Lienzo Plus').toUpperCase()}</div>;
  if (state === 'owned_applied') return <div className="dc-store-product-status owned"><Check size={14} /> YA LO TIENES</div>;
  if (state === 'in_inventory') return <div className="dc-store-product-status owned"><ShoppingBag size={14} /> EN INVENTARIO</div>;
  if (state === 'requires_base') return <div className="dc-store-product-status locked"><LockKeyhole size={14} /> {requirementCopy(product)}</div>;
  if (product.kind === 'addon') return <div className="dc-store-product-status available"><Check size={14} /> DISPONIBLE</div>;
  return null;
}

function StoreCategoryRow({ products, plusOwned, plusName, onOpen, onInventory }) {
  const rowRef = useRef(null);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const [scrollState, setScrollState] = useState({ left: false, right: false });

  const syncScrollState = () => {
    const row = rowRef.current;
    if (!row) return;
    const maxScroll = Math.max(0, row.scrollWidth - row.clientWidth);
    const next = {
      left: row.scrollLeft > 2,
      right: row.scrollLeft < maxScroll - 2
    };
    setScrollState((current) => current.left === next.left && current.right === next.right ? current : next);
  };

  const pause = () => {
    pausedRef.current = true;
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
  };

  const resume = (event) => {
    if (event?.currentTarget?.matches?.(':hover')) return;
    if (event?.currentTarget?.contains(document.activeElement)) return;
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => { pausedRef.current = false; }, 1200);
  };

  const scrollByCards = (direction) => {
    const row = rowRef.current;
    if (!row) return;
    pause();
    const amount = Math.max(260, Math.min(row.clientWidth * 0.82, 760));
    row.scrollBy({ left: direction * amount, behavior: 'smooth' });
    resumeTimerRef.current = window.setTimeout(() => { pausedRef.current = false; }, 2200);
  };

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return undefined;
    syncScrollState();

    const handleScroll = () => syncScrollState();
    const handleResize = () => syncScrollState();
    row.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      row.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    };
  }, [products.length]);

  useEffect(() => {
    const row = rowRef.current;
    if (!row || products.length < 2) return undefined;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    if (reduceMotion) return undefined;

    let frame = 0;
    let previous = performance.now();
    let direction = 1;
    const pixelsPerSecond = 20;

    let position = row.scrollLeft;

    const tick = (now) => {
      const delta = Math.min(now - previous, 48);
      previous = now;

      if (!pausedRef.current) {
        const maxScroll = Math.max(0, row.scrollWidth - row.clientWidth);

        if (maxScroll > 1) {
          if (position >= maxScroll - 1) direction = -1;
          else if (position <= 1) direction = 1;

          position += direction * pixelsPerSecond * (delta / 1000);
          position = Math.max(0, Math.min(maxScroll, position));

          row.scrollLeft = position;
        }
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [products.length]);

  return (
    <div className="dc-store-carousel-shell">
      <button type="button" className="dc-store-carousel-arrow is-left" aria-label="Ver productos anteriores" disabled={!scrollState.left} onClick={() => scrollByCards(-1)}>
        <ChevronLeft size={20} />
      </button>
      <div
        ref={rowRef}
        className="dc-store-carousel"
        onMouseEnter={pause}
        onMouseLeave={resume}
        onFocusCapture={pause}
        onBlurCapture={resume}
        onPointerDown={pause}
        onPointerUp={resume}
      >
        {products.map((product) => (
          <StoreProductCard key={product.uuid} product={product} plusOwned={plusOwned} plusName={plusName} onOpen={onOpen} onInventory={onInventory} />
        ))}
      </div>
      <button type="button" className="dc-store-carousel-arrow is-right" aria-label="Ver más productos" disabled={!scrollState.right} onClick={() => scrollByCards(1)}>
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function StoreProductCard({ product, plusOwned, plusName, onOpen, onInventory }) {
  const state = productState(product);
  const requiresConfirmation = state === 'requires_base';
  const purchaseBlocked = product.eligibility?.purchaseAvailable === false;
  const redundantByPlus = plusOwned && ['tool', 'pack'].includes(product.kind);
  const image = productImage(product);

  const handleAction = () => {
    if (purchaseBlocked && ['owned_applied', 'in_inventory'].includes(state)) {
      onInventory();
      return;
    }
    if (purchaseBlocked && state === 'included_in_plus') return;
    onOpen(product);
  };

  const actionLabel = (() => {
    if (state === 'included_in_plus') return 'Incluido en Plus';
    if (state === 'owned_applied' || state === 'in_inventory') return 'Ir a Inventario';
    if (requiresConfirmation) return 'Ver de todos modos';
    return `Comprar ${money(product)}`;
  })();

  return (
    <article className={`dc-store-product ${requiresConfirmation ? 'is-requirement-unmet' : ''} ${redundantByPlus ? 'is-plus-redundant' : ''}`}>
      <StoreProductStatus product={product} plusName={plusName} />
      <div className={`dc-store-product-preview ${image ? 'has-image' : ''}`} aria-hidden="true">
        {image ? <img src={image} alt="" loading="lazy" /> : <span>{productIcon(product, 27)}</span>}
      </div>
      <div className="dc-store-product-copy">
        <div className="dc-store-product-title-row">
          <div>
            {product.badge && <span className="dc-store-mini-badge">{product.badge}</span>}
            <h3>{product.name}</h3>
          </div>
          <div className="dc-store-price"><b>{money(product)}</b><span>{intervalLabel(product)}</span></div>
        </div>
        <p>{product.description}</p>
        <button type="button" className={purchaseBlocked || requiresConfirmation ? 'secondary' : 'primary'} disabled={state === 'included_in_plus'} onClick={handleAction}>
          {actionLabel} {!purchaseBlocked && <ArrowRight size={15} />}
        </button>
      </div>
    </article>
  );
}

function PlusHero({ product, intelligence, onOpen, onInventory }) {
  if (!product) return null;
  const appliedCount = Number(intelligence?.plusAppliedChannelCount || 0);
  const plusApplied = intelligence?.plusApplied === true;
  const plusOwned = intelligence?.plusOwned === true;
  const ctaLabel = plusApplied ? 'Administrar en Inventario' : plusOwned ? 'Aplicar desde Inventario' : 'Desbloquear todo';
  const [nameLead, ...nameTail] = String(product.name || 'Lienzo Plus').split(/\s+/);
  const handleClick = plusApplied || plusOwned ? onInventory : () => onOpen(product);

  return (
    <section className={`dc-store-plus ${plusApplied ? 'is-active' : ''}`}>
      <div className="dc-store-plus-glow" aria-hidden="true" />
      <div className="dc-store-plus-copy">
        <span className="dc-store-eyebrow"><Sparkles size={14} /> {plusApplied ? 'TU PLAN PRINCIPAL' : 'LA OPCIÓN MÁS COMPLETA'}</span>
        <h1><span>{nameLead}</span>{nameTail.length > 0 && <> <strong>{nameTail.join(' ')}</strong></>}</h1>
        <p>{product.description}</p>
        {!plusApplied && !plusOwned && <div className="dc-store-plus-pitch">¿Vas a comprar varias herramientas? {product.name} ya las reúne en un solo lienzo.</div>}
        {plusApplied && <div className="dc-store-plus-state"><Check size={15} /> ACTIVO EN {appliedCount} {appliedCount === 1 ? 'LIENZO' : 'LIENZOS'}</div>}
        {!plusApplied && plusOwned && <div className="dc-store-plus-state"><ShoppingBag size={15} /> YA ESTÁ EN TU INVENTARIO</div>}
        <div className="dc-store-plus-highlights">
          {(product.metadata?.highlights || []).map((item) => <span key={item}><Check size={14} /> {item}</span>)}
        </div>
      </div>
      <div className="dc-store-plus-buy">
        <span>POR LIENZO</span>
        <div><b>{money(product)}</b><small>{intervalLabel(product)}</small></div>
        <button type="button" onClick={handleClick}>{ctaLabel} <ArrowRight size={16} /></button>
        <small>{plusApplied ? 'Las herramientas y packs incluidos se marcan automáticamente como redundantes.' : 'Todos los colaboradores usan las capacidades del lienzo.'}</small>
      </div>
    </section>
  );
}

function StorePreviewModal({ product, checkoutEnabled, simulationEnabled, onClose, onPurchased, onInventory }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmingRisk, setConfirmingRisk] = useState(false);
  if (!product) return null;

  const state = productState(product);
  const purchaseBlocked = product.eligibility?.purchaseAvailable === false;
  const requiresConfirmation = state === 'requires_base';

  const purchase = async ({ acknowledgeUnmetRequirements = false } = {}) => {
    if (!simulationEnabled || busy || purchaseBlocked) return;
    setBusy(true);
    setError('');
    try {
      const result = await simulateStorePurchase(product.uuid, { acknowledgeUnmetRequirements });
      onPurchased(result?.license);
    } catch (reason) {
      setError(reason?.response?.data?.message || reason?.message || 'No se pudo crear la licencia de prueba.');
      setBusy(false);
    }
  };

  const handlePrimary = () => {
    if (purchaseBlocked) {
      if (state === 'owned_applied' || state === 'in_inventory') onInventory();
      return;
    }
    if (requiresConfirmation && !confirmingRisk) {
      setConfirmingRisk(true);
      setError('');
      return;
    }
    purchase({ acknowledgeUnmetRequirements: requiresConfirmation });
  };

  const primaryLabel = (() => {
    if (state === 'included_in_plus') return 'Incluido en Lienzo Plus';
    if (state === 'owned_applied') return 'Ver en Inventario';
    if (state === 'in_inventory') return 'Aplicar desde Inventario';
    if (checkoutEnabled) return requiresConfirmation ? 'Comprar de todos modos' : 'Continuar al pago';
    if (simulationEnabled) return busy ? 'Creando licencia…' : requiresConfirmation ? 'Comprar de todos modos' : 'Agregar al inventario';
    return 'Cobros próximamente';
  })();

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
          {state === 'included_in_plus' && <div className="dc-store-modal-lock"><Sparkles size={18} /><div><b>No necesitas comprarlo</b><span>Tu plan principal ya incluye esta capacidad.</span></div></div>}
          {state === 'owned_applied' && <div className="dc-store-modal-lock"><Check size={18} /><div><b>Ya lo tienes</b><span>Este producto ya está aplicado en uno de tus lienzos.</span></div></div>}
          {state === 'in_inventory' && <div className="dc-store-modal-lock"><ShoppingBag size={18} /><div><b>Ya está en tu Inventario</b><span>Usa la licencia que ya tienes antes de comprar otra.</span></div></div>}
          {requiresConfirmation && <>
            <div className="dc-store-modal-lock"><LockKeyhole size={18} /><div><b>No tienes la capacidad base</b><span>{requirementCopy(product)}</span></div></div>
            <div className="dc-store-modal-warning"><Sparkles size={18} /><div><b>Te recomendamos comprar primero la herramienta o Lienzo Plus.</b><span>Puedes comprar esta expansión ahora, pero permanecerá en tu Inventario y no podrás aplicarla hasta tener un lienzo compatible.</span></div></div>
          </>}
          {requiresConfirmation && confirmingRisk && <div className="dc-store-modal-confirm"><b>¿Estás seguro?</b><span>Estás comprando una expansión que actualmente no puedes usar. La compra no desbloquea la herramienta base.</span></div>}
          {simulationEnabled && !checkoutEnabled && !requiresConfirmation && !purchaseBlocked && <div className="dc-store-modal-note"><Sparkles size={17} /><span>Modo de prueba: crea una licencia real en tu inventario sin hacer ningún cobro.</span></div>}
          {error && <div className="dc-store-state error">{error}</div>}
        </div>
        <footer>
          {confirmingRisk ? <button type="button" onClick={() => setConfirmingRisk(false)} disabled={busy}>Volver</button> : <button type="button" onClick={onClose}>Cerrar</button>}
          <button type="button" className="primary" disabled={busy || state === 'included_in_plus' || (!purchaseBlocked && !checkoutEnabled && !simulationEnabled)} onClick={handlePrimary}>{primaryLabel}</button>
        </footer>
      </section>
    </div>
  );
}

export default function Store() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState({ checkoutEnabled: false, simulationEnabled: false, intelligence: {}, products: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    let active = true;
    getStoreCatalog()
      .then((result) => active && setCatalog(result || { checkoutEnabled: false, simulationEnabled: false, intelligence: {}, products: [] }))
      .catch((reason) => active && setError(reason?.response?.data?.message || reason?.message || 'No se pudo cargar la tienda.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const plus = useMemo(() => catalog.products.find((product) => product.featured), [catalog.products]);
  const sections = useMemo(() => {
    const grouped = { packs: [], tools: [], expansions: [], canvases: [] };
    catalog.products.filter((product) => !product.featured).forEach((product) => {
      const section = product.metadata?.section;
      if (grouped[section]) grouped[section].push(product);
    });
    return grouped;
  }, [catalog.products]);

  const tabs = useMemo(() => TAB_DEFINITIONS.map((tab) => ({
    ...tab,
    count: tab.id === 'all'
      ? catalog.products.filter((product) => !product.featured).length
      : (TAB_SECTIONS[tab.id] || []).reduce((total, section) => total + (sections[section]?.length || 0), 0)
  })), [catalog.products, sections]);

  const visibleSections = useMemo(() => {
    if (activeTab !== 'all') return TAB_SECTIONS[activeTab] || [];
    return catalog.intelligence?.plusOwned
      ? ['expansions', 'canvases', 'packs', 'tools']
      : ['packs', 'tools', 'expansions', 'canvases'];
  }, [activeTab, catalog.intelligence?.plusOwned]);

  const sectionTab = (section) => section === 'canvases' ? 'expansions' : section;

  const goInventory = () => navigate('/app/inventory');

  return (
    <div className="dc-store-page">
      <div className="dc-store-page-bg" aria-hidden="true" />
      <div className="dc-store-shell">
        <header className="dc-store-page-head">
          <div>
            <span className="dc-store-eyebrow"><ShoppingBag size={14} /> TIENDA</span>
            {/* <h1>MEJORAS <strong>//</strong> TRAZIO</h1> */}
            <p>Compra licencias para tu cuenta y aplícalas desde Inventario.</p>
          </div>
          <span className="dc-store-billing-pill">PRECIOS · USD</span>
        </header>

        {loading && <div className="dc-store-state">Cargando catálogo…</div>}
        {error && <div className="dc-store-state error">{error}</div>}
        {!loading && !error && <>
          <PlusHero product={plus} intelligence={catalog.intelligence} onOpen={setSelectedProduct} onInventory={goInventory} />

          <div className="dc-store-tabs" role="tablist" aria-label="Filtrar productos de la tienda">
            {tabs.map((tab) => (
              <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'is-active' : ''} onClick={() => setActiveTab(tab.id)}>
                {tab.label}<span>{tab.count}</span>
              </button>
            ))}
          </div>

          {visibleSections.map((key) => {
            const products = sections[key] || [];
            if (!products.length) return null;
            return (
              <section className={`dc-store-section ${activeTab === 'all' ? 'is-carousel-section' : ''}`} key={key}>
                <div className="dc-store-section-head">
                  <div className="dc-store-section-title">
                    <span className="dc-store-eyebrow">{['expansions', 'canvases'].includes(key) ? 'CAPACIDAD ADICIONAL' : 'CATÁLOGO'}</span>
                    <h2>{SECTION_COPY[key].title}</h2>
                    <p>{SECTION_COPY[key].copy}</p>
                  </div>
                  {activeTab === 'all' && (
                    <button type="button" className="dc-store-view-all" onClick={() => setActiveTab(sectionTab(key))}>
                      Ver todo <ArrowRight size={14} />
                    </button>
                  )}
                </div>
                {activeTab === 'all' ? (
                  <StoreCategoryRow products={products} plusOwned={catalog.intelligence?.plusOwned === true} plusName={catalog.intelligence?.plusProductName} onOpen={setSelectedProduct} onInventory={goInventory} />
                ) : (
                  <div className="dc-store-grid">
                    {products.map((product) => <StoreProductCard key={product.uuid} product={product} plusOwned={catalog.intelligence?.plusOwned === true} plusName={catalog.intelligence?.plusProductName} onOpen={setSelectedProduct} onInventory={goInventory} />)}
                  </div>
                )}
              </section>
            );
          })}
        </>}
      </div>
      <StorePreviewModal
        key={selectedProduct?.uuid || 'store-preview'}
        product={selectedProduct}
        checkoutEnabled={catalog.checkoutEnabled}
        simulationEnabled={catalog.simulationEnabled}
        onClose={() => setSelectedProduct(null)}
        onPurchased={goInventory}
        onInventory={goInventory}
      />
    </div>
  );
}
