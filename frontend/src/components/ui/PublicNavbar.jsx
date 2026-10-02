import { Link } from "react-router-dom";
import useSystemModules from "../../hooks/useSystemModules";

export default function PublicNavbar() {
    const { isEnabled } = useSystemModules();
    const loginEnabled = isEnabled("login");
    const registrationEnabled = isEnabled("registration");

    return (
        <nav className="flex flex-row flex-nowrap items-center justify-between gap-2 border-b border-[var(--dc-text)]/15 py-4 sm:gap-5 sm:py-5">
            <Link to="/" className="w-fit shrink-0 no-underline">
                <strong className="font-['Bebas_Neue'] text-xl font-normal tracking-[0.05em] sm:text-2xl sm:tracking-[0.06em] md:text-[28px]">
                    <strong>TRAZIO </strong><span className="text-[var(--dc-accent-three)]"> //</span>
                </strong>
            </Link>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                {loginEnabled && (
                    <Link className="whitespace-nowrap border border-[var(--dc-text)] px-2.5 py-2 font-mono text-[9px] font-bold tracking-normal transition hover:bg-[var(--dc-text)] hover:text-[var(--dc-bg)] sm:px-5 sm:py-3 sm:text-xs sm:tracking-wide md:px-6" to="/login">
                        Iniciar Sesión
                    </Link>
                )}

                {registrationEnabled && (
                    <Link className="whitespace-nowrap border border-[var(--dc-accent-two)] bg-[var(--dc-accent-two)] px-2.5 py-2 font-mono text-[9px] font-bold tracking-normal text-[var(--dc-text-inverse)] transition hover:bg-transparent hover:text-[var(--dc-accent)] sm:px-5 sm:py-3 sm:text-xs sm:tracking-wide md:px-6" to="/register">
                        Crear cuenta
                    </Link>
                )}
            </div>
        </nav>
    );
}
