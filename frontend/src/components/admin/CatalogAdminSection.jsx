import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Plus, Save, Trash2, X } from 'lucide-react';
import { createSystemCatalogProduct, disableSystemCatalogProduct, saveSystemCatalogProduct } from '../../api/systemAdmin';

const categoryTabs = [['licenses', 'Licencias'], ['packages', 'Paquetes'], ['expansions', 'Expansiones']];
const categoryDefaults = {
  licenses: { kind: 'plan', key: 'license.', billingInterval: 'month' },
  packages: { kind: 'pack', key: 'pack.', billingInterval: 'month' },
  expansions: { kind: 'addon', key: 'addon.', billingInterval: 'one_time' }
};
const moneyToCents = (value) => { const number = Number(String(value || '').replace(',', '.')); return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null; };

function ProductEditor({ product, capabilities, bundles, canManage, onSaved, onNotice }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const toDraft = (source) => ({
    name: source.name, description: source.description, price: (source.priceCents / 100).toFixed(2), currency: source.currency,
    billingInterval: source.billingInterval, badge: source.badge || '', featured: source.featured, active: source.active,
    storeVisible: source.storeVisible, sortOrder: source.sortOrder, bundleKeys: source.bundles.map((bundle) => bundle.key),
    bundleGrants: Object.fromEntries(source.bundles.map((bundle) => [bundle.key, bundle.grants.map((grant) => ({ ...grant }))]))
  });
  const [draft, setDraft] = useState(() => toDraft(product));

  const compatibleBundles = bundles.filter((bundle) => bundle.scope === product.targetScope);
  const updateGrant = (bundleKey, index, patch) => setDraft((current) => ({ ...current, bundleGrants: { ...current.bundleGrants, [bundleKey]: current.bundleGrants[bundleKey].map((grant, grantIndex) => grantIndex === index ? { ...grant, ...patch } : grant) } }));
  const removeGrant = (bundleKey, index) => setDraft((current) => ({ ...current, bundleGrants: { ...current.bundleGrants, [bundleKey]: current.bundleGrants[bundleKey].filter((_, grantIndex) => grantIndex !== index) } }));
  const addGrant = (bundleKey) => {
    const used = new Set((draft.bundleGrants[bundleKey] || []).map((grant) => grant.capabilityKey));
    const capability = capabilities.find((item) => item.scope === product.targetScope && !used.has(item.key));
    if (!capability) return;
    setDraft((current) => ({ ...current, bundleGrants: { ...current.bundleGrants, [bundleKey]: [...(current.bundleGrants[bundleKey] || []), { capabilityKey: capability.key, capabilityName: capability.name, valueType: capability.valueType, operation: 'set', value: capability.valueType === 'boolean' ? true : 0 }] } }));
  };
  const toggleBundle = (bundleKey) => setDraft((current) => {
    const selected = current.bundleKeys.includes(bundleKey);
    return { ...current, bundleKeys: selected ? current.bundleKeys.filter((key) => key !== bundleKey) : [...current.bundleKeys, bundleKey], bundleGrants: selected ? current.bundleGrants : { ...current.bundleGrants, [bundleKey]: bundles.find((item) => item.key === bundleKey)?.grants?.map((grant) => ({ ...grant })) || [] } };
  });

  const save = async () => {
    const priceCents = moneyToCents(draft.price);
    if (priceCents == null) return onNotice({ type: 'error', text: 'Precio inválido.' });
    if (!draft.bundleKeys.length) return onNotice({ type: 'error', text: 'El producto necesita al menos un paquete de capacidades.' });
    try {
      setSaving(true);
      const saved = await saveSystemCatalogProduct(product.uuid, {
        name: draft.name, description: draft.description, priceCents, currency: draft.currency, billingInterval: draft.billingInterval,
        badge: draft.badge, featured: draft.featured, active: draft.active, storeVisible: draft.storeVisible, sortOrder: Number(draft.sortOrder || 0),
        bundleKeys: draft.bundleKeys, bundleGrants: Object.fromEntries(draft.bundleKeys.map((key) => [key, draft.bundleGrants[key] || []]))
      });
      setDraft(toDraft(saved));
      await onSaved();
      onNotice({ type: 'success', text: `${saved.name} actualizado.` });
    } catch (error) { onNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo actualizar el producto.' }); }
    finally { setSaving(false); }
  };

  const disable = async () => {
    if (!window.confirm(`¿Quitar ${product.name} del catálogo? Las licencias históricas se conservan; el producto sólo quedará desactivado.`)) return;
    try { setSaving(true); await disableSystemCatalogProduct(product.uuid); await onSaved(); onNotice({ type: 'success', text: `${product.name} desactivado.` }); }
    catch (error) { onNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo desactivar el producto.' }); }
    finally { setSaving(false); }
  };

  return <article className={`bg-[var(--dc-surface)] ${product.active ? '' : 'opacity-60'}`}>
    <button type="button" onClick={() => { if (!open) setDraft(toDraft(product)); setOpen((value) => !value); }} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-left hover:bg-[var(--dc-button-secondary-hover)]">
      <span className="min-w-0"><strong className="block truncate text-sm">{product.name}</strong><span className="mt-0.5 block truncate text-[10px] uppercase tracking-[.08em] text-[var(--dc-text-muted)]">{product.key} · ${(product.priceCents / 100).toFixed(2)} {product.currency} · {product.active ? 'ACTIVO' : 'DESACTIVADO'}</span></span>
      {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
    </button>
    {open && <div className="grid gap-5 bg-[var(--dc-panel)] px-4 pb-4 pt-3">
      <div className="grid grid-cols-2 gap-3 max-[680px]:grid-cols-1">
        <label className="grid gap-1 text-xs font-bold">Nombre<input value={draft.name} disabled={!canManage} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="bg-[var(--dc-surface)] px-3 py-2 font-normal outline-none" /></label>
        <label className="grid gap-1 text-xs font-bold">Precio<input type="number" min="0" step="0.01" value={draft.price} disabled={!canManage} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className="bg-[var(--dc-surface)] px-3 py-2 font-normal outline-none" /></label>
        <label className="grid gap-1 text-xs font-bold">Descripción<textarea value={draft.description} disabled={!canManage} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} className="resize-none bg-[var(--dc-surface)] px-3 py-2 font-normal outline-none" /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs font-bold">Cobro<select value={draft.billingInterval} disabled={!canManage} onChange={(e) => setDraft({ ...draft, billingInterval: e.target.value })} className="bg-[var(--dc-surface)] px-3 py-2 font-normal"><option value="month">Mensual</option><option value="year">Anual</option><option value="one_time">Una vez</option></select></label>
          <label className="grid gap-1 text-xs font-bold">Orden<input type="number" value={draft.sortOrder} disabled={!canManage} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} className="bg-[var(--dc-surface)] px-3 py-2 font-normal outline-none" /></label>
          <label className="grid gap-1 text-xs font-bold">Badge<input value={draft.badge} disabled={!canManage} onChange={(e) => setDraft({ ...draft, badge: e.target.value })} className="bg-[var(--dc-surface)] px-3 py-2 font-normal outline-none" /></label>
          <label className="grid gap-1 text-xs font-bold">Moneda<input value={draft.currency} maxLength={3} disabled={!canManage} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} className="bg-[var(--dc-surface)] px-3 py-2 font-normal uppercase outline-none" /></label>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs font-bold">
        <label className="flex items-center gap-2"><input type="checkbox" checked={draft.active} disabled={!canManage} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Activo</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={draft.storeVisible} disabled={!canManage} onChange={(e) => setDraft({ ...draft, storeVisible: e.target.checked })} /> Visible en tienda</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={draft.featured} disabled={!canManage} onChange={(e) => setDraft({ ...draft, featured: e.target.checked })} /> Destacado</label>
      </div>
      <div>
        <span className="dc-kicker">CONTENIDO DE LA LICENCIA</span>
        <p className="mb-3 mt-1 text-[11px] leading-5 text-[var(--dc-text-muted)]">Aquí cambias límites y herramientas reales. Si un paquete se comparte con otro producto, editarlo también afecta al producto que lo comparte.</p>
        <div className="mb-3 flex flex-wrap gap-2">{compatibleBundles.map((bundle) => <label key={bundle.key} className={`cursor-pointer bg-[var(--dc-surface)] px-3 py-2 text-[10px] font-black uppercase tracking-[.06em] ${draft.bundleKeys.includes(bundle.key) ? 'text-[var(--dc-accent-four)]' : 'text-[var(--dc-text-muted)]'}`}><input type="checkbox" className="mr-2" checked={draft.bundleKeys.includes(bundle.key)} disabled={!canManage} onChange={() => toggleBundle(bundle.key)} />{bundle.name}</label>)}</div>
        <div className="grid gap-3">{draft.bundleKeys.map((bundleKey) => {
          const bundle = bundles.find((item) => item.key === bundleKey);
          const grants = draft.bundleGrants[bundleKey] || [];
          return <div key={bundleKey} className="bg-[var(--dc-surface)] p-3">
            <div className="mb-2 flex items-center justify-between gap-2"><div><strong className="block text-xs">{bundle?.name || bundleKey}</strong><code className="text-[9px] text-[var(--dc-text-muted)]">{bundleKey}</code></div>{canManage && <button type="button" onClick={() => addGrant(bundleKey)} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-black uppercase text-[var(--dc-accent-four)]"><Plus size={13} />Capacidad</button>}</div>
            <div className="grid gap-1.5">{grants.map((grant, index) => {
              const capability = capabilities.find((item) => item.key === grant.capabilityKey);
              return <div key={`${grant.capabilityKey}-${index}`} className="grid grid-cols-[minmax(150px,1fr)_110px_130px_30px] items-center gap-2 bg-[var(--dc-panel)] px-2 py-2 max-[680px]:grid-cols-1">
                <select value={grant.capabilityKey} disabled={!canManage} onChange={(e) => { const next = capabilities.find((item) => item.key === e.target.value); updateGrant(bundleKey, index, { capabilityKey: next.key, capabilityName: next.name, valueType: next.valueType, operation: 'set', value: next.valueType === 'boolean' ? true : 0 }); }} className="min-w-0 bg-[var(--dc-surface)] px-2 py-1.5 text-xs">{capabilities.filter((item) => item.scope === product.targetScope).map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select>
                <select value={grant.operation} disabled={!canManage || capability?.valueType === 'boolean'} onChange={(e) => updateGrant(bundleKey, index, { operation: e.target.value })} className="bg-[var(--dc-surface)] px-2 py-1.5 text-xs"><option value="set">Fijar</option>{capability?.expandable && <option value="add">Sumar</option>}</select>
                {grant.valueType === 'boolean' ? <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(grant.value)} disabled={!canManage} onChange={(e) => updateGrant(bundleKey, index, { value: e.target.checked })} /> Habilitado</label> : <input type="number" min={capability?.hardMin ?? 0} max={capability?.hardMax ?? undefined} value={Number(grant.value || 0)} disabled={!canManage} onChange={(e) => updateGrant(bundleKey, index, { value: Number(e.target.value) })} className="bg-[var(--dc-surface)] px-2 py-1.5 text-xs outline-none" />}
                {canManage && <button type="button" onClick={() => removeGrant(bundleKey, index)} className="grid h-7 w-7 place-items-center text-[var(--dc-alert-error-text)]"><X size={14} /></button>}
              </div>;
            })}{!grants.length && <span className="text-[11px] text-[var(--dc-text-muted)]">Este paquete no otorga capacidades.</span>}</div>
          </div>;
        })}</div>
      </div>
      {canManage && <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={disable} disabled={saving || !product.active} className="inline-flex items-center gap-2 bg-[var(--dc-alert-error-bg)] px-3 py-2 text-xs font-black uppercase text-[var(--dc-alert-error-text)] disabled:opacity-40"><Trash2 size={14} />Quitar</button><button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 bg-[var(--dc-button-primary-bg)] px-4 py-2 text-xs font-black uppercase text-[var(--dc-button-primary-text)] disabled:opacity-50"><Save size={14} />{saving ? 'Guardando…' : 'Guardar'}</button></div>}
    </div>}
  </article>;
}

function NewProduct({ category, canManage, onCreated, onNotice }) {
  const defaults = categoryDefaults[category];
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ key: defaults.key, name: '', description: '', price: '0.00', kind: defaults.kind, targetScope: 'channel', billingInterval: defaults.billingInterval, storeVisible: true });
  if (!canManage) return null;
  const create = async () => {
    const priceCents = moneyToCents(draft.price);
    if (priceCents == null || !draft.name.trim()) return onNotice({ type: 'error', text: 'Completa nombre y precio.' });
    try { setSaving(true); await createSystemCatalogProduct({ ...draft, priceCents, currency: 'MXN', grants: [] }); await onCreated(); onNotice({ type: 'success', text: `${draft.name} creado. Ábrelo para asignarle capacidades.` }); setOpen(false); }
    catch (error) { onNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo crear el producto.' }); }
    finally { setSaving(false); }
  };
  return <div className="mb-3">{!open ? <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 bg-[var(--dc-button-primary-bg)] px-3 py-2 text-xs font-black uppercase text-[var(--dc-button-primary-text)]"><Plus size={15} />Nuevo</button> : <div className="grid gap-3 bg-[var(--dc-surface)] p-4">
    <div className="flex items-center justify-between"><strong className="text-sm">Nuevo producto</strong><button type="button" onClick={() => setOpen(false)}><X size={17} /></button></div>
    <div className="grid grid-cols-2 gap-2 max-[680px]:grid-cols-1">
      <label className="grid gap-1 text-xs font-bold">Key técnica<input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} className="bg-[var(--dc-panel)] px-3 py-2 font-normal outline-none" /></label>
      <label className="grid gap-1 text-xs font-bold">Nombre<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="bg-[var(--dc-panel)] px-3 py-2 font-normal outline-none" /></label>
      <label className="grid gap-1 text-xs font-bold">Precio MXN<input type="number" min="0" step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className="bg-[var(--dc-panel)] px-3 py-2 font-normal outline-none" /></label>
      <label className="grid gap-1 text-xs font-bold">Tipo<select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} className="bg-[var(--dc-panel)] px-3 py-2 font-normal">{category === 'licenses' && <><option value="plan">Plan</option><option value="tool">Herramienta</option><option value="capacity">Capacidad</option></>}{category === 'packages' && <option value="pack">Paquete</option>}{category === 'expansions' && <option value="addon">Expansión</option>}</select></label>
    </div>
    <label className="grid gap-1 text-xs font-bold">Descripción<textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="resize-none bg-[var(--dc-panel)] px-3 py-2 font-normal outline-none" /></label>
    <div className="flex justify-end"><button type="button" onClick={create} disabled={saving} className="inline-flex items-center gap-2 bg-[var(--dc-button-primary-bg)] px-4 py-2 text-xs font-black uppercase text-[var(--dc-button-primary-text)]"><Check size={14} />{saving ? 'Creando…' : 'Crear'}</button></div>
  </div>}</div>;
}

export default function CatalogAdminSection({ catalog, canManage, onReload, onNotice }) {
  const [category, setCategory] = useState('licenses');
  const products = useMemo(() => (catalog?.products || []).filter((product) => product.category === category), [catalog, category]);
  return <div>
    <div className="mb-4 bg-[var(--dc-surface)] p-4"><span className="dc-kicker">FUENTE DE VERDAD</span><h2 className="mb-1 mt-1 text-xl">Catálogo comercial</h2><p className="m-0 text-[12px] leading-5 text-[var(--dc-text-muted)]">Administra productos, precios y capacidades reales. Bootstrap ya no sobrescribe los cambios guardados aquí.</p></div>
    <div className="mb-4 flex flex-wrap gap-1 bg-[var(--dc-surface)] p-1">{categoryTabs.map(([key, label]) => <button key={key} type="button" onClick={() => setCategory(key)} className={`px-4 py-2 text-xs font-black uppercase tracking-[.06em] ${category === key ? 'bg-[var(--dc-panel)] text-[var(--dc-accent-four)]' : 'text-[var(--dc-text-muted)]'}`}>{label}</button>)}</div>
    <NewProduct key={category} category={category} canManage={canManage} onCreated={onReload} onNotice={onNotice} />
    <div className="grid gap-2">{products.map((product) => <ProductEditor key={product.uuid} product={product} capabilities={catalog?.capabilities || []} bundles={catalog?.bundles || []} canManage={canManage} onSaved={onReload} onNotice={onNotice} />)}{!products.length && <p className="text-sm text-[var(--dc-text-muted)]">No hay productos en esta categoría.</p>}</div>
  </div>;
}
