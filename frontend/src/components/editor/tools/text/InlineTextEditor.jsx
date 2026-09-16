import { useEffect, useRef } from 'react';
import { normalizeTextConfig } from './textTool';

export default function InlineTextEditor({ editor, onCommit, onCancel }) {
  const inputRef = useRef(null);
  const config = normalizeTextConfig(editor?.config);

  useEffect(() => {
    if (!editor) return;
    const input = inputRef.current;
    input?.focus();
    input?.select();
  }, [editor]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
  });

  if (!editor) return null;

  const commit = () => {
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
      style={{
        left: `${editor.screenX}px`,
        top: `${editor.screenY}px`,
        color: config.color,
        fontFamily: config.fontFamily,
        fontSize: `${Math.max(10, config.fontSize * editor.scale)}px`
      }}
      onInput={(event) => {
        event.currentTarget.style.height = 'auto';
        event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
          return;
        }

        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}
