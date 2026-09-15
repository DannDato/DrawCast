import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, PenTool, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const items = [
  { name: 'Inicio', path: '/app', icon: LayoutDashboard },
  { name: 'Editor', path: '/app/editor', icon: PenTool },
  { name: 'Perfil', path: '/app/profile', icon: User }
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const exit = async () => {
    await logout();
    navigate('/login');
  };

  return <div className={`min-h-screen bg-[#101216] lg:grid lg:transition-[grid-template-columns] lg:duration-200 ${collapsed ? 'lg:grid-cols-[76px_minmax(0,1fr)]' : 'lg:grid-cols-[250px_minmax(0,1fr)]'}`}>
    <aside className={`fixed inset-y-0 left-0 z-30 flex h-screen w-[min(300px,86vw)] flex-col overflow-hidden border-r border-[#2a2e37] bg-[#0d0f12] shadow-lg transition-transform duration-200 lg:sticky lg:top-0 lg:w-auto lg:translate-x-0 lg:shadow-none ${mobileOpen ? 'translate-x-0' : '-translate-x-[105%]'}`}>
      <div className={`hidden min-h-[72px] items-center p-3.5 lg:flex ${collapsed ? 'justify-center px-0' : ''}`}><button className="ml-auto inline-grid h-9 w-9 place-items-center rounded-md border border-[#2a2e37] bg-[#101216] text-[#ebebeb] transition hover:bg-[#171a20] lg:ml-0" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Mostrar menú' : 'Ocultar menú'} title={collapsed ? 'Mostrar menú' : 'Ocultar menú'}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div>
      <nav className="flex-1 overflow-y-auto px-2.5 py-3.5">
        <div className="grid gap-1"><span className={`px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[.08em] text-[#7e8592] ${collapsed ? 'lg:hidden' : ''}`}>Sistema</span>{items.map((item) => { const Icon = item.icon; return <NavLink key={item.path} to={item.path} title={collapsed ? item.name : undefined} className={({ isActive }) => `flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2.5 font-semibold transition ${collapsed ? 'lg:justify-center' : ''} ${isActive ? 'border-[var(--dc-accent)] bg-[var(--dc-accent)] text-white' : 'border-transparent text-[#ebebeb] hover:border-[#2a2e37] hover:bg-[#101216]'}`} onClick={() => setMobileOpen(false)}><Icon size={18} className="min-w-[18px]" /><span className={collapsed ? 'lg:hidden' : ''}>{item.name}</span></NavLink>; })}</div>
      </nav>
      <div className="grid gap-2 border-t border-[#2a2e37] px-2.5 py-3">
        <div className={`flex items-center gap-2.5 p-2 ${collapsed ? 'lg:justify-center' : ''}`}>{user?.avatarUrl ? <img className="h-[38px] w-[38px] min-w-[38px] rounded-xl border border-[var(--dc-accent)] bg-[#101216] object-cover" src={user.avatarUrl} alt="" /> : <div className="grid h-[38px] w-[38px] min-w-[38px] place-items-center rounded-xl border border-[var(--dc-accent)] bg-[#101216] font-black">{(user?.displayName || user?.username || 'U').slice(0, 1).toUpperCase()}</div>}<div className={`min-w-0 leading-tight ${collapsed ? 'lg:hidden' : ''}`}><strong className="block truncate">{user?.displayName || user?.username}</strong><span className="mt-1 block truncate text-xs text-[#7e8592]">{user?.email}</span></div></div>
        <button className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2.5 text-left font-semibold text-[#ebebeb] transition hover:bg-[#101216] ${collapsed ? 'lg:justify-center' : ''}`} onClick={exit} title={collapsed ? 'Cerrar sesión' : undefined}><LogOut size={18} className="min-w-[18px]" /><span className={collapsed ? 'lg:hidden' : ''}>Cerrar sesión</span></button>
      </div>
    </aside>

    {mobileOpen && <button className="fixed inset-0 z-20 border-0 bg-black/25 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" />}

    <section className="min-w-0"><header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2.5 border-b border-[#2a2e37] bg-[#101216]/95 px-3.5 backdrop-blur lg:px-6"><div><strong><span className="dc-nav-brand">{import.meta.env.VITE_APP_NAME || 'DrawCast'} <b>// DannDato</b></span></strong><span className="text-[#7e8592]"> · {user?.username}</span></div><button className="inline-grid h-9 w-9 place-items-center rounded-md border border-[#2a2e37] bg-[#101216] text-[#ebebeb] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menú"><Menu size={20} /></button></header><main className="min-w-0"><Outlet /></main></section>
  </div>;
}
