import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Laptop, Link2Off, LogOut, Monitor, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import api from '../../api/axios';
import { getProfile, invalidateProfileCache } from '../../api/profile';
import { useAuth } from '../../context/AuthContext';

function deviceInfo(userAgent = '') {
  const ua = String(userAgent).toLowerCase();
  const mobile = /android|iphone|ipad|mobile/.test(ua);
  const os = /windows/.test(ua) ? 'Windows' : /android/.test(ua) ? 'Android' : /iphone|ipad/.test(ua) ? 'iOS/iPadOS' : /mac os|macintosh/.test(ua) ? 'macOS' : /linux/.test(ua) ? 'Linux' : 'Sistema desconocido';
  const browser = /edg\//.test(ua) ? 'Edge' : /chrome\//.test(ua) ? 'Chrome' : /firefox\//.test(ua) ? 'Firefox' : /safari\//.test(ua) ? 'Safari' : 'Navegador desconocido';
  return { mobile, title: `${browser} · ${os}` };
}

const accessProviders = [
  { id: 'google', label: 'Google', icon: '/icons/google.svg' },
  { id: 'twitch', label: 'Twitch', icon: '/icons/twitch.svg' },
  { id: 'kick', label: 'Kick', icon: '/icons/kick.svg' },
  { id: 'discord', label: 'Discord', icon: '/icons/discord.svg' },
];

function formatDate(value) {
  if (!value) return 'Sin registro';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function SecuritySettings({ onNotice, embedded = false }) {
  const { refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [hasPassword, setHasPassword] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [confirmProvider, setConfirmProvider] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let active = true;
    getProfile({ force: true })
      .then((data) => {
        if (!active) return;
        setSessions(data.sessions || []);
        setHasPassword(Boolean(data.hasPassword));
        setConnectedAccounts(data.connectedAccounts || []);
      })
      .catch((error) => {
        if (active) onNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo cargar la seguridad de la cuenta.' });
      });
    return () => { active = false; };
  }, [onNotice]);

  const changePassword = async (event) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      onNotice({ type: 'error', text: 'Las contraseñas nuevas no coinciden.' });
      return;
    }
    try {
      setBusy('password');
      const { data } = await api.patch('/user/profile/password', { currentPassword, newPassword });
      invalidateProfileCache();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setHasPassword(true);
      setSessions((current) => current.filter((session) => session.current));
      onNotice({ type: 'success', text: data.message });
    } catch (error) {
      onNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo cambiar la contraseña.' });
    } finally { setBusy(''); }
  };


  const disconnectProvider = async (provider) => {
    try {
      setBusy(`oauth:${provider}`);
      const { data } = await api.delete(`/user/profile/oauth/${provider}`);
      invalidateProfileCache();
      setConnectedAccounts((current) => current.filter((account) => account.provider !== provider));
      onNotice({ type: 'success', text: data.message });
    } catch (error) {
      onNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo desconectar la cuenta.' });
    } finally {
      setBusy('');
      setConfirmProvider(null);
    }
  };

  const revokeSession = async (session) => {
    try {
      setBusy(`session:${session.id}`);
      const { data } = await api.delete(`/user/profile/sessions/${session.id}`);
      invalidateProfileCache();
      if (data.current) {
        await refresh();
        navigate('/');
        return;
      }
      setSessions((current) => current.filter((row) => row.id !== session.id));
      onNotice({ type: 'success', text: 'Sesión cerrada en ese dispositivo.' });
    } catch (error) {
      onNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo cerrar la sesión.' });
    } finally { setBusy(''); }
  };

  const revokeOthers = async () => {
    try {
      setBusy('others');
      await api.delete('/user/profile/sessions/others');
      invalidateProfileCache();
      setSessions((current) => current.filter((session) => session.current));
      onNotice({ type: 'success', text: 'Se cerraron las demás sesiones.' });
    } catch (error) {
      onNotice({ type: 'error', text: error.response?.data?.message || 'No se pudieron cerrar las demás sesiones.' });
    } finally { setBusy(''); }
  };

  const logoutCurrent = async () => {
    setBusy('logout');
    try { await logout(); }
    finally { navigate('/'); }
  };

  const logoutAll = async () => {
    try {
      setBusy('all');
      await api.delete('/user/profile/sessions');
      await refresh();
    } finally { navigate('/'); }
  };

  return <div className="grid gap-[18px]">
    <section className={embedded ? 'border-t border-[var(--dc-line)] pt-5 first:border-t-0 first:pt-0' : 'bg-[var(--dc-panel)] p-5 shadow-[0_8px_24px_var(--dc-shadow-soft)]'}>
      <div className="mb-[18px] flex items-start gap-2.5"><KeyRound size={20} /><div className="grid gap-1"><strong>Contraseña</strong><span className="text-[13px] text-[var(--dc-text-muted)]">{hasPassword ? 'Actualiza tu contraseña de acceso.' : 'Tu cuenta no tiene contraseña local. Puedes configurar una.'}</span></div></div>
      <form className="grid grid-cols-1 gap-3.5 xl:grid-cols-3 [&>div:last-child]:xl:col-span-full" onSubmit={changePassword}>
        {hasPassword && <label className="grid gap-1.5 text-sm font-bold">Contraseña actual<input className="w-full border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] px-3 py-[11px] text-[var(--dc-text)] outline-none focus:border-[var(--dc-accent-three)]" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>}
        <label className="grid gap-1.5 text-sm font-bold">Nueva contraseña<input className="w-full border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] px-3 py-[11px] text-[var(--dc-text)] outline-none focus:border-[var(--dc-accent-three)]" type="password" autoComplete="new-password" minLength={6} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
        <label className="grid gap-1.5 text-sm font-bold">Confirmar nueva contraseña<input className="w-full border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] px-3 py-[11px] text-[var(--dc-text)] outline-none focus:border-[var(--dc-accent-three)]" type="password" autoComplete="new-password" minLength={6} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
        <div className="mt-[18px] flex flex-col justify-between gap-4 border-t border-[var(--dc-line)] pt-4 md:flex-row md:items-center"><button className="order-1 inline-flex items-center justify-center gap-2 border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] px-3.5 py-2.5 text-[var(--dc-button-primary-text)] disabled:opacity-50" disabled={busy === 'password'}><ShieldCheck size={16} /> {hasPassword ? 'Cambiar contraseña' : 'Configurar contraseña'}</button><span className="order-2 text-right text-[var(--dc-text-muted)]">Mínimo 6 caracteres, una mayúscula y un número.</span></div>
      </form>
    </section>

    <section className={embedded ? 'border-t border-[var(--dc-line)] pt-5 first:border-t-0 first:pt-0' : 'bg-[var(--dc-panel)] p-5 shadow-[0_8px_24px_var(--dc-shadow-soft)]'}>
      <div className="mb-[18px] flex items-start gap-2.5"><Link2Off size={20} /><div className="grid gap-1"><strong>Cuentas conectadas</strong><span className="text-[13px] text-[var(--dc-text-muted)]">Administra los servicios externos que pueden usarse para acceder a tu cuenta.</span></div></div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {accessProviders.map((provider) => {
          const connected = connectedAccounts.some((account) => account.provider === provider.id && account.active !== false);
          if (!connected) return null;
          return <div key={provider.id} className="flex items-center justify-between gap-3 border border-[var(--dc-line)] bg-[var(--dc-button-secondary-bg)] p-3">
            <div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center bg-[var(--dc-panel)] p-2"><img src={provider.icon} alt="" className="h-full w-full object-contain" /></div><div className="grid min-w-0 gap-0.5"><strong>{provider.label}</strong><span className="text-[12px] text-[var(--dc-text-muted)]">Cuenta conectada</span></div></div>
            <button type="button" className="inline-flex shrink-0 items-center justify-center gap-2 border border-[var(--dc-button-secondary-border)] bg-transparent px-3 py-2 text-[12px] font-bold text-[var(--dc-button-secondary-text)] hover:border-[var(--dc-accent-three)] disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setConfirmProvider(provider)} disabled={!hasPassword || busy === `oauth:${provider.id}`} title={hasPassword ? `Desconectar ${provider.label}` : 'Configura una contraseña antes de desconectar'}>Desconectar</button>
          </div>;
        })}
        {connectedAccounts.filter((account) => account.active !== false).length === 0 && <div className="sm:col-span-2 bg-[var(--dc-surface-raised)] p-4 text-[13px] text-[var(--dc-text-muted)]">No tienes cuentas externas conectadas.</div>}
      </div>
      {!hasPassword && connectedAccounts.some((account) => account.active !== false) && <p className="mb-0 mt-3 text-[12px] leading-5 text-[var(--dc-text-muted)]">Configura una contraseña antes de desconectar una cuenta externa para conservar un método de acceso.</p>}
    </section>

    <section className={embedded ? 'border-t border-[var(--dc-line)] pt-5 first:border-t-0 first:pt-0' : 'bg-[var(--dc-panel)] p-5 shadow-[0_8px_24px_var(--dc-shadow-soft)]'}>
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3"><button className="order-1 inline-flex items-center justify-center gap-2 border border-[var(--dc-button-secondary-border)] bg-[var(--dc-button-secondary-bg)] px-3.5 py-2.5 text-[var(--dc-button-secondary-text)] disabled:opacity-50" onClick={revokeOthers} disabled={busy === 'others' || sessions.filter((row) => !row.current).length === 0}><RefreshCw size={15} /> Cerrar las demás</button><div className="order-2 flex min-w-0 items-start gap-2.5 text-right"><div className="grid min-w-0 gap-1"><strong>Dispositivos y sesiones</strong><span className="text-[13px] text-[var(--dc-text-muted)]">Revisa dónde está abierta tu cuenta y cierra accesos individualmente.</span></div><Monitor size={20} className="mt-0.5 shrink-0" /></div></div>
      <div className="grid gap-2.5">
        {sessions.length === 0 && <div className="bg-[var(--dc-surface-raised)] p-4">No hay sesiones activas para mostrar.</div>}
        {sessions.map((session) => {
          const device = deviceInfo(session.userAgent);
          const DeviceIcon = device.mobile ? Smartphone : Laptop;
          return <div className={`grid grid-cols-[42px_minmax(0,1fr)] items-center gap-3 border p-3 md:grid-cols-[42px_minmax(0,1fr)_auto] [&>button]:col-span-full md:[&>button]:col-span-1 ${session.current ? 'border-[var(--dc-accent-four)] bg-[var(--dc-accent-two-soft)]' : 'border-[var(--dc-line)] bg-[var(--dc-button-secondary-bg)]'}`} key={session.id}>
            <div className="grid h-[42px] w-[42px] place-items-center bg-[var(--dc-panel)]"><DeviceIcon size={21} /></div>
            <div className="grid min-w-0 gap-1"><div className="flex flex-wrap items-center gap-2"><strong>{device.title}</strong>{session.current && <span className="inline-flex rounded-full bg-[var(--dc-surface-raised)] px-2 py-1 text-xs">Este dispositivo</span>}</div><span className="text-[13px] text-[var(--dc-text-muted)]">Inicio {formatDate(session.createdAt)}</span><small className="break-all text-[11px] text-[var(--dc-text-dim)]">Expira {formatDate(session.expiresAt)}</small></div>
            <button className="inline-flex items-center justify-center gap-2 border border-[var(--dc-button-secondary-border)] bg-transparent px-3.5 py-2.5 text-[var(--dc-button-secondary-text)] hover:border-[var(--dc-accent-three)] disabled:opacity-50" onClick={() => revokeSession(session)} disabled={busy === `session:${session.id}`}><LogOut size={16} /> Cerrar</button>
          </div>;
        })}
      </div>
    </section>

    <section className={embedded ? 'border-t border-[var(--dc-line)] pt-5 first:border-t-0 first:pt-0' : 'bg-[var(--dc-panel)] p-5 shadow-[0_8px_24px_var(--dc-shadow-soft)]'}>
      <div className="mb-[18px] flex items-start gap-2.5"><LogOut size={20} /><div className="grid gap-1"><strong>Cerrar sesión</strong><span className="text-[13px] text-[var(--dc-text-muted)]">Finaliza esta sesión o revoca todas las sesiones de tu cuenta.</span></div></div>
      <div className="flex flex-wrap gap-2"><button className="inline-flex items-center justify-center gap-2 border border-[var(--dc-button-secondary-border)] bg-[var(--dc-button-secondary-bg)] px-3.5 py-2.5 text-[var(--dc-button-secondary-text)] disabled:opacity-50" onClick={logoutCurrent} disabled={busy === 'logout'}>Cerrar esta sesión</button><button className="inline-flex items-center justify-center gap-2 border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] px-3.5 py-2.5 text-[var(--dc-button-primary-text)] disabled:opacity-50" onClick={logoutAll} disabled={busy === 'all'}>Cerrar en todos los dispositivos</button></div>
    </section>

    {confirmProvider && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmProvider(null); }}><div className="w-full max-w-[420px] bg-[var(--dc-panel)] p-5 shadow-[0_16px_60px_rgba(0,0,0,.45)]" role="dialog" aria-modal="true" aria-labelledby="disconnect-security-title"><h2 id="disconnect-security-title" className="m-0 font-['Bebas_Neue'] text-[1.8rem] font-normal uppercase leading-none">¿DESCONECTAR <span className="text-[var(--dc-accent-four)]">{confirmProvider.label.toUpperCase()}</span>?</h2><p className="mt-3 text-sm leading-6 text-[var(--dc-text-muted)]">Esta cuenta dejará de poder usarse para iniciar sesión en TRAZIO.</p><div className="mt-5 flex justify-end gap-2"><button type="button" className="border border-[var(--dc-button-secondary-border)] bg-[var(--dc-button-secondary-bg)] px-3.5 py-2.5 text-[var(--dc-button-secondary-text)]" onClick={() => setConfirmProvider(null)}>Cancelar</button><button type="button" className="border border-[var(--dc-button-danger-border)] bg-[var(--dc-button-danger-bg)] px-3.5 py-2.5 text-[var(--dc-button-danger-text)] disabled:cursor-not-allowed disabled:opacity-50" onClick={() => disconnectProvider(confirmProvider.id)} disabled={busy === `oauth:${confirmProvider.id}`}>Desconectar</button></div></div></div>}
  </div>;
}
