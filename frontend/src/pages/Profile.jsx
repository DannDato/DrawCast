import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, Check, Trash2, X } from 'lucide-react';
import api from '../api/axios';
import { getProfile, invalidateProfileCache } from '../api/profile';
import GoogleConnectButton from '../components/auth/GoogleConnectButton';
import TwitchAuthButton from '../components/auth/TwitchAuthButton';
import ExternalOAuthButton from '../components/auth/ExternalOAuthButton';
import { useAuth } from '../context/AuthContext';

const accessProviders = [
  { id: 'google', label: 'Google', icon: '/icons/google.svg' },
  { id: 'twitch', label: 'Twitch', icon: '/icons/twitch.svg' },
  { id: 'kick', label: 'Kick', icon: '/icons/kick.svg' },
  { id: 'discord', label: 'Discord', icon: '/icons/discord.svg' },
];

export default function Profile() {
  const { user, refresh } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const avatarInput = useRef(null);
  const [profile, setProfile] = useState(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [confirmProvider, setConfirmProvider] = useState(null);

  const applyProfileData = useCallback((data) => {
    setProfile(data.user);
    setDisplayName(data.user?.displayName || '');
    setHasPassword(Boolean(data.hasPassword));
    setConnectedAccounts(data.connectedAccounts || []);
  }, []);

  const loadProfile = useCallback(async ({ force = false } = {}) => {
    const data = await getProfile({ force });
    applyProfileData(data);
    return data;
  }, [applyProfileData]);

  useEffect(() => {
    let active = true;
    getProfile()
      .then((data) => { if (active) applyProfileData(data); })
      .catch((error) => { if (active) setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo cargar el perfil' }); });
    return () => { active = false; };
  }, [applyProfileData]);

  const oauth = searchParams.get('oauth');
  const oauthProvider = searchParams.get('provider');
  const oauthError = searchParams.get('oauthError');
  const oauthNotice = oauthError ? { type: 'error', text: oauthError } : oauth === 'connected' ? { type: 'success', text: `Cuenta de ${({ google: 'Google', twitch: 'Twitch', kick: 'Kick', discord: 'Discord' })[oauthProvider] || oauthProvider} conectada correctamente.` } : null;

  useEffect(() => {
    if (!oauth && !oauthError) return;
    setSearchParams({}, { replace: true });
  }, [oauth, oauthError, setSearchParams]);

  const handleGoogleConnected = useCallback(async (data) => {
    invalidateProfileCache();
    await loadProfile({ force: true });
    setNotice({ type: 'success', text: data.message });
  }, [loadProfile]);

  const handleGoogleError = useCallback((text) => setNotice({ type: 'error', text }), []);

  const saveProfile = async () => {
    try {
      setBusy('profile');
      setNotice(null);
      const { data } = await api.patch('/user/profile', { displayName });
      invalidateProfileCache();
      setProfile((value) => ({ ...value, ...data.user }));
      await refresh();
      setNotice({ type: 'success', text: 'Perfil actualizado correctamente.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo actualizar el perfil' });
    } finally { setBusy(''); }
  };

  const disconnectProvider = async (provider) => {
    try {
      setBusy(provider);
      setNotice(null);
      const { data } = await api.delete(`/user/profile/oauth/${provider}`);
      invalidateProfileCache();
      await loadProfile({ force: true });
      setNotice({ type: 'success', text: data.message });
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || `No se pudo desconectar ${provider}.` });
    } finally {
      setBusy('');
      setConfirmProvider(null);
    }
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setNotice({ type: 'error', text: 'Usa una imagen JPG, PNG o WEBP.' });
    if (file.size > 5 * 1024 * 1024) return setNotice({ type: 'error', text: 'La imagen no puede superar 5 MB.' });
    try {
      setBusy('avatar');
      setNotice(null);
      const { data } = await api.put('/user/profile/avatar', file, { headers: { 'Content-Type': file.type } });
      invalidateProfileCache();
      setProfile((value) => ({ ...value, avatarUrl: data.avatarUrl }));
      await refresh();
      setNotice({ type: 'success', text: 'Foto de perfil actualizada.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo actualizar la foto' });
    } finally { setBusy(''); }
  };

  const deleteAvatar = async () => {
    try {
      setBusy('avatar');
      const { data } = await api.delete('/user/profile/avatar');
      invalidateProfileCache();
      setProfile((value) => ({ ...value, avatarUrl: data.user?.avatarUrl || null }));
      await refresh();
      setNotice({ type: 'success', text: 'Foto de perfil eliminada.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo eliminar la foto' });
    } finally { setBusy(''); }
  };

  const shown = profile || user;
  const initial = (shown?.displayName || shown?.username || 'U').slice(0, 1).toUpperCase();

  return <div className="mx-auto w-full max-w-[1440px] py-6 pt-4">
    {(oauthNotice || notice) && <div className={`mb-4 flex items-center gap-2 border px-3.5 py-3 font-semibold ${(oauthNotice || notice).type === 'error' ? 'border-[var(--dc-alert-error-border)] bg-[var(--dc-alert-error-bg)] text-[var(--dc-alert-error-text)]' : 'border-[var(--dc-alert-success-border)] bg-[var(--dc-alert-success-bg)] text-[var(--dc-alert-success-text)]'}`}><span>{(oauthNotice || notice).type === 'success' ? <Check size={17} /> : <X size={17} />}</span>{(oauthNotice || notice).text}</div>}

    <div className="grid grid-cols-1 items-stretch gap-[18px] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
      <section className="flex min-h-[400px] h-full flex-col items-center justify-center bg-[var(--dc-panel)] p-5 text-center shadow-[0_8px_24px_var(--dc-shadow-soft)]">
        <div className="relative h-[150px] w-[150px]">
          {shown?.avatarUrl ? <img className="h-[150px] w-[150px] rounded-full border border-[var(--dc-accent-three)] bg-[var(--dc-button-secondary-hover)] object-cover" src={shown.avatarUrl} alt="Foto de perfil" /> : <div className="grid h-[150px] w-[150px] place-items-center rounded-full border border-[var(--dc-accent-three)] bg-[var(--dc-button-secondary-hover)] text-[48px] font-black">{initial}</div>}
          <button className="absolute bottom-1 right-0.5 grid h-9 w-9 place-items-center rounded-full border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] text-[var(--dc-button-primary-text)] shadow-md disabled:opacity-50" onClick={() => avatarInput.current?.click()} disabled={busy === 'avatar'} aria-label="Cambiar foto"><Camera size={17} /></button>
          <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={uploadAvatar} />
        </div>
        <h2 className="mb-0.5 mt-4 text-[24px]">{shown?.displayName || shown?.username}</h2>
        <span className="text-[var(--dc-text-muted)]">@{shown?.username}</span>
        <div className="mb-2 mt-4 flex items-center gap-2"><button className="inline-flex items-center justify-center gap-2 border border-[var(--dc-button-secondary-border)] bg-[var(--dc-button-secondary-bg)] px-3.5 py-2.5 text-[var(--dc-button-secondary-text)] transition hover:bg-[var(--dc-button-secondary-hover)] disabled:cursor-not-allowed disabled:opacity-50" onClick={() => avatarInput.current?.click()} disabled={busy === 'avatar'}><Camera size={16} /> {shown?.avatarUrl ? 'Cambiar foto' : 'Subir foto'}</button>{shown?.avatarUrl && <button className="inline-grid h-9 w-9 place-items-center bg-[var(--dc-panel)] transition hover:bg-[var(--dc-button-secondary-hover)] disabled:cursor-not-allowed disabled:opacity-50" onClick={deleteAvatar} disabled={busy === 'avatar'} title="Eliminar foto"><Trash2 size={16} /></button>}</div>
        <small className="text-[var(--dc-text-muted)]">JPG, PNG o WEBP · máximo 5 MB</small>
      </section>

      <section className="min-h-[400px] h-full bg-[var(--dc-panel)] p-5 shadow-[0_8px_24px_var(--dc-shadow-soft)]">
        <div className="mb-4 flex justify-end"><h1 className="m-0 flex flex-wrap justify-end gap-x-2 font-['Bebas_Neue'] text-[clamp(2.4rem,4vw,3.15rem)] font-normal uppercase leading-[.86] tracking-[-.01em] text-[var(--dc-text)] max-[680px]:text-[2.1rem]"><span>TU</span><span className="text-[var(--dc-accent-four)]">PERFIL</span></h1></div>
        <div className="grid gap-3.5">
          <label className="grid gap-1.5 text-sm font-bold">Nombre para mostrar<input className="w-full border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] px-3 py-[11px] text-[var(--dc-text)] outline-none transition focus:border-[var(--dc-accent-three)] disabled:cursor-not-allowed disabled:bg-[var(--dc-surface-hover)] disabled:text-[var(--dc-text-disabled)]" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} /></label>
          <label className="grid gap-1.5 text-sm font-bold">Correo electrónico<input className="w-full border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] px-3 py-[11px] text-[var(--dc-text)] outline-none transition focus:border-[var(--dc-accent-three)] disabled:cursor-not-allowed disabled:bg-[var(--dc-surface-hover)] disabled:text-[var(--dc-text-disabled)]" value={shown?.email || ''} disabled /></label>
          <label className="grid gap-1.5 text-sm font-bold">Nombre de usuario<input className="w-full border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] px-3 py-[11px] text-[var(--dc-text)] outline-none transition focus:border-[var(--dc-accent-three)] disabled:cursor-not-allowed disabled:bg-[var(--dc-surface-hover)] disabled:text-[var(--dc-text-disabled)]" value={shown?.username || ''} disabled /></label>
        </div>
        <div className="mt-[18px] flex flex-col items-stretch justify-between gap-4 border-t border-[var(--dc-line)] pt-4 md:flex-row md:items-center"><span className="text-[13px] text-[var(--dc-text-muted)]">El nombre de usuario no se cambia aquí.</span><button className="inline-flex items-center justify-center gap-2 border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] px-3.5 py-2.5 text-[var(--dc-button-primary-text)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" onClick={saveProfile} disabled={busy === 'profile'}>{busy === 'profile' ? 'Guardando…' : 'Guardar cambios'}</button></div>
      </section>

      <div className="h-full min-h-[400px]">
        <section className="flex h-full min-h-[400px] flex-col bg-[var(--dc-panel)] p-5 shadow-[0_8px_24px_var(--dc-shadow-soft)]">
          <div className="mb-2"><h2 className="m-0 flex flex-wrap justify-end gap-x-2 font-['Bebas_Neue'] text-[2rem] font-normal uppercase leading-none tracking-[.02em] text-[var(--dc-text)] max-[680px]:text-[1.6rem]"><span>MÉTODOS DE</span><span className="text-[var(--dc-accent-one)]">ACCESO</span></h2><p className="mt-2 text-right text-[13px] leading-5 text-[var(--dc-text-muted)]">Administra las cuentas externas que puedes usar para iniciar sesión en TRAZIO.</p></div>
          <div className="my-4 flex items-center justify-center"><div className="flex flex-wrap justify-center gap-2">
            {accessProviders.map((provider) => {
              const account = connectedAccounts.find((item) => item.provider === provider.id && item.active !== false);
              const connected = Boolean(account);
              const disabled = busy === provider.id || (!hasPassword && connected);
              const cardClass = `grid h-[56px] w-[56px] place-items-center border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] p-2.5 transition ${connected ? 'shadow-[0_0_18px_var(--dc-shadow-soft)] hover:border-[var(--dc-accent-four)]' : 'grayscale opacity-55 hover:opacity-90'} disabled:cursor-not-allowed disabled:opacity-50`;
              if (provider.id === 'google' && !connected) return <GoogleConnectButton key={provider.id} iconOnly onConnected={handleGoogleConnected} onError={handleGoogleError} className={cardClass} />;
              if (provider.id === 'twitch' && !connected) return <TwitchAuthButton key={provider.id} iconOnly connectMode onError={(text) => setNotice({ type: 'error', text })} className={cardClass} />;
              if ((provider.id === 'kick' || provider.id === 'discord') && !connected) return <ExternalOAuthButton key={provider.id} provider={provider.id} iconOnly connectMode onError={(text) => setNotice({ type: 'error', text })} className={cardClass} />;
              return <button key={provider.id} type="button" className={cardClass} onClick={() => connected && hasPassword && setConfirmProvider(provider)} disabled={disabled || !connected} title={connected ? (hasPassword ? `Desconectar ${provider.label}` : 'Configura una contraseña para desconectar') : `Conectar ${provider.label}`}><img src={provider.icon} alt={provider.label} className="h-full w-full object-contain" /></button>;
            })}
          </div></div>
          <p className="m-0 text-center text-[12px] leading-5 text-[var(--dc-text-muted)]">{hasPassword ? 'Puedes desconectar una cuenta cuando quieras. Si vuelves a conectarla, se reactiva como método de acceso.' : 'Configura una contraseña en Configuración → Seguridad para poder desconectar una cuenta social.'}</p>
        </section>
      </div>
    </div>

    {confirmProvider && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmProvider(null); }}><div className="w-full max-w-[420px] bg-[var(--dc-panel)] p-5 shadow-[0_16px_60px_rgba(0,0,0,.45)]" role="dialog" aria-modal="true" aria-labelledby="disconnect-title"><h2 id="disconnect-title" className="m-0 font-['Bebas_Neue'] text-[1.8rem] font-normal uppercase leading-none">¿DESCONECTAR <span className="text-[var(--dc-accent-four)]">{confirmProvider.label.toUpperCase()}</span>?</h2><p className="mt-3 text-sm leading-6 text-[var(--dc-text-muted)]">¿Estás seguro de que deseas desconectar {confirmProvider.label} de tu cuenta?</p><div className="mt-5 flex justify-end gap-2"><button type="button" className="border border-[var(--dc-button-secondary-border)] bg-[var(--dc-button-secondary-bg)] px-3.5 py-2.5 text-[var(--dc-button-secondary-text)]" onClick={() => setConfirmProvider(null)}>Cancelar</button><button type="button" className="border border-[var(--dc-button-danger-border)] bg-[var(--dc-button-danger-bg)] px-3.5 py-2.5 text-[var(--dc-button-danger-text)] disabled:cursor-not-allowed disabled:opacity-50" onClick={() => disconnectProvider(confirmProvider.id)} disabled={busy === confirmProvider.id}>Desconectar</button></div></div></div>}
  </div>;
}
