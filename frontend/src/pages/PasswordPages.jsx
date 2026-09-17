import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { KeyRound, Send } from 'lucide-react';
import api from '../api/axios';
import AuthShell from '../components/auth/AuthShell';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  return <AuthShell eyebrow="RECUPERA TU CUENTA" title="RECUPERAR // ACCESO" description="Te enviaremos un enlace seguro al correo asociado a tu cuenta.">
    <form onSubmit={async (event) => {
      event.preventDefault();
      setError('');
      try {
        const { data } = await api.post('/auth/forgot-password', { email });
        setMsg(data.message);
      } catch (err) {
        setError(err.response?.data?.message || 'No pudimos enviar el correo de recuperación.');
      }
    }} className="dc-auth-form">
      <label>CORREO DE TU CUENTA<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" required /></label>
      {error && <p className="dc-auth-alert error">{error}</p>}
      {msg && <p className="dc-auth-alert success">{msg}</p>}
      <button className="dc-auth-primary"><Send size={16} /> ENVIAR ENLACE DE RECUPERACIÓN</button>
    </form>
    <div className="dc-auth-links"><Link to="/login">VOLVER AL INICIO DE SESIÓN</Link></div>
  </AuthShell>;
}

export function ResetPassword() {
  const [query] = useSearchParams();
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  return <AuthShell eyebrow="CAMBIO SEGURO" title="NUEVA // CONTRASEÑA" description="Define una nueva contraseña para recuperar el acceso a DrawCast.">
    <form onSubmit={async (event) => {
      event.preventDefault();
      setError('');
      try {
        const { data } = await api.post('/auth/reset-password', { token: query.get('token'), password });
        setMsg(data.message);
      } catch (err) {
        setError(err.response?.data?.message || 'No pudimos actualizar la contraseña.');
      }
    }} className="dc-auth-form">
      <label>NUEVA CONTRASEÑA<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nueva contraseña" required /></label>
      {error && <p className="dc-auth-alert error">{error}</p>}
      {msg && <p className="dc-auth-alert success">{msg}</p>}
      <button className="dc-auth-primary"><KeyRound size={16} /> GUARDAR NUEVA CONTRASEÑA</button>
    </form>
    <div className="dc-auth-links"><Link to="/login">VOLVER AL INICIO DE SESIÓN</Link></div>
  </AuthShell>;
}
