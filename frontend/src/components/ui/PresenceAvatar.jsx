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
  const title = `${displayName}${username ? ` · ${handle}` : ''}${editor?.isOwner ? ' · propietario' : ''}${editor?.canEdit === false ? ' · esperando Live' : ''}`;
  const hasImage = Boolean(editor?.avatarUrl && !imageFailed);

  return (
    <span className={`dc-presence-avatar ${hasImage ? 'has-image' : 'has-initials'} ${editor?.canEdit === false ? 'is-waiting' : ''}`} style={{ '--dc-editor-color': editor?.colorSlot ? `var(--dc-cursor-${editor.colorSlot})` : 'var(--dc-accent)' }} title={title}>
      <span className="dc-presence-avatar-media">
        {hasImage
          ? <img src={editor.avatarUrl} alt="" onError={() => setImageFailed(true)} />
          : <b>{editorInitials(editor)}</b>}
      </span>
      <span className="dc-presence-avatar-name">{displayName}</span>
    </span>
  );
}

export function PresenceStack({ editors = [], max = 5 }) {
  if (!editors.length) return null;
  return (
    <div className="dc-presence-stack" aria-label={`${editors.length} editor${editors.length === 1 ? '' : 'es'} conectado${editors.length === 1 ? '' : 's'}`}>
      {editors.slice(0, max).map((editor, index) => (
        <PresenceAvatar key={editor.socketId || editor.userUuid || editor.username || `${editor.displayName || 'editor'}-${index}`} editor={editor} />
      ))}
      {editors.length > max && <span className="dc-presence-more">+{editors.length - max}</span>}
    </div>
  );
}
