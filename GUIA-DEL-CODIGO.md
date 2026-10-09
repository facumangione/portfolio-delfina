# Guía del código

Esta guía explica cómo está organizado el proyecto y cómo funcionan sus partes
principales, en el orden en que conviene leerlas. Cada archivo importante tiene
además comentarios al principio que explican qué hace.

---

## 1. La idea general

La aplicación es **una sola app de Next.js** que muestra las páginas y responde
las peticiones de la API. No hay un "backend" separado. Publicada, se reparte
en tres servicios gratuitos:

```
Navegador ──► Next.js en Vercel (src/app) ──► Prisma ──► PostgreSQL en Neon
    │                    │
    │                    └──► firma URLs de subida y descarga (lib/storage.ts)
    │
    └──► sube y baja las fotos DIRECTO de Cloudflare R2 (bucket compatible con S3)
```

Las fotos no pasan por el servidor: Vercel tiene poca memoria y tiempo por
petición, y no podría recibir originales 8K de cientos de MB. Por eso el
navegador de la fotógrafa genera las versiones optimizadas y sube todo
directo al bucket con URLs firmadas (ver sección 5).

Para probar en la computadora, sin las variables `S3_*` las fotos se guardan
en la carpeta `storage/` con exactamente el mismo recorrido.

Next.js con **App Router** tiene dos tipos de componentes, y entender esto es la
clave para leer el código:

| Tipo | Dónde corre | Se reconoce por | Se usa para |
| --- | --- | --- | --- |
| **Server Component** | En el servidor | No tiene `"use client"` | Leer la base de datos, verificar permisos, armar la página |
| **Client Component** | En el navegador | Empieza con `"use client"` | Animaciones, clicks, estado, hover |

El patrón que se repite en todo el proyecto es: **la página (servidor) busca los
datos y se los pasa a un componente cliente que los anima**. Por ejemplo,
`app/galeria/page.tsx` lee las fotos de la base y se las pasa a
`components/gallery/Gallery.tsx`, que filtra y anima.

---

## 2. Mapa de carpetas

```
prisma/
  schema.prisma          Modelo de datos (tablas)
  seed.ts                Carga usuarios, categorías y fotos de ejemplo
  sample-images.ts       Genera las fotos de ejemplo por código
  process-image.ts       Versiones optimizadas con sharp (sólo para los ejemplos)
  check-env.mjs          Avisa si faltan variables al arrancar con npm start
  db-env.mjs             Encuentra la conexión a la base con cualquier nombre de variable (Neon en Vercel)
  with-db-env.mjs        Corre el build o el arranque con esa conexión ya completada
  create-user.ts         npm run usuario: crea cuentas desde la terminal
  remove-samples.ts      npm run ejemplos:borrar
  many-samples.ts        npm run ejemplos:muchas (prueba con cientos de fotos)

src/
  auth.ts                Configuración de inicio de sesión (Auth.js)

  lib/                   Lógica de servidor reutilizable (sin interfaz)
    db.ts                Conexión a la base (Prisma)
    permissions.ts       Roles y permisos — la "tabla de quién puede qué"
    session.ts           getCurrentUser(), requirePermission()
    storage.ts           Dónde se guardan los archivos: bucket R2 o carpeta local
    client-image.ts      En el navegador: original → optimizada → miniatura → blur
    client-decode.ts     En el navegador: abre RAW, TIFF y HEIC además de los formatos web
    uploads.ts           Formatos admitidos (por extensión) y el "ticket" firmado de cada subida
    photos.ts            Consultas de fotos: filtros → SQL, paginación, PhotoDTO
    photo-index.ts       Campos calculados para filtrar/ordenar rápido
    settings.ts          Textos editables del sitio
    utils.ts             Formatos de fecha, bytes, slugs…

  app/                   Rutas: cada carpeta es una URL
    layout.tsx           Estructura común a todas las páginas
    template.tsx         Animación de ENTRADA de cada página
    page.tsx             /            Home
    galeria/             /galeria
    foto/[slug]/         /foto/mar-quieto   (vista individual)
    favoritos/           /favoritos
    contacto/            /contacto
    login/  registro/    Acceso
    cuenta/              /cuenta       Cambiar nombre, email y contraseña
    instalar/            /instalar     Crear el primer administrador
    estudio/             /estudio/…   Panel de la fotógrafa
    admin/               /admin/…     Panel del administrador
    api/                 Endpoints: subida (start, complete, file), descarga, favoritos, auth
    media/               Sirve las optimizadas si el bucket no tiene dirección pública

  components/            Piezas de interfaz (casi todas "use client")
    motion/              Transiciones de página, Reveal, curvas de animación
    nav/                 Menú de navegación
    gallery/             Galería masonry, filtros, visor (lightbox)
    photo/               Botones de favorito y descarga, vista individual
    home/                Hero cinematográfico, imágenes con parallax
    forms/               Campos y formularios públicos
    panel/               Piezas de los paneles (Estudio y Administración)
    Cursor.tsx           Cursor personalizado "Ver"
    ViewerProvider.tsx   Estado del visitante (sesión y favoritos)

storage/                 Fotos subidas en modo local, sin bucket (se crea solo)
  originals/             Originales en alta resolución — PRIVADOS
  display/               WebP de 2400 px para ver en pantalla
  thumbs/                WebP de 900 px para la galería
```

---

## 3. Datos: `prisma/schema.prisma`

Cada `model` es una tabla:

- **User**: nombre, email, contraseña (guardada como *hash* con bcrypt, nunca en
  texto plano), `role` (`USER`, `PHOTOGRAPHER` o `ADMIN`), `active` y
  `canDownload` (para restringir usuarios puntuales).
- **Photo**: los metadatos (título, fecha, tema, lugar, cámara…), los flags
  `published`, `featured` y `downloadable`, contadores de `views` y
  `downloads`, y **dos grupos de archivos**:
  - `originalPath`, `originalSize`, `width`, `height` → el original.
  - `displayPath`, `thumbPath`, `blurDataUrl` → las versiones optimizadas.
  - `focusX`, `focusY` → el punto de enfoque (ver sección 6, "Punto de enfoque automático").

  Además guarda cuatro **campos calculados** (`orientation`, `favoritesCount`,
  `popularity` y `searchText`) que existen sólo para que la base pueda filtrar y
  ordenar sin traer todas las fotos. Los mantiene al día `refreshPhotoIndex()`
  (`lib/photo-index.ts`), que se llama al subir, editar, marcar favorito, abrir
  o descargar una foto. Hay índices sobre las columnas más consultadas.
- **Category** y **Tag**: una foto tiene una categoría y muchas etiquetas.
- **Favorite**: une un usuario con una foto (clave compuesta, así no se repite).
- **ContactMessage**: mensajes del formulario de contacto.
- **Setting**: pares clave/valor con los textos editables del sitio.

Si cambiás el esquema, corré `npm run db:push` para actualizar la base.

---

## 4. Usuarios, roles y permisos

### Inicio de sesión — `src/auth.ts`

Usa **Auth.js** con el proveedor de credenciales (email + contraseña):

1. `authorize()` busca el usuario y compara la contraseña con `bcrypt.compare`.
2. La sesión se guarda en una **cookie firmada** (JWT), sin tabla de sesiones.
3. El callback `jwt()` **relee el rol desde la base en cada petición**. Así, si
   el administrador cambia el rol de alguien o lo desactiva, el cambio aplica
   de inmediato (si está desactivado, se le cierra la sesión).

Login y registro son *Server Actions* en `app/(auth)/actions.ts`: funciones del
servidor que los formularios llaman directamente, sin escribir una API.

### Permisos — `src/lib/permissions.ts`

Todo el control de acceso sale de una única tabla:

```ts
ROLE_PERMISSIONS = {
  USER:         [ver, descargar, favoritos, contactar],
  PHOTOGRAPHER: [...lo anterior, gestionar fotos, categorías, leer mensajes],
  ADMIN:        [todos],
}
```

y una función `can(rol, permiso)`. Para cambiar qué puede hacer un rol, se
edita sólo este archivo; la página **Administración → Permisos** muestra esta
misma tabla.

### Cómo se protege cada parte — `src/lib/session.ts`

- **Páginas**: `requirePermission("photos.manage")` en `app/estudio/layout.tsx`
  protege todo `/estudio`; si no hay permiso, redirige al login o al inicio.
  `/admin` hace lo mismo con `users.manage`.
- **Acciones y API**: `assertPermission(...)` o `can(...)` se vuelven a
  comprobar **en el servidor** en cada acción. Ocultar un botón no alcanza:
  alguien podría llamar a la acción a mano.

---

### Cuentas reales (sin datos de ejemplo)

Hay tres formas de crear cuentas, según la situación:

1. **Sitio recién publicado** (base vacía): al entrar a `/login` sin ningún
   administrador, se redirige a **`/instalar`**, donde se crea el primero
   (`app/instalar/page.tsx`). En cuanto existe uno, esa página deja de funcionar.
2. **Desde el panel**: Administración → Usuarios → *Crear usuario*, eligiendo el
   rol **Fotógrafa**. Así se crea la cuenta de Delfina.
3. **Desde la terminal**: `npm run usuario -- --rol fotografa --nombre "Delfina"
   --email delfina@mail.com` (pide la contraseña). Si el email ya existe,
   actualiza rol y contraseña, así que también sirve para recuperar un acceso.

La fotógrafa edita su presentación, sus **redes y medios de contacto**
(Instagram, WhatsApp, teléfono, Facebook, TikTok, YouTube, Behance, sitio web)
en **Estudio → Perfil y contacto**. Usa el permiso `profile.manage` y la acción
`updateProfile` (`app/estudio/perfil/actions.ts`), que sólo acepta los campos de
`PROFILE_KEYS`. `contactChannels()` en `lib/settings.ts` convierte esos datos en
enlaces (por ejemplo, el número de WhatsApp en un enlace `wa.me`); los campos
vacíos no se muestran.

Cada persona puede cambiar su nombre, email y contraseña en **`/cuenta`**
(enlace "Mi cuenta" en el menú). Para arrancar sin fotos de ejemplo se usa
`npm run setup:vacio`; y si ya se cargaron, `npm run ejemplos:borrar` las quita
sin tocar usuarios ni fotos reales.

---

## 5. Imágenes: original vs. versión optimizada

Este es el corazón técnico del proyecto, porque los originales pueden pesar
cientos de MB (fotos 8K).

### Subida — `components/panel/Uploader.tsx` + `app/api/upload/*`

Cada foto pasa por cuatro pasos, que la fotógrafa ve en la lista:

1. **Preparando** (`lib/client-image.ts`, en el navegador): se abre la foto con
   `createImageBitmap` (que aplica la rotación EXIF de las fotos verticales) y
   se generan en un `<canvas>` las versiones optimizadas (ver tabla abajo). Se
   achica de a mitades para que quede nítida, y se lee la **fecha de la toma**
   de los datos EXIF de la cámara.
2. **Pedir permiso** (`api/upload/start`): el servidor comprueba que sea staff,
   el formato y el tamaño (`MAX_UPLOAD_MB`), inventa el id y los nombres de
   los tres archivos, y devuelve una **URL firmada** para cada uno (vale unas
   horas y sólo para ese archivo) más un **ticket** firmado con lo autorizado.
   Antes revisa que las variables `S3_*` tengan la forma que espera R2
   (`storageConfigProblem` en `lib/storage.ts`); si no, avisa cuál está mal.
3. **Subiendo**: el navegador hace `PUT` de los tres archivos directo al
   bucket. Usa `XMLHttpRequest` porque es la API que informa el **progreso de
   subida**, que se muestra con una barra. Si el bucket rechaza un archivo,
   responde un XML con `<Code>` y `<Message>`; `storageError` en
   `Uploader.tsx` lo muestra junto con qué variable conviene revisar.
4. **Guardando** (`api/upload/complete`): con el ticket, el servidor verifica
   que los archivos existan, mide su tamaño real en el bucket (no confía en el
   navegador) y crea la foto con los **datos del lote**: antes de soltar los
   archivos, la fotógrafa elige categoría, tema, etiquetas y si se publican
   directamente; se aplican a todas.

Si hace falta, ajusta cada foto en **Estudio → Fotografías → (foto)**.

Para lotes grandes: se procesan **de a 2 en paralelo** y el resto espera en
cola, hay un resumen con el progreso total, las que fallan se reintentan con un
click y la lista sólo dibuja 40 filas (las vistas previas se crean y liberan a
medida que se muestran, para no gastar memoria con cientos de archivos).

Formatos (tabla en `lib/uploads.ts`, por extensión): JPG, PNG, WebP, AVIF,
GIF, BMP, TIFF, HEIC/HEIF y RAW de cámara (CR2, CR3, NEF, ARW, RAF, ORF, RW2,
DNG, PEF y otros). El original se guarda siempre tal cual. Para generar las
versiones optimizadas, `lib/client-decode.ts` abre cada uno así:

| Formato | Cómo se abre en el navegador |
| --- | --- |
| JPG, PNG, WebP, AVIF, GIF, BMP | Directo (`createImageBitmap`) |
| TIFF | Safari directo; los demás con UTIF (`utif2`), que se carga sólo si hace falta |
| HEIC / HEIF | Safari directo; los demás con libheif (`heic-to`), que se carga sólo si hace falta |
| RAW | Se busca la vista previa JPEG que la cámara guarda adentro del archivo (la más grande; se saltean los datos crudos del sensor) y se gira según la orientación del RAW |

En los RAW, las medidas que se guardan son las de esa vista previa, que en
la mayoría de las cámaras actuales es de tamaño completo o casi.

### Versiones de cada foto

| Versión | Tamaño | Formato | Uso |
| --- | --- | --- | --- |
| Original | Intacto | El subido | Sólo descarga, privado |
| Display | Lado largo ≤ 2400 px | WebP | Visor y página individual |
| Miniatura | Lado largo ≤ 900 px | WebP | Galería |
| Blur | 16 px | WebP en base64, guardado en la base | Se ve borroso mientras carga |

Detalles importantes:
- Si el navegador no sabe generar WebP (Safari viejo), usa JPG.
- Safari no permite canvas de más de ~16 millones de píxeles, así que el primer
  achique de un 8K ya baja de ese tamaño.
- El nombre de las versiones lleva un **hash** (`id-a1b2c3d4.webp`). Por eso el
  navegador puede cachearlas "para siempre": si cambia la imagen, cambia la URL.
- Los scripts de ejemplo (`npm run setup`) generan lo mismo con sharp, en
  `prisma/process-image.ts`, y lo guardan con `writeFile` de `lib/storage.ts`.

### Almacenamiento — `src/lib/storage.ts`

Cada archivo tiene una **clave** (`originals/<id>.jpg`, `display/…`,
`thumbs/…`), que es lo que se guarda en la base. `storage.ts` ofrece las mismas
funciones en dos modos:

| Función | Con bucket (R2) | Modo local (`storage/`) |
| --- | --- | --- |
| `signedUploadUrl` | URL firmada del bucket (firma S3 con `aws4fetch`) | `/api/upload/file?token=…`, que guarda en disco |
| `signedDownloadUrl` | URL firmada que vence en 5 minutos | — (se envía como stream) |
| `fileSize`, `readFile`, `writeFile`, `removeFiles` | Peticiones al bucket | Archivos de la carpeta |
| `publicUrl` | `S3_PUBLIC_URL/clave` | `/media/clave` |

Sólo acepta claves con esa forma exacta, así nadie puede pedir o pisar otros
archivos. El bucket es público para que las miniaturas carguen rápido, por eso
la clave del original lleva un sufijo secreto al azar
(`originals/<id>-<secreto>.jpg`): el id aparece en las URLs de las miniaturas,
pero sin el secreto no se puede adivinar la dirección del original.

### Entrega

- **Optimizadas**: se piden directo a la dirección pública del bucket
  (`S3_PUBLIC_URL`). Sin esa dirección (o en modo local),
  `app/media/[variant]/[file]/route.ts` las sirve con caché de un año. Sólo
  acepta `display` y `thumbs`, nunca originales.
- **Originales**: `app/api/photos/[id]/download/route.ts` verifica sesión,
  `canDownload` del usuario y `downloadable` de la foto, suma una descarga y
  **redirige a una URL firmada** que vence en 5 minutos, con el nombre del
  archivo. Así el original baja directo del bucket, nunca es público y el
  enlace no sirve para compartirlo.

---

## 6. Las animaciones

Todas usan **Framer Motion** y las mismas curvas (`components/motion/easing.ts`).
`EASE_CINE` arranca rápido y frena muy suave: es lo que da la sensación
"cinematográfica". Cuando el usuario tiene activado *reducir movimiento* en su
sistema, `globals.css` desactiva las transiciones.

### Transición entre páginas — `components/motion/PageTransition.tsx`

El App Router no anima la **salida** de una página. La solución:

1. Los enlaces internos usan `<TLink>` en lugar de `<Link>`.
2. Al hacer click, se anima la página actual hacia afuera (fade, sube 18 px,
   escala 0.985).
3. Recién entonces se navega con `router.push`.
4. `app/template.tsx` anima la **entrada** de la página nueva (aparece desde
   abajo con una escala de 1.01 a 1). `template.tsx`, a diferencia de
   `layout.tsx`, se vuelve a montar en cada navegación.

Una línea finita arriba de todo indica que la página siguiente está cargando.

### Galería masonry — `components/gallery/useMasonry.ts` + `Masonry.tsx`

En lugar de columnas CSS, **calculamos la posición de cada foto**:

- Cada foto va a la columna más baja en ese momento.
- Las destacadas y apaisadas pueden ocupar 2 columnas para dar ritmo editorial,
  pero sólo si no dejan huecos grandes.
- Columnas según el ancho: 1 (móvil), 2, 3 o 4 (pantallas grandes).

Como cada foto sabe su `x`, `y`, ancho y alto, al **filtrar**:
- las que ya no corresponden salen (fade + escala 0.94),
- las que siguen se **deslizan** a su nueva posición,
- las nuevas aparecen escalonadas.

Esto lo hace `AnimatePresence`, que permite animar elementos que se quitan.

**Virtualización**: aunque haya cientos de fotos cargadas, `Masonry.tsx` sólo
dibuja las que están cerca de la pantalla (una franja de 1,5 pantallas arriba y
abajo). Como ya conocemos la posición de cada foto, saber cuáles se ven es una
simple comparación. En la prueba con 650 fotos, el DOM nunca tuvo más de unas
30 tarjetas, sin importar cuánto se bajara.

### Tarjeta y hover — `components/gallery/PhotoCard.tsx`

El hover está hecho con clases CSS de Tailwind (`group-hover:`), que es más
liviano que JavaScript: zoom lento de la imagen, degradado desde abajo, título
que sube, y acciones (favorito, ver, descargar) que aparecen escalonadas con
`transitionDelay`. Además, la tarjeta aparece al entrar en pantalla
(`whileInView`).

### Visor — `components/gallery/Lightbox.tsx`

- La imagen de la tarjeta y la del visor comparten un `layoutId`. Framer Motion
  detecta que son "la misma" y anima su caja desde la tarjeta hasta el centro:
  ese es el efecto de "expandir".
- Primero se ve la miniatura (ya cargada) y encima aparece la versión de
  2400 px cuando termina de bajar.
- El fondo se oscurece y los controles aparecen después, escalonados (`custom`
  y `variants`).
- Teclado: ← → navegar, `i` información, `Esc` cerrar.
- Se renderiza con `createPortal` directamente en el `<body>`, para quedar por
  encima de todo.

### Otras

- **Menú** (`nav/SiteNav.tsx`): se abre con una cortina (`clipPath`) y los ítems
  entran uno tras otro (`staggerChildren`). La barra se oculta al bajar y
  reaparece al subir. Arriba de todo es transparente, con un degradado oscuro
  suave, letras más claras y una sombra leve para que se lea sobre fotos claras.
- **Filtros** (`gallery/FilterBar.tsx`): el subrayado de la categoría activa se
  desliza (`layoutId`), y el panel de filtros abre animando su altura.
- **Favorito** (`photo/FavoriteButton.tsx`): pulso de escala, relleno que
  cambia suave y un anillo que se expande una vez.
- **Hero** (`home/Hero.tsx`): zoom-out lento al cargar, nombre letra por
  letra, y al hacer scroll parallax sutil (`useScroll` + `useTransform`) con
  oscurecimiento progresivo. Cómo se acomoda la foto se explica abajo.

- **Cursor** (`Cursor.tsx`): cualquier elemento con `data-cursor="Ver"` hace
  que el cursor se convierta en un círculo con ese texto, que sigue al mouse
  con un resorte. Sólo en equipos con mouse.

### La foto de portada se adapta — `src/lib/hero.ts`

El hero ocupa toda la ventana, pero las fotos tienen formas distintas. Hay dos
formas de mostrarla:

- **Llenar** (`cover`): a pantalla completa, recortando lo que no entra. Lo que
  queda a la vista depende del **punto de enfoque** de la foto
  (`object-position`, ver abajo): en una foto vertical en una pantalla ancha
  sólo entra una franja, y el punto de enfoque queda dentro de esa franja.
- **Entera** (`contain`): la foto completa, sin agrandarla más que su tamaño
  real, sobre un fondo hecho con la misma foto en versión diminuta (el
  `blurDataUrl` de 16 px) muy desenfocada y oscurecida. En la computadora una
  vertical va a la derecha (el nombre está a la izquierda); en el celular, arriba.

`resolveHeroFit()` decide entre las dos. En modo **Automático** siempre llena,
salvo que la foto sea tan chica que habría que agrandarla más de 2,5 veces (se
vería muy pixelada). Como depende del tamaño de la pantalla, el hero mide la
ventana en el navegador (`ResizeObserver`) y recién muestra la foto cuando está
cargada y medida. El modo se guarda como ajuste `heroFit` (`lib/settings.ts`).

### Punto de enfoque automático — `src/lib/focus.ts`

Cada foto guarda su **punto de enfoque** (`focusX`, `focusY` en la tabla
`Photo`, de 0 a 100): lo importante de la foto, que tiene que quedar a la vista
cuando se recorta. Se usa en la portada y en las tapas de las series.

**Cómo se detecta.** `detectFocus()` trabaja sobre una versión de ~200 px de la
foto y le da un puntaje a cada píxel según cuánto "llama la atención", sin
inteligencia artificial y sin depender de que haya caras:

1. **Contraste con el resto**: qué tan distinto es su color del color promedio
   de la foto (una flor blanca sobre fondo oscuro, el sol en un paisaje).
2. **Nitidez**: los bordes marcados (lo que está en foco) cuentan más que el
   fondo liso o desenfocado.
3. **Piel**: los tonos de piel suman, porque si hay una persona suele ser lo
   importante.
4. **Color**: los colores vivos suman un poco.

Después prueba dónde ubicar una "ventana" con la forma de la pantalla (ancha
para decidir la altura, angosta para decidir el costado) y se queda con la
posición que junta más puntaje. Esa posición, en porcentaje, es el punto de
enfoque.

**Cuándo se calcula.**
- **Al subir** una foto: en el navegador, junto con las otras versiones
  (`lib/client-image.ts` → `lib/client-focus.ts`), y viaja a
  `/api/upload/complete`.
- **Fotos subidas antes**: al abrir **Administración → Contenido**, el
  navegador calcula el de las candidatas que no lo tienen y lo guarda
  (`saveDetectedFocus` en `app/admin/actions.ts`; nunca pisa uno ya guardado).
  Lee las miniaturas desde `/media/…` porque el navegador sólo deja leer los
  píxeles de imágenes del mismo sitio.
- **Fotos de ejemplo**: el seed lo calcula con sharp (`prisma/process-image.ts`).

**Cómo se corrige.** En **Administración → Contenido**
(`components/panel/HeroPicker.tsx`), debajo de la elección de foto y de modo,
está el **Encuadre**: tocando lo importante en la foto completa, o arrastrando
la foto dentro de las vistas previas de computadora y celular (que usan la
misma lógica que la portada, así lo que se ve ahí es lo que va a quedar). Al
guardar, `updateSettings` escribe `focusX`/`focusY` en la foto. "Volver a
detectar automáticamente" descarta el ajuste a mano.

---

## 7. Galería, filtros y favoritos

### Filtrar en la base y cargar de a páginas

Pensado para cientos o miles de fotos, nada se filtra "a mano" en el navegador:

1. `app/galeria/page.tsx` (servidor) lee los filtros de la URL y pide **sólo la
   primera página** (30 fotos) a `queryPhotos()` en `lib/photos.ts`.
2. `buildPhotoWhere()` traduce cada filtro a una condición de Prisma (SQL):
   categoría, tema, etiqueta, año (rango de fechas), orientación y búsqueda.
   La búsqueda compara contra `searchText`, que está sin tildes y en minúsculas,
   así "montana" encuentra "montaña".
3. El orden también lo resuelve la base: recientes, antiguas, nombre,
   popularidad, más favoritas, más descargadas, resolución o últimas subidas.
   Al final siempre se ordena por `id` para que las páginas no se mezclen.
4. **Scroll infinito** (`Gallery.tsx`): un elemento invisible al final de la
   grilla (el "centinela") se observa con `IntersectionObserver`; cuando está a
   1200 px de aparecer, se pide la página siguiente a `GET /api/photos`.
5. Al cambiar un filtro, se pide de nuevo la página 1. Mientras llega, la grilla
   se atenúa; después se reemplaza con la animación de siempre. La búsqueda de
   texto espera 300 ms a que dejes de escribir.
6. `getFacets()` calcula qué opciones mostrar en cada filtro (sólo valores que
   tienen fotos publicadas).

Los filtros se escriben en la URL (`?categoria=paisaje&orden=nombre`) para poder
compartir o recargar la vista. `components/gallery/filters.ts` tiene los tipos y
la conversión desde/hacia la URL.

**Popularidad** = visitas + descargas × 3 + favoritos × 5.

### Favoritos — `components/ViewerProvider.tsx`

Un *contexto* de React guarda el conjunto de favoritos del visitante, cargado
por el servidor en `app/layout.tsx`. Todos los corazones (tarjeta, visor,
página individual) leen de ahí, así que siempre coinciden.

Al marcar se usa **actualización optimista**: la interfaz cambia al instante y
después se confirma con `POST /api/favorites`; si el servidor falla, se revierte.
En la página **Favoritos**, al quitar un corazón la foto sale de la grilla con
la misma animación de los filtros.

---

## 8. Paneles

### Estudio (fotógrafa y administrador) — `app/estudio/`

| Página | Qué hace |
| --- | --- |
| Resumen | Publicadas, borradores, descargas, mensajes, la barra de **espacio en R2** y peso de originales vs. optimizadas |
| Fotografías | Listado paginado (60 por página) con búsqueda, filtros por estado, categoría y original (en R2 o archivado) y orden por fecha o peso. **Acciones en lote** sobre las marcadas: publicar, pasar a borrador, asignar categoría, tema o etiqueta, destacar, archivar el original y eliminar |
| Fotografías → foto | Editar título, descripción, fecha, categoría (o crear una nueva ahí mismo), tema, etiquetas, lugar, cámara, publicada, destacada, descargable. Muestra los tres archivos. Descargar el original o eliminar |
| Subir | Arrastrar y soltar cientos de fotos, con datos del lote (la categoría se puede crear ahí mismo), **nombre y descripción por foto** (editables mientras sube; si la foto ya terminó, se guardan al salir del campo con `updatePhotoText`), progreso total y reintento |
| Categorías | Crear, renombrar, ordenar y eliminar |
| Mensajes | Leer, marcar como leído, responder por email, eliminar |
| Perfil y contacto | Nombre público, biografía, ubicación, email, WhatsApp, teléfono y redes |

Todas las acciones están en `app/estudio/actions.ts`. Son *Server Actions*:
cada una verifica el permiso, cambia la base y llama a `revalidatePath` para
que las páginas muestren los datos nuevos.

El selector de categoría (`components/panel/CategorySelect.tsx`) se usa en
Subir, en la edición de una foto y en las acciones en lote. Su última opción,
**+ Nueva categoría…**, muestra un campo para escribir el nombre y llama a
`saveCategory`; la categoría creada queda elegida. Si ya existe una con ese
nombre, se usa la existente.

**Ojo con los formularios en React 19.** Un `<form action={...}>` vuelve sus
campos al valor inicial después de enviarse. Con `defaultValue`, eso hace que
la pantalla muestre el dato VIEJO aunque el nuevo se haya guardado (y que se
pise si se vuelve a guardar). Por eso `PhotoEditForm`, `CategoryForm` y
`UserRowForm` se envían con `onSubmit` + `startTransition`.

### Administración (sólo administrador) — `app/admin/`

| Página | Qué hace |
| --- | --- |
| Resumen | Barra de **espacio en R2** (ver sección 10), usuarios por rol, fotos, categorías y mensajes |
| Usuarios | Cambiar rol, activar/desactivar, permitir descargas, eliminar, crear usuarios |
| Fotógrafa | El mismo formulario de perfil que ve la fotógrafa, y las cuentas con ese rol |
| Contenido | Texto de portada, texto de contacto y foto del hero (cuál, cómo se acomoda y su encuadre) |
| Permisos | Tabla de permisos por rol y usuarios con restricciones |
| Fotografías / Categorías | Llevan a las mismas pantallas del Estudio |

Un administrador no puede quitarse a sí mismo el acceso ni eliminar su cuenta.

---

## 9. Recorrido de una petición, de punta a punta

**"Un usuario abre /galeria y marca un favorito"**

1. `app/layout.tsx` (servidor) lee la sesión y los favoritos del usuario y los
   pone en `ViewerProvider`.
2. `app/galeria/page.tsx` (servidor) llama a `getPublishedPhotos()`, que
   consulta Prisma y convierte cada foto en un `PhotoDTO` (objeto plano con
   URLs ya armadas).
3. `Gallery` (cliente) aplica filtros, `useMasonry` calcula posiciones y
   `Masonry` dibuja las tarjetas animadas.
4. El navegador pide la miniatura directo al bucket (`S3_PUBLIC_URL/thumbs/xxx.webp`).
5. Click en el corazón → `toggleFavorite()` cambia la interfaz y hace
   `POST /api/favorites` → `app/api/favorites/route.ts` verifica la sesión y
   guarda con Prisma.

---

## 10. Escala: qué pasa con cientos o miles de fotos

| Parte | Cómo escala |
| --- | --- |
| Galería y Favoritos | Páginas de 30 desde la base + scroll infinito + sólo ~30 tarjetas en el DOM |
| Filtros y orden | Consultas SQL con índices; con 650 fotos responden en ~10 ms |
| Portada | Sólo consulta las destacadas y la foto del hero |
| Estudio | Listado paginado de 60, búsqueda y acciones en lote |
| Subida | El navegador procesa de a 2 fotos y sube directo al bucket; el servidor sólo firma y registra |
| Imágenes | El visitante sólo baja miniaturas de ~100 KB, cacheadas un año |

Para probarlo: `npm run ejemplos:muchas -- 1000` crea 1000 fotos de ejemplo
(y `npm run ejemplos:borrar` las quita).

El límite real pasa a ser el **espacio del bucket**: cada original ocupa lo
que pesa el archivo de la cámara. R2 da 10 GB gratis; Administración →
Resumen (y Estudio → Resumen) muestra una barra con lo usado, que se pone
ámbar desde el 80 %. `lib/quota.ts` suma los tamaños guardados en la base
(original, versión web y miniatura, medidos en el bucket al subir) y
`api/upload/start` **rechaza subidas que pasarían el límite**, para que R2
nunca llegue a cobrar. El límite se cambia con `STORAGE_LIMIT_GB` (por
defecto 10).

Para hacer lugar sin sacar fotos del sitio está **Archivar original**, en la
edición de una foto o como acción en lote en Estudio → Fotografías (con los
filtros «Más pesadas» y «Original en R2» se eligen rápido). Borra del bucket
sólo el original, que es casi todo el peso (un RAW de 25 MB contra unos
500 KB de versiones web), y guarda la fecha en `Photo.originalArchivedAt`.
La foto sigue publicada y la descarga (`api/photos/[id]/download`) entrega
la versión de 2400 px. Con sólo versiones web, 10 GB alcanzan para unas
20.000 fotos. La fotógrafa conserva los originales en su computadora o en un
disco. La base de Neon (0,5 GB gratis) sobra: cada foto ocupa
pocos KB en la base.

---

## 11. Cómo extenderlo

- **Fotos reales**: Estudio → Subir. Podés borrar las de ejemplo desde su página
  de edición o volver a empezar con `npm run db:seed`.
- **Cambiar colores o tipografías**: bloque `@theme` en `src/app/globals.css`.
- **Otro proveedor de archivos** (Amazon S3, Backblaze B2): cualquier bucket
  compatible con S3 funciona cambiando las variables `S3_*`; todo el acceso a
  los archivos está en `src/lib/storage.ts`.
- **Recibir los mensajes por email**: en `app/contacto/actions.ts`, después de
  guardar, enviar con un servicio como Resend.
