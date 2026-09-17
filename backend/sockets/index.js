import jwt from 'jsonwebtoken';
import { parse as parseCookie } from 'cookie';
import { models } from '../models/index.js';
import { env } from '../config/env.js';
import { sha256 } from '../helpers/security.js';
import { getEditableChannelByPublicKey } from '../services/channelAccessService.js';
import { getChannelState, setObject, removeObject, clearObjects, replaceObjects, connectRole, disconnectRole } from '../services/channelRuntimeService.js';
import logger from '../helpers/winston.js';

async function socketUser(socket) {
  try { const cookies=parseCookie(socket.handshake.headers.cookie||''); const token=cookies[env.cookieName]; if(!token)return null; const decoded=jwt.verify(token,env.jwtSecret,{issuer:'fullstack-base'}); const session=await models.Session.findOne({where:{id:decoded.sid,userId:decoded.sub,tokenHash:sha256(token),revokedAt:null}}); if(!session||session.expiresAt<=new Date())return null; return models.User.findByPk(decoded.sub); } catch { return null; }
}
function validObject(o){ if(!o||typeof o!=='object'||typeof o.id!=='string'||o.id.length>120)return false; const size=JSON.stringify(o).length; const isDraw=o.tipo==='draw'||o.tipo==='trazo'; return size<=(isDraw?1800000:300000); }
function validScene(list){ return Array.isArray(list)&&list.length<=500&&list.every(validObject)&&Buffer.byteLength(JSON.stringify(list),'utf8')<=Number(process.env.SAVED_DESIGN_MAX_BYTES||8388608); }

export function configureSockets(io) {
  io.on('connection', (socket) => {
    let joined=null;
    socket.on('join-overlay', async ({publicKey}={}) => { const channel=await models.Channel.findOne({where:{publicKey:String(publicKey||'')}}); if(!channel)return socket.emit('access-denied'); joined={channelId:channel.id,role:'overlay'}; socket.join(`channel:${channel.id}`); connectRole(channel.id,socket.id,'overlay',io); socket.emit('sync-state',{objects:getChannelState(channel.id)}); });
    socket.on('join-editor', async ({publicKey}={}) => { const user=await socketUser(socket); if(!user)return socket.emit('access-denied'); const channel=await getEditableChannelByPublicKey(user.id,String(publicKey||'')); if(!channel)return socket.emit('access-denied'); joined={channelId:channel.id,role:'editor',userId:user.id}; socket.join(`channel:${channel.id}`); connectRole(channel.id,socket.id,'editor',io); socket.emit('sync-state',{objects:getChannelState(channel.id)}); logger.info('Editor conectado al canal',{channelId:channel.id,userId:user.id}); });
    const edit=(event,handler)=>socket.on(event,(payload,ack)=>{
      const reply=typeof ack==='function'?ack:null;
      if(!joined||joined.role!=='editor'){ socket.emit('access-denied'); reply?.({ok:false,message:'Acceso denegado'}); return; }
      handler(joined.channelId,payload,reply);
    });
    edit('obj-upsert',(id,obj)=>{ if(!validObject(obj))return; setObject(id,obj); socket.to(`channel:${id}`).emit('obj-upsert',obj); });
    edit('obj-remove',(id,p)=>{ if(!p?.id)return; removeObject(id,p.id); socket.to(`channel:${id}`).emit('obj-remove',{id:p.id}); });
    edit('clear-all',(id)=>{ clearObjects(id); io.to(`channel:${id}`).emit('clear-all'); });
    edit('scene-replace',(id,p,reply)=>{
      if(!validScene(p?.objects)){ reply?.({ok:false,message:'La escena guardada no es válida'}); return; }
      const objects=replaceObjects(id,p.objects);
      io.to(`channel:${id}`).emit('sync-state',{objects});
      reply?.({ok:true,count:objects.length});
    });
    edit('draw-live',(id,p)=>{ if(JSON.stringify(p||{}).length>50000)return; socket.to(`channel:${id}`).emit('draw-live',p); });
    socket.on('disconnect',()=>{ if(joined)disconnectRole(joined.channelId,socket.id,io); });
  });
}
