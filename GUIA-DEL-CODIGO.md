# Guía del código

Esta guía explica cómo está organizado el proyecto y cómo funcionan sus partes
principales, en el orden en que conviene leerlas. Cada archivo importante tiene
además comentarios al principio que explican qué hace.

---

## 1. La idea general

La aplicación es **una sola app de Next.js** que hace de todo: muestra las
páginas, responde las peticiones de la API y procesa las imágenes. No hay un
"backend" separado.

```
Navegador  ──►  Next.js (src/app)  ──►  Prisma  ──►  SQLite (prisma/dev.db)
                     │
                     └──►  sharp  ──►  storage/ (originales y versiones optimizadas)
```

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
  create-user.ts         npm run usuario: crea cuentas desde la terminal
  remove-samples.ts      npm run ejemplos:borrar
  many-samples.ts        npm run ejemplos:muchas (prueba con cientos de fotos)

src/
  auth.ts                Configuración de inicio de sesión (Auth.js)

  lib/                   Lógica de servidor reutilizable (sin interfaz)
    db.ts                Conexión a la base (Prisma)
    permissions.ts       Roles y permisos — la "tabla de quién puede qué"
    session.ts           getCurrentUser(), requirePermission()
    storage.ts           Dónde y cómo se guardan los archivos
    images.ts            Pipeline de sharp: original → optimizada → miniatura
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
    api/                 Endpoints: subida, descarga, favoritos, auth
    media/               Sirve las imágenes optimizadas

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

storage/                 Archivos subidos (se crea solo)
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

Cada persona puede cambiar su nombre, email y contraseña en **`/cuenta`**
(enlace "Mi cuenta" en el menú). Para arrancar sin fotos de ejemplo se usa
`npm run setup:vacio`; y si ya se cargaron, `npm run ejemplos:borrar` las quita
sin tocar usuarios ni fotos reales.

---

## 5. Imágenes: original vs. versión optimizada

Este es el corazón técnico del proyecto, porque los originales pueden pesar
cientos de MB (fotos 8K).

### Subida — `app/api/upload/route.ts` + `components/panel/Uploader.tsx`

1. El navegador envía el archivo **crudo** como cuerpo de la petición (no como
   formulario). Usa `XMLHttpRequest` porque es la API que informa el
   **progreso de subida**, que se muestra con una barra.
2. El servidor lo escribe **directamente en disco a medida que llega**
   (`saveStream` en `lib/storage.ts`), en trozos. Nunca tiene el archivo entero
   en memoria, y corta si supera `MAX_UPLOAD_MB`.
3. Se procesa con sharp (ver abajo) y se crea la foto con los **datos del
   lote**: antes de soltar los archivos, la fotógrafa elige categoría, tema,
   etiquetas y si se publican directamente; se aplican a todas.
4. Si hace falta, ajusta cada foto en **Estudio → Fotografías → (foto)**.

Para lotes grandes: se suben **de a 2 en paralelo** y el resto espera en cola,
hay un resumen con el progreso total, las que fallan se reintentan con un click
y la lista sólo dibuja 40 filas (las vistas previas se crean y liberan a medida
que se muestran, para no gastar memoria con cientos de archivos).

### Procesamiento — `src/lib/images.ts`

`processImage()` toma el original y genera:

| Versión | Tamaño | Formato | Uso |
| --- | --- | --- | --- |
| Original | Intacto | El subido | Sólo descarga, privado |
| Display | Lado largo ≤ 2400 px | WebP | Visor y página individual |
| Miniatura | Lado largo ≤ 900 px | WebP | Galería |
| Blur | 16 px | WebP en base64 | Se ve borroso mientras carga |

Detalles importantes:
- `limitInputPixels: false` permite abrir imágenes gigantes.
- `.rotate()` aplica la orientación EXIF (fotos verticales de cámara).
- La **fecha de la toma** se lee de los datos EXIF de la cámara, si existen.
- **Cola de procesamiento**: como máximo 2 fotos se procesan a la vez
  (`IMAGE_CONCURRENCY`). Procesar un 8K usa mucha memoria; si llegan 200 fotos,
  esperan su turno en lugar de saturar el servidor.
- El nombre de las versiones lleva un **hash** (`id-a1b2c3d4.webp`). Por eso el
  navegador puede cachearlas "para siempre": si se regeneran, cambia la URL.

### Entrega

- **Optimizadas**: `app/media/[variant]/[file]/route.ts` las sirve con caché
  de un año. Sólo acepta `display` y `thumbs`, nunca originales.
- **Originales**: `app/api/photos/[id]/download/route.ts` verifica sesión,
  `canDownload` del usuario y `downloadable` de la foto, suma una descarga y
  envía el archivo como *stream* con `Content-Disposition: attachment`.

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
  reaparece al subir.
- **Filtros** (`gallery/FilterBar.tsx`): el subrayado de la categoría activa se
  desliza (`layoutId`), y el panel de filtros abre animando su altura.
- **Favorito** (`photo/FavoriteButton.tsx`): pulso de escala, relleno que
  cambia suave y un anillo que se expande una vez.
- **Hero** (`home/Hero.tsx`): zoom-out lento al cargar, nombre letra por
  letra, y al hacer scroll parallax sutil (`useScroll` + `useTransform`) con
  oscurecimiento progresivo.
- **Cursor** (`Cursor.tsx`): cualquier elemento con `data-cursor="Ver"` hace
  que el cursor se convierta en un círculo con ese texto, que sigue al mouse
  con un resorte. Sólo en equipos con mouse.

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
| Resumen | Publicadas, borradores, descargas, mensajes, y peso de originales vs. optimizadas |
| Fotografías | Listado paginado (60 por página) con búsqueda y filtros por estado y categoría. **Acciones en lote** sobre las marcadas: publicar, pasar a borrador, asignar categoría, tema o etiqueta, destacar y eliminar |
| Fotografías → foto | Editar título, descripción, fecha, categoría, tema, etiquetas, lugar, cámara, publicada, destacada, descargable. Muestra los tres archivos. Regenerar optimizadas o eliminar |
| Subir | Arrastrar y soltar cientos de fotos, con datos del lote, progreso total y reintento |
| Categorías | Crear, renombrar, ordenar y eliminar |
| Mensajes | Leer, marcar como leído, responder por email, eliminar |

Todas las acciones están en `app/estudio/actions.ts`. Son *Server Actions*:
cada una verifica el permiso, cambia la base y llama a `revalidatePath` para
que las páginas muestren los datos nuevos.

### Administración (sólo administrador) — `app/admin/`

| Página | Qué hace |
| --- | --- |
| Usuarios | Cambiar rol, activar/desactivar, permitir descargas, eliminar, crear usuarios |
| Fotógrafa | Nombre público, bajada, biografía, contacto y redes; cuentas con rol de fotógrafa |
| Contenido | Texto de portada, texto de contacto y foto del hero |
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
4. El navegador pide `/media/thumbs/xxx.webp` → `app/media/.../route.ts`.
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
| Subida | 2 subidas en paralelo, el original va directo a disco, procesamiento en cola |
| Imágenes | El visitante sólo baja miniaturas de ~100 KB, cacheadas un año |

Para probarlo: `npm run ejemplos:muchas -- 1000` crea 1000 fotos de ejemplo
(y `npm run ejemplos:borrar` las quita).

El límite real pasa a ser el **disco**: cada original ocupa lo que pesa el
archivo de la cámara. Con muchos GB conviene mover `storage/` a un servicio de
almacenamiento de objetos (ver abajo) y SQLite a Postgres; el código ya está
preparado para que sea un cambio acotado.

---

## 11. Cómo extenderlo

- **Fotos reales**: Estudio → Subir. Podés borrar las de ejemplo desde su página
  de edición o volver a empezar con `npm run db:seed`.
- **Cambiar colores o tipografías**: bloque `@theme` en `src/app/globals.css`.
- **Base de datos en producción**: en `schema.prisma`, cambiar `provider` a
  `"postgresql"` y `DATABASE_URL`.
- **Archivos en la nube** (S3, Cloudflare R2): todo el acceso a disco está en
  `src/lib/storage.ts`; es el único archivo a adaptar.
- **Recibir los mensajes por email**: en `app/contacto/actions.ts`, después de
  guardar, enviar con un servicio como Resend.
