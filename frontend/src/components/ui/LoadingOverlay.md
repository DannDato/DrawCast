# Indicador de carga

`GlobalLoadingOverlay` se monta una sola vez en `main.jsx`. Las peticiones del cliente `api/axios.js` lo activan automáticamente y lo liberan al terminar, fallar o cancelarse. Las operaciones simultáneas se cuentan por separado; un pequeño margen al terminar evita parpadeos entre solicitudes encadenadas. No se muestra en `/overlay/`, para mantener limpia la salida de OBS.

Para tareas que no pasan por Axios:

```js
import { withLoading } from '../../utils/loading';

await withLoading(async () => {
  await prepararContenido();
}, 'Preparando contenido...');
```

También puedes gestionar el inicio y el final explícitamente. La función devuelta libera únicamente esa operación y es seguro llamarla más de una vez:

```js
import { startLoading } from '../../utils/loading';

const finish = startLoading('Cargando lienzo...');
try {
  await cargarLienzo();
} finally {
  finish();
}
```

Cada petición acepta un mensaje o puede excluirse si es una consulta de fondo que ya tiene su propio indicador:

```js
await api.get('/channels/mine', { loadingMessage: 'Cargando tus lienzos...' });
await api.get('/channels/invitations/pending', { showLoading: false });
```

Para un estado local, el componente visual también funciona por separado:

```jsx
<LoadingOverlay active={loading} message="Preparando vista previa..." />
```

Mantén el componente montado y cambia `active` para conservar el fade de salida. Evita usarlo a la vez que la carga global para la misma operación. El overlay se renderiza sobre el documento mediante un portal, anuncia el mensaje con `role="status"` y respeta la preferencia de movimiento reducido. Es un indicador visual, no un diálogo: los controles de cada operación deben conservar sus estados `disabled` para impedir envíos duplicados por teclado.
