import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import AuthShell from '../components/auth/AuthShell';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { clearPendingVerifyAccess, getPendingVerifyAccess, setPendingVerifyAccess, updatePendingVerifyAccess } from '../utils/verifyAccessStorage';

export default function VerifyAccess() {
  const [searchParams] = useSearchParams();
  const pending = useMemo(() => {
    const challengeId = searchParams.get('challengeId');
    if (challengeId) {
      setPendingVerifyAccess({
        challengeId,
        emailHint: searchParams.get('emailHint') || 'tu correo',
        resendAvailableInSeconds: Number(searchParams.get('resendAvailableInSeconds') || 60)
      });
    }
    return getPendingVerifyAccess();
  }, [searchParams]);
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(() => Math.max(0, Math.ceil(((pending?.resendAvailableAt || 0) - Date.now()) / 1000)));
  const refs = useRef([]);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  useEffect(() => {
    if (!pending) return undefined;
    const timer = setInterval(() => setCooldown(Math.max(0, Math.ceil(((getPendingVerifyAccess()?.resendAvailableAt || 0) - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [pending]);

  if (!pending) return <Navigate to="/login" replace />;

  const verify = async (code = digits.join('')) => {
    if (!/^\d{6}$/.test(code) || loading) return;
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await api.post('/auth/verify-access', { challengeId: pending.challengeId, code });
      clearPendingVerifyAccess();
      await refresh();
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo verificar el código');
      setDigits(Array(6).fill(''));
      setTimeout(() => refs.current[0]?.focus(), 0);
    } finally {
      setLoading(false);
    }
  };

  const setDigit = (index, value) => {
    const clean = String(value).replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    setError('');
    if (clean && index < 5) refs.current[index + 1]?.focus();
    if (clean && index === 5 && next.every(Boolean)) verify(next.join(''));
  };

  const keyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) refs.current[index - 1]?.focus();
    if (event.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < 5) refs.current[index + 1]?.focus();
  };

  const paste = (event) => {
    event.preventDefault();
    const code = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!code) return;
    const next = Array.from({ length: 6 }, (_, index) => code[index] || '');
    setDigits(next);
    refs.current[Math.min(code.length, 6) - 1]?.focus();
    if (code.length === 6) verify(code);
  };

  const resend = async () => {
    if (cooldown > 0 || loading) return;
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { data } = await api.post('/auth/resend-access-code', { challengeId: pending.challengeId });
      const resendAvailableAt = Date.now() + Number(data.resendAvailableInSeconds || 60) * 1000;
      updatePendingVerifyAccess({ resendAvailableAt, emailHint: data.emailHint || pending.emailHint });
      setCooldown(Number(data.resendAvailableInSeconds || 60));
      setMessage('Código reenviado.');
    } catch (err) {
      const retryAfter = Number(err.response?.data?.retryAfter || 0);
      if (retryAfter > 0) {
        const resendAvailableAt = Date.now() + retryAfter * 1000;
        updatePendingVerifyAccess({ resendAvailableAt });
        setCooldown(retryAfter);
      }
      setError(err.response?.data?.message || 'No se pudo reenviar el código');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell eyebrow="TWO-STEP VERIFICATION" title="VERIFY // ACCESS" description={<>Enviamos un código de 6 dígitos a <strong>{pending.emailHint}</strong>.</>}>
      <div className="dc-auth-shield"><ShieldCheck size={22} /></div>
      <div className="dc-auth-otp" onPaste={paste}>{digits.map((digit, index) => <input key={index} ref={(element) => { refs.current[index] = element; }} inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} maxLength={1} value={digit} disabled={loading} onChange={(event) => setDigit(index, event.target.value)} onKeyDown={(event) => keyDown(index, event)} aria-label={`Dígito ${index + 1}`} />)}</div>
      {error ? <p className="dc-auth-alert error">{error}</p> : null}
      {message ? <p className="dc-auth-alert success">{message}</p> : null}
      <button type="button" className="dc-auth-primary" disabled={loading || !digits.every(Boolean)} onClick={() => verify()}>{loading ? 'VERIFYING...' : 'VERIFY ACCESS'}</button>
      <button type="button" className="dc-auth-secondary" disabled={loading || cooldown > 0} onClick={resend}>{cooldown > 0 ? `RESEND IN ${cooldown}s` : 'RESEND CODE'}</button>
      <div className="dc-auth-links"><Link to="/login" onClick={clearPendingVerifyAccess}>BACK TO LOGIN</Link></div>
    </AuthShell>
  );
}
