import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, Menu, PenTool, User, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const items = [
    { name: "Inicio", path: "/app", icon: LayoutDashboard, end: true },
    { name: "Editor", path: "/app/editor", icon: PenTool },
    { name: "Perfil", path: "/app/profile", icon: User },
];

export default function DashboardLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);

    const exit = async () => {
        await logout();
        navigate("/login");
    };

    const navItem = (item, mobile = false) => {
        const Icon = item.icon;
        return (
            <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `flex items-center gap-2 border transition ${mobile ? "px-3 py-2.5" : "h-9 px-3"} ${isActive ? "border-[var(--dc-accent)] bg-[var(--dc-accent-soft)] text-white" : "border-transparent text-[#9ba1ac] hover:border-[#2a2e37] hover:bg-[#171a20] hover:text-white"}`}
            >
                <Icon size={15} />
                <span className="text-[11px] font-bold">{item.name}</span>
            </NavLink>
        );
    };

    return (
        <div className="min-h-screen bg-[#101216] text-[#ebebeb]">
            <header className="sticky top-0 z-40 border-b border-[#2a2e37] bg-[#0d0f12]/95 backdrop-blur">
                <div className="flex h-14 min-w-0 items-center gap-3 px-3 md:px-5">
                    <NavLink to="/app" className="flex min-w-0 shrink-0 items-baseline gap-1.5 no-underline" onClick={() => setMobileOpen(false)}>
                        <strong className="dc-nav-brand whitespace-nowrap">
                            {import.meta.env.VITE_APP_NAME || "DrawCast"} <b>//</b>
                        </strong>
                        <span className="max-w-[130px] truncate text-[11px] font-semibold text-[#7e8592] sm:max-w-[180px]">{user?.username}</span>
                    </NavLink>

                    <nav className="hidden items-center gap-1 md:flex">
                        {items.map((item) => navItem(item))}
                    </nav>

                    <div className="ml-auto hidden items-center gap-2 md:flex">
                        {user?.avatarUrl ? (
                            <img className="h-8 w-8 border border-[#2a2e37] bg-[#101216] object-cover" src={user.avatarUrl} alt="" title={user?.displayName || user?.username || "Tu cuenta"} />
                        ) : (
                            <div className="grid h-8 w-8 place-items-center border border-[#2a2e37] bg-[#101216] text-[11px] font-black" title={user?.displayName || user?.username || "Tu cuenta"}>
                                {(user?.displayName || user?.username || "U").slice(0, 1).toUpperCase()}
                            </div>
                        )}
                        <button className="inline-grid h-9 w-9 place-items-center border border-transparent text-[#7e8592] transition hover:border-[#2a2e37] hover:bg-[#171a20] hover:text-white" onClick={exit} aria-label="Cerrar sesión" title="Cerrar sesión">
                            <LogOut size={16} />
                        </button>
                    </div>

                    <button className="ml-auto inline-grid h-9 w-9 place-items-center border border-[#2a2e37] bg-[#101216] text-[#ebebeb] md:hidden" onClick={() => setMobileOpen((value) => !value)} aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}>
                        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>

                {mobileOpen && (
                    <div className="border-t border-[#2a2e37] bg-[#0d0f12] p-2 md:hidden">
                        <nav className="grid gap-1">{items.map((item) => navItem(item, true))}</nav>
                        <div className="mt-2 flex items-center gap-2 border-t border-[#2a2e37] px-2 pt-2">
                            <div className="min-w-0 flex-1">
                                <strong className="block truncate text-xs">{user?.displayName || user?.username}</strong>
                                <span className="block truncate text-[10px] text-[#7e8592]">{user?.email}</span>
                            </div>
                            <button className="flex h-9 items-center gap-2 border border-[#2a2e37] px-3 text-[10px] font-bold text-[#ebebeb]" onClick={exit}>
                                <LogOut size={14} /> Cerrar sesión
                            </button>
                        </div>
                    </div>
                )}
            </header>

            <main className="min-w-0">
                <Outlet />
            </main>
        </div>
    );
}
