import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export function useChannelSocket(publicKey, role, handlers = {}) {
  const socket = useMemo(() => io(socketUrl, { withCredentials: true, autoConnect: false }), []);
  const [presence, setPresence] = useState({ clients: 0, editors: 0, overlays: 0, editorList: [] });
  const [connected, setConnected] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!publicKey) return undefined;

    let active = true;
    const onConnect = () => {
      if (!active) return;
      setDenied(false);
      setConnected(true);
      socket.emit(role === 'overlay' ? 'join-overlay' : 'join-editor', { publicKey });
    };
    const onDisconnect = () => { if (active) setConnected(false); };
    const onDenied = () => { if (active) setDenied(true); };
    const onRevoked = (payload) => {
      if (!active || role !== 'editor' || payload?.publicKey !== publicKey) return;
      setDenied(true);
    };
    const onPresence = (value) => { if (active) setPresence(value); };
    const handlerEntries = Object.entries(handlers);

    // Registra listeners antes de conectar. Si Socket.IO reutiliza un Manager ya abierto
    // al navegar rápido, el evento connect puede ocurrir inmediatamente.
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('access-denied', onDenied);
    socket.on('access-revoked', onRevoked);
    socket.on('presence', onPresence);
    handlerEntries.forEach(([event, handler]) => socket.on(event, handler));

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      handlerEntries.forEach(([event, handler]) => socket.off(event, handler));
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('access-denied', onDenied);
      socket.off('access-revoked', onRevoked);
      active = false;
      socket.off('presence', onPresence);
      socket.disconnect();
    };
  }, [publicKey, role, socket, handlers]);

  return { socket, presence, connected, denied };
}
