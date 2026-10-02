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

src/
  auth.ts                Configuración de inicio de sesión (Auth.js)

  lib/                   Lógica de servidor reutilizable (sin interfaz)
    db.ts                Conexión a la base (Prisma)
    permissions.ts       Roles y permisos — la "tabla de quién puede qué"
    session.ts           getCurrentUser(), requirePermission()
    storage.ts           Dónde y cómo se guardan los archivos
    images.ts            Pipeline de sharp: original → optimizada → miniatura
    photos.ts            Consultas de fotos y conversión a PhotoDTO
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
3. Se procesa con sharp (ver abajo) y se crea la foto como **borrador**.
4. La fotógrafa completa los datos en **Estudio → Fotografías → (foto)** y la
   publica.

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

### Filtrar en el cliente — `components/gallery/filters.ts`

La página de galería trae todas las fotos publicadas y el filtrado/orden se hace
en el navegador. Ventaja: el cambio es instantáneo y se puede animar. Los
filtros se escriben en la URL (`?categoria=paisaje&orden=nombre`) para poder
compartir o recargar la vista. Este archivo es lógica pura, sin React:

- `applyFilters()` filtra por categoría, tema, etiqueta, año, orientación y
  texto libre (ignora tildes y mayúsculas), y ordena por recientes, antiguas,
  nombre, popularidad, más favoritas, más descargadas o resolución.
- `facets()` calcula qué opciones mostrar en cada filtro según las fotos.
- **Popularidad** = visitas + descargas × 3 + favoritos × 5 (en `lib/photos.ts`).

> Si algún día hay miles de fotos, el siguiente paso sería filtrar y paginar en
> el servidor con Prisma; la interfaz no cambiaría.

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
| Fotografías | Listado con estado, tamaños, publicar/despublicar y asignar categoría a varias a la vez |
| Fotografías → foto | Editar título, descripción, fecha, categoría, tema, etiquetas, lugar, cámara, publicada, destacada, descargable. Muestra los tres archivos. Regenerar optimizadas o eliminar |
| Subir | Arrastrar y soltar, varias a la vez, con progreso |
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

## 10. Cómo extenderlo

- **Fotos reales**: Estudio → Subir. Podés borrar las de ejemplo desde su página
  de edición o volver a empezar con `npm run db:seed`.
- **Cambiar colores o tipografías**: bloque `@theme` en `src/app/globals.css`.
- **Base de datos en producción**: en `schema.prisma`, cambiar `provider` a
  `"postgresql"` y `DATABASE_URL`.
- **Archivos en la nube** (S3, Cloudflare R2): todo el acceso a disco está en
  `src/lib/storage.ts`; es el único archivo a adaptar.
- **Recibir los mensajes por email**: en `app/contacto/actions.ts`, después de
  guardar, enviar con un servicio como Resend.
- **Fecha automática desde EXIF**: en `lib/images.ts`, leer `metadata.exif` al
  procesar y usarla como `takenAt`.
