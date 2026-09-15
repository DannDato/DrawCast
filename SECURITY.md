# Security

## Modelo de acceso

- API privada: cookie HttpOnly + sesión persistida y revocable.
- Editor Socket.IO: requiere la misma sesión y autorización explícita sobre el canal.
- Overlay: sólo lectura y asociado a un `publicKey` aleatorio.
- Invitaciones: token aleatorio de 256 bits, almacenado sólo como SHA-256, un uso, expiración de 7 días y email binding.

## Media

Uploads permitidos: PNG, JPEG, WebP y GIF, máximo 20 MB. SVG y archivos arbitrarios se rechazan.

La importación por URL resuelve DNS y bloquea loopback, link-local y redes privadas IPv4/IPv6; revalida cada redirect, aplica timeout, MIME allowlist y límite de bytes mientras lee el stream.

## Runtime cleanup

Al desaparecer el último editor comienza el periodo de gracia. Si no vuelve ninguno, se destruye el estado del canal y `uploads/channels/<channelId>`.

## Producción

Usa HTTPS, `COOKIE_SECURE=true`, secretos de al menos 32 caracteres, CORS con orígenes explícitos, SMTP real, MySQL con usuario de privilegios mínimos y reverse proxy con límites de request apropiados.
