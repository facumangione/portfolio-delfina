# Portfolio fotográfico · Delfina

Portfolio fotográfico premium: oscuro, cinematográfico y con animaciones fluidas.
Los visitantes exploran, filtran, guardan y descargan fotos en alta resolución; la
fotógrafa administra su portfolio desde el **Estudio** y el administrador gestiona
usuarios, contenido y permisos desde **Administración**.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Framer Motion ·
Prisma + SQLite · Auth.js (credenciales) · sharp

## Puesta en marcha

Requiere Node.js 20 o superior.

```bash
npm install
cp .env.example .env         # y cambiá AUTH_SECRET (npx auth secret)
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
| `DATABASE_URL`   | Base de datos (SQLite por defecto: `file:./dev.db`)         |
| `AUTH_SECRET`    | Clave para firmar las sesiones                              |
| `STORAGE_DIR`    | Carpeta de archivos (originales y optimizadas)              |
| `MAX_UPLOAD_MB`  | Tamaño máximo por foto subida (por defecto 2048 MB)         |
| `IMAGE_CONCURRENCY` | Fotos que se procesan a la vez (por defecto 2)           |

La explicación completa del código está en **[GUIA-DEL-CODIGO.md](./GUIA-DEL-CODIGO.md)**.
