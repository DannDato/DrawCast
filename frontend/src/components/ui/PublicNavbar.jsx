import { Link } from "react-router-dom";

export default function PublicNavbar() {
    return (
        <nav className="flex flex-col gap-5 border-b border-[var(--dc-text)]/15 py-5 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/" className="w-fit no-underline">
                <strong className="font-['Bebas_Neue'] text-2xl font-normal tracking-[0.06em] md:text-[28px]">
                    <strong>TRAZIO </strong><span className="text-[var(--dc-accent-one)]"> //</span>
                </strong>
            </Link>

            <div className="flex items-center gap-2">
                <Link className="border border-[var(--dc-text)] px-4 py-3 font-mono text-[10px] font-bold tracking-wide transition hover:bg-[var(--dc-text)] hover:text-[var(--dc-bg)] sm:px-5 sm:text-xs md:px-6" to="/login">
                    Iniciar Sesión
                </Link>

                <Link className="border border-[var(--dc-accent-two)] bg-[var(--dc-accent-two)] px-4 py-3 font-mono text-[10px] font-bold tracking-wide text-[var(--dc-text)] transition hover:bg-transparent hover:text-[var(--dc-accent)] sm:px-5 sm:text-xs md:px-6" to="/register">
                    Crear cuenta
                </Link>
            </div>
        </nav>
    );
}
