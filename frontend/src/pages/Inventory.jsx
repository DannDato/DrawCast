import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Clock3, PackageOpen, LockKeyhole } from 'lucide-react';
import { getChannels } from '../api/channels';
import { assignStoreLicense, getStoreLicenses } from '../api/store';
import InventoryLicenseModal from '../components/inventory/InventoryLicenseModal';
import InventoryProductIcon from '../components/inventory/InventoryProductIcon';
import { useSystemAlert } from '../components/ui/SystemAlert';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_FORMATTER = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

function activeAssignment(license) {
  return license.assignments?.find((item) => item.status === 'ACTIVE') || null;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return DATE_FORMATTER.format(date);
}

function daysUntil(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / DAY_MS);
}

function periodCountdown(days, verb = 'Termina') {
  if (days == null) return '';
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? 'día' : 'días'} desde la fecha indicada`;
  if (days === 0) return `${verb} hoy`;
  if (days === 1) return `${verb} en 1 día`;
  return `${verb} en ${days} días`;
}

function licenseState(license, assignment, isAccountLicense) {
  const status = String(license.status || '').toUpperCase();
  if (status === 'EXPIRED') return 'EXPIRADA';
  if (status === 'CANCELED' || status === 'CANCELLED') return 'CANCELADA';
  if (isAccountLicense) return '';
  return assignment ? 'EN USO' : 'LIBRE';
}

function licensePeriod(license) {
  const interval = license.product?.billingInterval;
  const hardEnd = license.endsAt || (license.cancelAtPeriodEnd ? license.currentPeriodEnd : null);

  if (license.cancelAtPeriodEnd) {
    const days = daysUntil(hardEnd);
    return {
      label: 'ACTIVA HASTA',
      value: hardEnd ? formatDate(hardEnd) : 'Fin del periodo actual',
      detail: hardEnd ? periodCountdown(days, 'Termina') : 'Disponible hasta el final del periodo actual.'
    };
  }

  if (license.endsAt) {
    const days = daysUntil(license.endsAt);
    return {
      label: 'VENCE',
      value: formatDate(license.endsAt),
      detail: periodCountdown(days, 'Vence')
    };
  }

  if (interval === 'one_time') {
    return { label: 'VIGENCIA', value: 'Sin vencimiento', detail: 'Licencia permanente.' };
  }

  if (license.currentPeriodEnd) {
    const days = daysUntil(license.currentPeriodEnd);
    return {
      label: 'PERIODO ACTUAL HASTA',
      value: formatDate(license.currentPeriodEnd),
      detail: periodCountdown(days, 'Termina')
    };
  }

  return { label: 'VIGENCIA', value: 'Activa', detail: '' };
}

export default function Inventory() {
  const { confirmDialog } = useSystemAlert();
  const [licenses, setLicenses] = useState([]);
  const [ownedChannels, setOwnedChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState({});
  const [busyLicense, setBusyLicense] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeType, setActiveType] = useState('all');
  const [selectedLicenseUuid, setSelectedLicenseUuid] = useState('');
  const selectedLicense = licenses.find((license) => license.uuid === selectedLicenseUuid);

  const load = useCallback(async ({ force = false } = {}) => {
    const [inventory, channels] = await Promise.all([
      getStoreLicenses({ force }),
      getChannels({ force })
    ]);
    setLicenses(inventory?.licenses || []);
    setOwnedChannels(channels?.ownedChannels || []);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getStoreLicenses(), getChannels()])
      .then(([inventory, channels]) => {
        if (!active) return;
        setLicenses(inventory?.licenses || []);
        setOwnedChannels(channels?.ownedChannels || []);
      })
      .catch((reason) => active && setError(reason?.response?.data?.message || reason?.message || 'No se pudo cargar el inventario.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const channelByUuid = useMemo(() => new Map(ownedChannels.map((channel) => [channel.uuid, channel])), [ownedChannels]);

  const licenseTabs = useMemo(() => {
    const definitions = [
      { id: 'all', label: 'Todas' },
      { id: 'plan', label: 'Planes' },
      { id: 'pack', label: 'Packs' },
      { id: 'tool', label: 'Herramientas' },
      { id: 'addon', label: 'Expansiones' },
      { id: 'capacity', label: 'Capacidad' }
    ];

    return definitions.map((tab) => ({
      ...tab,
      count: tab.id === 'all'
        ? licenses.length
        : licenses.filter((license) => license.product?.kind === tab.id).length
    }));
  }, [licenses]);

  const visibleLicenses = useMemo(() => (
    activeType === 'all'
      ? licenses
      : licenses.filter((license) => license.product?.kind === activeType)
  ), [activeType, licenses]);

  const assign = async (license, fallbackUuid) => {
    const channelUuid = selectedChannel[license.uuid] || fallbackUuid;
    if (!channelUuid || busyLicense) return;
    const confirmed = await confirmDialog({
      title: '¿Seguro que quieres aplicar esta licencia?',
      message: `${license.product?.name || 'Esta mejora'} quedará ligada a ${channelByUuid.get(channelUuid)?.name || 'este lienzo'}. No podrás retirarla ni transferirla a otro lienzo, incluso si eliminas el lienzo original.`,
      confirmLabel: 'Aplicar definitivamente',
      cancelLabel: 'Cancelar'
    });
    if (!confirmed) return;
    setBusyLicense(license.uuid);
    setError('');
    try {
      await assignStoreLicense(license.uuid, channelUuid);
      await load({ force: true });
    } catch (reason) {
      setError(reason?.response?.data?.message || reason?.message || 'No se pudo aplicar la licencia.');
    } finally {
      setBusyLicense('');
    }
  };


  return (
    <div className="dc-inventory-page">
      <div className="dc-inventory-shell dc-app-page">
        <header className="dc-inventory-header">
          <h1 className="dc-page-title">INVENTARIO</h1>
          <p>Administra tus licencias y decide en qué lienzo se aplica cada mejora.</p>
        </header>

        <div className="dc-inventory-toolbar">
          <div className="dc-section-tabs" role="tablist" aria-label="Filtrar licencias por tipo">
            {licenseTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeType === tab.id}
                className={`dc-section-tab${activeType === tab.id ? ' is-active' : ''}`}
                onClick={() => setActiveType(tab.id)}
              >
                {tab.label}
                <span>{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        {loading && <div className="dc-store-state">Cargando inventario…</div>}
        {error && !selectedLicense && <div className="dc-store-state error">{error}</div>}

        {!loading && (visibleLicenses.length ? (
          <div className="dc-inventory-grid">
            {visibleLicenses.map((license) => {
              const status = String(license.status || '').toUpperCase();
              const applied = status === 'ACTIVE' && (license.product?.targetScope === 'account' || Boolean(activeAssignment(license)));
              const state = status === 'ACTIVE' ? applied ? 'Aplicada' : 'Disponible' : status === 'EXPIRED' ? 'Vencida' : ['CANCELED', 'CANCELLED'].includes(status) ? 'Cancelada' : 'Inactiva';

              return (
                <button key={license.uuid} type="button" className="dc-inventory-tile" onClick={() => { setError(''); setSelectedLicenseUuid(license.uuid); }} aria-haspopup="dialog">
                  <span className={`dc-inventory-tile-status ${applied ? 'is-applied' : status === 'ACTIVE' ? 'is-available' : 'is-inactive'}`}>{applied && <Check size={12} />}{state}</span>
                  <InventoryProductIcon product={license.product} size={32} />
                  <span>{license.product?.name || 'Licencia TRAZIO'}</span>
                </button>
              );
            })}
          </div>
        ) : !error && (
          licenses.length ? (
            <div className="dc-inventory-empty">
              <PackageOpen size={34} />
              <div><b>No tienes licencias de este tipo</b><span>Elige otra categoría para seguir revisando tu inventario.</span></div>
            </div>
          ) : (
            <div className="dc-inventory-empty">
              <PackageOpen size={34} />
              <div><b>Aún no tienes mejoras</b><span>Encuentra herramientas, packs y expansiones en la Tienda para personalizar tus lienzos.</span></div>
            </div>
          )
        ))}
      </div>
      {selectedLicense && (
        <InventoryLicenseModal name={selectedLicense.product?.name || 'Licencia TRAZIO'} busy={Boolean(busyLicense)} onClose={() => { setSelectedLicenseUuid(''); setError(''); }}>
          {error && <div className="dc-store-state error" role="alert">{error}</div>}
            {[selectedLicense].map((license) => {
              const assignment = activeAssignment(license);
              const isAccountLicense = license.product?.targetScope === 'account';
              const eligible = (license.eligibleChannelUuids || []).map((uuid) => channelByUuid.get(uuid)).filter(Boolean);
              const fallbackUuid = eligible[0]?.uuid || '';
              const value = selectedChannel[license.uuid] || fallbackUuid;
              const busy = busyLicense === license.uuid;
              const state = licenseState(license, assignment, isAccountLicense);
              const period = licensePeriod(license);
              const isActiveLicense = String(license.status || '').toUpperCase() === 'ACTIVE';
              const isFree = !assignment && !isAccountLicense && isActiveLicense;

              return (
                <article className={`dc-inventory-card${isFree ? ' is-free' : ''}`} key={license.uuid}>
                  <div className="dc-inventory-card-head">
                    {state && (
                      <div className="dc-inventory-status-row">
                        <span className="dc-inventory-status">{state}</span>
                      </div>
                    )}
                    <h2>{license.product?.name || 'Licencia TRAZIO'}</h2>
                    {license.product?.description && <p className="dc-inventory-description">{license.product.description}</p>}
                  </div>

                  <div className="dc-inventory-period">
                    <CalendarDays size={16} />
                    <div className="dc-inventory-period-copy">
                      <span>{period.label}</span>
                      <div className="dc-inventory-period-meta">
                        <b>{period.value}</b>
                        {period.detail && <small><Clock3 size={13} /> {period.detail}</small>}
                      </div>
                    </div>
                  </div>

                  {!isActiveLicense ? (
                    <p className="dc-inventory-unavailable">Esta licencia ya no está activa.</p>
                  ) : isAccountLicense ? (
                    <div className="dc-inventory-active"><Check size={16} /> Se aplica automáticamente a tu cuenta</div>
                  ) : assignment ? (
                    <div className="dc-inventory-active"><LockKeyhole size={16} /><span>Aplicada a {assignment.channel?.name || 'un lienzo eliminado'}. Asignación permanente.</span></div>
                  ) : eligible.length ? (
                    <div className="dc-inventory-assign">
                      <select aria-label="Lienzo donde aplicar la licencia" value={value} onChange={(event) => setSelectedChannel((current) => ({ ...current, [license.uuid]: event.target.value }))}>
                        {eligible.map((channel) => <option key={channel.uuid} value={channel.uuid}>{channel.name}</option>)}
                      </select>
                      <button type="button" onClick={() => assign(license, fallbackUuid)} disabled={busy}>{busy ? 'Aplicando…' : 'Aplicar al lienzo'}</button>
                    </div>
                  ) : (
                    <p className="dc-inventory-unavailable">No tienes un lienzo compatible para esta licencia.</p>
                  )}
                </article>
              );
            })}
        </InventoryLicenseModal>
      )}
    </div>
  );
}
