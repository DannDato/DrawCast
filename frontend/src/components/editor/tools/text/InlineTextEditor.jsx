import { useEffect, useRef } from 'react';
import { normalizeTextConfig } from './textTool';

function fitEditorToContent(input, lineHeightPx) {
  if (!input) return;
  input.style.width = '2px';
  input.style.height = '1px';
  input.style.width = `${Math.max(2, Math.ceil(input.scrollWidth + 2))}px`;
  input.style.height = `${Math.max(Math.ceil(lineHeightPx), Math.ceil(input.scrollHeight))}px`;
}

export default function InlineTextEditor({ editor, onCommit, onCancel }) {
  const inputRef = useRef(null);
  const finishingRef = useRef(false);
  const readyRef = useRef(false);
  const config = normalizeTextConfig(editor?.config);
  const scale = Math.max(0.0001, Number(editor?.scale) || 1);
  const fontSize = Math.max(10, config.fontSize * scale);
  const lineHeight = fontSize * 1.18;

  useEffect(() => {
    if (!editor) return undefined;
    finishingRef.current = false;
    readyRef.current = false;

    const input = inputRef.current;
    if (!input) return undefined;
    fitEditorToContent(input, lineHeight);

    // El editor nace durante el pointerdown del canvas. Si enfocamos aquí mismo,
    // la acción por defecto de ese click puede devolver el foco al workspace y
    // disparar onBlur antes de que el usuario alcance a escribir. Esperamos al
    // siguiente task para enfocar una vez terminado el click que lo creó.
    const focusTimer = window.setTimeout(() => {
      const activeInput = inputRef.current;
      if (!activeInput) return;
      activeInput.focus({ preventScroll: true });
      if (editor.initialText) activeInput.select();
      readyRef.current = true;
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [editor, lineHeight]);

  if (!editor) return null;

  const finish = (cancel = false) => {
    if (finishingRef.current) return;
    finishingRef.current = true;

    if (cancel) {
      onCancel();
      return;
    }

    const value = inputRef.current?.value.trim() || '';
    if (value) onCommit(value);
    else onCancel();
  };

  return (
    <textarea
      ref={inputRef}
      className="dc-inline-text-editor"
      defaultValue={editor.initialText || ''}
      rows={1}
      wrap="off"
      spellCheck={false}
      style={{
        left: `${editor.screenX}px`,
        top: `${editor.screenY}px`,
        color: config.color,
        caretColor: config.color,
        fontFamily: config.fontFamily,
        fontSize: `${fontSize}px`
      }}
      onBlur={() => { if (readyRef.current) finish(); }}
      onInput={(event) => fitEditorToContent(event.currentTarget, lineHeight)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          finish(true);
          return;
        }

        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          finish();
        }
      }}
    />
  );
}
