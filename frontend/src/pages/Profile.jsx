import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, RefreshCw, Trash2, UserRound, X } from 'lucide-react';
import api from '../api/axios';
import { getProfile, invalidateProfileCache } from '../api/profile';
import GoogleConnectButton from '../components/auth/GoogleConnectButton';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user, refresh } = useAuth();
  const avatarInput = useRef(null);

  const [profile, setProfile] = useState(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailChallengeId, setEmailChallengeId] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

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

  const handleGoogleConnected = useCallback(async (data) => {
    invalidateProfileCache();
    await loadProfile({ force: true });
    setNotice({ type: 'success', text: data.message });
  }, [loadProfile]);

  const handleGoogleError = useCallback((text) => {
    setNotice({ type: 'error', text });
  }, []);

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

  const requestEmailChange = async () => {
    try {
      setBusy('email'); setNotice(null);
      const { data } = await api.post('/user/profile/email/request', { email: newEmail, currentPassword: emailPassword });
      setEmailChallengeId(data.challengeId); setNotice({ type: 'success', text: data.message });
    } catch (error) { setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo iniciar el cambio de correo' }); }
    finally { setBusy(''); }
  };

  const confirmEmailChange = async () => {
    try {
      setBusy('email-confirm'); setNotice(null);
      const { data } = await api.post('/user/profile/email/confirm', { challengeId: emailChallengeId, code: emailCode });
      invalidateProfileCache();
      setProfile((value) => ({ ...value, ...data.user })); setNewEmail(''); setEmailPassword(''); setEmailCode(''); setEmailChallengeId(''); await refresh();
      setNotice({ type: 'success', text: data.message });
    } catch (error) { setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo confirmar el correo' }); }
    finally { setBusy(''); }
  };

  const disconnectGoogle = async () => {
    try { setBusy('google'); const { data } = await api.delete('/user/profile/google'); invalidateProfileCache(); await loadProfile({ force: true }); setNotice({ type: 'success', text: data.message }); }
    catch (error) { setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo desconectar Google' }); }
    finally { setBusy(''); }
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

  return <div className="mx-auto w-full max-w-[1440px] py-8 pt-7">
    <div className="mb-[18px] flex flex-col items-start justify-between gap-[18px] md:flex-row md:items-end [&_p]:m-0">
      <div><h1 className="dc-page-title">TU <span className="dc-page-title-accent">PERFIL</span></h1><p className="mt-2 text-[var(--dc-text-muted)]">Administra tu información personal y métodos de acceso.</p></div>
      <button className="inline-flex items-center justify-center gap-2  border border-[var(--dc-button-secondary-border)] bg-[var(--dc-button-secondary-bg)] px-3.5 py-2.5 text-[var(--dc-button-secondary-text)] transition hover:bg-[var(--dc-button-secondary-hover)] disabled:cursor-not-allowed disabled:opacity-50" onClick={() => loadProfile({ force: true })}><RefreshCw size={16} /> Actualizar</button>
    </div>

    {notice && <div className={`mb-4 flex items-center gap-2 border px-3.5 py-3 font-semibold ${notice.type === 'error' ? 'border-[var(--dc-alert-error-border)] bg-[var(--dc-alert-error-bg)] text-[var(--dc-alert-error-text)]' : 'border-[var(--dc-alert-success-border)] bg-[var(--dc-alert-success-bg)] text-[var(--dc-alert-success-text)]'}`}><span>{notice.type === 'success' ? <Check size={17} /> : <X size={17} />}</span>{notice.text}</div>}

    <div className="grid grid-cols-1 items-start gap-[18px] md:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="grid gap-[18px] md:sticky md:top-[84px]">
        <section className=" bg-[var(--dc-panel)] p-5 shadow-[0_8px_24px_var(--dc-shadow-soft)] flex flex-col items-center text-center [&_h2]:mb-0.5 [&_h2]:mt-[15px] [&_h2]:text-[22px]">
          <div className="relative h-[126px] w-[126px]">
            {shown?.avatarUrl ? <img className="h-[126px] w-[126px] rounded-full border border-[var(--dc-accent)] bg-[var(--dc-button-secondary-hover)] object-cover" src={shown.avatarUrl} alt="Foto de perfil" /> : <div className="h-[126px] w-[126px] rounded-full border border-[var(--dc-accent)] bg-[var(--dc-button-secondary-hover)] object-cover grid place-items-center text-[42px] font-black">{initial}</div>}
            <button className="absolute bottom-1 right-0.5 grid h-9 w-9 place-items-center rounded-full border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] text-[var(--dc-button-primary-text)] shadow-md disabled:opacity-50" onClick={() => avatarInput.current?.click()} disabled={busy === 'avatar'} aria-label="Cambiar foto"><Camera size={17} /></button>
            <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={uploadAvatar} />
          </div>
          <h2>{shown?.displayName || shown?.username}</h2>
          <span className="text-[var(--dc-text-muted)]">@{shown?.username}</span>
          {/* <div className="my-3 flex flex-wrap justify-center gap-1.5"><span className="inline-flex rounded-full bg-[var(--dc-surface-raised)] px-2 py-1 text-xs">{shown?.role?.name || shown?.role?.key || 'Sin rol'}</span><span className="inline-flex rounded-full bg-[var(--dc-surface-raised)] px-2 py-1 text-xs">{shown?.status || 'Sin estado'}</span></div> */}
          <div className="mb-2 mt-1 flex items-center gap-2"><button className="inline-flex items-center justify-center gap-2  border border-[var(--dc-button-secondary-border)] bg-[var(--dc-button-secondary-bg)] px-3.5 py-2.5 text-[var(--dc-button-secondary-text)] transition hover:bg-[var(--dc-button-secondary-hover)] disabled:cursor-not-allowed disabled:opacity-50" onClick={() => avatarInput.current?.click()} disabled={busy === 'avatar'}><Camera size={16} /> {shown?.avatarUrl ? 'Cambiar foto' : 'Subir foto'}</button>{shown?.avatarUrl && <button className="inline-grid h-9 w-9 place-items-center  bg-[var(--dc-panel)]  transition hover:border-[var(--dc-accent)] disabled:cursor-not-allowed disabled:opacity-50" onClick={deleteAvatar} disabled={busy === 'avatar'} title="Eliminar foto"><Trash2 size={16} /></button>}</div>
          <small className="text-[var(--dc-text-muted)]">JPG, PNG o WEBP · máximo 5 MB</small>
        </section>

        <section className=" bg-[var(--dc-panel)] p-5 shadow-[0_8px_24px_var(--dc-shadow-soft)] grid gap-3.5">
          <div className="mb-[18px] flex items-start gap-2.5 [&>svg]:mt-px [&>svg]:min-w-5 [&>div]:grid [&>div]:min-w-0 [&>div]:gap-1 [&_strong]:text-base [&_span]:text-[13px] [&_span]:text-[var(--dc-text-muted)]"><UserRound size={19} /><div><strong>Datos principales</strong></div></div>
          <div className="grid [&>div]:grid [&>div]:gap-1 [&>div]:border-t [&>div]:border-[var(--dc-line)] [&>div]:py-2.5 [&_span]:text-xs [&_span]:text-[var(--dc-text-muted)] [&_strong]:break-all [&_strong]:text-sm"><div><span>Correo</span><strong>{shown?.email}</strong></div><div><span>Usuario</span><strong>{shown?.username}</strong></div></div>
        </section>
      </aside>

      <div className="grid gap-[18px]">
        <section className=" bg-[var(--dc-panel)] p-5 shadow-[0_8px_24px_var(--dc-shadow-soft)]">
          <div className="mb-[18px] flex items-start gap-2.5 [&>svg]:mt-px [&>svg]:min-w-5 [&>div]:grid [&>div]:min-w-0 [&>div]:gap-1 [&_strong]:text-base [&_span]:text-[13px] [&_span]:text-[var(--dc-text-muted)]"><UserRound size={20} /><div><strong>Información personal</strong><span>Los datos que se muestran dentro del sistema.</span></div></div>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2"><label className="grid gap-1.5 text-sm font-bold">Nombre para mostrar<input className="w-full  border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] px-3 py-[11px] text-[var(--dc-text)] outline-none transition focus:border-[var(--dc-accent)] disabled:cursor-not-allowed disabled:bg-[var(--dc-surface-hover)] disabled:text-[var(--dc-text-disabled)]" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} /></label>
            <label
              className="grid gap-1.5 text-sm font-bold">Correo electrónico<input className="w-full  border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] px-3 py-[11px] text-[var(--dc-text)] outline-none transition focus:border-[var(--dc-accent)] disabled:cursor-not-allowed disabled:bg-[var(--dc-surface-hover)] disabled:text-[var(--dc-text-disabled)]" value={shown?.email || ''} disabled /></label><label className="grid gap-1.5 text-sm font-bold">Nombre de usuario<input className="w-full  border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] px-3 py-[11px] text-[var(--dc-text)] outline-none transition focus:border-[var(--dc-accent)] disabled:cursor-not-allowed disabled:bg-[var(--dc-surface-hover)] disabled:text-[var(--dc-text-disabled)]" value={shown?.username || ''} disabled /></label>
              
          </div>
          <div className="mt-[18px] flex flex-col items-stretch justify-between gap-4 border-t border-[var(--dc-line)] pt-4 md:flex-row md:items-center"><span className="text-[var(--dc-text-muted)]">El nombre de usuario no se cambia aquí. Si quieres cambiar tu correo, hazlo en la sección de abajo.</span><button className="inline-flex items-center justify-center gap-2  border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] px-3.5 py-2.5 text-[var(--dc-button-primary-text)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" onClick={saveProfile} disabled={busy === 'profile'}>{busy === 'profile' ? 'Guardando…' : 'Guardar cambios'}</button></div>
        </section>

        <section className=" bg-[var(--dc-panel)] p-5 shadow-[0_8px_24px_var(--dc-shadow-soft)]">
          <div className="mb-4"><strong className="text-base">Correo y métodos de acceso</strong><p className="mt-1 text-sm text-[var(--dc-text-muted)]">Cambia tu correo con un código de verificación y administra las cuentas que usas para entrar.</p></div>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm font-bold">Nuevo correo<input className="w-full  border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] px-3 py-[11px] text-[var(--dc-text)] outline-none focus:border-[var(--dc-accent)]" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label>
            {hasPassword && <label className="grid gap-1.5 text-sm font-bold">Contraseña actual<input className="w-full  border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] px-3 py-[11px] text-[var(--dc-text)] outline-none focus:border-[var(--dc-accent)]" type="password" value={emailPassword} onChange={(event) => setEmailPassword(event.target.value)} /></label>}
            {!emailChallengeId ? <button className="inline-flex w-fit items-center justify-center  border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] px-3.5 py-2.5 text-[var(--dc-button-primary-text)]" onClick={requestEmailChange} disabled={!newEmail || busy === 'email'}>Enviar código al nuevo correo</button> : <div className="flex flex-wrap gap-2"><input className="w-44  border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] px-3 py-[11px] text-[var(--dc-text)] outline-none focus:border-[var(--dc-accent)]" inputMode="numeric" maxLength={6} placeholder="Código de 6 dígitos" value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, ''))} /><button className=" border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] px-3.5 py-2.5 text-[var(--dc-button-primary-text)]" onClick={confirmEmailChange} disabled={emailCode.length !== 6 || busy === 'email-confirm'}>Confirmar correo</button></div>}
          </div>
          <div className="mt-5 border-t border-[var(--dc-line)] pt-4">
            {connectedAccounts.some((account) => account.provider === 'google') ? <div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="block">Google conectado</strong><span className="text-sm text-[var(--dc-text-muted)]">{connectedAccounts.find((account) => account.provider === 'google')?.email}</span></div><button className=" border border-[var(--dc-button-secondary-border)] bg-[var(--dc-button-secondary-bg)] px-3.5 py-2.5 text-[var(--dc-button-secondary-text)] disabled:opacity-50" onClick={disconnectGoogle} disabled={!hasPassword || busy === 'google'}>{hasPassword ? 'Desconectar Google' : 'Configura una contraseña para desconectar'}</button></div> : <div><strong className="mb-2 block">Conectar Google</strong><GoogleConnectButton onConnected={handleGoogleConnected} onError={handleGoogleError} /></div>}
          </div>
        </section>

      </div>
    </div>
  </div>;
}
