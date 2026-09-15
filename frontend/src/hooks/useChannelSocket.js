import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
export function useChannelSocket(publicKey, role, handlers = {}) {
  const socket = useMemo(() => io(socketUrl, { withCredentials: true, autoConnect: false }), []);
  const [presence, setPresence] = useState({clients:0,editors:0,overlays:0}); const [connected,setConnected]=useState(false); const [denied,setDenied]=useState(false);
  useEffect(() => { if(!publicKey)return; socket.connect(); const onConnect=()=>{setConnected(true);socket.emit(role==='overlay'?'join-overlay':'join-editor',{publicKey});}; const onDisconnect=()=>setConnected(false); const onDenied=()=>setDenied(true); socket.on('connect',onConnect);socket.on('disconnect',onDisconnect);socket.on('access-denied',onDenied);socket.on('presence',setPresence); Object.entries(handlers).forEach(([e,h])=>socket.on(e,h)); return()=>{Object.entries(handlers).forEach(([e,h])=>socket.off(e,h));socket.off('connect',onConnect);socket.off('disconnect',onDisconnect);socket.off('access-denied',onDenied);socket.off('presence',setPresence);socket.disconnect();}; },[publicKey,role,socket,handlers]);
  return {socket,presence,connected,denied};
}
