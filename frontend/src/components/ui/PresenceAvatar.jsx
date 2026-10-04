import { useState } from 'react';

function editorInitials(editor) {
  const value = String(editor?.username || editor?.displayName || 'Editor').trim().replace(/^@/, '');
  if (!value) return 'E';
  const parts = value.split(/[\s._-]+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0] || ''}${parts.at(-1)?.[0] || ''}`.toUpperCase();
  return value.slice(0, 2).toUpperCase();
}

export function PresenceAvatar({ editor }) {
  const [imageFailed, setImageFailed] = useState(false);
  const username = String(editor?.username || '').trim();
  const displayName = String(editor?.displayName || username || 'Editor').trim();
  const handle = username ? `@${username}` : displayName;
  const hasImage = Boolean(editor?.avatarUrl && !imageFailed);

  return (
    <span className={`dc-presence-avatar ${hasImage ? 'has-image' : 'has-initials'} ${editor?.canEdit === false ? 'is-waiting' : ''}`} style={{ '--dc-editor-color': editor?.colorSlot ? `var(--dc-cursor-${editor.colorSlot})` : 'var(--dc-accent-three)' }}>
      <span className="dc-presence-avatar-media">
        {hasImage
          ? <img src={editor.avatarUrl} alt="" onError={() => setImageFailed(true)} />
          : <b>{editorInitials(editor)}</b>}
      </span>
      <span className="dc-presence-avatar-name">{displayName}</span>
    </span>
  );
}

function uniqueEditors(editors) {
  const grouped = new Map();

  editors.forEach((editor, index) => {
    const key = editor?.userUuid || editor?.username || editor?.socketId || `editor-${index}`;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, editor);
      return;
    }

    if (editor?.canEdit && !current?.canEdit) grouped.set(key, { ...current, ...editor, isOwner: Boolean(current?.isOwner || editor?.isOwner) });
    else if (editor?.isOwner && !current?.isOwner) grouped.set(key, { ...current, isOwner: true });
  });

  return Array.from(grouped.values());
}

export function PresenceStack({ editors = [], max = 5 }) {
  const visibleEditors = uniqueEditors(editors);
  if (!visibleEditors.length) return null;
  return (
    <div className="dc-presence-stack" aria-label={`${visibleEditors.length} editor${visibleEditors.length === 1 ? '' : 'es'} conectado${visibleEditors.length === 1 ? '' : 's'}`}>
      {visibleEditors.slice(0, max).map((editor, index) => (
        <PresenceAvatar key={editor.userUuid || editor.username || editor.socketId || `${editor.displayName || 'editor'}-${index}`} editor={editor} />
      ))}
      {visibleEditors.length > max && <span className="dc-presence-more">+{visibleEditors.length - max}</span>}
    </div>
  );
}
