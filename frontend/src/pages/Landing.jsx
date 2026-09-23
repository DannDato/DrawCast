import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, Check, Clock3, MonitorUp, PenTool, Radio, Type, Users } from "lucide-react";

import DoodleBackground from "../components/ui/DoodleBackground";
import PublicFooter from "../components/footer/PublicFooter";

const SHOW_PLANS = false;

export default function Landing() {
    const landingRef = useRef(null);

    useEffect(() => {
        const root = landingRef.current;
        if (!root) return undefined;

        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        let frameId = 0;

        const renderDepth = () => {
            frameId = 0;

            if (reduceMotion.matches) {
                root.style.setProperty("--dc-landing-doodle-y", "0px");
                root.style.setProperty("--dc-landing-wash-y", "0px");
                root.style.setProperty("--dc-landing-dots-x", "0px");
                root.style.setProperty("--dc-landing-dots-y", "0px");
                root.style.setProperty("--dc-landing-dots-soft-x", "4px");
                root.style.setProperty("--dc-landing-dots-soft-y", "6px");
                return;
            }

            const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
            const depth = Math.tanh(scrollY / 2200);

            // Capas profundas: movimiento acotado para que nunca descubran el borde del viewport.
            root.style.setProperty("--dc-landing-doodle-y", `${(-58 * depth).toFixed(2)}px`);
            root.style.setProperty("--dc-landing-wash-y", `${(-18 * depth).toFixed(2)}px`);

            // La trama es repetible, así que puede viajar un poco más y reforzar la profundidad.
            root.style.setProperty("--dc-landing-dots-x", `${((scrollY * 0.024) % 18).toFixed(2)}px`);
            root.style.setProperty("--dc-landing-dots-y", `${((scrollY * 0.085) % 18).toFixed(2)}px`);
            root.style.setProperty("--dc-landing-dots-soft-x", `${(4 - (scrollY * 0.013) % 13).toFixed(2)}px`);
            root.style.setProperty("--dc-landing-dots-soft-y", `${(6 - (scrollY * 0.041) % 13).toFixed(2)}px`);
        };

        const scheduleDepth = () => {
            if (frameId) return;
            frameId = requestAnimationFrame(renderDepth);
        };

        window.addEventListener("scroll", scheduleDepth, { passive: true });
        reduceMotion.addEventListener?.("change", scheduleDepth);
        renderDepth();

        return () => {
            if (frameId) cancelAnimationFrame(frameId);
            window.removeEventListener("scroll", scheduleDepth);
            reduceMotion.removeEventListener?.("change", scheduleDepth);
        };
    }, []);

    return (
        <main ref={landingRef} className="dc-landing-depth min-h-screen overflow-hidden bg-[var(--dc-bg)] text-[var(--dc-text)]">
            <DoodleBackground className="dc-landing-doodle blur-xs" />
            <div className="dc-landing-wash" aria-hidden="true"></div>
            <div className="dc-landing-stipple" aria-hidden="true"></div>
            <div className="dc-landing-content">
                <Helmet>
                    <title>TRAZIO — Overlays para OBS en Tiempo Real</title>
                    <meta
                        name="description"
                        content="Crea y controla overlays dinámicos para tu transmisión en vivo. Conecta TRAZIO a OBS Studio como Browser Source y opera tu stream en tiempo real, en equipo."
                    />
                    <link rel="canonical" href={`${import.meta.env.VITE_APP_URL}${window.location.pathname}`} />
                    <meta property="og:title" content="TRAZIO — Overlays para OBS en Tiempo Real" />
                    <meta
                        property="og:description"
                        content="Dibuja tu escena, comparte el control con tu equipo y transmite cada cambio al instante en OBS."
                    />
                    <meta property="og:url" content={`${import.meta.env.VITE_APP_URL}${window.location.pathname}`} />
                </Helmet>

                {/* HERO */}
                <section className="mx-auto flex min-h-screen w-full max-w-[1240px] flex-col px-6 md:px-10 xl:px-0">

                    <nav className="flex flex-col gap-5 border-b border-[var(--dc-text)]/15 py-5 sm:flex-row sm:items-center sm:justify-between">
                        <strong className="font-['Bebas_Neue'] text-2xl font-normal tracking-[0.06em] md:text-[28px]">
                            <strong>TRAZIO </strong><span className="text-[var(--dc-accent-four)]"> //</span>
                        </strong>

                        <div className="flex items-center gap-2">
                            <Link className="border border-[var(--dc-text)] px-4 py-3 font-mono text-[10px] font-bold tracking-wide transition hover:bg-[var(--dc-text)] hover:text-[var(--dc-bg)] sm:px-5 sm:text-xs md:px-6" to="/login">
                                Iniciar Sesión
                            </Link>

                            <Link className="border border-[var(--dc-accent-two)] bg-[var(--dc-accent-two)] px-4 py-3 font-mono text-[10px] font-bold tracking-wide text-[var(--dc-text-inverse)] transition hover:bg-transparent hover:text-[var(--dc-accent)] sm:px-5 sm:text-xs md:px-6" to="/register">
                                Crear cuenta
                            </Link>
                        </div>
                    </nav>

                    <div className="flex flex-col pt-10 md:pt-40 justify-between gap-10">
                        <div>
                            <h2 className="max-w-[800px] font-['Bebas_Neue'] text-[clamp(4rem,17vw,9rem)] font-normal uppercase leading-[0.74] tracking-[0.02em] md:text-[clamp(5rem,10vw,12rem)] m-0 p-0">
                                <strong>TRAZIO.</strong>
                            </h2>
                            <br></br>
                            <br></br>
                            <h2 className="max-w-[800px] font-['Bebas_Neue'] text-[clamp(3rem,17vw,9rem)] font-normal uppercase leading-[0.74] tracking-[-0.025em] md:text-[clamp(3rem,10vw,5.5rem)] mt-3">
                                <span className="text-[var(--dc-accent-four)]">DIBUJA.</span>
                                <br />
                                <span className="text-[var(--dc-accent-three)]">COLABORA.</span>
                                <br />
                                <span className="text-[var(--dc-accent)]">TRANSMITE.</span>
                            </h2>
                        </div>

                        <div className="flex flex-col justify-between text-right items-center">
                            <p className=" text-base leading-7 text-[var(--dc-text)] md:text-lg md:leading-8 text-right ">
                                Trazio es la plataforma para crear y controlar overlays dinámicos durante tus transmisiones en vivo.
                                Tus moderadores ahora pueden diseñar sobre tu escena, compartir el control con tu equipo de producción y mostrar cada cambio al instante en OBS Studio, sin reiniciar tu stream ni tu Browser Source.
                            </p>

                            <div className="mt-10 flex flex-wrap items-center gap-3">
                                <Link className="border border-[var(--dc-accent-two)] bg-[var(--dc-accent-two)] px-7 py-4 font-mono text-lg font-bold uppercase tracking-[0.08em] text-[var(--dc-text-inverse)] transition hover:bg-transparent hover:text-[var(--dc-accent)]" to="/register">
                                    CREA TU CUENTA YA!
                                </Link>
                            </div>
                        </div>
                    </div>

                    <footer className="grid border-t border-[var(--dc-text)]/15 md:grid-cols-3 hidden">
                        <div className="flex items-center gap-3 border-b border-[var(--dc-text)]/15 py-5 font-mono text-[11px] font-bold tracking-[0.12em] text-[var(--dc-text)]/45 md:border-r md:border-b-0">
                            <Radio className="h-4 w-4 text-[var(--dc-accent)]" strokeWidth={1.8} />
                            CONEXIÓN EN VIVO
                        </div>

                        <div className="flex items-center gap-3 border-b border-[var(--dc-text)]/15 py-5 font-mono text-[11px] font-bold tracking-[0.12em] text-[var(--dc-text)]/45 md:border-r md:border-b-0 md:px-6">
                            <Users className="h-4 w-4 text-[var(--dc-accent)]" strokeWidth={1.8} />
                            COLABORADORES AUTORIZADOS
                        </div>

                        <div className="flex items-center gap-3 py-5 font-mono text-[11px] font-bold tracking-[0.12em] text-[var(--dc-text)]/45 md:pl-6">
                            <PenTool className="h-4 w-4 text-[var(--dc-accent)]" strokeWidth={1.8} />
                            MOTOR DE DIBUJO
                        </div>
                    </footer>

                </section>

                <section>
                    <img src="img/Editor.png" alt="Description of image" className="w-[80%] h-auto mx-auto rounded-3xl overflow-hidden hover:scale-105 transition-transform duration-300"/>
                </section>

                {/* CONTROL -> OUTPUT */}
                <section className="">
                    <div className="mx-auto w-full max-w-[1240px] px-6 py-24 md:px-10 md:py-28 xl:px-0">

                        <h2 className="mt-5 font-['Bebas_Neue'] text-[clamp(4rem,14vw,7rem)] uppercase leading-[0.82] md:text-[clamp(4rem,8vw,7rem)]">
                            TÚ CONTROLAS AQUÍ <span className="text-[var(--dc-accent-two)]">//</span>
                            <span className="text-[var(--dc-accent-four)]"> SALE ALLÁ.</span>
                        </h2>

                        <p className="mt-8  text-base leading-7 text-[var(--dc-text)] md:text-lg md:leading-8">
                            Permite que tus moderadores operen tu transmisión en vivo directamente desde TRAZIO. Modifica textos, activa temporizadores y actualiza elementos gráficos sin reconstruir tu escena en OBS ni tocar el software de streaming a mitad de directo.
                        </p>

                        <div className="mt-14 grid min-w-0 gap-6 lg:mt-16 lg:grid-cols-[1fr_auto_1fr] lg:items-center">

                            {/* TRAZIO */}
                            <div className="min-w-0 border border-[var(--dc-text)]/20 bg-[var(--dc-panel)] shadow-[0_24px_70px_var(--dc-shadow-medium)]">
                                <div className="flex items-center justify-between gap-4 border-b border-[var(--dc-text)]/15 px-4 py-4 sm:px-5">
                                    <span className="font-mono text-[10px] font-bold tracking-[0.12em] sm:text-xs sm:tracking-[0.16em]">
                                        TRAZIO // EDITOR
                                    </span>

                                    <span className="h-2 w-2 shrink-0 bg-[var(--dc-accent)]"></span>
                                </div>

                                <div className="grid min-h-0 grid-cols-1 sm:min-h-[390px] sm:grid-cols-[110px_1fr] md:grid-cols-[160px_1fr]">

                                    <div className="border-b border-[var(--dc-text)]/15 p-3 sm:border-r sm:border-b-0 sm:p-4">
                                        <div className="mb-3 font-mono text-[9px] tracking-[0.15em] text-[var(--dc-text)]/60 sm:text-[10px]">
                                            ELEMENTOS
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                                            <div className="flex min-w-0 items-center gap-2 border border-[var(--dc-accent)] bg-[var(--dc-accent)]/10 p-3 font-mono text-[9px] text-[var(--dc-accent)] sm:text-[10px]">
                                                <Type className="h-3 w-3 shrink-0" />
                                                TEXTO
                                            </div>

                                            <div className="flex min-w-0 items-center gap-2 border border-[var(--dc-text)]/15 p-3 font-mono text-[9px] text-[var(--dc-text)]/50 sm:text-[10px]">
                                                <Clock3 className="h-3 w-3 shrink-0" />
                                                TEMPORIZADOR
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex min-w-0 items-center justify-center bg-black/30 p-3 sm:p-6">
                                        <div className="relative aspect-video w-full min-w-0 overflow-hidden border border-[var(--dc-text)]/15 bg-black">

                                            <div className="absolute left-[6%] top-[12%] max-w-[65%] border border-dashed border-[var(--dc-accent-three)]/70 px-2 py-1 font-['Bebas_Neue'] text-sm tracking-wider text-[var(--dc-accent-four)] sm:left-[8%] sm:top-[15%] sm:px-4 sm:py-2 sm:text-2xl">
                                                PRÓXIMO PARTIDO
                                            </div>

                                            <div className="absolute bottom-[10%] right-[6%] border border-dashed border-[var(--dc-accent-two)]/80 bg-[var(--dc-accent-two)]/25 px-2 py-1 font-mono text-xs font-bold text-[var(--dc-accent-four)] sm:bottom-[12%] sm:right-[8%] sm:px-5 sm:py-3 sm:text-xl">
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

                                <ArrowRight className="h-7 w-7 rotate-90 text-[var(--dc-accent-three)] lg:h-8 lg:w-8 lg:rotate-0" />

                                <span className="font-mono text-[9px] tracking-[0.16em] text-[var(--dc-text)]/60">
                                    SINCRONÍA EN VIVO
                                </span>
                            </div>

                            {/* OBS */}
                            <div className="min-w-0 border border-[var(--dc-text)]/20 bg-[var(--dc-panel)] shadow-[0_24px_70px_var(--dc-shadow-medium)]">
                                <div className="flex items-center justify-between gap-3 border-b border-[var(--dc-text)]/15 px-4 py-4 sm:px-5">
                                    <span className="font-mono text-[10px] font-bold tracking-[0.12em] sm:text-xs sm:tracking-[0.16em]">
                                        OBS // TRANSMISIÓN
                                    </span>

                                    <span className="font-mono text-[9px] text-[var(--dc-accent-four)] sm:text-[10px]">
                                        <span className="text-[var(--dc-accent-two)]">●</span> EN VIVO
                                    </span>
                                </div>

                                <div className="p-3 sm:p-6">
                                    <div className="relative aspect-video overflow-hidden border border-[var(--dc-text)]/15 bg-black">
                                        <div className="absolute left-[6%] top-[12%] px-2 py-1 font-['Bebas_Neue'] text-sm tracking-wider sm:left-[8%] sm:top-[15%] sm:px-4 sm:py-2 sm:text-2xl">
                                            PRÓXIMO JUEGO
                                        </div>

                                        <div className="absolute bottom-[10%] right-[6%] px-2 py-1 font-mono text-xs font-bold text-[var(--dc-accent)] sm:bottom-[12%] sm:right-[8%] sm:px-5 sm:py-3 sm:text-xl">
                                            04:32
                                        </div>

                                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/70 px-2 py-1.5 font-mono text-[7px] text-[var(--dc-text)]/60 sm:px-3 sm:py-2 sm:text-[9px]">
                                            <span>CÁMARA_01</span>
                                            <span>60 FPS</span>
                                        </div>
                                    </div>

                                    <div className="mt-4 border border-[var(--dc-text)]/15">
                                        <div className="border-b border-[var(--dc-text)]/15 px-4 py-3 font-mono text-[10px] tracking-[0.15em] text-[var(--dc-text)]/35">
                                            FUENTES
                                        </div>

                                        <div className="space-y-1 p-3 font-mono text-[10px]">
                                            <div className="flex justify-between px-2 py-1 text-[var(--dc-text)]/40">
                                                <span>Cámara</span>
                                                <span>●</span>
                                            </div>

                                            <div className="flex justify-between px-2 py-1 text-[var(--dc-text)]/40">
                                                <span>Gameplay</span>
                                                <span>●</span>
                                            </div>

                                            <div className="flex justify-between bg-[var(--dc-accent-two)] px-2 py-1 text-[var(--dc-text-inverse)]">
                                                <span>Overlay TRAZIO</span>
                                                <span>●</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </section>

        
                {/* COLLABORATION */}
                <section className="border-t border-[var(--dc-text)]/15 hidden">
                    <div className="mx-auto grid w-full max-w-[1240px] gap-16 px-6 py-24 md:px-10 md:py-28 lg:grid-cols-2 lg:items-center xl:px-0">

                        <div>

                            <h2 className="mt-5 font-['Bebas_Neue'] text-[clamp(4rem,14vw,6.5rem)] uppercase leading-[0.84] md:text-[clamp(4rem,7vw,6.5rem)]">
                                NO TIENES QUE
                                <br />
                                HACERLO TODO
                                <br />
                                <span className="text-[var(--dc-accent)]">TÚ SOLO.</span>
                            </h2>

                            <p className="mt-8 max-w-[550px] text-base leading-7 text-[var(--dc-text)]/50 md:text-lg md:leading-8">
                                Comparte el control de tu transmisión con tu equipo de producción. Mientras alguien está frente a cámara, otra persona puede operar los gráficos en vivo desde TRAZIO, en tiempo real y sin fricciones.
                            </p>
                        </div>

                        <div className="border border-[var(--dc-text)]/15 bg-[var(--dc-panel)]">
                            <div className="border-b border-[var(--dc-text)]/15 px-5 py-4 font-mono text-xs tracking-[0.15em] text-[var(--dc-text)]/40">
                                CANAL // EQUIPO DE PRODUCCIÓN
                            </div>

                            <div className="p-5 sm:p-6 md:p-8 ">
                                <div className="border border-[var(--dc-text)]/15  p-5 sm:p-6">
                                    <div className="font-mono text-[10px] tracking-[0.15em] text-[var(--dc-accent-three)]">
                                        STREAMER
                                    </div>

                                    <div className="mt-4 flex items-center justify-between gap-5">
                                        <div>
                                            <div className="font-['Bebas_Neue'] text-3xl">
                                                STREAMER
                                            </div>

                                            <div className="mt-1 font-mono text-[9px] text-[var(--dc-text)]/60 sm:text-[10px]">
                                                OBS // SALIDA EN VIVO
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
                                        COLABORADOR AUTORIZADO
                                    </div>

                                    <div className="mt-4 flex items-center justify-between gap-5">
                                        <div>
                                            <div className="font-['Bebas_Neue'] text-3xl">
                                                MODERADOR
                                            </div>

                                            <div className="mt-1 font-mono text-[9px] text-[var(--dc-text)]/60 sm:text-[10px]">
                                                TRAZIO // CONTROL
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

                        <h2 className="mt-6 font-['Bebas_Neue'] text-[clamp(4rem,14vw,8rem)] uppercase leading-[0.78] md:text-[clamp(4rem,9vw,6rem)]">
                            <span className="text-[var(--dc-accent-three)]"> UNA URL <span className="text-[var(--dc-text-muted)]">|</span> </span>
                            <span className="text-[var(--dc-text)]"> UNA FUENTE <span className="text-[var(--dc-text-muted)]">|</span> </span> 
                            <span className="text-[var(--dc-accent-four)]"> CONTROL TOTAL</span>
                        </h2>

                        <div className="mt-14 flex flex-col  gap-10 ">

                            <div className="min-w-0 border border-[var(--dc-text)]/15 bg-black p-3">
                                <div className="flex min-w-0 items-center gap-3 overflow-hidden border border-[var(--dc-text)]/10 bg-white/[0.03] px-4 py-3">
                                    <div className="h-2 w-2 shrink-0 bg-[var(--dc-accent)]"></div>

                                    <span className="min-w-0 truncate font-mono text-[9px] text-[var(--dc-text)]/35 sm:text-[10px]">
                                        {`${import.meta.env.VITE_APP_URL}${window.location.pathname}overlay/canal_xxxxxxxxx`}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <p className="text-base leading-7 text-[var(--dc-text)]/50 md:text-lg md:leading-8">
                                    Genera la URL de tu overlay para OBS, agrégala como Browser Source y mantén toda la operación fuera de tu escena de transmisión. Compatible con OBS Studio, Streamlabs y otros softwares de streaming.
                                </p>

                                <div className="mt-8 space-y-3 font-mono text-[11px] tracking-[0.12em]">
                                    <div className="flex items-center gap-3 border-b border-[var(--dc-text)]/10 pb-3">
                                        <span className="text-[var(--dc-accent-four)]">01</span>
                                        CREA TU CANAL
                                    </div>

                                    <div className="flex items-center gap-3 border-b border-[var(--dc-text)]/10 pb-3">
                                        <span className="text-[var(--dc-accent-three)]">02</span>
                                        COPIA LA URL DEL OVERLAY
                                    </div>

                                    <div className="flex items-center gap-3 border-b border-[var(--dc-text)]/10 pb-3">
                                        <span className="text-[var(--dc-accent-four)]">03</span>
                                        AGRÉGALA COMO BROWSER SOURCE
                                    </div>

                                    <div className="flex items-center gap-3 pb-3">
                                        <span className="bg-[var(--dc-accent-three)] px-1.5 py-0.5 text-[var(--dc-text-inverse)]">04</span>
                                        SAL AL AIRE
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </section>

                {/* PLANS */}
                {SHOW_PLANS && (
                <section className="border-t border-[var(--dc-text)]/15">
                    <div className="mx-auto w-full max-w-[1240px] px-6 py-24 md:px-10 md:py-28 xl:px-0">

                        <div className="mt-5 gap-8 lg:flex-row lg:items-end">
                            <h2 className="font-['Bebas_Neue'] text-[clamp(4rem,14vw,7rem)] uppercase leading-[0.82] md:text-[clamp(4rem,8vw,5rem)]">
                                EMPIEZA GRATIS.
                                <span className="text-[var(--dc-accent)]">CRECE CUANDO ESTÉS LISTO.</span>
                            </h2>
                        </div>

                        <div className="mt-16 grid border-t border-l border-[var(--dc-text)]/15 bg-[var(--dc-panel)] lg:grid-cols-3">

                            {/* FREE */}
                            <article className="flex min-h-[540px] flex-col border-r border-b border-[var(--dc-text)]/15 p-7 md:p-8">

                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="font-mono text-[10px] font-bold tracking-[0.18em] text-[var(--dc-accent-three)]">
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
                                    Lo esencial para comenzar a construir y controlar tus overlays desde TRAZIO, sin pagar nada.
                                </p>

                                <div className="my-8 h-px bg-[var(--dc-text)]/10"></div>

                                <div className="space-y-4">
                                    <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/65">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dc-accent-three)]" />
                                        Editor visual de overlays
                                    </div>

                                    <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/65">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dc-accent-three)]" />
                                        Browser Source para OBS
                                    </div>

                                    <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/65">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dc-accent-three)]" />
                                        Control en tiempo real
                                    </div>

                                    <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/65">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dc-accent-three)]" />
                                        Tu primer canal de transmisión
                                    </div>
                                </div>

                                <div className="mt-auto pt-10">
                                    <div className="mb-5">
                                        <span className="font-['Bebas_Neue'] text-5xl">
                                            $0
                                        </span>

                                        <span className="ml-2 font-mono text-[10px] tracking-[0.15em] text-[var(--dc-text)]/60">
                                            // PARA SIEMPRE
                                        </span>
                                    </div>

                                    <Link className="flex w-full items-center justify-between border border-[var(--dc-text)]/30 px-5 py-4 font-mono text-xs font-bold tracking-[0.08em] transition hover:border-[var(--dc-text)] hover:bg-[var(--dc-text)] hover:text-[var(--dc-bg)]" to="/register">
                                        EMPEZAR GRATIS
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </div>

                            </article>

                            {/* PREMIUM */}
                            <article className="relative flex min-h-[540px] flex-col overflow-hidden border-r border-b border-[var(--dc-accent)] bg-[var(--dc-accent)]/[0.035] p-7 md:p-8">

                                <div className="absolute right-0 top-0 bg-[var(--dc-accent)] px-4 py-2 font-mono text-[9px] font-bold tracking-[0.16em] text-[var(--dc-text-inverse)]">
                                    RECOMENDADO
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
                                    Para creadores que transmiten con frecuencia y quieren llevar su producción en vivo más allá de lo básico.
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
                                            PARA CREADORES
                                        </span>

                                        <span className="ml-2 font-mono text-[10px] tracking-[0.15em] text-[var(--dc-text)]/60">
                                            // PREMIUM
                                        </span>
                                    </div>

                                    <Link className="flex w-full items-center justify-between border border-[var(--dc-accent)] bg-[var(--dc-accent)] px-5 py-4 font-mono text-xs font-bold tracking-[0.08em] text-[var(--dc-text-inverse)] transition hover:bg-transparent hover:text-[var(--dc-accent)]" to="/register">
                                        PASAR A PREMIUM
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </div>

                            </article>

                            {/* PLUS */}
                            <article className="flex min-h-[540px] flex-col border-r border-b border-[var(--dc-text)]/15 p-7 md:p-8">

                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="font-mono text-[10px] font-bold tracking-[0.18em] text-[var(--dc-accent-three)]">
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
                                    Pensado para equipos, comunidades y producciones donde varias personas forman parte del directo, en sinergia total.
                                </p>

                                <div className="my-8 h-px bg-[var(--dc-text)]/10"></div>

                                <div className="space-y-4">
                                    <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/65">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dc-accent-three)]" />
                                        Todo lo incluido en Premium
                                    </div>

                                    <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/65">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dc-accent-three)]" />
                                        Equipos de producción
                                    </div>

                                    <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/65">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dc-accent-three)]" />
                                        Mayor capacidad de colaboración
                                    </div>

                                    <div className="flex items-start gap-3 text-sm text-[var(--dc-text)]/65">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dc-accent-three)]" />
                                        Prioridad en herramientas de producción
                                    </div>
                                </div>

                                <div className="mt-auto pt-10">
                                    <div className="mb-5">
                                        <span className="font-['Bebas_Neue'] text-4xl">
                                            PARA EQUIPOS
                                        </span>

                                        <span className="ml-2 font-mono text-[10px] tracking-[0.15em] text-[var(--dc-text)]/60">
                                            // PLUS
                                        </span>
                                    </div>

                                    <Link className="flex w-full items-center justify-between border border-[var(--dc-text)]/30 px-5 py-4 font-mono text-xs font-bold tracking-[0.08em] transition hover:border-[var(--dc-text)] hover:bg-[var(--dc-text)] hover:text-[var(--dc-bg)]" to="/register">
                                        ELEGIR PLUS
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </div>

                            </article>

                        </div>

                        <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--dc-text)]/25">
                            * Los límites y características de cada plan pueden ajustarse conforme evolucione TRAZIO.
                        </p>

                    </div>
                </section>
                )}

                {/* FINAL CTA */}
                <section className="border-t border-[var(--dc-text)]/15">
                    <div className="mx-auto w-full max-w-[1240px] px-6 py-28 text-center md:px-10 md:py-32 xl:px-0">

                        <h2 className="mt-6 font-['Bebas_Neue'] text-[clamp(5rem,18vw,10rem)] uppercase leading-[0.75] md:text-[clamp(5rem,11vw,10rem)]">
                            ¿LISTO PARA
                            <br />
                            <span className="text-[var(--dc-accent-two)]">TRANSMITIR?</span>
                        </h2>

                        <p className="mx-auto mt-10 ] text-base leading-7 text-[var(--dc-text)] md:text-lg md:leading-8">
                            Construye tu primer overlay, invita a tu equipo y conecta Trazio a OBS en minutos. Sin tarjeta de crédito, sin complicaciones.
                        </p>

                        <Link className="mt-10 inline-flex items-center gap-3 border border-[var(--dc-accent)] bg-[var(--dc-accent)] px-8 py-5 font-mono text-xs font-bold tracking-[0.1em] text-[var(--dc-text-inverse)] transition hover:bg-transparent hover:text-[var(--dc-accent)] sm:px-10" to="/register">
                            CREAR MI CANAL
                            <ArrowRight className="h-4 w-4" />
                        </Link>

                    </div>
                </section>

                <PublicFooter />


            </div>
        </main>
    );
}
