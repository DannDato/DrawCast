import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, KeyRound, Search, Settings2, UserRoundCheck, Users, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSystemCollaborators, getSystemPermissions, getSystemUsers, grantSystemCollabLicense, revokeSystemCollabLicense, saveSystemUserPermissions } from '../api/systemAdmin';

const sections = [
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

export default function SystemAdmin() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const allowedSections = useMemo(() => sections.filter((section) => !section.permission || user?.permissions?.includes(section.permission)), [user]);
  const requested = searchParams.get('section');
  const activeSection = allowedSections.some((section) => section.id === requested) ? requested : allowedSections[0]?.id || 'users';
  const current = allowedSections.find((section) => section.id === activeSection) || allowedSections[0];
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const canReadUsers = user?.permissions?.includes('admin.users.read');
  const canManagePermissions = user?.permissions?.includes('admin.users.permissions.manage');
  const canReadCollaborators = user?.permissions?.includes('admin.collaborators.read');
  const canManageCollaborators = user?.permissions?.includes('admin.collaborators.manage');

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

  useEffect(() => {
    let active = true;
    Promise.all([
      getSystemPermissions(),
      canReadUsers ? getSystemUsers() : Promise.resolve({ users: [] }),
      canReadCollaborators ? getSystemCollaborators() : Promise.resolve({ users: [] })
    ])
      .then(([permissionData, userData, collaboratorData]) => {
        if (!active) return;
        setPermissions(permissionData.permissions || []);
        setUsers(userData.users || []);
        setCollaborators(collaboratorData.users || []);
      })
      .catch((error) => { if (active) setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo cargar la administración del sistema.' }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canReadUsers, canReadCollaborators]);

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
