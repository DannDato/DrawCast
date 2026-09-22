import { useEffect, useState, useTransition } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, Menu, PenTool, Settings, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getPendingInvitations } from "../api/channels";
import AppFooter from "../components/footer/AppFooter";

const items = [
    { name: "Inicio", path: "/app", icon: LayoutDashboard, end: true },
    { name: "Editores", path: "/app/editor", icon: PenTool },
    // { name: "Perfil", path: "/app/profile", icon: User },
    { name: "Configuración", path: "/app/settings", icon: Settings },
];

export default function DashboardLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [invitationCount, setInvitationCount] = useState(0);
    const [navigationPending, startNavigation] = useTransition();
    const isFullEditor = /^\/app\/editor\/[^/]+$/.test(location.pathname);

    useEffect(() => {
        let active = true;
        let timer = 0;

        const refreshInvitations = async ({ force = false } = {}) => {
            try {
                const result = await getPendingInvitations({ force });
                if (active) setInvitationCount(Number(result?.count || 0));
            } catch {
                if (active) setInvitationCount(0);
            }
        };

        const handleChanged = () => refreshInvitations({ force: true });
        refreshInvitations();
        timer = window.setInterval(() => refreshInvitations({ force: true }), 30000);
        window.addEventListener('drawcast:invitations-changed', handleChanged);

        return () => {
            active = false;
            if (timer) window.clearInterval(timer);
            window.removeEventListener('drawcast:invitations-changed', handleChanged);
        };
    }, []);

    const exit = async () => {
        await logout();
        navigate("/login");
    };

    const navItem = (item, mobile = false) => {
        const Icon = item.icon;
        const showBadge = item.path === '/app/editor' && invitationCount > 0;
        return (
            <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={(event) => {
                    setMobileOpen(false);
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    startNavigation(() => navigate(item.path));
                }}
                aria-busy={navigationPending ? "true" : undefined}
                className={({ isActive }) => `relative flex items-center gap-2 border transition ${mobile ? "px-3 py-2.5" : "h-9 px-3"} ${isActive ? "border-[var(--dc-accent)] bg-[var(--dc-accent-soft)] text-[var(--dc-text-strong)]" : "border-transparent text-[var(--dc-nav-text)] hover:border-[var(--dc-line)] hover:bg-[var(--dc-button-secondary-hover)] hover:text-[var(--dc-text-strong)]"}`}
            >
                <Icon size={20} />
                <span className="text-[11px] font-bold">{item.name}</span>
                {showBadge && <span className={`${mobile ? 'ml-auto' : '-mr-1'} grid min-w-[18px] h-[18px] place-items-center rounded-full bg-[var(--dc-danger-strong)] px-[5px] text-[10px] font-black leading-none text-[var(--dc-text-strong)] shadow-[0_0_0_2px_var(--dc-nav-bg)]`}>{invitationCount > 99 ? '99+' : invitationCount}</span>}
            </NavLink>
        );
    };

    return (
        <div className="flex min-h-screen flex-col bg-[var(--dc-bg)] text-[var(--dc-text)]">
            <header className="sticky top-0 z-40 bg-[var(--dc-nav-bg)] backdrop-blur">
                <div className="flex h-14 min-w-0 items-center gap-3 px-3 md:px-5">
                    <NavLink to="/app" className="flex min-w-0 shrink-0 items-baseline gap-1.5 no-underline" onClick={(event) => {
                        setMobileOpen(false);
                        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                        event.preventDefault();
                        startNavigation(() => navigate('/app'));
                    }}>
                        <strong className="dc-nav-brand whitespace-nowrap">
                            {import.meta.env.VITE_APP_NAME || "DrawCast"} <b>//</b>
                        </strong>
                        <span className="max-w-[130px] truncate text-[11px] font-semibold text-[var(--dc-text-muted)] sm:max-w-[180px]">{user?.username}</span>
                    </NavLink>

                    <nav className="hidden w-full items-center justify-center gap-1 px-10 md:flex">
                        {items.map((item) => navItem(item))}
                    </nav>

                    <div className="ml-auto hidden items-center gap-2 md:flex">
                        {user?.avatarUrl ? (
                            <Link to="/app/profile" aria-label="Abrir perfil">
                                <img className="h-8 w-8 rounded-full border border-[var(--dc-line)] bg-[var(--dc-panel)] object-cover" src={user.avatarUrl} alt="" title={user?.displayName || user?.username || "Tu cuenta"} />
                            </Link>
                        ) : (
                            <Link to="/app/profile" aria-label="Abrir perfil">
                                <div className="grid h-8 w-8 place-items-center rounded-full border border-[var(--dc-line)] bg-[var(--dc-panel)] text-[11px] font-black" title={user?.displayName || user?.username || "Tu cuenta"}>
                                    {(user?.displayName || user?.username || "U").slice(0, 1).toUpperCase()}
                                </div>
                            </Link>
                        )}
                        <button className="inline-grid h-9 w-9 place-items-center border border-transparent text-[var(--dc-text-muted)] transition hover:border-[var(--dc-line)] hover:bg-[var(--dc-button-secondary-hover)] hover:text-[var(--dc-text-strong)]" onClick={exit} aria-label="Cerrar sesión" title="Cerrar sesión">
                            <LogOut size={16} />
                        </button>
                    </div>

                    <button className="ml-auto inline-grid h-9 w-9 place-items-center border border-[var(--dc-line)] bg-[var(--dc-panel)] text-[var(--dc-text)] md:hidden" onClick={() => setMobileOpen((value) => !value)} aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}>
                        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>

                {mobileOpen && (
                    <div className="border-t border-[var(--dc-line)] bg-[var(--dc-surface)] p-2 md:hidden">
                        <nav className="grid gap-1">{items.map((item) => navItem(item, true))}</nav>
                        <div className="mt-2 flex items-center gap-2 border-t border-[var(--dc-line)] px-2 pt-2">
                            <div className="min-w-0 flex-1">
                                <strong className="block truncate text-xs">{user?.displayName || user?.username}</strong>
                                <span className="block truncate text-[10px] text-[var(--dc-text-muted)]">{user?.email}</span>
                            </div>
                            <button className="flex h-9 items-center gap-2 border border-[var(--dc-line)] px-3 text-[10px] font-bold text-[var(--dc-text)]" onClick={exit}>
                                <LogOut size={14} /> Cerrar sesión
                            </button>
                        </div>
                    </div>
                )}
            </header>

            <main className="dc-dashboard-stage min-w-0 flex-1">
                <div className="min-w-0 flex-1">
                    <Outlet />
                </div>
                {!isFullEditor && <AppFooter />}
            </main>
        </div>
    );
}
