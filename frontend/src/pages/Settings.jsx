import { useCallback, useEffect, useState } from 'react';
import { Check, LockKeyhole, Palette, Settings2, X } from 'lucide-react';
import { getUserSettings, resetEditorSettings, saveEditorSettings } from '../api/settings';
import { DEFAULT_EDITOR_PREFERENCES, normalizeEditorPreferences } from '../components/editor/editorDefaults';
import EditorPreferencesSettings from '../components/settings/EditorPreferencesSettings';
import SecuritySettings from '../components/settings/SecuritySettings';

const sections = [
  { id: 'editor', label: 'Editor', icon: Palette, description: 'Herramientas y valores predeterminados' },
  { id: 'security', label: 'Seguridad', icon: LockKeyhole, description: 'Contraseña, dispositivos y sesiones' }
];

export default function Settings() {
  const [editorPreferences, setEditorPreferences] = useState(DEFAULT_EDITOR_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const showNotice = useCallback((next) => setNotice(next), []);

  useEffect(() => {
    let active = true;
    getUserSettings()
      .then((data) => { if (active) setEditorPreferences(normalizeEditorPreferences(data.editor)); })
      .catch((error) => { if (active) setNotice({ type: 'error', text: error.response?.data?.message || 'No se pudo cargar la configuración.' }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

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

  return <div className="mx-auto w-full max-w-[1440px] py-8 pt-7">
    <div className="mb-[18px] [&_p]:m-0"><h1 className="dc-page-title">TU <span className="dc-page-title-accent">CONFIGURACIÓN</span></h1><p className="mt-2 text-[var(--dc-text-muted)]">Personaliza DrawCast para tu cuenta. Estas opciones te siguen a ti, no al lienzo ni a los diseños.</p></div>

    {notice && <div className={`mb-4 flex items-center gap-2 border px-3.5 py-3 font-semibold ${notice.type === 'error' ? 'border-[var(--dc-alert-error-border)] bg-[var(--dc-alert-error-bg)] text-[var(--dc-alert-error-text)]' : 'border-[var(--dc-alert-success-border)] bg-[var(--dc-alert-success-bg)] text-[var(--dc-alert-success-text)]'}`}>{notice.type === 'success' ? <Check size={17} /> : <X size={17} />}{notice.text}</div>}

    <div className="grid grid-cols-1 items-start gap-[18px] md:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="grid gap-2 bg-[var(--dc-panel)] p-3 shadow-[0_8px_24px_var(--dc-shadow-soft)] md:sticky md:top-[84px]">
        <div className="mb-1 flex items-center gap-2 px-2 py-2 text-[11px] font-black uppercase tracking-[.1em] text-[var(--dc-text-muted)]"><Settings2 size={15} /> Secciones</div>
        {sections.map((section) => {
          const SectionIcon = section.icon;
          return <a key={section.id} href={`#${section.id}`} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2 border border-transparent px-2 py-2.5 text-[var(--dc-text)] no-underline transition hover:border-[var(--dc-line)] hover:bg-[var(--dc-button-secondary-hover)]"><SectionIcon size={18} className="mt-0.5" /><span><strong className="block text-sm">{section.label}</strong><small className="mt-0.5 block text-[11px] leading-4 text-[var(--dc-text-muted)]">{section.description}</small></span></a>;
        })}
        <div className="mt-2 border-t border-[var(--dc-line)] px-2 pt-3 text-[11px] leading-4 text-[var(--dc-text-dim)]">La navegación está separada por secciones para poder añadir nuevas categorías sin mezclar responsabilidades.</div>
      </aside>

      <main className="grid gap-8">
        <section id="editor" className="scroll-mt-20">{loading ? <div className="bg-[var(--dc-panel)] p-5">Cargando configuración…</div> : <EditorPreferencesSettings value={editorPreferences} onChange={setEditorPreferences} onSave={saveEditor} onReset={resetEditor} saving={saving} />}</section>
        <section id="security" className="scroll-mt-20"><div className="mb-3"><h2 className="m-0 text-2xl">Seguridad</h2><p className="mt-1 text-sm text-[var(--dc-text-muted)]">Controla tu contraseña y las sesiones abiertas de tu cuenta.</p></div><SecuritySettings onNotice={showNotice} /></section>
      </main>
    </div>
  </div>;
}
