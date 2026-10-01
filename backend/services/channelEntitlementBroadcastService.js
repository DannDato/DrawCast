import { publicChannelEntitlements, publicOverlayBranding } from './channelEntitlementAccessService.js';
import { getChannelControl, getChannelPresence, getEditorAccess, getPublishedChannelState, setLiveEnabled } from './channelRuntimeService.js';

export async function broadcastChannelEntitlements(req, channelId, entitlements) {
  const io = req.app.get('io');
  if (!io) return;

  const editorRoom = `channel:${channelId}:editors`;
  const overlayRoom = `channel:${channelId}:overlays`;
  const editorSockets = await io.in(editorRoom).fetchSockets();
  editorSockets.forEach((socket) => { socket.data.entitlementsStale = true; });

  const overlaySockets = await io.in(overlayRoom).fetchSockets();
  overlaySockets.forEach((socket) => { socket.data.entitlementsStale = true; });

  if (entitlements?.features?.['editor.live_studio'] !== true && !getChannelControl(channelId).liveEnabled) {
    const control = setLiveEnabled(channelId, true);
    io.to(overlayRoom).emit('sync-state', { objects: getPublishedChannelState(channelId) });
    io.to(editorRoom).emit('channel-control', control);
    const presence = getChannelPresence(channelId);
    io.to(editorRoom).emit('presence', presence);
    presence.editorList.forEach((editor) => {
      io.to(editor.socketId).emit('editor-access', getEditorAccess(channelId, editor.socketId));
    });
  }

  io.to(editorRoom).emit('channel-entitlements', publicChannelEntitlements(entitlements));
  io.to(overlayRoom).emit('overlay-branding', publicOverlayBranding(entitlements));
}
