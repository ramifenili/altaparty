# Imágenes de la plantilla "Sonic y sus amigos"

Reemplazá cualquier archivo de esta carpeta (PNG, WebP o JPG, mejor con fondo transparente) y recargá: no hace falta tocar código.

**Animados:** cualquier imagen puede ser un **GIF animado** (con transparencia) o un **video WebM/MP4** (sin transparencia), con el mismo nombre: por ejemplo `tails.gif` o `anillo.gif`. Si hay varios con el mismo nombre se usa primero el animado. Se repite en bucle; el video se limita a 8 s y 540 px de ancho. Además hay un archivo opcional `fondo.mp4` / `fondo.webm` / `fondo.gif` que reemplaza el degradado de fondo en todo el video.

| Archivo          | Qué es                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `sonic-corre.png` | Sonic corriendo **mirando a la derecha**. Cruza la pantalla de izquierda a derecha y, después, espejado, desde abajo |
| `sonic.png`      | Sonic atravesando un anillo (nombre y cierre)                                            |
| `tails.png`      | Tails (nombre y cierre). Si falta, no aparece                                            |
| `knuckles.png`   | Knuckles, flotando (nombre y cierre). Si falta, no aparece. Es de baja resolución: conviene cambiarlo por uno mejor |
| `anillo.png`     | Anillo dorado, de frente (se hace girar en el código): esquinas de todas las pantallas   |
| `aro.png`        | Marco dorado que rodea la foto del cumpleañero (cuadrado, fondo transparente). El agujero del centro tiene que medir el **83 % del medio ancho** de la imagen (en la actual, de 600 px, radio 250); se dibuja un poco encima del borde de la foto |

Cada personaje es una imagen separada con su propia animación. Proporción recomendada: ~3:4.
La tipografía de los títulos es `public/fonts/HighSpeed.ttf` (si falta, usa Racing Sans One).
