import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { UserPlus } from "lucide-react";
import api from "../api/axios";
import GoogleAuthButton from "../components/auth/GoogleAuthButton";
import TwitchAuthButton from "../components/auth/TwitchAuthButton";
import ExternalOAuthButton from "../components/auth/ExternalOAuthButton";
import AuthShell from "../components/auth/AuthShell";
import TurnstileWidget from "../components/auth/TurnstileWidget";
import { clearPendingVerifyAccess, setPendingVerifyAccess } from "../utils/verifyAccessStorage";

const PROVIDER_LABELS = { google: "Google", twitch: "Twitch", kick: "Kick", discord: "Discord" };

export default function Register() {
    const [searchParams] = useSearchParams();
    const oauthUsername = searchParams.get("oauthUsername") === "1";
    const [form, setForm] = useState({ username: "", email: "", password: "", displayName: "" });
    const [oauthPending, setOauthPending] = useState(null);
    const [usernameCheck, setUsernameCheck] = useState({ username: "", available: false });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(oauthUsername);
    const [turnstileToken, setTurnstileToken] = useState("");
    const turnstileRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!oauthUsername) return;
        api.get("/auth/oauth/pending")
            .then(({ data }) => {
                setOauthPending(data);
                setForm((current) => ({ ...current, username: data.suggestedUsername || "" }));
            })
            .catch((err) => setError(err.response?.data?.message || "El registro de la plataforma ya no está disponible"))
            .finally(() => setLoading(false));
    }, [oauthUsername]);

    useEffect(() => {
        if (!oauthPending) return;
        const username = form.username.trim();
        if (!username) return;
        const timeout = window.setTimeout(() => {
            api.get("/auth/username-availability", { params: { username } })
                .then(({ data }) => setUsernameCheck({ username, available: Boolean(data.valid && data.available) }))
                .catch(() => setUsernameCheck({ username, available: false }));
        }, 300);
        return () => window.clearTimeout(timeout);
    }, [form.username, oauthPending]);

    const currentUsername = form.username.trim();
    const checkingUsername = Boolean(oauthPending && currentUsername && usernameCheck.username !== currentUsername);
    const usernameAvailable = Boolean(currentUsername && usernameCheck.username === currentUsername && usernameCheck.available);

    const submit = async (event) => {
        event.preventDefault();
        setError("");
        setLoading(true);
        clearPendingVerifyAccess();
        try {
            const { data } = await api.post("/auth/register", { ...form, turnstileToken });
            if (data.requiresOtp) {
                setPendingVerifyAccess(data);
                navigate("/verify-access");
                return;
            }
            navigate("/login");
        } catch (err) {
            setError(err.response?.data?.message || "No se pudo registrar");
            turnstileRef.current?.reset();
        } finally {
            setLoading(false);
        }
    };

    const completeOAuth = async (event) => {
        event.preventDefault();
        if (!usernameAvailable || checkingUsername) return;
        setError("");
        setLoading(true);
        clearPendingVerifyAccess();
        try {
            const { data } = await api.post("/auth/oauth/complete", { username: form.username.trim() });
            if (data.requiresOtp) {
                setPendingVerifyAccess(data);
                navigate("/verify-access");
                return;
            }
            navigate("/app");
        } catch (err) {
            const data = err.response?.data;
            if (data?.available === false) setUsernameCheck({ username: form.username.trim(), available: false });
            setError(data?.message || "No se pudo completar el registro");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell eyebrow="" title="CREAR // CUENTA" description="">
            <Helmet>
                <title>Crear Cuenta Gratis — DrawCast</title>
                <meta name="description" content="Regístrate gratis en DrawCast y empieza a crear overlays para tu transmisión en vivo. Conecta con OBS en minutos, sin tarjeta de crédito." />
                <link rel="canonical" href={`${import.meta.env.VITE_APP_URL}${window.location.pathname}register`} />
                <meta name="robots" content="noindex, follow" />
            </Helmet>

            {oauthUsername ? (
                <form onSubmit={completeOAuth} className="dc-auth-form">
                    <p className="dc-auth-alert success">
                        {oauthPending ? `${PROVIDER_LABELS[oauthPending.provider] || oauthPending.provider} ya verificó tu correo. El nombre sugerido está ocupado; elige uno disponible para terminar.` : "Comprobando tu registro..."}
                    </p>
                    {oauthPending ? <label>CORREO VERIFICADO<input value={oauthPending.email} disabled /></label> : null}
                    <label>
                        NOMBRE DE USUARIO
                        <input placeholder="Elige un nombre de usuario" value={form.username} disabled={loading || !oauthPending} onChange={(event) => setForm({ ...form, username: event.target.value })} autoFocus />
                    </label>
                    {oauthPending && form.username.trim() ? (
                        <p className={`dc-auth-alert ${usernameAvailable ? "success" : checkingUsername ? "" : "error"}`}>
                            {checkingUsername ? "Comprobando disponibilidad..." : usernameAvailable ? "Nombre de usuario disponible." : "Ese nombre no está disponible."}
                        </p>
                    ) : null}
                    {error ? <p className="dc-auth-alert error">{error}</p> : null}
                    <button className="dc-auth-primary" disabled={loading || !oauthPending || checkingUsername || !usernameAvailable}>
                        <UserPlus size={16} />
                        {loading ? "CREANDO CUENTA..." : "CONTINUAR"}
                    </button>
                </form>
            ) : (
                <>
                    <form onSubmit={submit} className="dc-auth-form dc-auth-form-grid">
                        <label>
                            USUARIO
                            <input placeholder="Usuario" value={form.username} disabled={loading} onChange={(event) => setForm({ ...form, username: event.target.value })} />
                        </label>
                        <label>
                            NOMBRE PARA MOSTRAR
                            <input placeholder="Nombre para mostrar" value={form.displayName} disabled={loading} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
                        </label>
                        <label className="wide">
                            CORREO ELECTRÓNICO
                            <input type="email" placeholder="Correo electrónico" value={form.email} disabled={loading} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                        </label>
                        <label className="wide">
                            CONTRASEÑA
                            <input type="password" placeholder="Mín. 6 caracteres, una mayúscula y un número" value={form.password} disabled={loading} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                        </label>
                        {error ? <p className="dc-auth-alert error wide">{error}</p> : null}
                        <div className="wide"><TurnstileWidget ref={turnstileRef} action="register" onTokenChange={setTurnstileToken} /></div>
                        <button className="dc-auth-primary wide" disabled={loading || !turnstileToken}>
                            <UserPlus size={16} />
                            {loading ? "CREANDO CUENTA..." : "CREAR CUENTA"}
                        </button>
                    </form>
                    <div className="dc-auth-divider"><span>O REGÍSTRATE CON</span></div>
                    <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
                        <GoogleAuthButton mode="signup" onError={setError} />
                        <TwitchAuthButton onError={setError} />
                        <ExternalOAuthButton provider="kick" onError={setError} />
                        <ExternalOAuthButton provider="discord" onError={setError} />
                    </div>
                </>
            )}
            <div className="dc-auth-links"><span>¿Ya estás registrado?</span><Link to="/login">Iniciar sesión</Link></div>
        </AuthShell>
    );
}
