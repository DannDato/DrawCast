import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Check, KeyRound, Laptop, LogOut, Monitor, RefreshCw, ShieldCheck, Smartphone, Trash2, UserRound, X } from 'lucide-react';
import api from '../api/axios';
import GoogleConnectButton from '../components/auth/GoogleConnectButton';
import { useAuth } from '../context/AuthContext';

function deviceInfo(userAgent = '') {
  const ua = String(userAgent).toLowerCase();
  const mobile = /android|iphone|ipad|mobile/.test(ua);
  const os = /windows/.test(ua) ? 'Windows' : /android/.test(ua) ? 'Android' : /iphone|ipad/.test(ua) ? 'iOS/iPadOS' : /mac os|macintosh/.test(ua) ? 'macOS' : /linux/.test(ua) ? 'Linux' : 'Sistema desconocido';
  const browser = /edg\//.test(ua) ? 'Edge' : /chrome\//.test(ua) ? 'Chrome' : /firefox\//.test(ua) ? 'Firefox' : /safari\//.test(ua) ? 'Safari' : 'Navegador desconocido';
  return { mobile, title: `${browser} · ${os}` };
}

function formatDate(value) {
  if (!value) return 'Sin registro';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function Profile() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const avatarInput = useRef(null);

  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [hasPassword, setHasPassword] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailChallengeId, setEmailChallengeId] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

  const loadProfile = useCallback(async () => {
    const { data } = await api.get('/user/profile');
    setProfile(data.user);
    setDisplayName(data.user?.displayName || '');
    setSessions(data.sessions || []);
    setHasPassword(Boolean(data.hasPassword));
    setConnectedAccounts(data.connectedAccounts || []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProfile().catch((error) => setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo cargar el perfil' }));
  }, [loadProfile]);

  const saveProfile = async () => {
    try {
      setBusy('profile');
      setNotice(null);
      const { data } = await api.patch('/user/profile', { displayName });
      setProfile((value) => ({ ...value, ...data.user }));
      await refresh();
      setNotice({ type: 'success', text: 'Perfil actualizado correctamente.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo actualizar el perfil' });
    } finally { setBusy(''); }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) return setNotice({ type: 'error', text: 'Las contraseñas nuevas no coinciden.' });

    try {
      setBusy('password');
      setNotice(null);
      const { data } = await api.patch('/user/profile/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setHasPassword(true);
      setNotice({ type: 'success', text: data.message });
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo cambiar la contraseña' });
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
      setProfile((value) => ({ ...value, ...data.user })); setNewEmail(''); setEmailPassword(''); setEmailCode(''); setEmailChallengeId(''); await refresh();
      setNotice({ type: 'success', text: data.message });
    } catch (error) { setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo confirmar el correo' }); }
    finally { setBusy(''); }
  };

  const disconnectGoogle = async () => {
    try { setBusy('google'); const { data } = await api.delete('/user/profile/google'); await loadProfile(); setNotice({ type: 'success', text: data.message }); }
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
      setProfile((value) => ({ ...value, avatarUrl: data.user?.avatarUrl || null }));
      await refresh();
      setNotice({ type: 'success', text: 'Foto de perfil eliminada.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo eliminar la foto' });
    } finally { setBusy(''); }
  };

  const revokeSession = async (session) => {
    try {
      setBusy(`session:${session.id}`);
      const { data } = await api.delete(`/user/profile/sessions/${session.id}`);
      if (data.current) {
        await refresh();
        navigate('/login');
        return;
      }
      setSessions((value) => value.filter((row) => row.id !== session.id));
      setNotice({ type: 'success', text: 'Sesión cerrada en ese dispositivo.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo cerrar la sesión' });
    } finally { setBusy(''); }
  };

  const revokeOthers = async () => {
    try {
      setBusy('others');
      await api.delete('/user/profile/sessions/others');
      setSessions((value) => value.filter((session) => session.current));
      setNotice({ type: 'success', text: 'Se cerraron las demás sesiones.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudieron cerrar las demás sesiones' });
    } finally { setBusy(''); }
  };

  const logoutCurrent = async () => {
    setBusy('logout');
    try { await logout(); }
    finally { navigate('/login'); }
  };

  const logoutAll = async () => {
    try {
      setBusy('all');
      await api.delete('/user/profile/sessions');
      await refresh();
    } finally { navigate('/login'); }
  };

  const shown = profile || user;
  const initial = (shown?.displayName || shown?.username || 'U').slice(0, 1).toUpperCase();

  return <div className="mx-auto w-[min(1200px,calc(100%-32px))] py-8 pt-7">
    <div className="mb-[18px] flex flex-col items-start justify-between gap-[18px] md:flex-row md:items-end [&_h1]:my-1 [&_h1]:text-[clamp(32px,5vw,48px)] [&_h1]:leading-none [&_p]:m-0">
      <div><span className="inline-block text-[11px] font-black uppercase tracking-[.1em] ">Mi cuenta</span><h1>Perfil</h1><p className="">Administra tu información, seguridad y sesiones activas.</p></div>
      <button className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--dc-accent)] bg-[var(--dc-accent)] px-3.5 py-2.5 font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 bg-[#101216]  hover:bg-[#171a20]" onClick={loadProfile}><RefreshCw size={16} /> Actualizar</button>
    </div>

    {notice && <div className={`mb-4 flex items-center gap-2 rounded-xl border border-[var(--dc-accent)] px-3.5 py-3 font-semibold ${notice.type === 'error' ? 'bg-[#171a20]' : 'bg-[#101216]'}`}><span>{notice.type === 'success' ? <Check size={17} /> : <X size={17} />}</span>{notice.text}</div>}

    <div className="grid grid-cols-1 items-start gap-[18px] md:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="grid gap-[18px] md:sticky md:top-[84px]">
        <section className="rounded-2xl border border-[#2a2e37] bg-[#101216] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.06)] flex flex-col items-center text-center [&_h2]:mb-0.5 [&_h2]:mt-[15px] [&_h2]:text-[22px]">
          <div className="relative h-[126px] w-[126px]">
            {shown?.avatarUrl ? <img className="h-[126px] w-[126px] rounded-full border border-[var(--dc-accent)] bg-[#171a20] object-cover" src={shown.avatarUrl} alt="Foto de perfil" /> : <div className="h-[126px] w-[126px] rounded-full border border-[var(--dc-accent)] bg-[#171a20] object-cover grid place-items-center text-[42px] font-black">{initial}</div>}
            <button className="absolute bottom-1 right-0.5 grid h-9 w-9 place-items-center rounded-full border border-[var(--dc-accent)] bg-[var(--dc-accent)] text-white shadow-md disabled:opacity-50" onClick={() => avatarInput.current?.click()} disabled={busy === 'avatar'} aria-label="Cambiar foto"><Camera size={17} /></button>
            <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={uploadAvatar} />
          </div>
          <h2>{shown?.displayName || shown?.username}</h2>
          <span className="">@{shown?.username}</span>
          {/* <div className="my-3 flex flex-wrap justify-center gap-1.5"><span className="inline-flex rounded-full border border-[#2a2e37] bg-[#171a20] px-2 py-1 text-xs">{shown?.role?.name || shown?.role?.key || 'Sin rol'}</span><span className="inline-flex rounded-full border border-[#2a2e37] bg-[#171a20] px-2 py-1 text-xs">{shown?.status || 'Sin estado'}</span></div> */}
          <div className="mb-2 mt-1 flex items-center gap-2"><button className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--dc-accent)] bg-[var(--dc-accent)] px-3.5 py-2.5 font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 bg-[#101216]  hover:bg-[#171a20]" onClick={() => avatarInput.current?.click()} disabled={busy === 'avatar'}><Camera size={16} /> {shown?.avatarUrl ? 'Cambiar foto' : 'Subir foto'}</button>{shown?.avatarUrl && <button className="inline-grid h-9 w-9 place-items-center rounded-md border border-[#2a2e37] bg-[#101216]  transition hover:border-[var(--dc-accent)] disabled:cursor-not-allowed disabled:opacity-50" onClick={deleteAvatar} disabled={busy === 'avatar'} title="Eliminar foto"><Trash2 size={16} /></button>}</div>
          <small className="">JPG, PNG o WEBP · máximo 5 MB</small>
        </section>

        <section className="rounded-2xl border border-[#2a2e37] bg-[#101216] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.06)] grid gap-3.5">
          <div className="mb-[18px] flex items-start gap-2.5 [&>svg]:mt-px [&>svg]:min-w-5 [&>div]:grid [&>div]:min-w-0 [&>div]:gap-1 [&_strong]:text-base [&_span]:text-[13px] [&_span]:"><UserRound size={19} /><div><strong>Datos principales</strong></div></div>
          <div className="grid [&>div]:grid [&>div]:gap-1 [&>div]:border-t [&>div]:border-[#2a2e37] [&>div]:py-2.5 [&_span]:text-xs [&_span]: [&_strong]:break-all [&_strong]:text-sm"><div><span>Correo</span><strong>{shown?.email}</strong></div><div><span>Usuario</span><strong>{shown?.username}</strong></div></div>
        </section>
      </aside>

      <div className="grid gap-[18px]">
        <section className="rounded-2xl border border-[#2a2e37] bg-[#101216] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          <div className="mb-[18px] flex items-start gap-2.5 [&>svg]:mt-px [&>svg]:min-w-5 [&>div]:grid [&>div]:min-w-0 [&>div]:gap-1 [&_strong]:text-base [&_span]:text-[13px] [&_span]:"><UserRound size={20} /><div><strong>Información personal</strong><span>Los datos que se muestran dentro del sistema.</span></div></div>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2"><label className="grid gap-1.5 text-sm font-bold">Nombre para mostrar<input className="w-full rounded-md border border-[#353942] bg-[#101216] px-3 py-[11px] text-[#ebebeb] outline-none transition focus:border-[var(--dc-accent)] disabled:cursor-not-allowed disabled:bg-[#171a20] disabled:" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} /></label>
            <label
              className="grid gap-1.5 text-sm font-bold">Correo electrónico<input className="w-full rounded-md border border-[#353942] bg-[#101216] px-3 py-[11px] text-[#ebebeb] outline-none transition focus:border-[var(--dc-accent)] disabled:cursor-not-allowed disabled:bg-[#171a20] disabled:" value={shown?.email || ''} disabled /></label><label className="grid gap-1.5 text-sm font-bold">Nombre de usuario<input className="w-full rounded-md border border-[#353942] bg-[#101216] px-3 py-[11px] text-[#ebebeb] outline-none transition focus:border-[var(--dc-accent)] disabled:cursor-not-allowed disabled:bg-[#171a20] disabled:" value={shown?.username || ''} disabled /></label>
              
          </div>
          <div className="mt-[18px] flex flex-col items-stretch justify-between gap-4 border-t border-[#2a2e37] pt-4 md:flex-row md:items-center"><span className="">Usuario y correo se mantienen bloqueados desde esta pantalla base.</span><button className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--dc-accent)] bg-[var(--dc-accent)] px-3.5 py-2.5 font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" onClick={saveProfile} disabled={busy === 'profile'}>{busy === 'profile' ? 'Guardando…' : 'Guardar cambios'}</button></div>
        </section>

        <section className="rounded-2xl border border-[#2a2e37] bg-[#101216] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          <div className="mb-4"><strong className="text-base">Correo y métodos de acceso</strong><p className="mt-1 text-sm text-[#7e8592]">Cambia tu correo mediante código de verificación y administra Google.</p></div>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm font-bold">Nuevo correo<input className="w-full rounded-md border border-[#353942] bg-[#101216] px-3 py-[11px] text-[#ebebeb] outline-none focus:border-[var(--dc-accent)]" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label>
            {hasPassword && <label className="grid gap-1.5 text-sm font-bold">Contraseña actual<input className="w-full rounded-md border border-[#353942] bg-[#101216] px-3 py-[11px] text-[#ebebeb] outline-none focus:border-[var(--dc-accent)]" type="password" value={emailPassword} onChange={(event) => setEmailPassword(event.target.value)} /></label>}
            {!emailChallengeId ? <button className="inline-flex w-fit items-center justify-center rounded-md border border-[var(--dc-accent)] bg-[var(--dc-accent)] px-3.5 py-2.5 font-extrabold text-white" onClick={requestEmailChange} disabled={!newEmail || busy === 'email'}>Enviar código al nuevo correo</button> : <div className="flex flex-wrap gap-2"><input className="w-44 rounded-md border border-[#353942] bg-[#101216] px-3 py-[11px] text-[#ebebeb] outline-none focus:border-[var(--dc-accent)]" inputMode="numeric" maxLength={6} placeholder="Código de 6 dígitos" value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, ''))} /><button className="rounded-md border border-[var(--dc-accent)] bg-[var(--dc-accent)] px-3.5 py-2.5 font-extrabold text-white" onClick={confirmEmailChange} disabled={emailCode.length !== 6 || busy === 'email-confirm'}>Confirmar correo</button></div>}
          </div>
          <div className="mt-5 border-t border-[#2a2e37] pt-4">
            {connectedAccounts.some((account) => account.provider === 'google') ? <div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="block">Google conectado</strong><span className="text-sm text-[#7e8592]">{connectedAccounts.find((account) => account.provider === 'google')?.email}</span></div><button className="rounded-md border border-[var(--dc-accent)] bg-[#101216] px-3.5 py-2.5 font-extrabold text-[#ebebeb] disabled:opacity-50" onClick={disconnectGoogle} disabled={!hasPassword || busy === 'google'}>{hasPassword ? 'Desconectar Google' : 'Configura una contraseña para desconectar'}</button></div> : <div><strong className="mb-2 block">Conectar Google</strong><GoogleConnectButton onConnected={async (data) => { await loadProfile(); setNotice({ type: 'success', text: data.message }); }} onError={(text) => setNotice({ type: 'error', text })} /></div>}
          </div>
        </section>

        <section className="rounded-2xl border border-[#2a2e37] bg-[#101216] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          <div className="mb-[18px] flex items-start gap-2.5 [&>svg]:mt-px [&>svg]:min-w-5 [&>div]:grid [&>div]:min-w-0 [&>div]:gap-1 [&_strong]:text-base [&_span]:text-[13px] [&_span]:"><KeyRound size={20} /><div><strong>Contraseña</strong><span>{hasPassword ? 'Actualiza tu contraseña de acceso.' : 'Tu cuenta no tiene contraseña local. Puedes configurar una.'}</span></div></div>
          <form className="grid grid-cols-1 gap-3.5 xl:grid-cols-3 [&>div:last-child]:xl:col-span-full" onSubmit={changePassword}>
            {hasPassword && <label className="grid gap-1.5 text-sm font-bold">Contraseña actual<input className="w-full rounded-md border border-[#353942] bg-[#101216] px-3 py-[11px] text-[#ebebeb] outline-none transition focus:border-[var(--dc-accent)] disabled:cursor-not-allowed disabled:bg-[#171a20] disabled:" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>}
            <label className="grid gap-1.5 text-sm font-bold">Nueva contraseña<input className="w-full rounded-md border border-[#353942] bg-[#101216] px-3 py-[11px] text-[#ebebeb] outline-none transition focus:border-[var(--dc-accent)] disabled:cursor-not-allowed disabled:bg-[#171a20] disabled:" type="password" autoComplete="new-password" minLength={6} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
            <label className="grid gap-1.5 text-sm font-bold">Confirmar nueva contraseña<input className="w-full rounded-md border border-[#353942] bg-[#101216] px-3 py-[11px] text-[#ebebeb] outline-none transition focus:border-[var(--dc-accent)] disabled:cursor-not-allowed disabled:bg-[#171a20] disabled:" type="password" autoComplete="new-password" minLength={6} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
            <div className="mt-[18px] flex flex-col items-stretch justify-between gap-4 border-t border-[#2a2e37] pt-4 md:flex-row md:items-center"><span className="">Mínimo 6 caracteres, una mayúscula y un número.</span><button className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--dc-accent)] bg-[var(--dc-accent)] px-3.5 py-2.5 font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy === 'password'}><ShieldCheck size={16} /> {hasPassword ? 'Cambiar contraseña' : 'Configurar contraseña'}</button></div>
          </form>
        </section>

        <section className="rounded-2xl border border-[#2a2e37] bg-[#101216] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          <div className="mb-[18px] flex items-start gap-2.5 [&>svg]:mt-px [&>svg]:min-w-5 [&>div]:grid [&>div]:min-w-0 [&>div]:gap-1 [&_strong]:text-base [&_span]:text-[13px] [&_span]: flex-wrap items-start md:items-center [&_.btn]:md:ml-auto [&_.btn]:whitespace-nowrap"><Monitor size={20} /><div><strong>Dispositivos y sesiones</strong><span>Revisa dónde está abierta tu cuenta y cierra accesos individualmente.</span></div>
            <button className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--dc-accent)] bg-[#101216] px-3.5 py-2.5 font-extrabold text-[#ebebeb] transition hover:bg-[#171a20] disabled:cursor-not-allowed disabled:opacity-50" onClick={revokeOthers} disabled={busy === 'others' || sessions.filter((row) => !row.current).length === 0}>Cerrar las demás</button>
          </div>
          <div className="grid gap-2.5">
            {sessions.length === 0 && <div className="rounded-xl border border-[#2a2e37] bg-[#171a20] p-4 ">No hay sesiones activas para mostrar.</div>}
            {sessions.map((session) => {
              const device = deviceInfo(session.userAgent);
              const DeviceIcon = device.mobile ? Smartphone : Laptop;
              return <div className={`grid grid-cols-[42px_minmax(0,1fr)] items-center gap-3 rounded-xl border p-3 md:grid-cols-[42px_minmax(0,1fr)_auto] [&>button]:col-span-full md:[&>button]:col-span-1 ${session.current ? 'border-[var(--dc-accent)] bg-[#171a20]' : 'border-[#2a2e37] bg-[#101216]'}`} key={session.id}>
                <div className="grid h-[42px] w-[42px] place-items-center rounded-xl border border-[#2a2e37] bg-[#101216]"><DeviceIcon size={21} /></div>
                <div className="grid min-w-0 gap-1 [&>div]:flex [&>div]:flex-wrap [&>div]:items-center [&>div]:gap-2 [&>span]:break-all [&>span]:text-[13px] [&>span]: [&>small]:break-all [&>small]:text-[11px] [&>small]:"><div><strong>{device.title}</strong>{session.current && <span className="inline-flex rounded-full border border-[#2a2e37] bg-[#171a20] px-2 py-1 text-xs">Este dispositivo</span>}</div><span>{session.ip || 'IP no disponible'} · Inicio {formatDate(session.createdAt)}</span><small>Expira {formatDate(session.expiresAt)}</small></div>
                <button className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--dc-accent)] bg-[var(--dc-accent)] px-3.5 py-2.5 font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 border-[#2a2e37] bg-transparent  hover:border-[var(--dc-accent)] hover:bg-[#171a20]" onClick={() => revokeSession(session)} disabled={busy === `session:${session.id}`}><LogOut size={16} /> Cerrar</button>
              </div>;
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-[#2a2e37] bg-[#101216] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.06)] ">
          <div className="mb-[18px] flex items-start gap-2.5 [&>svg]:mt-px [&>svg]:min-w-5 [&>div]:grid [&>div]:min-w-0 [&>div]:gap-1 [&_strong]:text-base [&_span]:text-[13px] [&_span]:"><LogOut size={20} /><div><strong>Cerrar sesión</strong><span>Finaliza esta sesión o revoca todas las sesiones de tu cuenta.</span></div></div>
          <div className="flex flex-wrap gap-2"><button className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--dc-accent)] bg-[var(--dc-accent)] px-3.5 py-2.5 font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 bg-[#101216]  hover:bg-[#171a20]" onClick={logoutCurrent} disabled={busy === 'logout'}>Cerrar esta sesión</button><button className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--dc-accent)] bg-[var(--dc-accent)] px-3.5 py-2.5 font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" onClick={logoutAll} disabled={busy === 'all'}>Cerrar en todos los dispositivos</button></div>
        </section>
      </div>
    </div>
  </div>;
}
