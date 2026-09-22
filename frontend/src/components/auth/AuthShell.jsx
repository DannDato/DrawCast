import { Link } from 'react-router-dom';
import PublicFooter from '../footer/PublicFooter';
import DoodleBackground from '../ui/DoodleBackground';

export default function AuthShell({ eyebrow = 'ACCESO SEGURO', title, description, children, footer }) {
  return <main className="dc-auth-page">
    <div className="dc-auth-stage">
      <DoodleBackground className="dc-auth-doodle blur-xs" />
      <div className="dc-auth-grid" aria-hidden="true" />
      <Link className="dc-auth-brand" to="/"><strong>TRAZIO</strong><span>//</span></Link>
      <section className="dc-auth-card">
        <div className="dc-auth-card-line" />
        <div className="dc-auth-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description ? <p className="dc-auth-description">{description}</p> : null}
        {children}
        {footer ? <div className="dc-auth-footer">{footer}</div> : null}
      </section>
      <div className="dc-auth-system">TRAZIO // GRÁFICOS EN TIEMPO REAL</div>
    </div>
    <PublicFooter />
  </main>;
}
