const appUsers = new Map();
const editorUsers = new Map();
const overlays = new Set();

function normalizeUser(user = {}) {
  return {
    id: Number(user.id),
    uuid: user.uuid || null,
    username: String(user.username || ''),
    displayName: user.displayName ? String(user.displayName) : null,
    email: user.email ? String(user.email) : null,
    avatarUrl: user.avatarUrl || null
  };
}

function connectUser(map, socketId, user) {
  const normalized = normalizeUser(user);
  if (!normalized.id || !socketId) return;
  const current = map.get(normalized.id) || { ...normalized, sockets: new Set() };
  current.uuid = normalized.uuid;
  current.username = normalized.username;
  current.displayName = normalized.displayName;
  current.email = normalized.email;
  current.avatarUrl = normalized.avatarUrl;
  current.sockets.add(socketId);
  map.set(normalized.id, current);
}

function disconnectUser(map, socketId, userId) {
  const id = Number(userId);
  const current = map.get(id);
  if (!current) return;
  current.sockets.delete(socketId);
  if (!current.sockets.size) map.delete(id);
}

export function connectAppPresence(socketId, user) {
  connectUser(appUsers, socketId, user);
}

export function disconnectAppPresence(socketId, userId) {
  disconnectUser(appUsers, socketId, userId);
}

export function connectEditorPresence(socketId, user) {
  connectUser(editorUsers, socketId, user);
}

export function disconnectEditorPresence(socketId, userId) {
  disconnectUser(editorUsers, socketId, userId);
}

export function connectOverlayPresence(socketId) {
  if (socketId) overlays.add(socketId);
}

export function disconnectOverlayPresence(socketId) {
  overlays.delete(socketId);
}

export function getSystemPresenceSnapshot() {
  const userIds = new Set([...appUsers.keys(), ...editorUsers.keys()]);
  const users = [...userIds].map((userId) => {
    const app = appUsers.get(userId);
    const editor = editorUsers.get(userId);
    const source = editor || app;
    return {
      uuid: source?.uuid || null,
      username: source?.username || '',
      displayName: source?.displayName || null,
      email: source?.email || null,
      avatarUrl: source?.avatarUrl || null,
      area: editor ? 'editor' : 'app',
      appConnections: app?.sockets.size || 0,
      editorConnections: editor?.sockets.size || 0
    };
  }).sort((a, b) => String(a.displayName || a.username).localeCompare(String(b.displayName || b.username), 'es', { sensitivity: 'base' }));

  const editorCount = editorUsers.size;
  const appOnlyCount = users.filter((user) => user.area === 'app').length;

  return {
    counts: {
      online: users.length,
      app: appOnlyCount,
      editor: editorCount,
      overlay: overlays.size
    },
    users,
    updatedAt: new Date().toISOString()
  };
}
