# AltaParty — invitaciones de cumpleaños animadas en MP4

Web en español (pensada para Argentina) donde una persona carga los datos de la fiesta **una sola vez**, prueba nueve plantillas animadas con su foto y su música, ve una vista previa con marca de agua y compra el MP4 final sin marca de agua con **Mercado Pago**.

- **Todo el video se genera en el navegador** (canvas + `@ffmpeg/ffmpeg`). El servidor no renderiza nada: solo crea el cobro, verifica el pago y firma una autorización.
- Stack: Next.js 16 (App Router), React 19, TypeScript 7, `@ffmpeg/ffmpeg` 0.12 + `@ffmpeg/core` 0.12 (un hilo), SDK oficial `mercadopago`.

## Comandos

```bash
npm install            # instala y copia el núcleo de FFmpeg a public/ffmpeg (postinstall)
cp .env.example .env.local   # y completar las variables (ver abajo)
npm run dev            # http://localhost:3000
npm run typecheck      # tsc --noEmit
npm test               # pruebas (node:test) de validación, pagos, tokens, webhook y audio
npm run build && npm start
npm run generate:audio # regenera public/audio/*.wav (música original sintetizada)
npm run fetch:fonts    # vuelve a bajar las tipografías OFL a public/fonts
```

## Variables de entorno (`.env.example`)

| Variable | Para qué |
| --- | --- |
| `APP_URL` | URL pública. Mercado Pago exige **https** para el webhook y el retorno automático. |
| `MP_ACCESS_TOKEN` | Access Token (solo servidor). En pruebas usar el de las credenciales de prueba (`TEST-...`). |
| `MP_WEBHOOK_SECRET` | Clave secreta del webhook; si existe, se exige firma `x-signature` válida. Obligatoria en producción. |
| `PURCHASE_TOKEN_SECRET` | Secreto propio (cadena aleatoria larga) para firmar las autorizaciones de descarga. Obligatorio en producción. |

Ninguna lleva prefijo `NEXT_PUBLIC_`: nunca llegan al navegador.

### Probar Mercado Pago en modo prueba

1. En *Tus integraciones* crear una aplicación y copiar las **credenciales de prueba** → `MP_ACCESS_TOKEN`.
2. Crear dos usuarios de prueba (vendedor y comprador) y pagar con el comprador, usando las tarjetas de prueba oficiales.
3. Para el webhook usar un túnel https (p. ej. ngrok/cloudflared), poner esa URL en `APP_URL`, cargar `https://<url>/api/webhooks/mercadopago` en *Webhooks* (evento *Pagos*) y copiar la clave secreta a `MP_WEBHOOK_SECRET`.
4. Flujo: completar datos → elegir plantilla → *Generar vista previa* → *Comprar con Mercado Pago* → pagar → al volver, la pantalla verifica el pago contra la API de MP y habilita *Generar mi video final*.

> En desarrollo local (`http://localhost`) no se envían `auto_return` ni `notification_url` (MP los rechaza sin https); al volver de MP se pulsa/actualiza *Verificar mi pago* y la pantalla consulta el estado real.

## Arquitectura

```
app/                      rutas (App Router) y API
  api/purchases            POST crear compra · GET estado · POST authorize · POST delivered
  api/authorization/verify valida una autorización antes del render final
  api/webhooks/mercadopago notificaciones firmadas, idempotentes
src/
  config/pricing.ts        precio compartido ($8.000, referencia $15.000)
  domain/invitation.ts     datos del formulario, validación en español, formato de fecha/hora
  state/                   estado central tipado (Context+useReducer), persistencia de texto (localStorage)
                           y de foto/audio propios (IndexedDB, nunca en localStorage)
  templates/               catálogo modular: kit.ts (herramientas), registry.ts y una plantilla por archivo
  audio/library.ts         biblioteca de sonidos + resolución de la selección
  render/                  frame.ts (plantilla + marca de agua), watermark.ts, engine.ts (FFmpeg),
                           exporter.ts (exportPreview / exportFinal), assets.ts (fuentes, foto, audio)
  server/                  gateway MP, evaluación de pagos, tokens HMAC, webhook, compras (solo servidor)
  client/purchases.ts      cliente HTTP de las compras
  components/, hooks/      interfaz (formulario, galería, estudio, procesamiento, oferta, recuperación)
tests/                     node:test
scripts/                   copy-ffmpeg-core, generate-audio, fetch-fonts
```

### Plantillas (9)

| Id | Nombre | Temática | Música predeterminada |
| --- | --- | --- | --- |
| `boca` | Azul y Oro | Fútbol: estadio, camiseta con nombre y edad, entradas (azul y amarillo, **sin escudo ni material oficial**) | Cancha en fiesta |
| `kpop` | Guerreras del Escenario | Concierto pop, guerreras originales, photocard holográfica | Estrella pop |
| `arana` | Héroe Arácnido | Cómic rojo y azul, rascacielos, telarañas (**diseño original, no oficial**) | Aventura heroica |
| `dinos` | Rugido Jurásico | Dinosaurio con gorro, volcán, huevo que revela la edad | Paso jurásico |
| `unicornios` | Magia de Unicornio | Arcoíris que se dibuja, unicornio, nubes pastel | Cielo de caramelo |
| `espacial` | Misión Espacial | Cuenta regresiva, cohete, astronauta con la foto en el visor | Cuenta regresiva |
| `gamer` | Nivel Arcade | Pixel art, neón, barra de experiencia, diálogos que se escriben | Nivel arcade |
| `elegante` | Gala Dorada | Negro y oro, marco art déco, cortinas, confeti fino | Gala dorada |
| `tropical` | Fiesta Tropical | Atardecer, palmeras, olas, piña con anteojos, salvavidas | Verano tropical |

Cada plantilla es un `TemplateDefinition` (id, nombre, descripción, categoría, paleta, fuentes, duración, fps, audio predeterminado, regla para la foto y una función `draw(ctx, {t, content})` determinista). **Para sumar una:** crear su archivo, agregar el id en `templates/ids.ts` y registrarla en `registry.ts`; el editor, la vista previa y el exportador no cambian.

### Audio (10 pistas, todas originales)

`public/audio/*.wav` se **sintetizan por código** (`scripts/generate-audio.mjs`): no hay material de terceros ni licencias que gestionar. Pistas: Cancha en fiesta, Estrella pop, Aventura heroica, Paso jurásico, Cielo de caramelo, Cuenta regresiva, Nivel arcade, Gala dorada, Verano tropical y Cumpleaños feliz (melodía tradicional, dominio público). El usuario puede elegir otra, escuchar una muestra, subir la suya (MP3/WAV/M4A/AAC/OGG, ≤ 5 MB, solo en el navegador del usuario: no se sube ni se guarda en ningún servidor), volver al predeterminado o silenciar. Al cambiar de plantilla, el audio "predeterminado" sigue a la nueva plantilla; una elección explícita (biblioteca o propia) se conserva.

### Inicio

La galería de plantillas está en la página de inicio, junto al formulario. Las miniaturas se ven con los datos que el usuario ya cargó (o datos de muestra). Al pasar el mouse solo se reproduce un adelanto de la presentación (segundos 0,6–3,0), no el video completo.

### Vista previa

`LivePreview` dibuja la plantilla en un canvas con `requestAnimationFrame` (sin exportar MP4), con la marca de agua pintada dentro del canvas. Reproducir/pausar/reiniciar; el audio solo suena si el usuario pulsa *Escuchar música*.

### Generación del MP4 (en el navegador)

`render/engine.ts`: dibuja cada fotograma de forma determinista (`t = i / fps`), lo guarda como JPEG en el FS en memoria de FFmpeg y ejecuta `libx264` + `aac` con el audio elegido (en bucle si es más corto, con fundido de entrada y salida; pista muda si se silencia). Los fotogramas se dibujan en un **Worker con `OffscreenCanvas`** (`render/frameWorker.ts`), así la exportación no se frena si la pestaña pierde el foco; si el navegador no lo soporta, se dibuja en el hilo principal. En celulares se recomienda usar una computadora (la app avisa, pero no lo impide). Vista previa: 540×960, `ultrafast`. Final: 720×1280, `superfast`, CRF 22. Se libera el worker/WebAssembly al terminar o cancelar, se revocan los `ObjectURL` y se impide más de un render a la vez. Errores (memoria, audio ilegible, falta de WebAssembly) devuelven mensajes claros y la opción *Reintentar*.

Requisitos de FFmpeg: se usa el **núcleo de un solo hilo**, por lo que **no hacen falta COOP/COEP ni `SharedArrayBuffer`**. Sí se necesitan WebAssembly y Web Workers; la CSP de producción (`next.config.js`) permite `'wasm-unsafe-eval'` y `worker-src 'self' blob:`.

### Marca de agua

`render/watermark.ts` dibuja un patrón diagonal repetido y móvil que cubre todo el cuadro más un sello central, **dentro del fotograma** que se codifica (también en la pantalla de procesamiento y al pasar el mouse por las miniaturas). Se configura en `src/config/watermark.ts`: `opacityPercent` (10–100), `mode: 'text' | 'image'`, `text`, `imageSrc` (PNG en `public/`, p. ej. `/watermark/logo.png`), tamaños, separación, ángulo y sello central. Es configuración del sitio, no una opción para los usuarios. No existe ninguna opción de interfaz ni parámetro público para ocultarla: solo `exportFinal` llama al render con `watermark: false`, y antes exige una autorización firmada por el servidor.

> Ninguna marca de agua es imposible de eliminar: una grabación de pantalla siempre es posible, y el código del cliente lo controla quien usa el navegador. La protección es razonable para este modelo comercial, no absoluta.

### Pagos y entrega

1. `POST /api/purchases {templateId}`: el servidor crea la preferencia con **importe y moneda tomados de `config/pricing.ts`** (se ignora cualquier importe enviado). La compra se identifica con `external_reference = <uuid>.<plantilla>`.
2. Mercado Pago redirige a `/?compra=<id>`. Ese parámetro solo indica *qué compra consultar*; **no prueba nada**.
3. `GET /api/purchases/:id` consulta a la API de MP los pagos de esa referencia y los evalúa (`payment-evaluation.ts`): solo es `approved` si el pago está aprobado **con el importe y la moneda correctos** y la referencia coincide. Maneja pendiente, rechazado, cancelado, devuelto y `mismatch`.
4. `POST /api/purchases/:id/authorize` vuelve a verificar y, solo si está aprobado, emite un **token HMAC-SHA256 de 30 minutos** atado a la compra y a la plantilla.
5. El navegador llama a `exportFinal`, que valida el token en `/api/authorization/verify` antes de renderizar sin marca de agua.
6. Al terminar el render se llama a `POST /api/purchases/:id/delivered` (idempotente). Nunca se marca como entregado antes.
7. El webhook (`/api/webhooks/mercadopago`) valida la firma `x-signature`, consulta el pago a la API (no confía en el cuerpo) y registra el evento una sola vez; las notificaciones duplicadas responden 200 sin cambiar el estado.

**Cierre de pestaña tras pagar:** no se guarda ningún video en el servidor (cero costo de almacenamiento). La compra se recupera con el *código de compra* (se muestra en pantalla, queda en este navegador y puede figurar como referencia externa en el comprobante de MP): en *¿Ya compraste tu video?* se pega el código, el servidor reverifica el pago y se vuelve a generar el MP4 sin costo. Los textos, la foto y el audio propio se restauran desde el navegador (localStorage / IndexedDB) si siguen disponibles; si no, hay que volver a cargarlos.

## Probar la compra y el video sin marca de agua en tu computadora

Con `MP_FAKE_PAYMENTS=1` (ya está en `.env.local`; reiniciá `npm run dev`) el pago es **simulado**: no pasa por Mercado Pago. Solo se activa fuera de producción o con `APP_URL` en `localhost`; en un dominio público se ignora aunque la variable esté definida (`src/server/fake-gateway.ts`). Dos formas de probar:

1. **Código `PRUEBA-<plantilla>`** (p. ej. `PRUEBA-boca`, `PRUEBA-kpop`, `PRUEBA-dinos`...): en el inicio, abrir *¿Ya compraste tu video?*, pegarlo y *Verificar compra*.
2. **Flujo completo:** elegir plantilla → vista previa → *Comprar*; vuelve solo a la app con el pago aprobado.

En ambos casos se llega al **generador de compra**, con la **plantilla fija** (la comprada). Con el flujo completo (comprar con pago simulado) los datos quedan **bloqueados** y de solo lectura, como en producción; con el código `PRUEBA-<plantilla>` no hay datos guardados, así que el formulario es editable para que pruebes libremente. Cada compra permite como máximo `maxFinalRenders` generaciones (5 por defecto, editable en el panel): el servidor descuenta una por cada autorización que firma y rechaza la siguiente. El contador y las compras viven en `.data/db.json` (para empezar de cero, borrá la carpeta `.data`).

## Panel interno (`/admin`)

Entrá a `/admin` con `ADMIN_PASSWORD` (sin definirla, el panel queda desactivado). La sesión dura 12 h, va en una cookie firmada `HttpOnly`/`SameSite=Strict`, el login tiene límite de intentos y los cambios exigen que el pedido venga del mismo sitio (anti-CSRF). Secciones:

- **Resumen:** ventas, ingresos, visitas, conversión, abandonos, devoluciones, ingresos por día, embudo (visitas → elegir plantilla → vista previa → comprar → descargar), rendimiento por plantilla y últimas compras (estado, importe, generaciones usadas, vencimiento). Las compras de prueba local no cuentan. Enlaces a Clarity y Google Analytics.
- **Plantillas:** mostrar/ocultar y ordenar las que ven los clientes (incluidas y compiladas).
- **Marca de agua:** texto o imagen/logo, opacidad (%), tamaño, separación, inclinación, movimiento y sello central, con vista previa en vivo. Se guarda en el servidor y el sitio lo usa al instante.
- **Ajustes:** precios (video, imagen, combo y promos), precio tachado, días para descargar (vencimiento), generaciones por compra e IDs de Google Analytics 4 y Microsoft Clarity.

### Analítica

Dos capas: contadores propios del embudo (`/api/events`, sin cookies ni datos personales, siempre activos) y GA4 + Clarity, que se cargan solo si cargás los IDs en Ajustes **y** la persona acepta el aviso de cookies. Los eventos que llegan a GA4/Clarity son solo nombres de acción y la plantilla; nunca nombre, foto, fecha ni dirección.

### Compras: datos guardados, solo lectura y vencimiento

Al tocar *Comprar*, el servidor guarda una copia de lo que se compra: datos de la invitación, música elegida y la foto (reducida, JPEG ≤ 700 KB). La **música propia subida no se guarda** (si la compra la usó, al recuperar hay que adjuntarla de nuevo). Quien recupera la compra (por el retorno de Mercado Pago o por el código) llega al generador con la plantilla bloqueada y **todo en solo lectura**: se muestran los datos comprados y solo puede descargar ese mismo video, hasta `maxFinalRenders` veces y hasta el vencimiento (`retentionDays`, contados desde el pago).

Al vencer, la compra deja de poder descargarse y se **borran automáticamente** los datos personales y la foto (al iniciar el servidor, cada hora y cuando alguien consulta la compra). Queda solo el registro de la venta (id, plantilla, importe, fechas) para las estadísticas. Las compras que nunca se pagan se descartan a los 3 días.

### Imágenes de las plantillas de código (reemplazables desde la carpeta)

Las plantillas de código pueden usar imágenes: se declaran en `assets` (nombres sin extensión) y viven en `public/templates/<id>/`. Para cambiar una basta con **reemplazar el archivo con el mismo nombre** (PNG, WebP, JPG, o animados: GIF, WebM o MP4, que se repiten en bucle) y recargar: no hace falta tocar código ni el panel; vale para la vista previa, las miniaturas y la exportación a MP4. Si un archivo falta, la plantilla dibuja una alternativa. Cada carpeta tiene un `README.md` con qué es cada imagen y su tamaño recomendado. Hoy las usan **Fiesta de Campeones** (`campeones`), **Spidey y sus amigos** (`spidey`) **Juguetes en acción** (`toystory`) **Sonic y sus amigos** (`sonic`) y **HUNTR/X: Cazadoras K-pop** (`huntrx`, 30 s en seis bloques, con rumi/mira/zoey/grupo en 1–4 poses y música propia `cazadoras`; si faltan imágenes dibuja siluetas con el nombre del archivo); el mecanismo está en `src/templates/assets.ts`.

### SEO por plantilla

Cada plantilla tiene su propia página indexable: `/invitacion/<slug>` (por ejemplo `/invitacion/fiesta-tropical`), renderizada en el servidor con su `<title>`, descripción, URL canónica, Open Graph y datos estructurados (`Product` + precio). Al elegir una plantilla en el sitio también cambian el título de la pestaña y la URL, así se puede compartir el enlace directo. Hay `sitemap.xml` (home + todas las plantillas visibles) y `robots.txt` (bloquea `/admin` y `/api`). En el panel, en **Plantillas → SEO y dirección (URL)**, editás por plantilla la dirección, el título y la descripción, con contadores y una vista de cómo se ve en Google; vacío = texto automático. Las direcciones deben ser únicas. Falta una imagen para compartir (Open Graph): se puede agregar más adelante.

### El panel recuerda dónde estás

La pestaña, el video que estás editando, la escena y la capa seleccionada viajan en la URL (`/admin?tab=videos&video=c-xxxx&scene=2&layer=...`): si recargás volvés al mismo lugar, y el botón Atrás del navegador funciona.

### Tipografías, formas y el estilo "campaña de estadio"

Además de las tipografías incluidas hay **CABJ 1905** (`public/fonts/CABJ-1905.ttf`, archivo que aportaste: verificá que tengas licencia para usarla comercialmente) y podés **subir las tuyas** (TTF/OTF/WOFF, hasta 3 MB) desde el editor de texto de cada capa. Las capas nuevas **Línea / forma** (rectángulos y círculos con color, opacidad y esquinas redondeadas; con entrada "Se escribe" se dibujan de izquierda a derecha) sirven para líneas doradas, marcos y destellos de transición. El ejemplo *Estadio azul y oro (estilo campaña)* usa todo eso: títulos que se escriben, datos con líneas doradas y destello al cambiar de escena. Todo se puede editar (textos, colores, imágenes, tipografías).

### Almacenamiento (importante para el hosting)

Compras, ajustes, estadísticas, videos compilados y archivos subidos se guardan en `.data/` (`db.json` y `media/`). Necesitás un **disco persistente** y **un solo proceso** (VPS, o Railway/Render/Fly con volumen). En hosting serverless (Vercel) ese disco se pierde: habría que migrar a una base/KV y a un almacenamiento de objetos (p. ej. Cloudflare R2). Hacé copias de seguridad de `.data/`.

## Límite de pedidos (rate limit)

Cada ruta de la API limita los pedidos por IP (`src/server/ratelimit.ts`): crear compra 8 cada 10 min, estado 60/min, autorizar 15 cada 10 min, verificar autorización 30/min, entregado 15 cada 10 min y webhook 600/min. Al excederlo responde `429` con `Retry-After` y un mensaje en español. Por defecto cuenta en memoria (válido para un servidor Node/VPS propio). En hosting serverless conviene definir `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` (Upstash Redis, plan gratuito, sin dependencias nuevas) para que el contador se comparta entre instancias. Si Upstash falla, el límite "se abre" y se registra el error. La IP se toma de `x-forwarded-for`: solo es confiable detrás de un proxy (Vercel, Nginx, Cloudflare).

## Limitaciones conocidas

- **Un cliente manipulado puede saltarse el control de marca de agua** (el render es local). La barrera real es comercial: el flujo oficial exige una autorización firmada; no hay forma de impedir técnicamente que alguien modifique su propio navegador.
- El estado del pago **no** depende del disco local: se consulta siempre a Mercado Pago. Lo que sí se guarda en `.data/` son los datos de cada compra, el contador de generaciones y la configuración (ver *Almacenamiento*).
- Si la pestaña se cierra durante el proceso, se pierde el progreso (no hay nada en el servidor). Tras pagar, el video se puede volver a generar con el código de compra.
- En móviles de pocos recursos la exportación final (720×1280) puede fallar por memoria; la app muestra un aviso y sugiere cerrar apps o usar una computadora.
- Las tipografías de las plantillas son locales (OFL). Los textos con caracteres fuera del alfabeto latino pueden no mostrarse correctamente.

## Próximos pasos para producción

1. Credenciales reales de Mercado Pago, `APP_URL` con https, webhook configurado y probado con la firma.
2. Hosting con disco persistente (o migrar `.data/` a una base de datos + almacenamiento de objetos).
3. Rate limiting y monitoreo de errores (los registros `[pagos]` salen por consola).
4. Revisar con asesoría legal el precio tachado ($15.000) para que corresponda a una promoción real, y los términos de uso de música propia subida por los usuarios.

## Productos: video, imagen o ambas

Cada compra elige qué incluye (`product` en el registro de la compra): **solo video** (MP4), **solo imagen** (PNG y JPG 1080×1920) o **video + imagen**. Los precios se editan en el admin (Ajustes → Precio: video, imagen y combo; por defecto $8.000, $5.000 y $9.500) y el servidor fija siempre el importe según el producto (`src/server/purchases.ts`). La imagen es una "captura" de la plantilla en `imageTime` (o `thumbnailTime` si la plantilla no lo define), generada en el navegador con `src/render/still.ts`; se autoriza con el mismo token firmado que el video (`kind: 'image'`) y no consume las generaciones del video. La imagen se genera sola al abrir el generador (PNG principal y JPG más liviana). Quien compra solo la imagen puede sumar el video con 20% de descuento (`videoUpgradePrice`: redondeado a …500 o …750; compra nueva con los mismos datos que copia el servidor, una sola vez). En la vista previa y en la oferta hay pestañas "Video | Imagen".

## Nombre, etiqueta y título de cada plantilla

En el admin (Plantillas) se pueden editar el nombre general y la etiqueta de cada plantilla; al renombrar, la dirección (slug) actual se conserva para no perder el posicionamiento. El título SEO siempre termina en `| AltaParty` (se agrega solo y no se puede quitar).
