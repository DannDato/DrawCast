import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import PublicFooter from "../components/footer/PublicFooter";

const supportEmail = String(import.meta.env.VITE_SUPPORT_EMAIL || "").trim();

const pages = {
    privacy: {
        eyebrow: "LEGAL // PRIVACIDAD",
        title: "POLÍTICA DE",
        accent: "PRIVACIDAD",
        description: "Cómo tratamos la información necesaria para operar TRAZIO.",
        sections: [
            ["Qué información tratamos", [
                "Datos de cuenta y perfil que proporcionas al registrarte o conectar métodos de acceso.",
                "Contenido y archivos que decides guardar o subir dentro de tus lienzos.",
                "Información técnica necesaria para sesiones, seguridad, prevención de abuso y diagnóstico del servicio.",
                "Datos de colaboración, invitaciones y actividad necesarios para operar espacios compartidos.",
            ]],
            ["Para qué la usamos", [
                "Prestar y mantener el servicio, autenticar tu cuenta y conservar tus preferencias.",
                "Permitir colaboración en tiempo real, operación de overlays y recuperación de diseños.",
                "Proteger cuentas, detectar actividad anómala, aplicar límites y resolver incidentes técnicos.",
                "Comunicarnos contigo sobre eventos de seguridad o cambios relevantes del servicio cuando corresponda.",
            ]],
            ["Compartición y terceros", [
                "No publicamos tu información de cuenta por defecto. Los datos necesarios pueden ser procesados por proveedores que soportan funciones del servicio, por ejemplo autenticación, correo o infraestructura.",
                "Cuando conectas servicios externos, su tratamiento de datos también se rige por las políticas del proveedor correspondiente.",
            ]],
            ["Conservación y control", [
                "Conservamos la información mientras sea necesaria para operar tu cuenta, cumplir obligaciones aplicables, prevenir abuso o mantener integridad del servicio.",
                "Puedes actualizar datos de cuenta desde TRAZIO y solicitar atención sobre privacidad mediante el canal de soporte publicado en este sitio.",
            ]],
        ],
    },
    terms: {
        eyebrow: "LEGAL // SERVICIO",
        title: "TÉRMINOS Y",
        accent: "CONDICIONES",
        description: "Reglas básicas para utilizar TRAZIO y sus espacios colaborativos.",
        sections: [
            ["Cuenta y acceso", [
                "Eres responsable de mantener bajo control tus métodos de acceso y de revisar las sesiones asociadas a tu cuenta.",
                "Los enlaces de editor, overlay e invitación deben tratarse como información sensible cuando permitan acceso o visualización de contenido.",
            ]],
            ["Uso permitido", [
                "No debes utilizar TRAZIO para vulnerar sistemas, distribuir contenido ilegal, abusar de otros usuarios o interferir deliberadamente con la disponibilidad del servicio.",
                "El acceso de colaboradores depende de los permisos otorgados por el propietario del lienzo y puede ser suspendido o revocado.",
            ]],
            ["Tu contenido", [
                "Conservas la responsabilidad sobre los textos, imágenes, diseños y demás contenido que cargas o produces en TRAZIO.",
                "Al colaborar en un lienzo aceptas que otros usuarios autorizados puedan modificar el contenido de ese espacio conforme a sus permisos.",
            ]],
            ["Disponibilidad y cambios", [
                "TRAZIO puede evolucionar, modificar funciones o establecer límites técnicos para mantener seguridad y estabilidad.",
                "Las funciones experimentales o en desarrollo pueden cambiar antes de considerarse definitivas.",
            ]],
            ["Suspensión y terminación", [
                "Podemos restringir acceso cuando sea necesario para proteger usuarios, el servicio o cumplir obligaciones aplicables.",
                "El propietario puede eliminar lienzos y revocar colaboradores desde las herramientas disponibles en la aplicación.",
            ]],
        ],
    },
    cookies: {
        eyebrow: "LEGAL // NAVEGADOR",
        title: "POLÍTICA DE",
        accent: "COOKIES",
        description: "Qué cookies utiliza TRAZIO y para qué sirven.",
        sections: [
            ["Cookies necesarias", [
                "TRAZIO utiliza cookies necesarias para mantener una sesión autenticada de forma segura.",
                "También puede utilizar una cookie de dispositivo confiable cuando habilitas o utilizas funciones de verificación de acceso.",
                "Estas cookies soportan funciones esenciales de cuenta y seguridad; deshabilitarlas puede impedir iniciar sesión o usar partes protegidas de la aplicación.",
            ]],
            ["Preferencias y almacenamiento", [
                "Las preferencias propias de TRAZIO se asocian a tu cuenta cuando corresponde. El navegador también puede conservar información técnica estrictamente necesaria para completar ciertos flujos.",
            ]],
            ["Servicios externos", [
                "Al utilizar autenticación o contenido de proveedores externos, esos servicios pueden aplicar sus propias cookies en sus dominios conforme a sus políticas.",
            ]],
            ["Cambios futuros", [
                "Si TRAZIO incorpora cookies no esenciales, analítica o publicidad que requieran controles adicionales, esta política y la experiencia de consentimiento se actualizarán antes de utilizarlas cuando corresponda.",
            ]],
        ],
    },
    faq: {
        eyebrow: "AYUDA // FAQ",
        title: "PREGUNTAS",
        accent: "FRECUENTES",
        description: "Respuestas rápidas sobre el flujo principal de TRAZIO.",
        sections: [
            ["¿Qué es TRAZIO?", ["Es una herramienta para construir y operar overlays colaborativos en tiempo real y proyectarlos en software de streaming mediante una Browser Source."]],
            ["¿Cómo lo conecto a OBS?", ["Cada lienzo genera una URL de overlay. Agrégala en OBS Studio como Browser Source y conserva esa fuente mientras trabajas desde el editor."]],
            ["¿Puedo trabajar con otras personas?", ["Sí. El propietario puede invitar colaboradores, suspender su acceso o eliminarlo. Los cambios autorizados se sincronizan con el lienzo compartido."]],
            ["¿Puedo guardar diseños?", ["Sí. Puedes guardar estados de diseño para recuperarlos después y mantener elementos preparados dentro y fuera del área visible del overlay."]],
            ["¿Qué se proyecta?", ["Sólo lo que queda dentro del área del lienzo se muestra en el overlay. Los elementos que quedan fuera pueden seguir guardados y listos para arrastrarse cuando los necesites."]],
            ["¿Dónde gestiono mi seguridad?", ["Dentro de Configuración puedes revisar sesiones y dispositivos, cambiar contraseña y cerrar accesos que ya no reconozcas."]],
        ],
    },
    security: {
        eyebrow: "AYUDA // SEGURIDAD",
        title: "SEGURIDAD EN",
        accent: "TRAZIO",
        description: "Prácticas y controles que ayudan a proteger cuentas, lienzos y colaboración.",
        sections: [
            ["Acceso y sesiones", [
                "La aplicación valida permisos en el servidor antes de permitir operaciones protegidas sobre lienzos y cuentas.",
                "Las sesiones del navegador utilizan cookies de autenticación protegidas contra acceso directo desde JavaScript.",
                "Puedes revisar y cerrar sesiones desde Configuración cuando un dispositivo ya no deba conservar acceso.",
            ]],
            ["Colaboración", [
                "Ser invitado a un lienzo no convierte al colaborador en propietario. Los permisos se verifican en cada flujo protegido.",
                "Suspender o eliminar a un colaborador revoca su acceso al lienzo conforme a las reglas del servidor.",
            ]],
            ["Enlaces y UUID", [
                "TRAZIO utiliza identificadores públicos no incrementales para evitar exponer IDs internos de base de datos.",
                "Un identificador público no sustituye la autorización: el servidor sigue comprobando permisos antes de aceptar acciones.",
            ]],
            ["Reportar un problema", [
                supportEmail
                    ? `Si detectas una posible vulnerabilidad, evita publicarla y repórtala de forma responsable a ${supportEmail}.`
                    : "Si detectas una posible vulnerabilidad, evita publicarla y utiliza el canal de soporte oficial que TRAZIO publique para reportarla de forma responsable.",
            ]],
        ],
    },
};

function PublicInfoPage({ page }) {
    const data = pages[page];

    const isLegal = ["privacy", "terms", "cookies"].includes(page);

    if (isLegal) return (
        <main className="min-h-screen bg-white text-black">
            <Helmet>
                    <title>{`${data.accent} — TRAZIO`}</title>
                    <meta name="description" content={data.description} />
            </Helmet>

            <nav className="border-b border-white/10 bg-[#242424] text-white">
                <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between gap-5 px-6 py-5 md:px-10 xl:px-0">
                    <Link className="font-['Bebas_Neue'] text-2xl font-normal tracking-[0.06em]" to="/">TRAZIO // OVERLAY</Link>
                    <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
                        <Link className="border border-white/20 px-3 py-2 transition hover:border-white" to="/">Inicio</Link>
                        <Link className="border border-white bg-white px-3 py-2 text-black transition hover:bg-white/85" to="/login">Entrar</Link>
                    </div>
                </div>
            </nav>

            <div className="mx-auto w-full max-w-[1100px] px-6 md:px-10 xl:px-0">
                <header className="py-12 md:py-16">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-black/45">{data.eyebrow}</span>
                    <h1 className="mt-4 font-['Bebas_Neue'] text-[clamp(3rem,7vw,5.5rem)] font-normal uppercase leading-[0.86] tracking-[-0.01em] text-black">{data.title} <span className="text-[var(--dc-accent-two)]">{data.accent}</span></h1>
                    <p className="mt-6 max-w-[820px] text-base leading-7 text-black md:text-lg md:leading-8">{data.description}</p>
                    <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-black/40">Última actualización: 22 septiembre 2026</p>
                </header>

                <div className="border-t border-black/10 pb-14">
                    {data.sections.map(([title, paragraphs], index) => (
                        <section key={title} className="grid gap-4 border-b border-black/10 py-8 md:grid-cols-[210px_minmax(0,1fr)] md:gap-10">
                            <h2 className="m-0 text-base font-bold uppercase tracking-[0.04em] text-black"><span className="mr-2 font-mono text-xs text-[var(--dc-accent-two)]">{String(index + 1).padStart(2, "0")}</span>{title}</h2>
                            <div className="grid gap-4 text-justify text-sm leading-7 text-black md:text-base md:leading-8">
                                {paragraphs.map((paragraph) => <p className="m-0" key={paragraph}>{paragraph}</p>)}
                            </div>
                        </section>
                    ))}
                </div>
            </div>

            <PublicFooter legal />
        </main>
    );

    return (
        <main className="relative min-h-screen overflow-hidden bg-[var(--dc-bg)] text-[var(--dc-text)]">
            <div className="relative z-10">
                <Helmet>
                    <title>{`${data.accent} — TRAZIO`}</title>
                    <meta name="description" content={data.description} />
                </Helmet>

                <div className="mx-auto w-full max-w-[1240px] px-6 md:px-10 xl:px-0">
                    <nav className="flex items-center justify-between gap-5 border-b border-[var(--dc-text)]/15 py-5">
                        <Link className="font-['Bebas_Neue'] text-2xl font-normal tracking-[0.06em]" to="/">
                            TRAZIO <span className="text-[var(--dc-accent-three)]">//</span> <span className="text-[var(--dc-accent-four)]">OVERLAY</span>
                        </Link>
                        <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
                            <Link className="border border-[var(--dc-text)]/25 px-3 py-2 transition hover:border-[var(--dc-accent-three)] hover:text-[var(--dc-accent-four)]" to="/">Inicio</Link>
                            <Link className="border border-[var(--dc-accent-one)] bg-[var(--dc-accent-one)] px-3 py-2 text-[var(--dc-text-inverse)]" to="/login">Entrar</Link>
                        </div>
                    </nav>

                    <header className="py-16 md:py-24">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--dc-text)]/40">{data.eyebrow}</span>
                        <h1 className="mt-5 font-['Bebas_Neue'] text-[clamp(4rem,12vw,8rem)] font-normal uppercase leading-[0.78] tracking-[-0.02em]">
                            {data.title} <span className="text-[var(--dc-accent-four)]">{data.accent}</span>
                        </h1>
                        <p className="mt-8 max-w-[760px] text-base leading-7 text-[var(--dc-text)]/60 md:text-lg md:leading-8">{data.description}</p>
                        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--dc-text)]/30">Última actualización: 22 septiembre 2026</p>
                    </header>

                    <div className="border-t border-[var(--dc-text)]/15 pb-20">
                        {data.sections.map(([title, paragraphs], index) => (
                            <section key={title} className="grid gap-5 border-b border-[var(--dc-text)]/10 py-10 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
                                <div className="font-['Bebas_Neue'] text-3xl uppercase text-[var(--dc-text-muted)]">
                                    <span className="mr-2 text-[var(--dc-accent-three)]">{String(index + 1).padStart(2, "0")}</span>{title}
                                </div>
                                <div className="grid gap-4 text-sm leading-7 text-[var(--dc-text)]/60 md:text-base">
                                    {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                                </div>
                            </section>
                        ))}
                    </div>
                </div>

                <PublicFooter />
            </div>
        </main>
    );
}

export const PrivacyPage = () => <PublicInfoPage page="privacy" />;
export const TermsPage = () => <PublicInfoPage page="terms" />;
export const CookiesPage = () => <PublicInfoPage page="cookies" />;
export const FaqPage = () => <PublicInfoPage page="faq" />;
export const SecurityPage = () => <PublicInfoPage page="security" />;
