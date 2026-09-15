# DrawCast Cloud

Evolución multiusuario de **Art-on-OBS / DrawCast**, construida sobre la base de identidad y seguridad de **FullStackBase**.

## Qué incluye

- React + Vite para toda la interfaz, conservando la identidad visual oscura/terminal de DrawCast.
- Node.js + Express + Sequelize + MySQL.
- Autenticación, sesiones persistentes, Google OAuth, OTP, recuperación de contraseña, dispositivos confiables, permisos y auditoría heredados de FullStackBase.
- Un canal DrawCast por propietario, con `publicKey` criptográficamente aleatoria.
- URL única de editor y URL única de OBS Browser Source por canal.
- Colaboradores por invitación de correo. El token es de un solo uso, expira a los 7 días y sólo puede aceptarlo una cuenta con el mismo correo invitado.
- Socket.IO ligado a la sesión real: el navegador no puede autoproclamarse editor. Sólo propietario o colaboradores activos pueden emitir mutaciones.
- Overlay público de sólo lectura: puede recibir el estado, nunca modificarlo.
- Estado runtime aislado por canal y sincronización completa al reconectar OBS/editor.
- Sleep/cleanup: al quedar un canal sin editores durante `CHANNEL_SLEEP_MINUTES`, se limpia el canvas y se eliminan sus archivos temporales.
- Uploads aislados por canal, límite de 20 MB y MIME allowlist (PNG/JPEG/WebP/GIF).
- Importación remota protegida contra SSRF, redes privadas/locales, redirects maliciosos, MIME inesperado y descargas mayores a 20 MB.
- Logger Winston rotativo de FullStackBase usado también para canales, invitaciones, sockets, imports y limpieza.

## Editor React

El antiguo `actions.js` monolítico desaparece. La lógica está dividida por responsabilidad:

- `components/editor/objectFactory.js`: creación de objetos.
- `components/editor/drawObject.js`: renderer compartido por editor y overlay.
- `components/editor/CanvasStage.jsx`: interacción con canvas.
- `components/editor/Toolbar.jsx`: herramientas.
- `components/editor/Inspector.jsx`: propiedades.
- `components/editor/LayersPanel.jsx`: gestión de capas.
- `hooks/useChannelSocket.js`: transporte Socket.IO y presencia.
- `api/channels.js`: API de canal, invitaciones y colaboradores.

El editor y OBS usan **el mismo renderer**, evitando divergencias visuales entre preview y transmisión.

## Arranque

1. Crea una base MySQL y configura `backend/.env` usando `backend/.env.example`.
2. Configura SMTP si usarás invitaciones/OTP/correos.
3. En backend: `npm install`, `npm run bootstrap`, `npm run dev`.
4. En frontend: `npm install`, `npm run dev`.
5. Registra una cuenta, entra a `/app` y crea tu canal.
6. Copia la URL `OBS BROWSER SOURCE` a OBS con resolución 1920×1080.

## Seguridad del canal

El `publicKey` identifica el room y sirve para el overlay. **No concede edición**. Para editar, Socket.IO extrae la cookie HttpOnly, valida JWT + `sid` + hash + sesión no revocada en DB, y después comprueba ownership o `channel_collaborators`.

Los eventos de escritura (`obj-upsert`, `obj-remove`, `clear-all`, `draw-live`) son ignorados/rechazados para sockets overlay o no autorizados.

## Nota de persistencia

Los objetos del canvas siguen siendo deliberadamente efímeros en memoria, como DrawCast original. La identidad, canales, colaboradores e invitaciones sí son persistentes. Una futura función de **Scenes/Presets** puede persistir composiciones sin convertir accidentalmente el estado de una transmisión en datos permanentes.
