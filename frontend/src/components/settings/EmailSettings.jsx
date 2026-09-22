import { useCallback, useEffect, useState } from 'react';
import { Check, Mail, X } from 'lucide-react';
import api from '../../api/axios';
import { getProfile, invalidateProfileCache } from '../../api/profile';
import { useAuth } from '../../context/AuthContext';

const fieldClass = 'w-full border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] px-3 py-[11px] text-[var(--dc-text)] outline-none focus:border-[var(--dc-accent-four)]';

export default function EmailSettings({ onNotice, embedded = false }) {
    const { refresh } = useAuth();
    const [profile, setProfile] = useState(null);
    const [hasPassword, setHasPassword] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [challengeId, setChallengeId] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');

    const load = useCallback(async () => {
        const data = await getProfile({ force: true });
        setProfile(data.user || null);
        setHasPassword(Boolean(data.hasPassword));
    }, []);

    useEffect(() => {
        let active = true;
        getProfile({ force: true })
            .then((data) => {
                if (!active) return;
                setProfile(data.user || null);
                setHasPassword(Boolean(data.hasPassword));
            })
            .catch((error) => {
                if (active) onNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo cargar la información del correo.' });
            })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [onNotice]);

    const requestEmailChange = async () => {
        try {
            setBusy('request');
            onNotice(null);
            const { data } = await api.post('/user/profile/email/request', { email: newEmail, currentPassword });
            setChallengeId(data.challengeId);
            onNotice({ type: 'success', text: data.message });
        } catch (error) {
            onNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo iniciar el cambio de correo.' });
        } finally { setBusy(''); }
    };

    const confirmEmailChange = async () => {
        try {
            setBusy('confirm');
            onNotice(null);
            const { data } = await api.post('/user/profile/email/confirm', { challengeId, code });
            invalidateProfileCache();
            setNewEmail('');
            setCurrentPassword('');
            setChallengeId('');
            setCode('');
            await load();
            await refresh();
            onNotice({ type: 'success', text: data.message });
        } catch (error) {
            onNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo confirmar el correo.' });
        } finally { setBusy(''); }
    };

    if (loading) return <div className="bg-[var(--dc-panel)] p-5">Cargando configuración del correo…</div>;

    return <section className={embedded ? '' : 'bg-[var(--dc-panel)] p-5 shadow-[0_8px_24px_var(--dc-shadow-soft)]'}>
        <div className="mb-[18px] flex items-start gap-2.5">
            <Mail size={20} />
            <div className="grid gap-1">
                <strong>Correo electrónico</strong>
                <span className="text-[13px] text-[var(--dc-text-muted)]">Cambia el correo asociado a tu cuenta mediante un código de verificación.</span>
            </div>
        </div>

        <div className="mb-4 border border-[var(--dc-line)] bg-[var(--dc-surface-raised)] p-4">
            <span className="block text-xs text-[var(--dc-text-muted)]">Correo actual</span>
            <strong className="mt-1 block break-all">{profile?.email || 'Sin correo registrado'}</strong>
        </div>

        <div className="grid gap-3.5 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-bold">Nuevo correo<input className={fieldClass} type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} disabled={Boolean(challengeId)} /></label>
            {hasPassword && <label className="grid gap-1.5 text-sm font-bold">Contraseña actual<input className={fieldClass} type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={Boolean(challengeId)} /></label>}
        </div>

        {!challengeId ? (
            <div className="mt-[18px] border-t border-[var(--dc-line)] pt-4">
                <button className="inline-flex items-center justify-center border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] px-3.5 py-2.5 text-[var(--dc-button-primary-text)] disabled:opacity-50" onClick={requestEmailChange} disabled={!newEmail || (hasPassword && !currentPassword) || busy === 'request'}>
                    {busy === 'request' ? 'Enviando…' : 'Enviar código al nuevo correo'}
                </button>
            </div>
        ) : (
            <div className="mt-[18px] border-t border-[var(--dc-line)] pt-4">
                <p className="mb-3 text-sm text-[var(--dc-text-muted)]">Revisa el nuevo correo e introduce el código de 6 dígitos que recibiste.</p>
                <div className="flex flex-wrap gap-2">
                    <input className="w-44 border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] px-3 py-[11px] text-[var(--dc-text)] outline-none focus:border-[var(--dc-accent-four)]" inputMode="numeric" maxLength={6} placeholder="Código de 6 dígitos" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} />
                    <button className="inline-flex items-center justify-center gap-2 border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] px-3.5 py-2.5 text-[var(--dc-button-primary-text)] disabled:opacity-50" onClick={confirmEmailChange} disabled={code.length !== 6 || busy === 'confirm'}>
                        {busy === 'confirm' ? 'Confirmando…' : 'Confirmar correo'}
                    </button>
                </div>
            </div>
        )}
    </section>;
}
