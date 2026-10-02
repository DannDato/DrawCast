import PublicFooter from '../footer/PublicFooter';
import PublicBackground from '../ui/PublicBackground';
import PublicNavbar from '../ui/PublicNavbar';

export default function AuthShell({ eyebrow = 'ACCESO SEGURO', title, description, children, footer }) {
  return (
    <main className="dc-auth-page dc-public-stage">
      <PublicBackground />

      <div className="dc-public-content dc-auth-public-content">
        <div className="dc-auth-public-nav mx-auto w-full max-w-[1240px] px-6 md:px-10 xl:px-0">
          <PublicNavbar />
        </div>

        <div className="dc-auth-stage">
          <section className="dc-auth-card">
            <div className="dc-auth-eyebrow">{eyebrow}</div>
            <h1>{title}</h1>
            {description ? <p className="dc-auth-description">{description}</p> : null}
            {children}
            {footer ? <div className="dc-auth-footer">{footer}</div> : null}
          </section>

          <div className="dc-auth-system">TRAZIO // GRÁFICOS EN TIEMPO REAL</div>
        </div>

        <div className="dc-auth-public-footer">
          <PublicFooter />
        </div>
      </div>
    </main>
  );
}
