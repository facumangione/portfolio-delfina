# Portfolio fotográfico · Delfina

Portfolio fotográfico premium: oscuro, cinematográfico y con animaciones fluidas.
Los visitantes exploran, filtran, guardan y descargan fotos en alta resolución; la
fotógrafa administra su portfolio desde el **Estudio** y el administrador gestiona
usuarios, contenido y permisos desde **Administración**.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Framer Motion ·
Prisma + PostgreSQL · Auth.js (credenciales) · fotos en Cloudflare R2

## Puesta en marcha

Requiere Node.js 20 o superior y una base PostgreSQL (la gratis de
[Neon](https://neon.tech) sirve; usá una base aparte de la del sitio publicado).

```bash
npm install
cp .env.example .env         # completá DATABASE_URL y cambiá AUTH_SECRET (npx auth secret)
npm run setup                # crea la base y carga datos y fotos de ejemplo
npm run dev                  # http://localhost:3000
```

Para producción: `npm run build && npm start`.

### Empezar con el sitio vacío (cuentas reales, sin fotos de ejemplo)

```bash
npm run setup:vacio          # crea la base vacía
npm run dev                  # entrá a /login → te lleva a /instalar
```

En `/instalar` se crea la cuenta de administrador. Después, en
**Administración → Usuarios**, se crea la cuenta de la fotógrafa con el rol
"Fotógrafa". También se puede desde la terminal:

```bash
npm run usuario -- --rol fotografa --nombre "Delfina" --email delfina@mail.com
```

Si ya cargaste los ejemplos, `npm run ejemplos:borrar` los quita sin tocar
usuarios ni fotos reales.

### Usuarios de prueba

| Rol            | Email                   | Contraseña    |
| -------------- | ----------------------- | ------------- |
| Administrador  | admin@portfolio.com     | admin1234     |
| Fotógrafa      | delfina@portfolio.com   | foto1234      |
| Usuario        | usuario@portfolio.com   | usuario1234   |

Las fotos de ejemplo son escenas generadas por código (`prisma/sample-images.ts`)
para poder ver la experiencia completa sin depender de imágenes externas.
Reemplazalas subiendo fotos reales desde **Estudio → Subir**.

### Variables de entorno

| Variable         | Para qué sirve                                              |
| ---------------- | ----------------------------------------------------------- |
| `DATABASE_URL`   | Base PostgreSQL (conexión que usa la app)                   |
| `DATABASE_URL_UNPOOLED` | Conexión directa, para crear las tablas              |
| `AUTH_SECRET`    | Clave para firmar las sesiones                              |
| `STORAGE_DIR`    | Carpeta de las fotos cuando no hay bucket (para probar)     |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Bucket de Cloudflare R2 donde se guardan las fotos |
| `S3_PUBLIC_URL`  | Dirección pública del bucket para las versiones optimizadas |
| `MAX_UPLOAD_MB`  | Tamaño máximo por foto subida (por defecto 2048 MB)         |

## Publicar en internet

El sitio se publica gratis con **Vercel** (la app) + **Neon** (la base) +
**Cloudflare R2** (las fotos). Los pasos están en
**[PUBLICAR-EN-VERCEL.md](./PUBLICAR-EN-VERCEL.md)**.

La explicación completa del código está en **[GUIA-DEL-CODIGO.md](./GUIA-DEL-CODIGO.md)**.
