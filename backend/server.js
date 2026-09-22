import './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import routes from './routes/index.js';
import { db, auditDb } from './models/index.js';
import { hasAuditDatabase } from './config/database.js';
import { env, validateEnv } from './config/env.js';
import logger from './helpers/winston.js';
import { handleError } from './handlers/handleError.js';
import { apiLimiter, verifyBrowserOrigin } from './middlewares/security.js';
import { configureSockets } from './sockets/index.js';

validateEnv();
const app=express(); const httpServer=createServer(app);
const origins=String(process.env.CORS_ORIGINS||env.frontendUrl).split(',').map(v=>v.trim()).filter(Boolean);
const io=new Server(httpServer,{cors:{origin:origins,credentials:true,methods:['GET','POST']},maxHttpBufferSize:Number(process.env.SOCKET_MAX_BYTES||10000000)});
app.set('io', io);
app.disable('x-powered-by'); app.set('trust proxy',env.trustProxy); app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));
app.use(cors({origin(origin,cb){if(!origin||origins.includes(origin))return cb(null,true);cb(new Error('Origen no permitido por CORS'));},credentials:true,methods:['GET','POST','PUT','PATCH','DELETE']}));
app.use(cookieParser()); app.use(verifyBrowserOrigin); app.use(express.json({limit:process.env.JSON_BODY_LIMIT||'10mb'})); app.use(express.urlencoded({extended:true,limit:process.env.JSON_BODY_LIMIT||'10mb'})); app.use(apiLimiter);
const appFolder=process.env.APP_FOLDER||'/api';
app.use(appFolder,routes);
app.use((req,res)=>res.status(404).json({message:'Ruta no encontrada'})); app.use(handleError); configureSockets(io);
await db.authenticate(); if(hasAuditDatabase){try{await auditDb.authenticate();logger.info('Base de datos de auditoría conectada');}catch(error){logger.error('No fue posible conectar con la base de datos de auditoría',{error:error.message});}}
httpServer.listen(env.port,()=>logger.info(`DrawCast Cloud iniciado en puerto ${env.port}`));
