import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import api from '../api/axios';
import GoogleAuthButton from '../components/auth/GoogleAuthButton';
import AuthShell from '../components/auth/AuthShell';
import { clearPendingVerifyAccess, setPendingVerifyAccess } from '../utils/verifyAccessStorage';

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '', displayName: '' }); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const navigate = useNavigate();
  const submit = async (event) => { event.preventDefault(); setError(''); setLoading(true); clearPendingVerifyAccess(); try { const { data } = await api.post('/auth/register', form); if (data.requiresOtp) { setPendingVerifyAccess(data); navigate('/verify-access'); return; } navigate('/login'); } catch (err) { setError(err.response?.data?.message || 'No se pudo registrar'); } finally { setLoading(false); } };
  return <AuthShell eyebrow="NEW OPERATOR" title="CREATE // ACCOUNT" description="Crea tu identidad DrawCast. Después podrás inicializar tu canal e invitar colaboradores registrados.">
    <form onSubmit={submit} className="dc-auth-form dc-auth-form-grid"><label>USERNAME<input placeholder="Usuario" value={form.username} disabled={loading} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label><label>DISPLAY NAME<input placeholder="Nombre para mostrar" value={form.displayName} disabled={loading} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label><label className="wide">EMAIL<input type="email" placeholder="Email" value={form.email} disabled={loading} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label className="wide">PASSWORD<input type="password" placeholder="Mín. 6 caracteres, una mayúscula y un número" value={form.password} disabled={loading} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>{error ? <p className="dc-auth-alert error wide">{error}</p> : null}<button className="dc-auth-primary wide" disabled={loading}><UserPlus size={16}/>{loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}</button></form>
    <div className="dc-auth-divider"><span>OR CONTINUE WITH</span></div><GoogleAuthButton mode="signup" onError={setError} /><div className="dc-auth-links"><span>ALREADY REGISTERED?</span><Link to="/login">LOGIN</Link></div>
  </AuthShell>;
}
