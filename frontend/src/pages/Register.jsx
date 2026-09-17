import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { UserPlus } from "lucide-react";
import api from "../api/axios";
import GoogleAuthButton from "../components/auth/GoogleAuthButton";
import AuthShell from "../components/auth/AuthShell";
import { clearPendingVerifyAccess, setPendingVerifyAccess } from "../utils/verifyAccessStorage";

export default function Register() {
    const [form, setForm] = useState({ username: "", email: "", password: "", displayName: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const submit = async (event) => {
        event.preventDefault();
        setError("");
        setLoading(true);
        clearPendingVerifyAccess();
        try {
            const { data } = await api.post("/auth/register", form);
            if (data.requiresOtp) {
                setPendingVerifyAccess(data);
                navigate("/verify-access");
                return;
            }
            navigate("/login");
        } catch (err) {
            setError(err.response?.data?.message || "No se pudo registrar");
        } finally {
            setLoading(false);
        }
    };
    return (
        <AuthShell
            eyebrow=""
            title="CREAR // CUENTA"
            description="Crea tu cuenta de DrawCast. Después podrás abrir tu canal e invitar a tu equipo para ayudarte durante el stream."
        >
            <Helmet>
                <title>Crear Cuenta Gratis — DrawCast</title>
                <meta
                    name="description"
                    content="Regístrate gratis en DrawCast y empieza a crear overlays para tu transmisión en vivo. Conecta con OBS en minutos, sin tarjeta de crédito."
                />
                <link rel="canonical" href="https://drawcast.app/register" />
                <meta name="robots" content="noindex, follow" />
            </Helmet>
            <form onSubmit={submit} className="dc-auth-form dc-auth-form-grid">
                <label>
                    USUARIO
                    <input
                        placeholder="Usuario"
                        value={form.username}
                        disabled={loading}
                        onChange={(event) => setForm({ ...form, username: event.target.value })}
                    />
                </label>
                <label>
                    NOMBRE PARA MOSTRAR
                    <input
                        placeholder="Nombre para mostrar"
                        value={form.displayName}
                        disabled={loading}
                        onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                    />
                </label>
                <label className="wide">
                    CORREO ELECTRÓNICO
                    <input
                        type="email"
                        placeholder="Correo electrónico"
                        value={form.email}
                        disabled={loading}
                        onChange={(event) => setForm({ ...form, email: event.target.value })}
                    />
                </label>
                <label className="wide">
                    CONTRASEÑA
                    <input
                        type="password"
                        placeholder="Mín. 6 caracteres, una mayúscula y un número"
                        value={form.password}
                        disabled={loading}
                        onChange={(event) => setForm({ ...form, password: event.target.value })}
                    />
                </label>
                {error ? <p className="dc-auth-alert error wide">{error}</p> : null}
                <button className="dc-auth-primary wide" disabled={loading}>
                    <UserPlus size={16} />
                    {loading ? "CREANDO CUENTA..." : "CREAR CUENTA"}
                </button>
            </form>
            <div className="dc-auth-divider">
                <span>O REGÍSTRATE CON</span>
            </div>
            <GoogleAuthButton mode="signup" onError={setError} />
            <div className="dc-auth-links">
                <span>¿Ya estás registrado?</span>
                <Link to="/login">Iniciar sesión</Link>
            </div>
        </AuthShell>
    );
}
