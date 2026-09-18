import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { acceptInvitation } from '../api/channels';

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading', title: 'Procesando invitación', message: 'Estamos comprobando tu acceso...' });

  useEffect(() => {
    let cancelled = false;
    let redirectTimer = 0;

    acceptInvitation(token)
      .then((result) => {
        if (cancelled) return;
        const alreadyMember = result.status === 'already_member' || result.status === 'already_member_suspended';
        setState({
          status: result.status === 'already_member_suspended' ? 'warning' : 'success',
          title: alreadyMember ? 'Ya formas parte de este equipo' : 'Invitación aceptada',
          message: result.message || (alreadyMember ? 'Este acceso ya había sido aceptado.' : 'Ya tienes acceso al lienzo.')
        });
        redirectTimer = window.setTimeout(() => navigate('/app/editor'), 1600);
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: 'error',
          title: 'No se pudo usar esta invitación',
          message: error.response?.data?.message || 'La invitación no es válida o ya no está disponible.'
        });
      });

    return () => {
      cancelled = true;
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [token, navigate]);

  const tone = state.status === 'error' ? 'var(--dc-danger)' : state.status === 'warning' ? 'var(--dc-warning)' : 'var(--dc-accent)';

  return <div className="fixed inset-0 grid place-content-center bg-[var(--dc-bg)] px-5 text-center text-[var(--dc-text)]">
    <div className="grid max-w-[520px] justify-items-center gap-3 bg-[var(--dc-panel)] p-8 shadow-[0_16px_50px_var(--dc-shadow-strong)]">
      <span className="dc-kicker">DRAWCAST // COLABORACIÓN</span>
      <h1 className="m-0 text-[32px] font-black" style={{ color: tone }}>{state.title}</h1>
      <p className="m-0 text-[13px] leading-relaxed text-[var(--dc-text-secondary)]">{state.message}</p>
      {state.status === 'error' && <Link to="/app/editor" className="mt-2 inline-flex min-h-10 items-center justify-center border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] px-4 text-[13px] font-bold text-[var(--dc-button-primary-text)]">Ir a Editores</Link>}
    </div>
  </div>;
}
