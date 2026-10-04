import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, Check, Copy, KeyRound, Link2, PackageOpen, Power, Search, Settings2, UserRoundCheck, Users, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createRegistrationInvite, getAdminSystemModules, getRegistrationInvites, getSystemCatalog, getSystemCollaborators, getSystemPermissions, getSystemUsers, grantSystemCollabLicense, revokeRegistrationInvite, revokeSystemCollabLicense, saveSystemUserPermissions, setAdminSystemModule } from '../api/systemAdmin';
import CatalogAdminSection from '../components/admin/CatalogAdminSection';

const sections = [
  { id: 'modules', label: 'Bloqueos', title: ['CONTROL', 'DE ACCESO'], icon: Power, permission: 'admin.modules.manage' },
  { id: 'catalog', label: 'Catálogo', title: ['CATÁLOGO', 'COMERCIAL'], icon: PackageOpen, permission: 'admin.catalog.read' },
  { id: 'registration-invites', label: 'Invitaciones', title: ['REGISTRO', 'POR INVITACIÓN'], icon: Link2, permission: 'admin.registration_invites.read' },
  { id: 'users', label: 'Usuarios', title: ['USUARIOS', 'Y PERMISOS'], icon: Users, permission: 'admin.users.read' },
  { id: 'collaborators', label: 'Colaboradores', title: ['LICENCIAS', 'COLLAB'], icon: UserRoundCheck, permission: 'admin.collaborators.read' },
  { id: 'permissions', label: 'Permisos', title: ['CATÁLOGO', 'DE PERMISOS'], icon: KeyRound }
];

const accent = 'var(--dc-accent-four)';
const soft = 'var(--dc-accent-four-soft)';

function Notice({ notice }) {
  if (!notice) return null;
  return <div className={`mb-4 flex items-center gap-2 border px-3.5 py-3 font-semibold ${notice.type === 'error' ? 'border-[var(--dc-alert-error-border)] bg-[var(--dc-alert-error-bg)] text-[var(--dc-alert-error-text)]' : 'border-[var(--dc-alert-success-border)] bg-[var(--dc-alert-success-bg)] text-[var(--dc-alert-success-text)]'}`}>{notice.type === 'success' ? <Check size={17} /> : <X size={17} />}{notice.text}</div>;
}


function ModulesSection({ modules, onChange, onNotice }) {
  const [working, setWorking] = useState(null);
  const orderedKeys = ['login', 'registration', 'editor', 'store'];

  const toggle = async (moduleKey, enabled) => {
    try {
      setWorking(moduleKey);
      onNotice(null);
      await setAdminSystemModule(moduleKey, enabled);
      window.dispatchEvent(new CustomEvent('TRAZIO:system-modules-changed', { detail: { moduleKey, enabled } }));
      await onChange();
      const label = modules?.[moduleKey]?.label || moduleKey;
      onNotice({ type: 'success', text: `${label} ${enabled ? 'habilitado' : 'bloqueado'}.` });
    } catch (error) {
      onNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo actualizar el bloqueo.' });
    } finally { setWorking(null); }
  };

  return <div className="grid gap-2">
    <div className="mb-2 border border-[var(--dc-line)] p-4">
      <span className="dc-kicker">ACCESO GLOBAL</span>
      <h2 className="mb-1 mt-1 text-xl">Bloqueos del sistema</h2>
      <p className="m-0 text-[12px] leading-5 text-[var(--dc-text-muted)]">Apaga temporalmente módulos completos. La validación se aplica tanto en frontend como en backend.</p>
    </div>
    {orderedKeys.map((moduleKey) => {
      const module = modules?.[moduleKey];
      if (!module) return null;
      const enabled = module.enabled !== false;
      return <article key={moduleKey} className="flex items-center justify-between gap-4 border border-[var(--dc-line)] p-4 max-[560px]:items-start">
        <div><strong className="block text-sm">{module.label}</strong><span className="mt-1 block text-[11px] text-[var(--dc-text-muted)]">{enabled ? 'Disponible para los usuarios.' : 'Acceso bloqueado globalmente.'}</span></div>
        <button type="button" disabled={working === moduleKey} onClick={() => toggle(moduleKey, !enabled)} aria-pressed={enabled} className={`min-w-[92px] border px-3 py-2 text-xs font-black uppercase tracking-[.06em] disabled:opacity-50 ${enabled ? 'border-[var(--dc-alert-success-border)] bg-[var(--dc-alert-success-bg)] text-[var(--dc-alert-success-text)]' : 'border-[var(--dc-alert-error-border)] bg-[var(--dc-alert-error-bg)] text-[var(--dc-alert-error-text)]'}`}>{working === moduleKey ? '...' : enabled ? 'ENCENDIDO' : 'APAGADO'}</button>
      </article>;
    })}
  </div>;
}

function PermissionsSection({ permissions }) {
  return <div className="grid gap-2">
    {permissions.map((permission) => <article key={permission.key} className="border border-[var(--dc-line)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{permission.name}</strong><code className="text-[11px] text-[var(--dc-text-muted)]">{permission.key}</code></div>
      {permission.description && <p className="mb-0 mt-1 text-[12px] leading-5 text-[var(--dc-text-muted)]">{permission.description}</p>}
    </article>)}
  </div>;
}

function UsersSection({ users, permissions, canManage, onReload, onNotice }) {
  const [query, setQuery] = useState('');
  const [selectedUuid, setSelectedUuid] = useState(users[0]?.uuid || null);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const selected = users.find((user) => user.uuid === selectedUuid) || users[0] || null;

  const search = async (event) => {
    event.preventDefault();
    await onReload(query);
  };

  const toggle = (key) => setDraft((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);

  const save = async () => {
    if (!selected || selected.protectedRoot || !canManage) return;
    try {
      setSaving(true);
      onNotice(null);
      await saveSystemUserPermissions(selected.uuid, draft);
      await onReload(query);
      onNotice({ type: 'success', text: `Permisos de ${selected.username} actualizados.` });
    } catch (error) {
      onNotice({ type: 'error', text: error.response?.data?.message || 'No se pudieron actualizar los permisos.' });
    } finally { setSaving(false); }
  };

  return <div className="grid grid-cols-[minmax(220px,.8fr)_minmax(0,1.4fr)] gap-4 max-[820px]:grid-cols-1">
    <div className="min-w-0">
      <form onSubmit={search} className="mb-3 flex border border-[var(--dc-line)] bg-[var(--dc-surface)]">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar usuario…" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none" />
        <button type="submit" className="grid w-10 place-items-center border-l border-[var(--dc-line)]" aria-label="Buscar"><Search size={16} /></button>
      </form>
      <div className="grid max-h-[520px] gap-1 overflow-auto">
        {users.map((user) => <button key={user.uuid} type="button" onClick={() => { setSelectedUuid(user.uuid); setDraft(user.permissions || []); }} className={`border px-3 py-2 text-left ${selected?.uuid === user.uuid ? 'border-[var(--dc-accent-four)] bg-[var(--dc-accent-four-soft)]' : 'border-[var(--dc-line)] hover:bg-[var(--dc-button-secondary-hover)]'}`}>
          <strong className="block truncate text-sm">{user.displayName || user.username}{user.protectedRoot ? ' · ROOT' : ''}</strong>
          <span className="block truncate text-[11px] text-[var(--dc-text-muted)]">{user.email}</span>
          <span className="mt-1 block text-[10px] font-black uppercase tracking-[.08em] text-[var(--dc-text-muted)]">{user.roleKey} · {user.statusKey}</span>
        </button>)}
        {!users.length && <p className="text-sm text-[var(--dc-text-muted)]">No se encontraron usuarios.</p>}
      </div>
    </div>

    <div className="min-w-0 border border-[var(--dc-line)] p-4">
      {!selected ? <p className="m-0 text-sm text-[var(--dc-text-muted)]">Selecciona un usuario.</p> : <>
        <div className="mb-4"><span className="dc-kicker">PERMISOS EXPLÍCITOS</span><h2 className="mb-1 mt-1 text-xl">{selected.displayName || selected.username}</h2><p className="m-0 text-[12px] text-[var(--dc-text-muted)]">{selected.protectedRoot ? 'El Super Admin raíz recibe sus permisos desde el seed y no se puede modificar desde esta pantalla.' : 'Estos permisos se guardan directamente en user_permissions.'}</p></div>
        <div className="grid gap-2">
          {permissions.map((permission) => {
            const checked = draft.includes(permission.key);
            return <label key={permission.key} className={`flex gap-3 border border-[var(--dc-line)] p-3 ${selected.protectedRoot ? 'opacity-70' : 'cursor-pointer'}`}>
              <input type="checkbox" checked={checked} disabled={selected.protectedRoot || !canManage} onChange={() => toggle(permission.key)} className="mt-1" />
              <span className="min-w-0"><strong className="block text-sm">{permission.name}</strong><code className="block break-all text-[10px] text-[var(--dc-text-muted)]">{permission.key}</code>{permission.description && <span className="mt-1 block text-[11px] leading-5 text-[var(--dc-text-muted)]">{permission.description}</span>}</span>
            </label>;
          })}
        </div>
        {!selected.protectedRoot && canManage && <div className="mt-4 flex justify-end"><button type="button" onClick={save} disabled={saving} className="inline-flex items-center justify-center border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] px-3.5 py-2.5 text-sm font-bold text-[var(--dc-button-primary-text)] transition hover:brightness-110 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar permisos'}</button></div>}
      </>}
    </div>
  </div>;
}


function CollaboratorsSection({ users, canManage, onReload, onNotice }) {
  const [query, setQuery] = useState('');
  const [workingUuid, setWorkingUuid] = useState(null);

  const search = async (event) => {
    event.preventDefault();
    await onReload(query);
  };

  const mutate = async (user, action) => {
    if (!canManage || !user) return;
    try {
      setWorkingUuid(user.uuid);
      onNotice(null);
      if (action === 'grant') await grantSystemCollabLicense(user.uuid);
      else await revokeSystemCollabLicense(user.uuid);
      await onReload(query);
      onNotice({ type: 'success', text: action === 'grant' ? `Licencia Collab asignada a ${user.username}.` : `Licencia Collab revocada a ${user.username}.` });
    } catch (error) {
      onNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo actualizar la Licencia Collab.' });
    } finally { setWorkingUuid(null); }
  };

  return <div>
    <div className="mb-4 border border-[var(--dc-line)] p-4">
      <span className="dc-kicker">LICENCIA ADMINISTRATIVA</span>
      <h2 className="mb-1 mt-1 text-xl">Collab</h2>
      <p className="m-0 text-[12px] leading-5 text-[var(--dc-text-muted)]">Se entrega al Inventario del usuario, no aparece en Tienda y no caduca. Al aplicarla a un lienzo desbloquea las capacidades de Plus, pero mantiene la marca de agua del Overlay.</p>
    </div>

    <form onSubmit={search} className="mb-3 flex border border-[var(--dc-line)] bg-[var(--dc-surface)]">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar colaborador…" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none" />
      <button type="submit" className="grid w-10 place-items-center border-l border-[var(--dc-line)]" aria-label="Buscar"><Search size={16} /></button>
    </form>

    <div className="grid gap-2">
      {users.map((user) => {
        const active = user.collabLicense?.status === 'ACTIVE';
        const assignment = user.collabLicense?.assignment?.channel;
        const disabled = workingUuid === user.uuid || user.statusKey !== 'ACTIVE' || !canManage;
        return <article key={user.uuid} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border border-[var(--dc-line)] p-3 max-[680px]:grid-cols-1">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm">{user.displayName || user.username}</strong><span className={`border px-2 py-0.5 text-[10px] font-black uppercase tracking-[.08em] ${active ? 'border-[var(--dc-alert-success-border)] bg-[var(--dc-alert-success-bg)] text-[var(--dc-alert-success-text)]' : 'border-[var(--dc-line)] text-[var(--dc-text-muted)]'}`}>{active ? 'COLLAB ACTIVA' : 'SIN COLLAB'}</span></div>
            <span className="mt-0.5 block truncate text-[11px] text-[var(--dc-text-muted)]">{user.email}</span>
            <span className="mt-1 block text-[10px] font-black uppercase tracking-[.08em] text-[var(--dc-text-muted)]">{user.roleKey} · {user.statusKey}{assignment ? ` · Aplicada en ${assignment.name}` : active ? ' · Disponible en Inventario' : ''}</span>
          </div>
          {canManage && (active
            ? <button type="button" onClick={() => mutate(user, 'revoke')} disabled={disabled} className="border border-[var(--dc-alert-error-border)] px-3 py-2 text-xs font-black uppercase tracking-[.06em] text-[var(--dc-alert-error-text)] disabled:opacity-50">{workingUuid === user.uuid ? 'Procesando…' : 'Revocar'}</button>
            : <button type="button" onClick={() => mutate(user, 'grant')} disabled={disabled} className="border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] px-3 py-2 text-xs font-black uppercase tracking-[.06em] text-[var(--dc-button-primary-text)] disabled:opacity-50">{workingUuid === user.uuid ? 'Procesando…' : 'Asignar Collab'}</button>)}
        </article>;
      })}
      {!users.length && <p className="text-sm text-[var(--dc-text-muted)]">No se encontraron usuarios.</p>}
    </div>
  </div>;
}


function RegistrationInvitesSection({ invites, canManage, onReload, onNotice }) {
  const [working, setWorking] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  const generate = async () => {
    if (!canManage) return;
    try {
      setWorking(true);
      onNotice(null);
      const invite = await createRegistrationInvite();
      const path = invite.path || `/register?invite=${encodeURIComponent(invite.token || '')}`;
      const link = new URL(path, window.location.origin).toString();
      setGeneratedLink(link);
      await onReload();
      onNotice({ type: 'success', text: 'Invitación de registro creada. El enlace funciona una sola vez.' });
    } catch (error) {
      onNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo generar la invitación.' });
    } finally { setWorking(false); }
  };

  const copy = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      onNotice({ type: 'success', text: 'Enlace copiado al portapapeles.' });
    } catch {
      onNotice({ type: 'error', text: 'No se pudo copiar el enlace automáticamente.' });
    }
  };

  const revoke = async (invite) => {
    if (!canManage || invite.status !== 'AVAILABLE') return;
    try {
      setWorking(true);
      onNotice(null);
      await revokeRegistrationInvite(invite.uuid);
      await onReload();
      onNotice({ type: 'success', text: 'Invitación revocada.' });
    } catch (error) {
      onNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo revocar la invitación.' });
    } finally { setWorking(false); }
  };

  const statusLabel = (status) => status === 'AVAILABLE' ? 'DISPONIBLE' : status === 'USED' ? 'USADA' : 'REVOCADA';

  return <div>
    <div className="mb-4 border border-[var(--dc-line)] p-4">
      <span className="dc-kicker">ACCESO EXCEPCIONAL</span>
      <h2 className="mb-1 mt-1 text-xl">Links únicos de registro</h2>
      <p className="m-0 text-[12px] leading-5 text-[var(--dc-text-muted)]">Permiten crear una cuenta aunque Registro esté apagado. Cada enlace se consume únicamente cuando el alta termina correctamente.</p>
      {canManage && <button type="button" onClick={generate} disabled={working} className="mt-4 inline-flex items-center gap-2 border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] px-3.5 py-2.5 text-sm font-bold text-[var(--dc-button-primary-text)] disabled:opacity-50"><Link2 size={16} />{working ? 'Generando…' : 'Generar link único'}</button>}
    </div>

    {generatedLink && <div className="mb-4 border border-[var(--dc-alert-success-border)] bg-[var(--dc-alert-success-bg)] p-4">
      <strong className="mb-2 block text-sm text-[var(--dc-alert-success-text)]">Guarda este enlace ahora</strong>
      <div className="flex gap-2 max-[680px]:flex-col"><input readOnly value={generatedLink} className="min-w-0 flex-1 border border-[var(--dc-line)] bg-[var(--dc-surface)] px-3 py-2 text-xs outline-none" /><button type="button" onClick={copy} className="inline-flex items-center justify-center gap-2 border border-[var(--dc-line)] px-3 py-2 text-xs font-black uppercase tracking-[.06em]"><Copy size={15} />Copiar</button></div>
      <p className="mb-0 mt-2 text-[11px] text-[var(--dc-text-muted)]">El token completo no se vuelve a mostrar después; el servidor conserva sólo su hash.</p>
    </div>}

    <div className="grid gap-2">
      {invites.map((invite) => <article key={invite.uuid} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border border-[var(--dc-line)] p-3 max-[680px]:grid-cols-1">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><strong className="text-sm">Invitación</strong><span className={`border px-2 py-0.5 text-[10px] font-black uppercase tracking-[.08em] ${invite.status === 'AVAILABLE' ? 'border-[var(--dc-alert-success-border)] bg-[var(--dc-alert-success-bg)] text-[var(--dc-alert-success-text)]' : 'border-[var(--dc-line)] text-[var(--dc-text-muted)]'}`}>{statusLabel(invite.status)}</span></div>
          <code className="mt-1 block truncate text-[10px] text-[var(--dc-text-muted)]">{invite.uuid}</code>
          <span className="mt-1 block text-[10px] text-[var(--dc-text-muted)]">Creada {new Date(invite.createdAt).toLocaleString()}{invite.usedBy ? ` · usada por ${invite.usedBy.displayName || invite.usedBy.username}` : ''}</span>
        </div>
        {canManage && invite.status === 'AVAILABLE' && <button type="button" disabled={working} onClick={() => revoke(invite)} className="inline-flex items-center justify-center gap-2 border border-[var(--dc-alert-error-border)] px-3 py-2 text-xs font-black uppercase tracking-[.06em] text-[var(--dc-alert-error-text)] disabled:opacity-50"><Ban size={15} />Revocar</button>}
      </article>)}
      {!invites.length && <p className="text-sm text-[var(--dc-text-muted)]">Todavía no hay invitaciones de registro.</p>}
    </div>
  </div>;
}

export default function SystemAdmin() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const allowedSections = useMemo(() => sections.filter((section) => !section.permission || user?.permissions?.includes(section.permission)), [user]);
  const requested = searchParams.get('section');
  const activeSection = allowedSections.some((section) => section.id === requested) ? requested : allowedSections[0]?.id || 'users';
  const current = allowedSections.find((section) => section.id === activeSection) || allowedSections[0];
  const [permissions, setPermissions] = useState([]);
  const [modules, setModules] = useState({});
  const [users, setUsers] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [registrationInvites, setRegistrationInvites] = useState([]);
  const [catalog, setCatalog] = useState({ products: [], capabilities: [], bundles: [] });
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const canManageModules = user?.permissions?.includes('admin.modules.manage');
  const canReadUsers = user?.permissions?.includes('admin.users.read');
  const canManagePermissions = user?.permissions?.includes('admin.users.permissions.manage');
  const canReadCollaborators = user?.permissions?.includes('admin.collaborators.read');
  const canManageCollaborators = user?.permissions?.includes('admin.collaborators.manage');
  const canReadRegistrationInvites = user?.permissions?.includes('admin.registration_invites.read');
  const canManageRegistrationInvites = user?.permissions?.includes('admin.registration_invites.manage');
  const canReadCatalog = user?.permissions?.includes('admin.catalog.read');
  const canManageCatalog = user?.permissions?.includes('admin.catalog.manage');

  const loadModules = useCallback(async () => {
    if (!canManageModules) return;
    setModules(await getAdminSystemModules());
  }, [canManageModules]);

  const loadUsers = useCallback(async (q = '') => {
    if (!canReadUsers) return;
    const data = await getSystemUsers(q);
    setUsers(data.users || []);
  }, [canReadUsers]);

  const loadCollaborators = useCallback(async (q = '') => {
    if (!canReadCollaborators) return;
    const data = await getSystemCollaborators(q);
    setCollaborators(data.users || []);
  }, [canReadCollaborators]);

  const loadRegistrationInvites = useCallback(async () => {
    if (!canReadRegistrationInvites) return;
    setRegistrationInvites(await getRegistrationInvites());
  }, [canReadRegistrationInvites]);

  const loadCatalog = useCallback(async () => {
    if (!canReadCatalog) return;
    setCatalog(await getSystemCatalog());
  }, [canReadCatalog]);

  useEffect(() => {
    let active = true;
    Promise.all([
      canManageModules ? getAdminSystemModules() : Promise.resolve({}),
      getSystemPermissions(),
      canReadUsers ? getSystemUsers() : Promise.resolve({ users: [] }),
      canReadCollaborators ? getSystemCollaborators() : Promise.resolve({ users: [] }),
      canReadRegistrationInvites ? getRegistrationInvites() : Promise.resolve([]),
      canReadCatalog ? getSystemCatalog() : Promise.resolve({ products: [], capabilities: [], bundles: [] })
    ])
      .then(([moduleData, permissionData, userData, collaboratorData, inviteData, catalogData]) => {
        if (!active) return;
        setModules(moduleData || {});
        setPermissions(permissionData.permissions || []);
        setUsers(userData.users || []);
        setCollaborators(collaboratorData.users || []);
        setRegistrationInvites(inviteData || []);
        setCatalog(catalogData || { products: [], capabilities: [], bundles: [] });
      })
      .catch((error) => { if (active) setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo cargar la administración del sistema.' }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canManageModules, canReadUsers, canReadCollaborators, canReadRegistrationInvites, canReadCatalog]);

  return <div className="dc-app-page">
    <Notice notice={notice} />
    <div className="grid grid-cols-1 items-start gap-[18px] md:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="grid gap-1.5 bg-[var(--dc-panel)] p-3 shadow-[0_8px_24px_var(--dc-shadow-soft)] md:sticky md:top-[84px]">
        <div className="mb-0.5 flex items-center gap-2 px-2 py-1.5 text-[11px] font-black uppercase tracking-[.1em] text-[var(--dc-text-muted)]"><Settings2 size={15} /> Secciones</div>
        {allowedSections.map((section) => { const Icon = section.icon; const selected = section.id === activeSection; return <button key={section.id} type="button" onClick={() => { setNotice(null); setSearchParams({ section: section.id }); }} style={{ '--dc-section-accent': accent, '--dc-section-soft': soft }} className={`grid grid-cols-[28px_minmax(0,1fr)] gap-2 px-2 py-2 text-left transition ${selected ? 'bg-[var(--dc-section-soft)] text-[var(--dc-section-accent)]' : 'text-[var(--dc-text)] hover:bg-[var(--dc-button-secondary-hover)]'}`} aria-current={selected ? 'page' : undefined}><Icon size={18} className="mt-0.5" /><strong className="block text-sm">{section.label}</strong></button>; })}
      </aside>

      <main className="min-w-0">
        <section className="overflow-hidden bg-[var(--dc-panel)] shadow-[0_8px_24px_var(--dc-shadow-soft)]">
          <div className="flex justify-end px-5 pb-1 pt-4 max-[680px]:px-4 max-[680px]:pt-3"><h1 className="m-0 flex flex-wrap justify-end gap-x-2 font-['Bebas_Neue'] text-[clamp(2.4rem,4vw,3.15rem)] font-normal uppercase leading-[.86] tracking-[-.01em] text-[var(--dc-text)] max-[680px]:text-[1.75rem]"><span>{current?.title[0]}</span><span style={{ color: accent }}>{current?.title[1]}</span></h1></div>
          <div className="px-5 pb-5 pt-2 max-[680px]:px-4 max-[680px]:pb-4 max-[680px]:pt-2">
            {loading ? <div>Cargando administración…</div> : <>
              {activeSection === 'modules' && <ModulesSection modules={modules} onChange={loadModules} onNotice={setNotice} />}
              {activeSection === 'catalog' && <CatalogAdminSection catalog={catalog} canManage={canManageCatalog} onReload={loadCatalog} onNotice={setNotice} />}
              {activeSection === 'registration-invites' && <RegistrationInvitesSection invites={registrationInvites} canManage={canManageRegistrationInvites} onReload={loadRegistrationInvites} onNotice={setNotice} />}
              {activeSection === 'users' && <UsersSection key={users.map((item) => item.uuid).join('|') || 'empty'} users={users} permissions={permissions} canManage={canManagePermissions} onReload={loadUsers} onNotice={setNotice} />}
              {activeSection === 'collaborators' && <CollaboratorsSection users={collaborators} canManage={canManageCollaborators} onReload={loadCollaborators} onNotice={setNotice} />}
              {activeSection === 'permissions' && <PermissionsSection permissions={permissions} />}
            </>}
          </div>
        </section>
      </main>
    </div>
  </div>;
}
