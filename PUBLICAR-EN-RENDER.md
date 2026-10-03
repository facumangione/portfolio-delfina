# Publicar el sitio en Render

Render es la opción recomendada: el repositorio trae un *Blueprint*
(`render.yaml`) que crea el servicio, el disco y las variables solo.

**Costo:** el disco persistente (donde quedan la base de datos y las fotos)
necesita el plan **Starter** (unos 7 USD por mes) más el disco (unos
0,25 USD por GB al mes; arranca con 10 GB). Sin disco, las fotos se borrarían
en cada actualización, por eso el plan gratis no sirve para este sitio.

## Pasos

1. **Crear la cuenta**
   Entrá a [render.com](https://render.com) y registrate con **GitHub**
   (así Render ve tus repositorios).

2. **Crear el sitio desde el Blueprint**
   **New → Blueprint** → elegí el repositorio **portfolio-delfina**.
   Si no aparece, tocá **Configure account** y dale acceso a ese repositorio.
   Render lee `render.yaml` y te muestra lo que va a crear: un servicio web
   `portfolio-delfina` con un disco `datos` montado en `/data`.

3. **Confirmar y pagar**
   Tocá **Apply** (o **Deploy Blueprint**). Te va a pedir una tarjeta para el
   plan Starter. La clave de las sesiones (`AUTH_SECRET`) se genera sola.

4. **Esperar el primer deploy**
   En el servicio, la pestaña **Logs** muestra el avance. Cuando dice
   **Live**, arriba aparece la dirección, del tipo
   `portfolio-delfina.onrender.com`.

5. **Crear las cuentas**
   Entrá a `https://tu-direccion/login`: como todavía no hay administrador, te
   lleva a **/instalar** para crear el tuyo. Después, en
   **Administración → Usuarios**, creá la cuenta de Delfina con el rol
   **Fotógrafa**.

6. **Delfina completa su perfil y sube fotos**
   En **Estudio → Perfil y contacto** carga sus redes, y en
   **Estudio → Subir** sus fotografías.

## Dominio propio (opcional)

En el servicio: **Settings → Custom Domains → Add**, por ejemplo
`delfinafoto.com`. Render te indica los registros DNS que tenés que cargar
donde compraste el dominio. El certificado HTTPS es automático.

## Actualizar el sitio

Cada cambio que se sube a la rama `main` del repositorio se publica solo. La
base de datos y las fotos están en el disco, así que no se pierden. Mientras
se actualiza, el sitio puede quedar sin responder unos segundos (pasa con
todos los servicios que usan disco en Render).

## Copias de seguridad y espacio

Todo lo importante está en `/data`: `app.db` (cuentas, datos de las fotos,
favoritos, mensajes) y `storage/` (originales y versiones optimizadas). Render
hace una copia diaria del disco automáticamente (pestaña **Disks**).

Para ampliar el espacio: **Disks → Size**. Estudio → Resumen muestra cuánto
ocupan los originales y las versiones optimizadas.
