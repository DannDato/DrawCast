# TRAZIO Cloud

TRAZIO es una aplicación web para crear y operar overlays de streaming desde un editor colaborativo. Cada lienzo es un **canal** con su propio acceso al Editor y una salida pública para OBS. Esa misma salida reproduce el contenido visual y el audio: el Launchpad no necesita otro Browser Source.

El proyecto usa React, Vite, React Router, Axios, Tailwind CSS, Lucide y CSS propio en frontend; Node.js, Express, Socket.IO, Sequelize y MySQL/MariaDB en backend. Conserva nombres históricos de DrawCast en carpetas, variables `dc-*` y algunos ejemplos de configuración.

Este documento describe el código actual, incluidos los cambios locales del proyecto. La disponibilidad de las funciones depende de las capacidades y licencias del lienzo; no todas están habilitadas en Free.

## Funciones implementadas

### Cuenta, acceso y navegación

- Registro e inicio de sesión, recuperación de contraseña, verificación OTP y dispositivos confiables.
- OAuth con Google, Twitch, Kick y Discord, según la configuración de cada proveedor.
- Perfil, métodos de acceso y configuración de Editor, correo, seguridad y diagnóstico.
- Inicio con lienzos propios, acceso a mejoras y un streamer destacado. La vista previa contempla Twitch, Kick y YouTube; su detección de directo depende de las credenciales configuradas.
- Gestión de lienzos propios y colaboraciones, invitaciones, permisos de edición y preferencias de canal.
- Tienda e inventario de licencias, con asignación permanente de mejoras a lienzos propios.

### Editor y colaboración

- Escena de 1920 × 1080 con capas, selección individual y múltiple, grupos, orden, duplicación, portapapeles y deshacer/rehacer.
- Pincel, borrador, imágenes/GIF, texto, formas, línea recta, temporizador y ruleta.
- Pan con la herramienta Manita o temporalmente con el botón central; zoom entre 25% y 400%; ajuste magnético y propiedades por objeto.
- Los objetos pueden extenderse fuera del lienzo; el Overlay muestra el área correspondiente a la salida de 1920 × 1080.
- Línea con color, grosor, controles de longitud y rotación; Shift ajusta su ángulo a pasos de 45°.
- Temporizadores ascendentes o descendentes, límites, controles de ejecución y color/animación al finalizar.
- Ruleta con entradas editables, colores, parámetros de giro, resultado, mezcla de opciones, eliminación del ganador y sonido de giro. Actualmente utiliza la capacidad `editor.shape`, no una licencia de ruleta independiente.
- Presencia de colaboradores, cursores remotos y sincronización por Socket.IO.
- Live publica los cambios al Overlay. Estudio mantiene un borrador hasta publicar; los controles del canal gestionan qué editor puede modificarlo. También existe apagado del Overlay por el propietario.
- El Editor contiene las vistas Lienzo y Launchpad. `?view=canvas` y `?view=launchpad` conservan la vista al recargar.

El renderizado es compartido por Editor y Overlay. Hay limitación gráfica a 30 FPS, detección de cambios y tratamiento específico de objetos animados para evitar redibujos innecesarios. El transporte incluye actualizaciones parciales de transformaciones y trazos en vivo.

### Diseños y guías

**Archivo → Guardar como → Lienzo** conserva una copia de la escena y datos del editor en los diseños del canal. Permite cargar, sobrescribir y eliminar diseños.

**Archivo → Guardar como → Guía** captura el lienzo como un PNG transparente de 1920 × 1080, sin selección, cuadrícula ni guía activa. Los GIF y temporizadores quedan como imagen fija. Las guías:

- Pertenecen al canal y están disponibles para sus editores autorizados.
- Se identifican como `Guía 1`, `Guía 2`, etc., sin nombre editable.
- Se pueden guardar, reemplazar y eliminar; se muestran como referencia al 20% de opacidad y no aparecen en OBS.
- Recuerdan localmente la selección por canal y notifican cambios a los demás editores.
- Tienen un cupo resuelto por `limit.guide_slots`. Las tres guías son el valor base de Plus, no un máximo universal: existen expansiones y la validación técnica admite espacios del 1 al 99.

El cupo de diseños también depende de las capacidades del canal y está limitado adicionalmente por `SAVED_DESIGN_LIMIT`. El estado guardado admite hasta 500 capas y, por defecto, 8 MiB; estos límites técnicos no desbloquean las capacidades necesarias para usarlo.

### Sonidos y Launchpad

- Biblioteca global de MP3 leída desde `backend/sounds/`.
- Sonidos propios ligados al canal, disponibles para sus editores autorizados.
- Asignaciones de sonidos rápidos y Launchpad guardadas en la configuración de cada usuario; el audio propio referenciado sigue perteneciendo al canal.
- Slots de acceso rápido y pads habilitados según las capacidades del lienzo. El Launchpad tiene un máximo técnico de 24 pads.
- Vista previa, búsqueda, asignación por arrastre, progreso de reproducción y detención al volver a pulsar un sonido; distintos sonidos pueden superponerse.
- Monitoreo local con preferencia persistida en el navegador. Silenciarlo no silencia OBS.
- Pads adaptables al espacio y scroll dentro de su sección; color estable derivado del nombre, mezclado con los grises del sistema.

Los sonidos personalizados aceptan sólo MP3: máximo original de 12 MiB y archivo final de 2 MiB. Si el original supera 2 MiB, el backend intenta recomprimirlo con FFmpeg; si no puede reducirlo suficientemente, lo rechaza.

## Capacidades, tienda y licencias

El backend resuelve capacidades booleanas y límites numéricos para dos ámbitos:

| Ámbito | Ejemplos |
| --- | --- |
| Cuenta | Cantidad de lienzos propios mediante `account.canvas_slots`. |
| Canal | Herramientas, colaboración, Live/Estudio, audio, marca de agua y cupos de capas, diseños, guías y sonidos. |

La interfaz muestra los bloqueos, pero la autoridad está en los servicios, middlewares y sockets del backend. Los colaboradores trabajan con las capacidades del canal compartido.

Los [catálogos de bootstrap](backend/bootstrap/catalogs/) definen los valores iniciales. Una vez persistidos, **la base de datos es la fuente de verdad** para productos, precios, requisitos, bundles y concesiones. Reiniciar el servidor no siembra ni restablece esos catálogos. `npm run seed` crea registros y relaciones faltantes y sincroniza únicamente `priceCents` y `currency` de los productos existentes. Conserva nombres, metadata, disponibilidad, licencias y asignaciones. Los precios del catálogo están en centavos MXN, convertidos inicialmente a 18 MXN por USD; las ejecuciones posteriores escriben esos importes, sin volver a multiplicarlos.

Valores iniciales relevantes del catálogo:

| Recurso | Free | Lienzo Plus |
| --- | --- | --- |
| Lienzos de cuenta | 1 de base; ampliable mediante licencias de cuenta | Plus se aplica a un canal, no añade por sí solo otro lienzo. |
| Herramientas | Selección, pan, pincel, borrador, imagen, imán, Overlay y colaboración | Desbloquea también texto, formas/línea/ruleta, temporizador, diseños, guías, audio y Live/Estudio. |
| Capas | 5 | 5 |
| Diseños / guías | 0 / 0 | 3 / 3 |
| Sonidos rápidos / propios | 0 / 0 | 3 / 5 |
| Pads de Launchpad | 0 | 24 |
| Marca de agua del Overlay | Visible | Oculta por la capacidad incluida. |

La tienda contempla Plus, herramientas individuales, paquetes y expansiones. El inventario permite aplicar licencias a lienzos compatibles de forma permanente. Una vez aplicadas, no se pueden retirar ni transferir, incluso si se elimina el lienzo. La API rechaza los intentos de retiro con `403 LICENSE_ASSIGNMENT_PERMANENT`; las mejoras de cuenta no requieren asignación a un canal.

**Estado comercial actual:** hay un flujo de compra simulada de desarrollo, no una pasarela de cobro implementada. Sólo está disponible fuera de `NODE_ENV=production` y puede desactivarse con `STORE_SIMULATION_ENABLED=false`. Los períodos y estados de licencia no implican que exista cobro o renovación automática.


### Carrito de compras

El carrito está disponible en `/app/cart` y desde el icono situado antes de Tienda en el navbar. En móvil, el icono permanece visible junto al menú. Agregar el mismo producto aumenta su cantidad; cada fila permite sumar, restar y quitar productos.

Se guarda por usuario en `user_settings`, bajo la clave interna `store.cart`. No requiere una tabla nueva ni una migración. El servidor obtiene el usuario de la sesión y serializa los cambios dentro de una transacción, incluyendo la primera creación del carrito. Los precios y la disponibilidad se consultan en el catálogo; el cliente sólo envía el producto y su cantidad.

`STORE_MINIMUM_PURCHASE_CENTS=3900` configura un mínimo de **39 MXN** en `backend/.env`. El servicio `storeSettingsService.js` concentra su lectura para permitir incorporar configuración de base de datos en el futuro. Aún no existe una pantalla de administración para este valor. Reinicia el backend después de modificarlo.

`POST /store/cart/review` vuelve a validar productos y mínimo antes de mostrar el resumen. Un carrito vacío, con productos no disponibles o por debajo del mínimo no puede continuar. Llegar al resumen no crea licencias ni realiza cargos: la pasarela de pago sigue pendiente. Las rutas del carrito usan autenticación y límites de peticiones; admiten hasta 50 productos distintos y 99 unidades por producto.

## Persistencia y ciclo de vida

| Datos | Almacenamiento |
| --- | --- |
| Usuarios, sesiones, canales, colaboradores, invitaciones y preferencias | MySQL/MariaDB mediante Sequelize. |
| Diseños, PNG de guías, catálogos, licencias y asignaciones | Base de datos. |
| Escena activa, escena publicada, borrador de Estudio y presencia | Memoria del proceso backend, por canal. |
| Imágenes del canal y avatares | Archivos locales bajo el almacenamiento de uploads. |
| MP3 personalizados y sus metadatos | `backend/uploads/channel-sounds/`, separados por canal. |
| MP3 globales | `backend/sounds/`. |
| Selección de guía, monitoreo y otras preferencias locales de interfaz | Almacenamiento del navegador. |

La escena activa **no tiene persistencia automática en base de datos**. Un reinicio del backend pierde ese runtime; los diseños y guías guardados permanecen.

El temporizador de reposo se inicia cuando no quedan **ni editores ni overlays** conectados. Pasados `CHANNEL_SLEEP_MINUTES` —10 por defecto— se vacían las escenas activa y publicada y se restablece el control del canal. Si existen diseños guardados, se conservan los medios de imagen del canal; si no, se elimina su directorio de medios temporales. Esta limpieza no es un borrado general de todos los uploads.

El runtime y varias cachés son locales al proceso. El código actual no incluye almacenamiento compartido del runtime ni un adaptador distribuido de Socket.IO para ejecutar réplicas independientes del mismo canal.

## Rutas principales

Las rutas activas de interfaz están definidas en [App.jsx](frontend/src/App.jsx).

| Ruta | Uso |
| --- | --- |
| `/` | Landing pública. |
| `/login`, `/register`, `/verify-access` | Acceso, registro y verificación. |
| `/forgot-password`, `/reset-password` | Recuperación de contraseña. |
| `/app`, `/app/inicio` | Inicio autenticado. |
| `/app/editor` | Gestión de lienzos y colaboraciones. |
| `/app/editor/:publicKey` | Editor y Launchpad del mismo lienzo. |
| `/overlay/:publicKey` | Browser Source público de OBS, con imagen y audio. |
| `/app/store`, `/app/inventory` | Tienda e inventario. |
| `/app/profile`, `/app/settings` | Perfil y configuración. |
| `/app/diagnostico` | Redirige a la sección de diagnóstico de Configuración. |
| `/invite/:token` | Aceptación de invitaciones, con autenticación. |
| `/privacidad`, `/terminos`, `/cookies`, `/faq`, `/seguridad` | Información pública y legal. |

El backend monta la API en `APP_FOLDER`, con `/api` como fallback incluso si la variable está vacía. Las familias de rutas incluyen `/auth`, `/user`, `/channels`, `/sounds`, `/channel-media` y `/store`, además de `/health` y `/health/diagnostics`. Las operaciones de diseños, guías y sonidos propios usan `/channels/:channelUuid/...`.

Los UUID públicos identifican usuarios, canales, productos, licencias y otros recursos de la API. `publicKey` es un concepto distinto: se usa en URLs del Editor/Overlay y no otorga permiso de edición. Los números de slot de guía son posiciones públicas, no IDs internos de base de datos.

## Seguridad

- Cookies HttpOnly y sesiones verificadas en servidor; autenticación y autorización también en Socket.IO.
- Revalidación del acceso al canal y de sus capacidades antes de mutaciones. Revocar sesiones o colaboración desconecta los sockets correspondientes.
- Overlay de sólo lectura: no puede emitir operaciones de edición autorizadas.
- Validación de Origin, CORS y handshake WebSocket; rate limits por superficie.
- Turnstile en login, registro y recuperación de contraseña. Su configuración pública se obtiene del backend; el secreto nunca se envía al frontend.
- Login puede permitir fallos técnicos de Turnstile mediante `TURNSTILE_LOGIN_FAIL_OPEN`; una respuesta explícita de token inválido se rechaza.
- Importación remota de imágenes con defensas contra SSRF, destinos privados, redirecciones indebidas y tamaños/MIME no permitidos.
- Upload de imágenes PNG/JPEG/WebP/GIF hasta 20 MiB; validación de rutas e identificadores en medios y sonidos.
- Registro técnico con Winston y auditoría en la base principal o en una conexión separada opcional.

No introducir una CSP estática en `frontend/index.html` sin revisar las integraciones de OAuth, Turnstile, API y vistas previas externas. El servidor configura Helmet con `contentSecurityPolicy: false`.

## Instalación y desarrollo

### Requisitos

- Node.js compatible con Vite 7: `^20.19.0 || >=22.12.0`, y npm.
- MySQL o MariaDB y una base de datos creada.
- SMTP para los flujos que envían correo: OTP, recuperación e invitaciones, entre otros.
- FFmpeg en `PATH`, o `FFMPEG_PATH` apuntando al ejecutable, para recomprimir MP3 mayores de 2 MiB.
- Credenciales de los proveedores externos que se quieran habilitar.

### Preparar el entorno

Desde la raíz, en PowerShell:

```powershell
npm run install:all
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Copia los ejemplos sólo en una instalación nueva; conserva los `.env` existentes. Ajusta nombres históricos de los ejemplos, como `APP_NAME` y `VITE_APP_NAME`, a tu instalación de TRAZIO.

Configuración mínima para desarrollo:

| Archivo | Variables |
| --- | --- |
| `backend/.env` | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`; `JWT_SECRET` aleatorio de al menos 32 caracteres. |
| `backend/.env` | `PORT=3000`, `FRONTEND_URL=http://localhost:5173`, `CORS_ORIGINS=http://localhost:5173`; cookies acordes al entorno. |
| `frontend/.env` | `VITE_API_URL=http://localhost:3000/api`, `VITE_SOCKET_URL=http://localhost:3000`. |

El ejemplo activa Turnstile: configura `CLOUDFLARE_CAPTCHA_KEY` y `CLOUDFLARE_CAPTCHA_SECRET`, o desactívalo explícitamente con `TURNSTILE_ENABLED=false` para desarrollo local. Para Google configura `GOOGLE_CLIENT_ID`; Twitch, Kick y Discord necesitan sus credenciales y callbacks. La vista previa de Twitch/Kick reutiliza esas credenciales; YouTube necesita `YOUTUBE_API_KEY`.

Inicializa esquema y catálogos:

```powershell
npm run bootstrap
```

Este comando ejecuta migración y seed. La migración general usa `db.sync({ alter: true })` y ajustes de compatibilidad: revisa su efecto y respalda datos antes de aplicarla a una instalación existente. El seed puede crear un administrador si se configuran `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD`; no cambia la contraseña de un usuario ya existente.

Inicia dos terminales desde la raíz:

```powershell
npm run dev:backend
```

```powershell
npm run dev:frontend
```

Por defecto, Vite sirve en `http://localhost:5173` y Express/Socket.IO en `http://localhost:3000`. Vite también tiene un proxy `/api` hacia el backend local; para usarlo con Axios, configura `VITE_API_URL=/api`. El socket tiene su URL independiente.

Registra una cuenta, crea un lienzo y añade su URL `/overlay/:publicKey` en OBS como Browser Source de **1920 × 1080**. Las herramientas bloqueadas requieren capacidades habilitadas mediante tienda/inventario o administración.

### Variables operativas adicionales

| Variable | Efecto |
| --- | --- |
| `CHANNEL_SLEEP_MINUTES` | Espera sin editores ni overlays antes de vaciar el runtime; 10 por defecto. |
| `SAVED_DESIGN_MAX_BYTES`, `SAVED_DESIGN_LIMIT` | Límites técnicos adicionales para diseños; por defecto 8 MiB y 100. El cupo efectivo también depende del canal. |
| `JSON_BODY_LIMIT`, `SOCKET_MAX_BYTES` | Límites de cuerpos HTTP y mensajes Socket.IO. |
| `ENTITLEMENT_CACHE_TTL_MS` | Caché de capacidades del backend; 3000 ms por defecto, mínimo 1000. |
| `STORE_SIMULATION_ENABLED` | Permite desactivar las compras simuladas de desarrollo. |
| `FFMPEG_PATH` | Ejecutable para recomprimir MP3; fallback `ffmpeg`. |
| `UPLOAD_DIR` | Raíz configurable de varios uploads. Los sonidos personalizados usan su directorio propio en `backend/uploads/channel-sounds/`. |
| `AUDIT_DB_*` | Conexión opcional para auditoría; sin `AUDIT_DB_NAME` se usa la principal. |
| `LOG_DIR`, `LOG_LEVEL` | Salida y nivel del logging técnico. |
| `SECURITY_CLEANUP_RETENTION_DAYS` | Retención utilizada por el script de limpieza de seguridad. |

Consulta [backend/.env.example](backend/.env.example), [frontend/.env.example](frontend/.env.example) y [la validación del entorno](backend/config/env.js). Los ejemplos contienen algunos comentarios históricos: el límite actual de lienzos lo resuelve `account.canvas_slots`, no `CANVAS_LIMIT_DEFAULT`.

## Comandos de mantenimiento y validación

Todos estos comandos se ejecutan desde la raíz:

```powershell
# Comprobación de backend, lint y build de frontend
npm run check

# Pruebas existentes de guías, capacidades y catálogo de tienda
node --test backend/tests/*.test.js

# Compilar sólo el frontend
npm run build

# Crear únicamente la tabla de guías cuando haga falta
npm --prefix backend run migrate:guides

# Completar catálogos y actualizar precios y moneda de la tienda
npm run seed

# Limpieza de registros de seguridad expirados o antiguos
npm run cleanup

# Consultar capacidades y administrar concesiones del CLI
npm --prefix backend run entitlement -- show <channelUuid>
npm --prefix backend run entitlement -- grant <channelUuid> canvas.plus
npm --prefix backend run entitlement -- revoke <channelUuid> canvas.plus
```

Sustituye `<channelUuid>` por el UUID público del lienzo. El CLI modifica concesiones administrativas con origen `dev-cli`; `revoke` no equivale a retirar todas las licencias compradas del canal. `cleanup` debe programarse externamente si se desea una ejecución periódica; el servidor no lo agenda.

`check` valida sintaxis del servidor, imports locales, ESLint y compilación. No sustituye pruebas visuales, de base de datos, proveedores externos, colaboración o OBS. Los tests de backend usan el runner de Node; los que importan modelos también cargan la configuración del backend.

## Estructura del proyecto

```text
backend/
  bootstrap/catalogs/   Definiciones iniciales de capacidades y tienda
  controllers/         Casos de uso HTTP de auth, usuarios, canales y tienda
  middlewares/         Autenticación, acceso, capacidades, límites y Turnstile
  models/              Esquema Sequelize y relaciones
  routes/              API HTTP
  services/            Runtime, identidad, catálogos, licencias, audio y previews
  sockets/             Autorización y eventos de colaboración/Overlay
  scripts/             Migración, seed, limpieza y CLI de capacidades
  tests/               Pruebas de servicios y catálogos
  sounds/              Biblioteca global MP3
  uploads/             Archivos persistidos localmente
frontend/src/
  api/                 Clientes HTTP y caché de solicitudes
  components/editor/   Herramientas, renderizado, capas, audio, guías y propiedades
  components/home/     Streamer destacado y adaptación por plataforma
  components/channels/ Tarjetas y gestión visual de lienzos
  components/auth/     Acceso, OAuth y Turnstile
  components/ui/       Alertas, presencia y elementos públicos compartidos
  context/             Estado de autenticación
  hooks/               Conexión del canal
  layouts/             Navegación autenticada
  pages/               Pantallas y composición del Editor/Overlay
  styles/              Tema y estilos de editor, tienda y streamer destacado
  utils/               Tema, control de FPS y utilidades de acceso
```

En el Editor, [Editor.jsx](frontend/src/pages/Editor.jsx) coordina escena, selección, historial y sockets. Los hooks de `preferences/`, `sounds/`, `guides/` y `hotkeys/` concentran sus respectivas responsabilidades; `tools/` contiene herramientas y `renderer/` el dibujo compartido. El CSS entra por [index.css](frontend/src/index.css); [editor.css](frontend/src/styles/editor.css) conserva el orden de sus módulos y los controles de ruleta importan su estilo específico.

La existencia de un archivo de página antiguo no implica una ruta activa: `App.jsx` es la referencia. El Launchpad vigente está dentro del Editor, aunque queden archivos históricos de una versión separada.

## Despliegue y límites actuales

- `npm run build` genera `frontend/dist`. Las variables `VITE_*` se incorporan al compilar. Express no sirve esa SPA: configura su hosting y fallback a `index.html` para React Router, además del proxy HTTP/WebSocket hacia el backend.
- El backend se inicia con `npm --prefix backend start`; autentica las conexiones de base de datos, pero no ejecuta automáticamente migraciones ni seed.
- En producción, la validación exige `COOKIE_SECURE=true` y las claves de Turnstile. `COOKIE_SAME_SITE=none` requiere cookies seguras. Configura HTTPS, orígenes y `TRUST_PROXY` según el despliegue real.
- Persiste y respalda la base de datos y los directorios de archivos que utilice la instalación. Una copia de base de datos no contiene los MP3 ni las imágenes subidas.
- No hay cobros reales, renovación automática de pagos ni garantía de persistencia de la escena activa tras reiniciar el proceso.
- La detección de stream y el audio del navegador dependen de servicios externos y de las condiciones del navegador/OBS; la compilación por sí sola no valida esas integraciones.
