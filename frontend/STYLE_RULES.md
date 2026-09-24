# TRAZIO — reglas visuales de interfaz

Estas reglas son obligatorias para UI nueva o revisada.

1. **Texto mínimo: 12 px.**
   Ningún texto visible debe usar menos de 12 px. Si no cabe, primero se simplifica el contenido.

2. **Texto normal: `var(--dc-text)`.**
   No usar grises para jerarquía de copy (`--dc-text-muted`, `--dc-text-secondary`, `--dc-text-tertiary`).
   La jerarquía se consigue con tamaño, peso, espacio y superficies.
   Los colores de acento se reservan para estados o identidad visual puntual.

3. **Minimalismo.**
   No agregar texto explicativo, badges, bordes, cards o controles si no cumplen una función clara.
   Si una pantalla se entiende sin una pieza, esa pieza no se agrega.

4. **Bloqueos Plus.**
   Las funciones/productos premium siguen visibles.
   Se muestran opacos, con candado dorado y una superficie espectral sutil.
   No ocultar capacidades premium si verlas ayuda a comprender el producto.

5. **Superficies antes que bordes.**
   Preferir contraste entre `--dc-bg`, `--dc-surface`, `--dc-panel` y acentos suaves.
   Usar bordes sólo cuando separan o comunican estado.
