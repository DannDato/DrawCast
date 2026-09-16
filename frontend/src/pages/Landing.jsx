import { Link } from "react-router-dom";
import { ArrowRight, Check, Clock3, MonitorUp, PenTool, Radio, Type, Users } from "lucide-react";

export default function Landing() {
    return (
        <main className="min-h-screen overflow-hidden bg-[var(--dc-bg)] text-[var(--dc-text)]">

            {/* HERO */}
            <section className="mx-auto flex min-h-screen w-full max-w-[1240px] flex-col px-6 md:px-10 xl:px-0">

                <nav className="flex flex-col gap-5 border-b border-[var(--dc-text)]/15 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <strong className="font-['Bebas_Neue'] text-2xl font-normal tracking-[0.06em] md:text-[28px]">
                        DRAWCAST <span className="text-[var(--dc-accent)]">// OVERLAY</span>
                    </strong>

                    <div className="flex items-center gap-2">
                        <Link className="border border-[var(--dc-text)] px-4 py-3 font-mono text-[10px] font-bold tracking-wide transition hover:bg-[var(--dc-text)] hover:text-[var(--dc-bg)] sm:px-5 sm:text-xs md:px-6" to="/login">
                            Iniciar Sesión
                        </Link>

                        <Link className="border border-[var(--dc-accent)] bg-[var(--dc-accent)] px-4 py-3 font-mono text-[10px] font-bold tracking-wide text-white transition hover:bg-transparent hover:text-[var(--dc-accent)] sm:px-5 sm:text-xs md:px-6" to="/register">
                            Registrarse
                        </Link>
                    </div>
                </nav>

                <div className="flex flex-1 flex-col justify-center py-16 lg:justify-start lg:pt-20">
                    <div className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400 sm:text-xs sm:tracking-[0.22em]">
                        Gráficos en tiempo real // OBS
                    </div>

                    <h1 className="max-w-[800px] font-['Bebas_Neue'] text-[clamp(4rem,17vw,9rem)] font-normal uppercase leading-[0.74] tracking-[-0.025em] md:text-[clamp(5rem,10vw,9rem)]">
                        DRAW.
                        <br />
                        COLLABORATE.
                        <br />
                        <span className="text-[var(--dc-accent)]">BROADCAST.</span>
                    </h1>

                    <p className="mt-10 max-w-[680px] text-base leading-7 text-[var(--dc-text)]/60 md:text-lg md:leading-8">
                        DrawCast es una plataforma web para crear y controlar overlays dinámicos durante transmisiones en vivo.
                        <br />
                        Construye tu escena, comparte el control con tu equipo y muestra los cambios instantáneamente en OBS.
                    </p>

                    <div className="mt-10 flex flex-wrap items-center gap-3">
                        <Link className="border border-[var(--dc-accent)] bg-[var(--dc-accent)] px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.08em] text-white transition hover:bg-transparent hover:text-[var(--dc-accent)]" to="/register">
                            INITIALIZE CHANNEL
                        </Link>

                        <Link className="border border-[var(--dc-text)]/40 px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.08em] transition hover:border-[var(--dc-text)] hover:bg-[var(--dc-text)] hover:text-[var(--dc-bg)]" to="/login">
                            OPEN CONSOLE
                        </Link>
                    </div>
                </div>

                <footer className="grid border-t border-[var(--dc-text)]/15 md:grid-cols-3">
                    <div className="flex items-center gap-3 border-b border-[var(--dc-text)]/15 py-5 font-mono text-[11px] font-bold tracking-[0.12em] text-[var(--dc-text)]/45 md:border-r md:border-b-0">
                        <Radio className="h-4 w-4 text-[var(--dc-accent)]" strokeWidth={1.8} />
                        LIVE SOCKETS
                    </div>

                    <div className="flex items-center gap-3 border-b border-[var(--dc-text)]/15 py-5 font-mono text-[11px] font-bold tracking-[0.12em] text-[var(--dc-text)]/45 md:border-r md:border-b-0 md:px-6">
                        <Users className="h-4 w-4 text-[var(--dc-accent)]" strokeWidth={1.8} />
                        AUTHORIZED COLLABS
                    </div>

                    <div className="flex items-center gap-3 py-5 font-mono text-[11px] font-bold tracking-[0.12em] text-[var(--dc-text)]/45 md:pl-6">
                        <PenTool className="h-4 w-4 text-[var(--dc-accent)]" strokeWidth={1.8} />
                        CANVAS ENGINE
                    </div>
                </footer>

            </section>

            {/* CONTROL -> OUTPUT */}
            <section className="border-t border-[var(--dc-text)]/15">
                <div className="mx-auto w-full max-w-[1240px] px-6 py-24 md:px-10 md:py-28 xl:px-0">

                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400 sm:text-xs sm:tracking-[0.22em]">
                        CONTROL EN TIEMPO REAL // BROWSER SOURCE
                    </div>

                    <h2 className="mt-5 font-['Bebas_Neue'] text-[clamp(4rem,14vw,7rem)] uppercase leading-[0.82] md:text-[clamp(4rem,8vw,7rem)]">
                        CONTROLAS AQUÍ.
                        <br />
                        <span className="text-[var(--dc-accent)]">SALE ALLÁ.</span>
                    </h2>

                    <p className="mt-8 max-w-[640px] text-base leading-7 text-[var(--dc-text)]/55 md:text-lg md:leading-8">
                        Opera tu transmisión desde DrawCast. Modifica textos, controla timers y actualiza elementos sin tener que reconstruir tu escena en OBS.
                    </p>

                    <div className="mt-14 grid min-w-0 gap-6 lg:mt-16 lg:grid-cols-[1fr_auto_1fr] lg:items-center">

                        {/* DRAWCAST */}
                        <div className="min-w-0 border border-[var(--dc-text)]/20 bg-white/[0.02]">
                            <div className="flex items-center justify-between gap-4 border-b border-[var(--dc-text)]/15 px-4 py-4 sm:px-5">
                                <span className="font-mono text-[10px] font-bold tracking-[0.12em] sm:text-xs sm:tracking-[0.16em]">
                                    DRAWCAST // CONSOLE
                                </span>

                                <span className="h-2 w-2 shrink-0 bg-cyan-400"></span>
                            </div>

                            <div className="grid min-h-0 grid-cols-1 sm:min-h-[390px] sm:grid-cols-[110px_1fr] md:grid-cols-[160px_1fr]">

                                <div className="border-b border-[var(--dc-text)]/15 p-3 sm:border-r sm:border-b-0 sm:p-4">
                                    <div className="mb-3 font-mono text-[9px] tracking-[0.15em] text-[var(--dc-text)]/30 sm:text-[10px]">
                                        ELEMENTS
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                                        <div className="flex min-w-0 items-center gap-2 border border-[var(--dc-accent)] bg-[var(--dc-accent)]/10 p-3 font-mono text-[9px] text-[var(--dc-accent)] sm:text-[10px]">
                                            <Type className="h-3 w-3 shrink-0" />
                                            TEXT
                                        </div>

                                        <div className="flex min-w-0 items-center gap-2 border border-[var(--dc-text)]/15 p-3 font-mono text-[9px] text-[var(--dc-text)]/50 sm:text-[10px]">
                                            <Clock3 className="h-3 w-3 shrink-0" />
                                            TIMER
                                        </div>
                                    </div>
                                </div>

                                <div className="flex min-w-0 items-center justify-center bg-black/30 p-3 sm:p-6">
                                    <div className="relative aspect-video w-full min-w-0 overflow-hidden border border-[var(--dc-text)]/15 bg-black">

                                        <div className="absolute left-[6%] top-[12%] max-w-[65%] border border-dashed border-cyan-400/70 px-2 py-1 font-['Bebas_Neue'] text-sm tracking-wider sm:left-[8%] sm:top-[15%] sm:px-4 sm:py-2 sm:text-2xl">
                                            NEXT MATCH
                                        </div>

                                        <div className="absolute bottom-[10%] right-[6%] border border-dashed border-[var(--dc-accent)]/80 px-2 py-1 font-mono text-xs font-bold text-[var(--dc-accent)] sm:bottom-[12%] sm:right-[8%] sm:px-5 sm:py-3 sm:text-xl">
                                            04:32
                                        </div>

                                        <div className="absolute bottom-2 left-2 font-mono text-[7px] tracking-[0.12em] text-[var(--dc-text)]/20 sm:bottom-3 sm:left-3 sm:text-[9px] sm:tracking-[0.16em]">
                                            1920 × 1080
                                        </div>

                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* CONNECTION */}
                        <div className="flex items-center justify-center gap-3 py-2 lg:flex-col lg:py-0">
                            <div className="h-2 w-2 bg-[var(--dc-accent)]"></div>

                            <ArrowRight className="h-7 w-7 rotate-90 text-[var(--dc-accent)] lg:h-8 lg:w-8 lg:rotate-0" />

                            <span className="font-mono text-[9px] tracking-[0.16em] text-[var(--dc-text)]/30">
                                LIVE SYNC
                            </span>
                        </div>

                        {/* OBS */}
                        <div className="min-w-0 border border-[var(--dc-text)]/20 bg-white/[0.02]">
                            <div className="flex items-center justify-between gap-3 border-b border-[var(--dc-text)]/15 px-4 py-4 sm:px-5">
                                <span className="font-mono text-[10px] font-bold tracking-[0.12em] sm:text-xs sm:tracking-[0.16em]">
                                    OBS // PROGRAM
                                </span>

                                <span className="font-mono text-[9px] text-red-500 sm:text-[10px]">
                                    ● LIVE
                                </span>
                            </div>

                            <div className="p-3 sm:p-6">
                                <div className="relative aspect-video overflow-hidden border border-[var(--dc-text)]/15 bg-black">
                                    <div className="absolute left-[6%] top-[12%] px-2 py-1 font-['Bebas_Neue'] text-sm tracking-wider sm:left-[8%] sm:top-[15%] sm:px-4 sm:py-2 sm:text-2xl">
                                        NEXT MATCH
                                    </div>

                                    <div className="absolute bottom-[10%] right-[6%] px-2 py-1 font-mono text-xs font-bold text-[var(--dc-accent)] sm:bottom-[12%] sm:right-[8%] sm:px-5 sm:py-3 sm:text-xl">
                                        04:32
                                    </div>

                                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/70 px-2 py-1.5 font-mono text-[7px] text-[var(--dc-text)]/30 sm:px-3 sm:py-2 sm:text-[9px]">
                                        <span>CAMERA_01</span>
                                        <span>60 FPS</span>
                                    </div>
                                </div>

                                <div className="mt-4 border border-[var(--dc-text)]/15">
                                    <div className="border-b border-[var(--dc-text)]/15 px-4 py-3 font-mono text-[10px] tracking-[0.15em] text-[var(--dc-text)]/35">
                                        SOURCES
                                    </div>

                                    <div className="space-y-1 p-3 font-mono text-[10px]">
                                        <div className="flex justify-between px-2 py-1 text-[var(--dc-text)]/40">
                                            <span>Camera</span>
                                            <span>●</span>
                                        </div>

                                        <div className="flex justify-between px-2 py-1 text-[var(--dc-text)]/40">
                                            <span>Gameplay</span>
                                            <span>●</span>
                                        </div>

                                        <div className="flex justify-between bg-[var(--dc-accent)]/10 px-2 py-1 text-[var(--dc-accent)]">
                                            <span>DrawCast Overlay</span>
                                            <span>●</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* PIPELINE */}
            <section className="border-t border-[var(--dc-text)]/15">
                <div className="mx-auto w-full max-w-[1240px] px-6 py-24 md:px-10 md:py-28 xl:px-0">

                    <div className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-cyan-400">
                        WORKFLOW // 03 STEPS
                    </div>

                    <div className="mt-10 grid border-t border-l border-[var(--dc-text)]/15 md:grid-cols-3">

                        <article className="min-h-[300px] border-r border-b border-[var(--dc-text)]/15 p-7 md:min-h-[320px] md:p-8">
                            <div className="font-['Bebas_Neue'] text-7xl text-[var(--dc-text)]/10">
                                01
                            </div>

                            <div className="mt-10 font-mono text-xs font-bold tracking-[0.18em] text-cyan-400">
                                // DRAW
                            </div>

                            <h3 className="mt-3 font-['Bebas_Neue'] text-4xl uppercase">
                                Construye tu escena.
                            </h3>

                            <p className="mt-5 leading-7 text-[var(--dc-text)]/45">
                                Agrega y posiciona elementos visuales dentro de tu overlay.
                            </p>
                        </article>

                        <article className="min-h-[300px] border-r border-b border-[var(--dc-text)]/15 p-7 md:min-h-[320px] md:p-8">
                            <div className="font-['Bebas_Neue'] text-7xl text-[var(--dc-text)]/10">
                                02
                            </div>

                            <div className="mt-10 font-mono text-xs font-bold tracking-[0.18em] text-cyan-400">
                                // CONTROL
                            </div>

                            <h3 className="mt-3 font-['Bebas_Neue'] text-4xl uppercase">
                                Opera el directo.
                            </h3>

                            <p className="mt-5 leading-7 text-[var(--dc-text)]/45">
                                Cambia textos, dispara temporizadores y controla la transmisión desde el navegador.
                            </p>
                        </article>

                        <article className="min-h-[300px] border-r border-b border-[var(--dc-text)]/15 p-7 md:min-h-[320px] md:p-8">
                            <div className="font-['Bebas_Neue'] text-7xl text-[var(--dc-text)]/10">
                                03
                            </div>

                            <div className="mt-10 font-mono text-xs font-bold tracking-[0.18em] text-cyan-400">
                                // BROADCAST
                            </div>

                            <h3 className="mt-3 font-['Bebas_Neue'] text-4xl uppercase">
                                Sal al aire.
                            </h3>

                            <p className="mt-5 leading-7 text-[var(--dc-text)]/45">
                                Conecta tu overlay como Browser Source y transmite los cambios en tiempo real.
                            </p>
                        </article>

                    </div>

                    <div className="mt-10 font-['Bebas_Neue'] text-[clamp(2.5rem,7vw,6rem)] uppercase tracking-wide text-[var(--dc-text)]/10">
                        DRAW → CONTROL → <span className="text-[var(--dc-accent)]">BROADCAST</span>
                    </div>
                </div>
            </section>

            {/* COLLABORATION */}
            <section className="border-t border-[var(--dc-text)]/15">
                <div className="mx-auto grid w-full max-w-[1240px] gap-16 px-6 py-24 md:px-10 md:py-28 lg:grid-cols-2 lg:items-center xl:px-0">

                    <div>
                        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400 sm:text-xs sm:tracking-[0.22em]">
                            COLLABORATION // LIVE PRODUCTION
                        </div>

                        <h2 className="mt-5 font-['Bebas_Neue'] text-[clamp(4rem,14vw,6.5rem)] uppercase leading-[0.84] md:text-[clamp(4rem,7vw,6.5rem)]">
                            NO TIENES QUE
                            <br />
                            HACERLO TODO
                            <br />
                            <span className="text-[var(--dc-accent)]">TÚ.</span>
                        </h2>

                        <p className="mt-8 max-w-[550px] text-base leading-7 text-[var(--dc-text)]/50 md:text-lg md:leading-8">
                            Comparte el control de una transmisión con tu equipo. Mientras alguien está frente a cámara, otra persona puede operar gráficos desde DrawCast.
                        </p>
                    </div>

                    <div className="border border-[var(--dc-text)]/15">
                        <div className="border-b border-[var(--dc-text)]/15 px-5 py-4 font-mono text-xs tracking-[0.15em] text-[var(--dc-text)]/40">
                            CHANNEL // PRODUCTION TEAM
                        </div>

                        <div className="p-5 sm:p-6 md:p-8">
                            <div className="border border-[var(--dc-text)]/15 p-5 sm:p-6">
                                <div className="font-mono text-[10px] tracking-[0.15em] text-cyan-400">
                                    BROADCASTER
                                </div>

                                <div className="mt-4 flex items-center justify-between gap-5">
                                    <div>
                                        <div className="font-['Bebas_Neue'] text-3xl">
                                            STREAMER
                                        </div>

                                        <div className="mt-1 font-mono text-[9px] text-[var(--dc-text)]/30 sm:text-[10px]">
                                            OBS // LIVE OUTPUT
                                        </div>
                                    </div>

                                    <MonitorUp className="h-8 w-8 shrink-0 text-[var(--dc-accent)]" strokeWidth={1.4} />
                                </div>
                            </div>

                            <div className="flex h-20 items-center justify-center">
                                <div className="h-full w-px bg-[var(--dc-text)]/15"></div>
                            </div>

                            <div className="border border-[var(--dc-accent)] bg-[var(--dc-accent)]/[0.04] p-5 sm:p-6">
                                <div className="font-mono text-[9px] tracking-[0.15em] text-[var(--dc-accent)] sm:text-[10px]">
                                    AUTHORIZED COLLABORATOR
                                </div>

                                <div className="mt-4 flex items-center justify-between gap-5">
                                    <div>
                                        <div className="font-['Bebas_Neue'] text-3xl">
                                            MODERATOR
                                        </div>

                                        <div className="mt-1 font-mono text-[9px] text-[var(--dc-text)]/30 sm:text-[10px]">
                                            DRAWCAST // CONTROL
                                        </div>
                                    </div>

                                    <Users className="h-8 w-8 shrink-0 text-[var(--dc-accent)]" strokeWidth={1.4} />
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </section>

            {/* OBS */}
            <section className="border-t border-[var(--dc-text)]/15">
                <div className="mx-auto w-full max-w-[1240px] px-6 py-24 md:px-10 md:py-28 xl:px-0">

                    <div className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-cyan-400">
                        OUTPUT // OBS
                    </div>

                    <h2 className="mt-6 font-['Bebas_Neue'] text-[clamp(4rem,14vw,8rem)] uppercase leading-[0.78] md:text-[clamp(4rem,9vw,8rem)]">
                        ONE URL.
                        <br />
                        ONE SOURCE.
                        <br />
                        <span className="text-[var(--dc-accent)]">FULL CONTROL.</span>
                    </h2>

                    <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_420px] lg:items-center">

                        <div className="min-w-0 border border-[var(--dc-text)]/15 bg-black p-3">
                            <div className="flex min-w-0 items-center gap-3 overflow-hidden border border-[var(--dc-text)]/10 bg-white/[0.03] px-4 py-3">
                                <div className="h-2 w-2 shrink-0 bg-[var(--dc-accent)]"></div>

                                <span className="min-w-0 truncate font-mono text-[9px] text-[var(--dc-text)]/35 sm:text-[10px]">
                                    https://drawcast.app/overlay/channel_xxxxxxxxx
                                </span>
                            </div>
                        </div>

                        <div>
                            <p className="text-base leading-7 text-[var(--dc-text)]/50 md:text-lg md:leading-8">
                                Genera la URL de tu overlay, agrégala como Browser Source en OBS y mantén la operación completamente fuera de tu escena.
                            </p>

                            <div className="mt-8 space-y-3 font-mono text-[11px] tracking-[0.12em]">
                                <div className="flex items-center gap-3 border-b border-[var(--dc-text)]/10 pb-3">
                                    <span className="text-[var(--dc-accent)]">01</span>
                                    CREATE CHANNEL
                                </div>

                                <div className="flex items-center gap-3 border-b border-[var(--dc-text)]/10 pb-3">
                                    <span className="text-[var(--dc-accent)]">02</span>
                                    COPY OVERLAY URL
                                </div>

                                <div className="flex items-center gap-3 border-b border-[var(--dc-text)]/10 pb-3">
                                    <span className="text-[var(--dc-accent)]">03</span>
                                    ADD BROWSER SOURCE
                                </div>

                                <div className="flex items-center gap-3 pb-3">
                                    <span className="text-[var(--dc-accent)]">04</span>
                                    GO LIVE
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* PLANS */}
            <section className="border-t border-[var(--dc-text)]/15">
                <div className="mx-auto w-full max-w-[1240px] px-6 py-24 md:px-10 md:py-28 xl:px-0">

                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400 sm:text-xs sm:tracking-[0.22em]">
                        PLANS // CHOOSE YOUR SETUP
                    </div>

                    <div className="mt-5 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
                        <h2 className="font-['Bebas_Neue'] text-[clamp(4rem,14vw,7rem)] uppercase leading-[0.82] md:text-[clamp(4rem,8vw,7rem)]">
                            START FREE.
                            <br />
                            <span className="text-[var(--dc-accent)]">SCALE WHEN READY.</span>
                        </h2>

                        <p className="max-w-[430px] pb-2 text-base leading-7 text-[var(--dc-text)]/50 md:text-lg md:leading-8">
                            Empieza a construir tu transmisión sin costo y aumenta las capacidades de DrawCast conforme crece tu producción.
                        </p>
                    </div>

                    <div className="mt-16 grid border-t border-l border-[var(--dc-text)]/15 lg:grid-cols-3">

                        {/* FREE */}
                        <article className="flex min-h-[540px] flex-col border-r border-b border-[var(--dc-text)]/15 p-7 md:p-8">

                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="font-mono text-[10px] font-bold tracking-[0.18em] text-cyan-400">
                                        PLAN // 01
                                    </div>

                                    <h3 className="mt-3 font-['Bebas_Neue'] text-6xl uppercase">
                                        GRATIS
                                    </h3>
                                </div>

                                <span className="font-['Bebas_Neue'] text-6xl leading-none text-[var(--dc-text)]/5">
                                    01
                                </span>
                            </div>

                            <p className="mt-6 leading-7 text-[var(--dc-text)]/45">
                                Lo esencial para comenzar a construir y controlar tus overlays desde DrawCast.
                            </p>

                            <div className="my-8 h-px bg-[var(--dc-text)]/10"></div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/65">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                                    Editor visual de overlays
                                </div>

                                <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/65">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                                    Browser Source para OBS
                                </div>

                                <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/65">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                                    Control en tiempo real
                                </div>

                                <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/65">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                                    Tu primer canal de transmisión
                                </div>
                            </div>

                            <div className="mt-auto pt-10">
                                <div className="mb-5">
                                    <span className="font-['Bebas_Neue'] text-5xl">
                                        $0
                                    </span>

                                    <span className="ml-2 font-mono text-[10px] tracking-[0.15em] text-[var(--dc-text)]/30">
                                        // FOREVER
                                    </span>
                                </div>

                                <Link className="flex w-full items-center justify-between border border-[var(--dc-text)]/30 px-5 py-4 font-mono text-xs font-bold tracking-[0.08em] transition hover:border-[var(--dc-text)] hover:bg-[var(--dc-text)] hover:text-[var(--dc-bg)]" to="/register">
                                    START FREE
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>

                        </article>

                        {/* PREMIUM */}
                        <article className="relative flex min-h-[540px] flex-col overflow-hidden border-r border-b border-[var(--dc-accent)] bg-[var(--dc-accent)]/[0.035] p-7 md:p-8">

                            <div className="absolute right-0 top-0 bg-[var(--dc-accent)] px-4 py-2 font-mono text-[9px] font-bold tracking-[0.16em] text-white">
                                RECOMMENDED
                            </div>

                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="font-mono text-[10px] font-bold tracking-[0.18em] text-[var(--dc-accent)]">
                                        PLAN // 02
                                    </div>

                                    <h3 className="mt-3 font-['Bebas_Neue'] text-6xl uppercase text-[var(--dc-accent)]">
                                        PREMIUM
                                    </h3>
                                </div>

                                <span className="font-['Bebas_Neue'] text-6xl leading-none text-[var(--dc-accent)]/10">
                                    02
                                </span>
                            </div>

                            <p className="mt-6 leading-7 text-[var(--dc-text)]/50">
                                Para creadores que transmiten con frecuencia y quieren llevar la operación más allá.
                            </p>

                            <div className="my-8 h-px bg-[var(--dc-accent)]/20"></div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/70">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dc-accent)]" />
                                    Todo lo incluido en Gratis
                                </div>

                                <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/70">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dc-accent)]" />
                                    Más canales de transmisión
                                </div>

                                <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/70">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dc-accent)]" />
                                    Colaboradores autorizados
                                </div>

                                <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/70">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dc-accent)]" />
                                    Herramientas avanzadas de producción
                                </div>
                            </div>

                            <div className="mt-auto pt-10">
                                <div className="mb-5">
                                    <span className="font-['Bebas_Neue'] text-4xl">
                                        FOR CREATORS
                                    </span>

                                    <span className="ml-2 font-mono text-[10px] tracking-[0.15em] text-[var(--dc-text)]/30">
                                        // PREMIUM
                                    </span>
                                </div>

                                <Link className="flex w-full items-center justify-between border border-[var(--dc-accent)] bg-[var(--dc-accent)] px-5 py-4 font-mono text-xs font-bold tracking-[0.08em] text-white transition hover:bg-transparent hover:text-[var(--dc-accent)]" to="/register">
                                    GO PREMIUM
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>

                        </article>

                        {/* PLUS */}
                        <article className="flex min-h-[540px] flex-col border-r border-b border-[var(--dc-text)]/15 p-7 md:p-8">

                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="font-mono text-[10px] font-bold tracking-[0.18em] text-cyan-400">
                                        PLAN // 03
                                    </div>

                                    <h3 className="mt-3 font-['Bebas_Neue'] text-6xl uppercase">
                                        PLUS
                                    </h3>
                                </div>

                                <span className="font-['Bebas_Neue'] text-6xl leading-none text-[var(--dc-text)]/5">
                                    03
                                </span>
                            </div>

                            <p className="mt-6 leading-7 text-[var(--dc-text)]/45">
                                Pensado para equipos, comunidades y producciones donde varias personas forman parte del directo.
                            </p>

                            <div className="my-8 h-px bg-[var(--dc-text)]/10"></div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/65">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                                    Todo lo incluido en Premium
                                </div>

                                <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/65">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                                    Equipos de producción
                                </div>

                                <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/65">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                                    Mayor capacidad de colaboración
                                </div>

                                <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/65">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                                    Prioridad en herramientas de producción
                                </div>
                            </div>

                            <div className="mt-auto pt-10">
                                <div className="mb-5">
                                    <span className="font-['Bebas_Neue'] text-4xl">
                                        FOR TEAMS
                                    </span>

                                    <span className="ml-2 font-mono text-[10px] tracking-[0.15em] text-[var(--dc-text)]/30">
                                        // PLUS
                                    </span>
                                </div>

                                <Link className="flex w-full items-center justify-between border border-[var(--dc-text)]/30 px-5 py-4 font-mono text-xs font-bold tracking-[0.08em] transition hover:border-[var(--dc-text)] hover:bg-[var(--dc-text)] hover:text-[var(--dc-bg)]" to="/register">
                                    CHOOSE PLUS
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>

                        </article>

                    </div>

                    <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--dc-text)]/25">
                        * Los límites y características de cada plan pueden ajustarse conforme evolucione DrawCast.
                    </p>

                </div>
            </section>

            {/* FINAL CTA */}
            <section className="border-t border-[var(--dc-text)]/15">
                <div className="mx-auto w-full max-w-[1240px] px-6 py-28 text-center md:px-10 md:py-32 xl:px-0">

                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400 sm:text-xs sm:tracking-[0.22em]">
                        YOUR STREAM // YOUR CONTROL
                    </div>

                    <h2 className="mt-6 font-['Bebas_Neue'] text-[clamp(5rem,18vw,10rem)] uppercase leading-[0.75] md:text-[clamp(5rem,11vw,10rem)]">
                        READY TO
                        <br />
                        <span className="text-[var(--dc-accent)]">BROADCAST?</span>
                    </h2>

                    <p className="mx-auto mt-10 max-w-[520px] text-base leading-7 text-[var(--dc-text)]/45 md:text-lg md:leading-8">
                        Construye tu primer overlay, invita a tu equipo y conecta DrawCast a OBS.
                    </p>

                    <Link className="mt-10 inline-flex items-center gap-3 border border-[var(--dc-accent)] bg-[var(--dc-accent)] px-8 py-5 font-mono text-xs font-bold tracking-[0.1em] text-white transition hover:bg-transparent hover:text-[var(--dc-accent)] sm:px-10" to="/register">
                        INITIALIZE CHANNEL
                        <ArrowRight className="h-4 w-4" />
                    </Link>

                </div>
            </section>

            {/* BOTTOM */}
            <footer className="border-t border-[var(--dc-text)]/15">
                <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-6 py-7 font-mono text-[10px] tracking-[0.12em] text-[var(--dc-text)]/25 md:flex-row md:items-center md:justify-between md:px-10 xl:px-0">
                    <span>DRAWCAST // REAL-TIME BROADCAST GRAPHICS</span>
                    <span>DRAW. COLLABORATE. BROADCAST.</span>
                </div>
            </footer>

        </main>
    );
}