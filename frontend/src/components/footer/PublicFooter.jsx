import { Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { PUBLIC_FOOTER_LINKS, footerSocialLinks, footerSupportEmail } from "./footerLinks";

import { SOCIAL_ICONS } from "./socialIcons";

function FooterColumn({ title, links, legal }) {
    return (
        <div>
            <h3 className={legal ? "mb-4 font-['Bebas_Neue'] text-2xl font-normal uppercase tracking-[0.03em] text-black" : "mb-4 font-['Bebas_Neue'] text-2xl font-normal uppercase tracking-[0.03em] text-[var(--dc-text)]"}>{title}</h3>
            <div className={legal ? "grid gap-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-black/55" : "grid gap-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--dc-text)]/45"}>
                {links.map((item) => (
                    <Link key={item.to} className={legal ? "w-fit transition hover:underline" : "w-fit transition hover:text-[var(--dc-accent)]"} to={item.to}>
                        {item.label}
                    </Link>
                ))}
            </div>
        </div>
    );
}

export default function PublicFooter({ legal = false }) {
    const socialLinks = footerSocialLinks();
    const supportEmail = footerSupportEmail();
    const year = new Date().getFullYear();

    return (
        <footer className={legal ? "border-t border-black/10 bg-white text-black" : "border-t border-[var(--dc-text)]/15 bg-black/10"}>
            <div className={legal ? "mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10 md:py-12 xl:px-0" : "mx-auto w-full max-w-[1240px] px-6 py-14 md:px-10 md:py-16 xl:px-0"}>
                <div className={legal ? "grid gap-8 border-b border-black/10 pb-8 md:grid-cols-[1.4fr_repeat(3,1fr)]" : "grid gap-10 border-b border-[var(--dc-text)]/10 pb-12 md:grid-cols-[1.4fr_repeat(3,1fr)]"}>
                    <div className="max-w-[360px]">
                        <strong className="font-['Bebas_Neue'] text-4xl font-normal tracking-[0.04em]">
                            DRAWCAST // OVERLAY
                        </strong>
                        <p className={legal ? "mt-4 text-sm leading-6 text-black/65" : "mt-5 text-sm leading-6 text-[var(--dc-text)]/50"}>
                            Crea, organiza y opera overlays colaborativos para transmisiones en vivo desde un solo espacio de trabajo.
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                            {socialLinks.map((item) => {
                                return (
                                    <a key={item.label} className={legal ? "grid h-9 w-9 place-items-center border border-black/10 text-black transition hover:border-black" : "grid h-9 w-9 place-items-center border border-[var(--dc-text)]/15 text-[var(--dc-text)]/45 transition hover:border-[var(--dc-accent)] hover:text-[var(--dc-accent)]"} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label} title={item.label}>
                                        <img src={SOCIAL_ICONS[item.label]} alt="" className={`h-4 w-4 object-contain ${item.label === "Instagram" || item.label === "GitHub" ? "brightness-0 invert" : ""}`} />
                                    </a>
                                );
                            })}
                        </div>
                    </div>

                    <FooterColumn title="Producto" links={PUBLIC_FOOTER_LINKS.producto} legal={legal} />
                    <FooterColumn title="Ayuda" links={PUBLIC_FOOTER_LINKS.ayuda} legal={legal} />

                    <div>
                        <h3 className={legal ? "mb-4 font-['Bebas_Neue'] text-2xl font-normal uppercase tracking-[0.03em] text-black" : "mb-4 font-['Bebas_Neue'] text-2xl font-normal uppercase tracking-[0.03em] text-[var(--dc-text)]"}>Legal</h3>
                        <div className={legal ? "grid gap-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-black/55" : "grid gap-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--dc-text)]/45"}>
                            {PUBLIC_FOOTER_LINKS.legal.map((item) => (
                                <Link key={item.to} className={legal ? "w-fit transition hover:underline" : "w-fit transition hover:text-[var(--dc-accent)]"} to={item.to}>
                                    {item.label}
                                </Link>
                            ))}
                            {supportEmail && (
                                <a className={legal ? "mt-2 inline-flex w-fit items-center gap-2 transition hover:underline" : "mt-2 inline-flex w-fit items-center gap-2 transition hover:text-[var(--dc-accent)]"} href={`mailto:${supportEmail}`}>
                                    <Mail size={14} /> Contacto
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                <div className={legal ? "flex flex-col gap-3 pt-6 font-mono text-[10px] uppercase tracking-[0.08em] text-black/45 md:flex-row md:items-center md:justify-between" : "flex flex-col gap-4 pt-7 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--dc-text)]/30 md:flex-row md:items-center md:justify-between"}>
                    <span>© {year} DrawCast. Todos los derechos reservados.</span>
                    <span className="inline-flex items-center gap-2">Seguridad y privacidad por diseño.</span>
                    <span>Sitio desarrollado por <a className={legal ? "transition hover:underline" : "transition hover:text-[var(--dc-accent)]"} href="https://datech.dannprod.com/" target="_blank" rel="noopener noreferrer">Datech</a>.</span>
                </div>
            </div>
        </footer>
    );
}
