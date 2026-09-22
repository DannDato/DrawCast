import { useCallback, useEffect, useState } from 'react';
import { Activity, Check, LockKeyhole, Mail, Palette, Settings2, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { getUserSettings, resetEditorSettings, saveEditorSettings } from '../api/settings';
import { DEFAULT_EDITOR_PREFERENCES, normalizeEditorPreferences } from '../components/editor/editorDefaults';
import EditorPreferencesSettings from '../components/settings/EditorPreferencesSettings';
import EmailSettings from '../components/settings/EmailSettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import ConnectionDiagnostics from '../components/dashboard/ConnectionDiagnostics';

const sections = [
    { id: 'editor', label: 'Editor', title: ['PREFERENCIAS', 'DEL EDITOR'], icon: Palette, accent: 'var(--dc-accent-one)', soft: 'var(--dc-accent-one-soft)' },
    { id: 'email', label: 'Correo', title: ['CORREO', 'DE ACCESO'], icon: Mail, accent: 'var(--dc-accent-four)', soft: 'var(--dc-accent-four-soft)' },
    { id: 'security', label: 'Seguridad', title: ['SEGURIDAD', 'DE CUENTA'], icon: LockKeyhole, accent: 'var(--dc-accent-three)', soft: 'var(--dc-accent-three-soft)' },
    { id: 'diagnostics', label: 'Diagnóstico', title: ['DIAGNÓSTICO', 'DE RENDIMIENTO'], icon: Activity, accent: 'var(--dc-accent-four)', soft: 'var(--dc-accent-two-soft)' },
];

const diagnosticNotes = [
    ['Red', 'Latencia y jitter altos apuntan normalmente a Wi‑Fi, ISP o la ruta entre tu navegador y TRAZIO.'],
    ['Este equipo', 'FPS bajos o bloqueos largos indican que el navegador o la computadora están trabajando de más.'],
    ['Servidor', 'Event loop o CPU altos indican que el problema puede estar del lado de TRAZIO, no en tu conexión.'],
];

export default function Settings() {
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedSection = searchParams.get('section');
    const activeSection = sections.some((item) => item.id === requestedSection) ? requestedSection : 'editor';
    const [editorPreferences, setEditorPreferences] = useState(DEFAULT_EDITOR_PREFERENCES);
    const [loadingEditor, setLoadingEditor] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState(null);

    const showNotice = useCallback((next) => setNotice(next), []);


    useEffect(() => {
        if (activeSection !== 'editor') return undefined;
        let active = true;
        getUserSettings()
            .then((data) => { if (active) setEditorPreferences(normalizeEditorPreferences(data.editor)); })
            .catch((error) => { if (active) setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo cargar la configuración del editor.' }); })
            .finally(() => { if (active) setLoadingEditor(false); });
        return () => { active = false; };
    }, [activeSection]);

    const selectSection = (id) => {
        setNotice(null);
        setSearchParams({ section: id });
    };

    const saveEditor = async () => {
        try {
            setSaving(true);
            setNotice(null);
            const data = await saveEditorSettings(editorPreferences);
            setEditorPreferences(normalizeEditorPreferences(data.editor));
            setNotice({ type: 'success', text: 'Configuración del editor guardada.' });
        } catch (error) {
            setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo guardar la configuración.' });
        } finally { setSaving(false); }
    };

    const resetEditor = async () => {
        try {
            setSaving(true);
            setNotice(null);
            const data = await resetEditorSettings();
            setEditorPreferences(normalizeEditorPreferences(data.editor));
            setNotice({ type: 'success', text: 'Se restauraron los valores predeterminados del editor.' });
        } catch (error) {
            setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo restaurar la configuración.' });
        } finally { setSaving(false); }
    };

    const current = sections.find((section) => section.id === activeSection) || sections[0];

    return <div className="mx-auto w-full max-w-[1440px] py-8 pt-7">
        {notice && <div className={`mb-4 flex items-center gap-2 border px-3.5 py-3 font-semibold ${notice.type === 'error' ? 'border-[var(--dc-alert-error-border)] bg-[var(--dc-alert-error-bg)] text-[var(--dc-alert-error-text)]' : 'border-[var(--dc-alert-success-border)] bg-[var(--dc-alert-success-bg)] text-[var(--dc-alert-success-text)]'}`}>{notice.type === 'success' ? <Check size={17} /> : <X size={17} />}{notice.text}</div>}

        <div className="grid grid-cols-1 items-start gap-[18px] md:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="grid gap-2 bg-[var(--dc-panel)] p-3 shadow-[0_8px_24px_var(--dc-shadow-soft)] md:sticky md:top-[84px]">
                <div className="mb-1 flex items-center gap-2 px-2 py-2 text-[11px] font-black uppercase tracking-[.1em] text-[var(--dc-text-muted)]"><Settings2 size={15} /> Secciones</div>
                {sections.map((section) => {
                    const SectionIcon = section.icon;
                    const selected = section.id === activeSection;
                    return <button key={section.id} type="button" onClick={() => selectSection(section.id)} style={{ '--dc-section-accent': section.accent, '--dc-section-soft': section.soft }} className={`grid grid-cols-[28px_minmax(0,1fr)] gap-2 px-2 py-2.5 text-left transition ${selected ? 'bg-[var(--dc-section-soft)] text-[var(--dc-section-accent)]' : 'text-[var(--dc-text)] hover:bg-[var(--dc-button-secondary-hover)]'}`} aria-current={selected ? 'page' : undefined}>
                        <SectionIcon size={18} className="mt-0.5" />
                        <strong className="block text-sm">{section.label}</strong>
                    </button>;
                })}
            </aside>

            <main className="min-w-0">
                {activeSection !== 'diagnostics' && <section className="overflow-hidden bg-[var(--dc-panel)] shadow-[0_8px_24px_var(--dc-shadow-soft)]">
                    <div className="flex justify-end px-5 py-4 max-[680px]:px-4">
                        <h1 className="m-0 flex flex-wrap justify-end gap-x-2 font-['Bebas_Neue'] text-[2rem] font-normal uppercase leading-none tracking-[.02em] text-[var(--dc-text)] max-[680px]:text-[1.75rem]"><span>{current.title[0]}</span><span style={{ color: current.accent }}>{current.title[1]}</span></h1>
                    </div>
                    <div className="p-5 max-[680px]:p-4">
                        {activeSection === 'editor' && (loadingEditor ? <div>Cargando configuración…</div> : <EditorPreferencesSettings embedded value={editorPreferences} onChange={setEditorPreferences} onSave={saveEditor} onReset={resetEditor} saving={saving} />)}
                        {activeSection === 'email' && <EmailSettings embedded onNotice={showNotice} />}
                        {activeSection === 'security' && <SecuritySettings embedded onNotice={showNotice} />}
                    </div>
                </section>}

                {activeSection === 'diagnostics' && <div className="grid gap-[18px]"><ConnectionDiagnostics /><section className="grid grid-cols-[minmax(190px,.7fr)_minmax(0,2fr)] gap-7 bg-[var(--dc-panel)] p-[22px] shadow-[0_8px_24px_var(--dc-shadow-soft)] max-[820px]:grid-cols-1"><div><span className="dc-kicker">CÓMO LEERLO</span><h2 className="mt-[5px] mb-0 text-[22px]">¿Dónde está el problema?</h2></div><div className="grid grid-cols-3 gap-[18px] max-[820px]:grid-cols-1 max-[820px]:gap-[13px]">{diagnosticNotes.map(([title, text]) => <article className="min-w-0" key={title}><strong className="mb-[5px] block text-[13px]">{title}</strong><p className="m-0 text-[13px] leading-6 text-[var(--dc-muted)]">{text}</p></article>)}</div></section></div>}
            </main>
        </div>
    </div>;
}
