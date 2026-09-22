import { Link } from "react-router-dom";
import { APP_FOOTER_LINKS, footerSocialLinks } from "./footerLinks";

import { SOCIAL_ICONS } from "./socialIcons";

export default function AppFooter() {
    const socialLinks = footerSocialLinks();
    const year = new Date().getFullYear();

    return (
        <footer className="mx-auto w-full max-w-[1440px] border-t border-[var(--dc-line)] px-4 py-5 md:px-0">
            <div className="flex flex-col gap-4 text-[11px] text-[var(--dc-text-muted)] md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 font-mono font-bold uppercase tracking-[0.08em]">
                    <span className="text-[var(--dc-text)]">DrawCast</span>
                    <span className="text-[var(--dc-line)]">//</span>
                    <span>© {year}</span>
                </div>

                <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] font-bold uppercase tracking-[0.06em]">
                    {APP_FOOTER_LINKS.map((item) => (
                        <Link key={item.to} className="transition hover:text-[var(--dc-accent)]" to={item.to}>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                {socialLinks.length > 0 && (
                    <div className="flex items-center gap-1.5">
                        {socialLinks.map((item) => (
                            <a key={item.label} className="grid h-8 w-8 place-items-center border border-transparent transition hover:border-[var(--dc-line)] hover:bg-[var(--dc-panel)] hover:text-[var(--dc-accent)]" href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label} title={item.label}>
                                <img src={SOCIAL_ICONS[item.label]} alt="" className={`h-[15px] w-[15px] object-contain ${item.label === "Instagram" || item.label === "GitHub" ? "brightness-0 invert" : ""}`} />
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </footer>
    );
}
