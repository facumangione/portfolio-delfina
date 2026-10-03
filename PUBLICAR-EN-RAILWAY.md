# Publicar el sitio en Railway

Railway corre la app tal como está: un servidor Node con un **volumen** (disco
persistente) donde viven la base de datos y las fotos originales. El proyecto ya
trae la configuración (`railway.json`): Railway compila con `npm run build` y
arranca con `npm run start:prod`, que actualiza la base y levanta el sitio.

## Antes de empezar

- El código tiene que estar en un repositorio de GitHub.
- Una cuenta en https://railway.com (se puede entrar con GitHub). Railway cobra
  según el uso; para un portfolio suele alcanzar el plan Hobby.

## Paso a paso

1. **Crear el proyecto**
   En Railway: **New Project → Deploy from GitHub repo** → elegí el repositorio.
   Si no aparece, tocá *Configure GitHub App* y dale acceso a ese repo.
   El primer deploy puede fallar porque todavía faltan las variables: es normal.

2. **Agregar el volumen (disco)**
   Dentro del servicio: clic derecho en el lienzo o **⌘K → Add Volume**, elegí el
   servicio y como *Mount path* escribí:
   ```
   /data
   ```

3. **Cargar las variables**
   Pestaña **Variables → Raw Editor**, pegá esto y guardá:
   ```
   DATABASE_URL=file:/data/app.db
   STORAGE_DIR=/data/storage
   AUTH_SECRET=pegá-acá-una-clave-larga
   AUTH_TRUST_HOST=true
   ```
   Para `AUTH_SECRET` usá una clave larga y aleatoria. Se genera con
   `npx auth secret` o `openssl rand -base64 32` en tu compu.

4. **Darle una dirección pública**
   **Settings → Networking → Generate Domain**. Railway te da una dirección del
   tipo `algo.up.railway.app`.

5. **Deploy**
   Railway vuelve a desplegar solo al cambiar las variables (si no, **Deploy**).
   Cuando termine, abrí la dirección.

6. **Crear las cuentas**
   Entrá a `https://tu-direccion/login`: como no hay administrador, te lleva a
   **/instalar** para crear el tuyo. Después, en **Administración → Usuarios**,
   creá la cuenta de Delfina con el rol **Fotógrafa**.

7. **Delfina completa su perfil y sube fotos**
   En **Estudio → Perfil y contacto** carga sus redes, y en **Estudio → Subir**
   sus fotografías.

## Dominio propio (opcional)

En **Settings → Networking → Custom Domain** agregás, por ejemplo,
`delfinafoto.com`. Railway te muestra un registro DNS (CNAME) que tenés que
cargar donde compraste el dominio. El certificado HTTPS es automático.

## Actualizar el sitio

Cada vez que se sube un cambio a la rama principal del repositorio, Railway
vuelve a desplegar solo. La base de datos y las fotos están en el volumen, así
que no se pierden.

## Copias de seguridad

Todo lo importante está en el volumen `/data`: `app.db` (cuentas, datos de las
fotos, favoritos, mensajes) y `storage/` (originales y versiones optimizadas).
Railway permite hacer *backups* del volumen desde la pestaña del volumen.

## Espacio en disco

Los originales ocupan lo que pesan los archivos de la cámara. Revisá el uso del
volumen en Railway y ampliálo cuando haga falta. Estudio → Resumen muestra
cuánto ocupan los originales y las versiones optimizadas.
