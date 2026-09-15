import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/auth/GoogleAuthButton';
import AuthShell from '../components/auth/AuthShell';
import { clearPendingVerifyAccess, setPendingVerifyAccess } from '../utils/verifyAccessStorage';

export default function Login() {
  const [login, setLogin] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const { login: doLogin } = useAuth(); const navigate = useNavigate();
  const submit = async (event) => { event.preventDefault(); setError(''); setLoading(true); clearPendingVerifyAccess(); try { const data = await doLogin({ login, password }); if (data.requiresOtp) { setPendingVerifyAccess(data); navigate('/verify-access'); return; } navigate('/app'); } catch (err) { setError(err.response?.data?.message || 'No se pudo iniciar sesión'); } finally { setLoading(false); } };
  return <AuthShell eyebrow="USER AUTHENTICATION" title="WELCOME // BACK" description="Accede a tu consola DrawCast para administrar tu canal, colaboradores y editor.">
    <form onSubmit={submit} className="dc-auth-form"><label>USER / EMAIL<input placeholder="Usuario o email" value={login} disabled={loading} onChange={(event) => setLogin(event.target.value)} /></label><label>PASSWORD<input type="password" placeholder="Contraseña" value={password} disabled={loading} onChange={(event) => setPassword(event.target.value)} /></label>{error ? <p className="dc-auth-alert error">{error}</p> : null}<button className="dc-auth-primary" disabled={loading}><LogIn size={16}/>{loading ? 'AUTHENTICATING...' : 'LOGIN'}</button></form>
    <div className="dc-auth-divider"><span>OR CONTINUE WITH</span></div><GoogleAuthButton mode="signin" onError={setError} />
    <div className="dc-auth-links"><Link to="/register">CREATE ACCOUNT</Link><Link to="/forgot-password">FORGOT PASSWORD?</Link></div>
  </AuthShell>;
}
