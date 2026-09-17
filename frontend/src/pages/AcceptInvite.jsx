import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { acceptInvitation } from '../api/channels';

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState('Aceptando invitación...');

  useEffect(() => {
    let cancelled = false;
    let redirectTimer = 0;

    acceptInvitation(token)
      .then(() => {
        if (cancelled) return;
        setState('Listo, ya tienes acceso.');
        redirectTimer = window.setTimeout(() => navigate('/app'), 900);
      })
      .catch((error) => {
        if (!cancelled) setState(error.response?.data?.message || 'No se pudo aceptar la invitación.');
      });

    return () => {
      cancelled = true;
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [token, navigate]);

  return <div className="dc-invite-page"><h1>DrawCast // COLABORACIÓN</h1><p>{state}</p></div>;
}
