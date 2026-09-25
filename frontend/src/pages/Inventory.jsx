import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, CalendarDays, Check, Clock3, PackageOpen, Unlink } from 'lucide-react';
import { getChannels } from '../api/channels';
import { assignStoreLicense, getStoreLicenses, releaseStoreLicense } from '../api/store';
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

function periodCountdown(days, verb = 'Renueva') {
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
  if (isAccountLicense) return 'EN CUENTA';
  return assignment ? 'EN USO' : 'LIBRE';
}

function licensePeriod(license) {
  const isDev = license.sourceType === 'dev';
  const interval = license.product?.billingInterval;
  const periodEnd = license.currentPeriodEnd || license.endsAt;
  const hardEnd = license.endsAt || (license.cancelAtPeriodEnd ? license.currentPeriodEnd : null);

  if (isDev) {
    const days = daysUntil(periodEnd);
    return {
      label: 'PERIODO SIMULADO',
      value: periodEnd ? `Corte ${formatDate(periodEnd)}` : 'Sin fecha de corte',
      detail: periodEnd ? periodCountdown(days, 'Corte') : 'No genera un cobro real.'
    };
  }

  if (license.cancelAtPeriodEnd) {
    const days = daysUntil(hardEnd);
    return {
      label: 'ACTIVA HASTA',
      value: hardEnd ? formatDate(hardEnd) : 'Fin del periodo actual',
      detail: hardEnd ? periodCountdown(days, 'Termina') : 'No se renovará al terminar el periodo.'
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
      label: 'PRÓXIMA RENOVACIÓN',
      value: formatDate(license.currentPeriodEnd),
      detail: periodCountdown(days, 'Renueva')
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

  const assign = async (license, fallbackUuid) => {
    const channelUuid = selectedChannel[license.uuid] || fallbackUuid;
    if (!channelUuid || busyLicense) return;
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

  const release = async (license, assignment) => {
    if (!assignment?.uuid || busyLicense) return;
    const confirmed = await confirmDialog({
      tone: 'danger',
      title: 'Quitar licencia del lienzo',
      message: `${license.product?.name || 'Esta mejora'} dejará de aplicarse en ${assignment.channel?.name || 'este lienzo'}. La licencia seguirá disponible en tu Inventario y su periodo continuará corriendo.`,
      confirmLabel: 'Quitar licencia',
      cancelLabel: 'Cancelar'
    });
    if (!confirmed) return;

    setBusyLicense(license.uuid);
    setError('');
    try {
      await releaseStoreLicense(license.uuid, assignment.uuid);
      await load({ force: true });
    } catch (reason) {
      setError(reason?.response?.data?.message || reason?.message || 'No se pudo quitar la licencia del lienzo.');
    } finally {
      setBusyLicense('');
    }
  };

  return (
    <div className="dc-inventory-page">
      <div className="dc-store-page-bg" aria-hidden="true" />
      <div className="dc-store-shell">
        <header className="dc-store-page-head">
          <div>
            <span className="dc-store-eyebrow"><Boxes size={14} /> INVENTARIO</span>
            <h1>TUS <strong>//</strong> MEJORAS</h1>
            <p>Consulta el estado de tus licencias y decide en qué lienzo usarlas.</p>
          </div>
        </header>

        {loading && <div className="dc-store-state">Cargando inventario…</div>}
        {error && <div className="dc-store-state error">{error}</div>}

        {!loading && (licenses.length ? (
          <div className="dc-inventory-grid">
            {licenses.map((license) => {
              const assignment = activeAssignment(license);
              const isAccountLicense = license.product?.targetScope === 'account';
              const eligible = (license.eligibleChannelUuids || []).map((uuid) => channelByUuid.get(uuid)).filter(Boolean);
              const fallbackUuid = eligible[0]?.uuid || '';
              const value = selectedChannel[license.uuid] || fallbackUuid;
              const busy = busyLicense === license.uuid;
              const state = licenseState(license, assignment, isAccountLicense);
              const period = licensePeriod(license);
              const assignedDate = assignment?.assignedAt ? formatDate(assignment.assignedAt) : '';
              const isActiveLicense = String(license.status || '').toUpperCase() === 'ACTIVE';
              const isFree = !assignment && !isAccountLicense && isActiveLicense;

              return (
                <article className={`dc-inventory-card${isFree ? ' is-free' : ''}`} key={license.uuid}>
                  <div className="dc-inventory-card-head">
                    <div className="dc-inventory-status-row">
                      <span className="dc-inventory-status">{state}</span>
                      {license.sourceType === 'dev' && <span className="dc-inventory-source">PRUEBA</span>}
                    </div>
                    <h2>{license.product?.name || 'Licencia TRAZIO'}</h2>
                    {license.product?.description && <p className="dc-inventory-description">{license.product.description}</p>}
                  </div>

                  <div className="dc-inventory-facts">
                    <div className="dc-inventory-fact">
                      <div className="dc-inventory-fact-icon"><Check size={16} /></div>
                      <div>
                        <span>APLICACIÓN</span>
                        <b>{isAccountLicense ? 'Activa en tu cuenta' : assignment ? assignment.channel?.name || 'Lienzo asignado' : 'Disponible para asignar'}</b>
                        {assignment && assignedDate && <small>Aplicada desde {assignedDate}</small>}
                        {isFree && <small>El periodo sigue corriendo aunque la licencia esté libre.</small>}
                      </div>
                    </div>

                    <div className="dc-inventory-fact">
                      <div className="dc-inventory-fact-icon"><CalendarDays size={16} /></div>
                      <div>
                        <span>{period.label}</span>
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
                    <button type="button" className="dc-inventory-release" onClick={() => release(license, assignment)} disabled={busy}><Unlink size={15} /> {busy ? 'Quitando…' : 'Quitar del lienzo'}</button>
                  ) : eligible.length ? (
                    <div className="dc-inventory-assign">
                      <select value={value} onChange={(event) => setSelectedChannel((current) => ({ ...current, [license.uuid]: event.target.value }))}>
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
          </div>
        ) : !error && (
          <div className="dc-inventory-empty">
            <PackageOpen size={34} />
            <div><b>Aún no tienes mejoras</b><span>Compra una licencia en Tienda y aparecerá aquí.</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
