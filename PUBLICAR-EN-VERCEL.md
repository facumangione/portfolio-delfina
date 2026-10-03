# Publicar el sitio gratis: Vercel + Neon + Cloudflare R2

El sitio se reparte en tres servicios, los tres con plan gratuito:

| Servicio | Qué guarda | Gratis hasta |
| --- | --- | --- |
| **Vercel** | La aplicación (las páginas) | Uso personal, no comercial |
| **Neon** | La base de datos (cuentas, datos de las fotos, favoritos, mensajes) | 0,5 GB, sobra |
| **Cloudflare R2** | Las fotos (originales y versiones optimizadas) | 10 GB |

Hacé los pasos en este orden. Vas a ir copiando claves de Cloudflare a Vercel:
tené a mano un bloc de notas.

---

## 1. Cloudflare R2 (las fotos)

1. Creá una cuenta en [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
2. En el menú de la izquierda: **R2 Object Storage**. La primera vez te pide
   activar R2 y cargar una tarjeta: no cobra nada mientras no pases los 10 GB.
3. **Create bucket** → nombre `portfolio-delfina` → **Create bucket**.
4. Dentro del bucket, pestaña **Settings**:
   - **Public Development URL** → **Enable** (escribí `allow` para confirmar).
     Copiá la dirección que aparece, del tipo `https://pub-xxxxxxxx.r2.dev`.
     👉 Es tu `S3_PUBLIC_URL`.
   - **CORS Policy** → **Add CORS policy** → borrá lo que haya, pegá esto y
     guardá:
     ```json
     [
       {
         "AllowedOrigins": ["*"],
         "AllowedMethods": ["GET", "PUT", "HEAD"],
         "AllowedHeaders": ["*"],
         "MaxAgeSeconds": 3600
       }
     ]
     ```
     (Sin esto el navegador no puede subir las fotos al bucket.)
5. Volvé a **R2 Object Storage** → **Manage API tokens** (arriba a la
   derecha, también puede decir **API → Manage API tokens**) →
   **Create API token**:
   - Permisos: **Object Read & Write**.
   - Buckets: **Apply to specific buckets only** → `portfolio-delfina`.
   - **Create API Token**. En la pantalla siguiente copiá (se muestran una sola vez):
     - **Access Key ID** 👉 `S3_ACCESS_KEY_ID`
     - **Secret Access Key** 👉 `S3_SECRET_ACCESS_KEY`
     - El endpoint, del tipo `https://<números-y-letras>.r2.cloudflarestorage.com`
       👉 `S3_ENDPOINT` (sin nada después de `.com`)

## 2. Vercel (la aplicación)

1. Creá una cuenta en [vercel.com/signup](https://vercel.com/signup) eligiendo
   **Hobby** y **Continue with GitHub**.
2. **Add New… → Project** → buscá **portfolio-delfina** → **Import**. Si no
   aparece, tocá **Adjust GitHub App Permissions** y dale acceso a ese repo.
3. Antes de tocar **Deploy**, abrí **Environment Variables** y cargá una por
   una (nombre a la izquierda, valor a la derecha):

   | Nombre | Valor |
   | --- | --- |
   | `AUTH_SECRET` | Una clave al azar: abrí [generate-secret.vercel.app/32](https://generate-secret.vercel.app/32) y copiá lo que aparece |
   | `S3_ENDPOINT` | El endpoint de R2 |
   | `S3_BUCKET` | `portfolio-delfina` |
   | `S3_ACCESS_KEY_ID` | El Access Key ID de R2 |
   | `S3_SECRET_ACCESS_KEY` | El Secret Access Key de R2 |
   | `S3_PUBLIC_URL` | La Public Development URL de R2 (sin `/` al final) |

4. Tocá **Deploy**. **Este primer intento va a fallar** porque todavía no hay
   base de datos: es normal, seguí con el paso 3.

## 3. Neon (la base de datos), desde Vercel

1. En tu proyecto de Vercel: pestaña **Storage** → **Create Database** →
   **Neon** (Serverless Postgres) → **Continue**.
2. Región: **Washington, D.C., USA (East) – iad1**, la misma donde corre la
   app en Vercel (así responde más rápido). Plan **Free**. Nombre:
   `portfolio-delfina`. **Create**.
3. En **Connect Project**, elegí `portfolio-delfina` y dejá marcados todos los
   entornos → **Connect**. Esto carga solo `DATABASE_URL` y
   `DATABASE_URL_UNPOOLED` en las variables del proyecto.
4. Pestaña **Deployments** → en el último, los tres puntos **⋯** →
   **Redeploy** → **Redeploy**. Esta vez crea las tablas y termina en
   **Ready**.

## 4. Primeros pasos en el sitio

1. Abrí la dirección que muestra Vercel (del tipo
   `portfolio-delfina.vercel.app`) y andá a `/login`: como no hay
   administrador, te lleva a **/instalar** para crear tu cuenta.
2. En **Administración → Usuarios**, creá la cuenta de Delfina con el rol
   **Fotógrafa**.
3. Delfina entra, completa **Estudio → Perfil y contacto** y sube fotos en
   **Estudio → Subir**. Para comprobar que todo anda, subí una primero.

---

## Bueno saber

- **Actualizaciones**: cada cambio que se sube a la rama `main` del repositorio
  se publica solo en Vercel.
- **Primera visita después de un rato**: la base gratuita de Neon se "duerme"
  tras 5 minutos sin visitas y tarda alrededor de un segundo en despertar. Las
  visitas siguientes son instantáneas.
- **Espacio**: Estudio → Resumen muestra cuánto ocupan los originales. Con 10
  GB entran unos cientos de originales pesados (por ejemplo, 400 fotos de
  25 MB). Si se llena, R2 cobra 0,015 USD por GB extra al mes.
- **Plan Hobby de Vercel**: es para uso personal y no comercial. Si el sitio
  pasa a vender fotos o servicios, corresponde el plan Pro.
- **Dominio propio** (opcional): en Vercel, **Settings → Domains → Add**, por
  ejemplo `delfinafoto.com`, y cargá los registros DNS que te indica donde
  compraste el dominio.
- **Si la subida de fotos falla con "falta configurar CORS"**: revisá el paso
  1.4 (CORS Policy del bucket).
- **Si el sitio muestra "Application error"**: en Vercel, **Deployments →
  (el último) → Logs** muestra el detalle; casi siempre es una variable mal
  copiada.
