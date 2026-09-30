import { useEffect, useRef, useState, useTransition } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
    Boxes,
    LayoutDashboard,
    LogOut,
    Menu,
    PenTool,
    Settings,
    ShoppingBag,
    User,
    X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getPendingInvitations } from "../api/channels";
import CartNavLink from "../components/inventory/CartNavLink";
import AppFooter from "../components/footer/AppFooter";

const items = [
    { name: "Inicio", path: "/app/inicio", icon: LayoutDashboard, end: true },
    { name: "Lienzos", path: "/app/editor", icon: PenTool },
    { name: "Inventario", path: "/app/inventory", icon: Boxes },
    { name: "Tienda", path: "/app/store", icon: ShoppingBag, separator: "left" },
];

export default function DashboardLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [mobileOpen, setMobileOpen] = useState(false);
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const [invitationCount, setInvitationCount] = useState(0);
    const [navigationPending, startNavigation] = useTransition();

    const accountMenuRef = useRef(null);

    // Detectar si la ruta actual es el editor dinámico
    const isFullEditor = /^\/app\/editor\/[^/]+\/?$/.test(location.pathname);

    useEffect(() => {
        let active = true;
        let timer = 0;

        const refreshInvitations = async ({ force = false } = {}) => {
            try {
                const result = await getPendingInvitations({ force, showLoading: false });

                if (active) {
                    setInvitationCount(Number(result?.count || 0));
                }
            } catch {
                if (active) {
                    setInvitationCount(0);
                }
            }
        };

        const handleChanged = () => {
            refreshInvitations({ force: true });
        };

        refreshInvitations();

        timer = window.setInterval(() => {
            refreshInvitations({ force: true });
        }, 30000);

        window.addEventListener("TRAZIO:invitations-changed", handleChanged);

        return () => {
            active = false;

            if (timer) {
                window.clearInterval(timer);
            }

            window.removeEventListener("TRAZIO:invitations-changed", handleChanged);
        };
    }, []);

    useEffect(() => {
        const handlePointerDown = (event) => {
            if (!accountMenuRef.current?.contains(event.target)) {
                setAccountMenuOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === "Escape") {
                setAccountMenuOpen(false);
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, []);

    useEffect(() => {
        setAccountMenuOpen(false);
        setMobileOpen(false);
    }, [location.pathname]);

    const exit = async () => {
        setAccountMenuOpen(false);
        setMobileOpen(false);

        await logout();
        navigate("/");
    };

    const goTo = (path) => {
        setAccountMenuOpen(false);
        setMobileOpen(false);

        startNavigation(() => {
            navigate(path);
        });
    };

    const navItem = (item, mobile = false) => {
        const Icon = item.icon;
        const showBadge = item.path === "/app/editor" && invitationCount > 0;

        return (
            <>
                {item.separator === "left" && (
                    <span className="hidden md:block w-px bg-[var(--dc-line)] transition-all duration-200 h-8 mx-5" />
                )}
                <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    onClick={(event) => {
                        setMobileOpen(false);
                        
                        if (
                            event.button !== 0 ||
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.altKey
                        ) {
                            return;
                        }
                        
                        event.preventDefault();
                        
                        startNavigation(() => {
                            navigate(item.path);
                        });
                    }}
                    aria-busy={navigationPending ? "true" : undefined}
                    className={({ isActive }) =>
                        `relative flex items-center justify-center gap-2 border transition-all duration-200 ${
                            mobile ? "px-3 py-2.5" : "h-9 px-3"
                        } ${
                            isActive
                            ? "border-[var(--dc-accent-three)] bg-[var(--dc-accent-three-soft)] text-[var(--dc-accent-four)]"
                            : "border-transparent text-[var(--dc-nav-text)] hover:scale-110 hover:bg-[var(--dc-button-secondary-hover)] hover:text-[var(--dc-text-strong)]"
                        }`
                    }
                    >
                    <Icon size={22} className="transition-all duration-200 shrink-0" />
                    
                    <span className="text-[12px] font-bold whitespace-nowrap">{item.name}</span>

                    {showBadge && (
                        <span
                        className={`${
                            mobile ? "ml-auto" : "-mr-1"
                        } grid h-[16px] min-w-[16px] place-items-center rounded-full bg-[var(--dc-danger-strong)] px-[4px] text-[9px] font-black leading-none text-[var(--dc-text)] shadow-[0_0_0_2px_var(--dc-nav-bg)]`}
                        >
                            {invitationCount > 99 ? "99+" : invitationCount}
                        </span>
                    )}
                </NavLink>
                {item.path === "/app/store" && !mobile && <CartNavLink />}
                {item.separator === "right" && (
                    <span className="hidden md:block w-px bg-[var(--dc-line)] transition-all duration-200 h-8 mx-5" />
                )}
            </>
        );
    };

    return (
        <div className="flex min-h-screen min-h-dvh flex-col bg-[var(--dc-bg)] text-[var(--dc-text)]">
            <header hidden={isFullEditor} className="sticky top-0 z-40 bg-[var(--dc-nav-bg)] backdrop-blur transition-all duration-200">
                <div className="flex h-14 items-center gap-3 px-3 md:px-5">
                    <NavLink
                        to="/app"
                        className="flex min-w-0 shrink-0 items-baseline gap-1.5 no-underline"
                        onClick={(event) => {
                            setMobileOpen(false);

                            if (
                                event.button !== 0 ||
                                event.metaKey ||
                                event.ctrlKey ||
                                event.shiftKey ||
                                event.altKey
                            ) {
                                return;
                            }

                            event.preventDefault();

                            startNavigation(() => {
                                navigate("/app");
                            });
                        }}
                    >
                        <strong className="dc-nav-brand whitespace-nowrap">
                            {import.meta.env.VITE_APP_NAME || "TRAZIO"} <b>//</b>
                        </strong>

                        <span className="max-w-[130px] truncate text-[12px] font-semibold text-[var(--dc-text)] sm:max-w-[180px]">
                            {user?.username}
                        </span>
                    </NavLink>

                    <nav className="hidden w-full items-center justify-center gap-2 px-3 transition-all duration-200 md:flex lg:px-10">
                        {items.map((item) => navItem(item))}
                    </nav>

                    <div className="ml-auto hidden items-center md:flex">
                        <div ref={accountMenuRef} className="relative">
                            <button
                                type="button"
                                className="grid h-9 w-9 place-items-center rounded-full border border-transparent transition hover:border-[var(--dc-line)] hover:bg-[var(--dc-button-secondary-hover)]"
                                onClick={() => {
                                    setAccountMenuOpen((value) => !value);
                                }}
                                aria-label="Abrir menú de cuenta"
                                aria-haspopup="menu"
                                aria-expanded={accountMenuOpen}
                                title={user?.displayName || user?.username || "Tu cuenta"}
                            >
                                {user?.avatarUrl ? (
                                    <img
                                        className="h-8 w-8 rounded-full border border-[var(--dc-line)] bg-[var(--dc-panel)] object-cover"
                                        src={user.avatarUrl}
                                        alt=""
                                    />
                                ) : (
                                    <div className="grid h-8 w-8 place-items-center rounded-full border border-[var(--dc-line)] bg-[var(--dc-panel)] text-[12px] font-black">
                                        {(user?.displayName || user?.username || "U")
                                            .slice(0, 1)
                                            .toUpperCase()}
                                    </div>
                                )}
                            </button>

                            {accountMenuOpen && (
                                <div
                                    role="menu"
                                    className="absolute right-[-20px] top-[calc(100%+8px)] z-50 w-52 bg-[var(--dc-panel)] p-1 shadow-lg"
                                >
                                    <div className="border-b border-[var(--dc-line)] px-3 py-2">
                                        <strong className="block truncate text-xs text-[var(--dc-text-strong)]">
                                            {user?.displayName || user?.username}
                                        </strong>

                                        {user?.email && (
                                            <span className="mt-0.5 block truncate text-[11px] text-[var(--dc-text)]">
                                                {user.email}
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        role="menuitem"
                                        className="mt-1 flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-bold text-[var(--dc-text)] transition hover:bg-[var(--dc-button-secondary-hover)] hover:text-[var(--dc-text-strong)]"
                                        onClick={() => goTo("/app/profile")}
                                    >
                                        <User size={15} />
                                        Perfil
                                    </button>

                                    <button
                                        type="button"
                                        role="menuitem"
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-bold text-[var(--dc-text)] transition hover:bg-[var(--dc-button-secondary-hover)] hover:text-[var(--dc-text-strong)]"
                                        onClick={() => goTo("/app/settings")}
                                    >
                                        <Settings size={15} />
                                        Configuración
                                    </button>

                                    <div className="my-1 h-px bg-[var(--dc-line)]" />

                                    <button
                                        type="button"
                                        role="menuitem"
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-bold text-[var(--dc-danger-strong)] transition hover:bg-[var(--dc-button-secondary-hover)]"
                                        onClick={exit}
                                    >
                                        <LogOut size={15} />
                                        Cerrar sesión
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="ml-auto md:hidden"><CartNavLink onClick={() => setMobileOpen(false)} /></div>

                    {/* Botón Menú Mobile */}
                    <button
                        className="inline-grid h-7 w-7 place-items-center border border-[var(--dc-line)] bg-[var(--dc-panel)] text-[var(--dc-text)] md:hidden"
                        onClick={() => {
                            setMobileOpen((value) => !value);
                        }}
                        aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
                    >
                        {mobileOpen ? <X size={16} /> : <Menu size={16} />}
                    </button>
                </div>

                {mobileOpen && (
                    <div className="border-t border-[var(--dc-line)] bg-[var(--dc-surface)] p-2 md:hidden">
                        <nav className="grid gap-1">
                            {items.map((item) => navItem(item, true))}
                        </nav>

                        <div className="mt-2 border-t border-[var(--dc-line)] pt-2">
                            <div className="flex items-center gap-3 px-2 py-2">
                                {user?.avatarUrl ? (
                                    <img
                                        className="h-9 w-9 shrink-0 rounded-full border border-[var(--dc-line)] bg-[var(--dc-panel)] object-cover"
                                        src={user.avatarUrl}
                                        alt=""
                                    />
                                ) : (
                                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--dc-line)] bg-[var(--dc-panel)] text-[12px] font-black">
                                        {(user?.displayName || user?.username || "U")
                                            .slice(0, 1)
                                            .toUpperCase()}
                                    </div>
                                )}

                                <div className="min-w-0 flex-1">
                                    <strong className="block truncate text-xs">
                                        {user?.displayName || user?.username}
                                    </strong>

                                    <span className="block truncate text-[12px] text-[var(--dc-text)]">
                                        {user?.email}
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-bold text-[var(--dc-text)] transition hover:bg-[var(--dc-button-secondary-hover)]"
                                onClick={() => goTo("/app/profile")}
                            >
                                <User size={16} />
                                Perfil
                            </button>

                            <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-bold text-[var(--dc-text)] transition hover:bg-[var(--dc-button-secondary-hover)]"
                                onClick={() => goTo("/app/settings")}
                            >
                                <Settings size={16} />
                                Configuración
                            </button>

                            <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-bold text-[var(--dc-danger-strong)] transition hover:bg-[var(--dc-button-secondary-hover)]"
                                onClick={exit}
                            >
                                <LogOut size={16} />
                                Cerrar sesión
                            </button>
                        </div>
                    </div>
                )}
            </header>

            <main className={`dc-dashboard-stage flex min-w-0 flex-1 flex-col ${isFullEditor ? "min-h-screen min-h-dvh" : "min-h-[calc(100vh-3.5rem)] min-h-[calc(100dvh-3.5rem)]"}`}>
                <div className="min-w-0 flex-1">
                    <Outlet />
                </div>

                {!isFullEditor && (
                    <div className="mt-auto pt-8">
                        <AppFooter />
                    </div>
                )}
            </main>
        </div>
    );
}
