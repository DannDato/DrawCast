import { Link } from 'react-router-dom';

export default function AuthShell({ eyebrow = 'SECURE ACCESS', title, description, children, footer }) {
  return <main className="dc-auth-page">
    <div className="dc-auth-grid" aria-hidden="true" />
    <Link className="dc-auth-brand" to="/"><strong>DrawCast</strong><span>// DannDato</span></Link>
    <section className="dc-auth-card">
      <div className="dc-auth-card-line" />
      <div className="dc-auth-eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {description ? <p className="dc-auth-description">{description}</p> : null}
      {children}
      {footer ? <div className="dc-auth-footer">{footer}</div> : null}
    </section>
    <div className="dc-auth-system">DRAWCAST CLOUD // REALTIME GRAPHICS SYSTEM</div>
  </main>;
}
