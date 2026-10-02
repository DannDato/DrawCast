import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { getSystemModules } from '../api/systemModules';

export default function RegistrationRoute({ children }) {
  const [searchParams] = useSearchParams();
  const invite = String(searchParams.get('invite') || '').trim();
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      getSystemModules(),
      invite ? api.get(`/auth/registration-invite/${encodeURIComponent(invite)}`).then(() => true).catch(() => false) : Promise.resolve(false)
    ])
      .then(([modules, inviteValid]) => {
        if (!active) return;
        setAllowed(modules?.registration?.enabled !== false || inviteValid);
      })
      .catch(() => { if (active) setAllowed(false); });
    return () => { active = false; };
  }, [invite]);

  if (allowed == null) return null;
  if (!allowed) return <Navigate to="/" replace />;
  return children;
}
