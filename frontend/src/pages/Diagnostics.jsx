import { Activity } from "lucide-react";
import ConnectionDiagnostics from "../components/dashboard/ConnectionDiagnostics";

export default function Diagnostics() {
    return (
        <div className="mx-auto w-full max-w-[1440px] py-8 pt-7 text-[13px]">
            <div className="mb-[18px] flex items-end justify-between gap-5 max-[820px]:flex-col max-[820px]:items-start">
                <div>
                    {/* <span className="dc-kicker">SOPORTE</span> */}
                    <h1 className="dc-page-title">
                        DIAGNOSTICO <span className="dc-page-title-accent">DE RENDIMIENTO</span>
                    </h1>
                    <p className="m-0 max-w-[720px] text-[13px] text-[var(--dc-muted)]">
                        Revisa si un problema viene de tu conexión, este equipo o los servidores de DrawCast.
                    </p>
                </div>
                {/* <div className="inline-flex min-h-9 items-center gap-2 border border-[var(--dc-line)] bg-[var(--dc-panel)] px-[11px] text-[13px] font-bold leading-none text-[var(--dc-muted)]">
                    <Activity size={16} className="text-[var(--dc-accent)]" />
                    <span>Estado en tiempo real</span>
                </div> */}
            </div>

            <ConnectionDiagnostics />

            <section className="mt-[18px] grid grid-cols-[minmax(190px,.7fr)_minmax(0,2fr)] gap-7 bg-[var(--dc-panel)] p-[22px] shadow-[0_8px_24px_var(--dc-shadow-soft)] max-[820px]:grid-cols-1">
                <div>
                    <span className="dc-kicker">CÓMO LEERLO</span>
                    <h2 className="mt-[5px] mb-0 text-[22px]">¿Dónde está el problema?</h2>
                </div>
                <div className="grid grid-cols-3 gap-[18px] max-[820px]:grid-cols-1 max-[820px]:gap-[13px]">
                    <article className="min-w-0">
                        <strong className="mb-[5px] block text-[13px]">Red</strong>
                        <p className="m-0 text-[13px] leading-6 text-[var(--dc-muted)]">
                            Latencia y jitter altos apuntan normalmente a Wi‑Fi, ISP o la ruta entre tu navegador y
                            DrawCast.
                        </p>
                    </article>
                    <article className="min-w-0">
                        <strong className="mb-[5px] block text-[13px]">Este equipo</strong>
                        <p className="m-0 text-[13px] leading-6 text-[var(--dc-muted)]">
                            FPS bajos o bloqueos largos indican que el navegador o la computadora están trabajando de
                            más.
                        </p>
                    </article>
                    <article className="min-w-0">
                        <strong className="mb-[5px] block text-[13px]">Servidor</strong>
                        <p className="m-0 text-[13px] leading-6 text-[var(--dc-muted)]">
                            Event loop o CPU altos indican que el problema puede estar del lado de DrawCast, no en tu
                            conexión.
                        </p>
                    </article>
                </div>
            </section>
        </div>
    );
}
