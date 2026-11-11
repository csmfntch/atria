# Artia

Plataforma en español para conectar **mentores** (profesores) y **estudiantes** en Colombia. Precios en COP, ciudades colombianas, hora de Colombia (GMT-5), celulares `3XX XXX XXXX` y contacto por WhatsApp.

## Qué hace

**Acceso:** ingreso y registro separados por rol («Soy estudiante» / «Soy mentor»), con una guía de **primeros pasos** (perfil → suscripción → primera reserva / verificación → clase → horarios). Funciona en computador y en el celular (menú móvil, instalable como app desde el navegador).

**Catálogo de clases:** Idiomas (inglés, francés, alemán, italiano) · Ciencias y números (matemáticas, física, química, contabilidad) · Humanidades (ciencias sociales, escritura) · Bienestar y espiritualidad (yoga, pilates, astrología, reiki, ángeles, tarot) · Arte y creatividad (cerámica, arte) · Deportes (tenis, pádel, rutinas de ejercicio) · Tecnología (inteligencia artificial). Se edita en `colombia.mjs`.

**Estudiante**
- Perfil con ciudad, grado y **colegio público o privado** (nombre y localidad de Bogotá). Los mentores solo ven el grado y el tipo de colegio, nunca el nombre.
- Si es menor de 18 años registra a su **acudiente**; al mentor se le comparte el celular del acudiente, no el del menor.
- Marketplace con **categorías y materias**, y filtros por ciudad, modalidad, precio máximo, calificación mínima y orden (mejor calificadas, precio, recientes). Reserva un horario disponible del mentor.
- Agenda con próximas clases e historial; cancela reservas; deja **reseñas** (1–5 ★ + comentario) cuando la clase ya ocurrió.
- Publica lo que busca y recibe ofertas de mentores.

**Mentor**
- Perfil, clases (precio, duración, modalidad) y **disponibilidad semanal** por bloques horarios; los estudiantes reservan en espacios de la duración de cada clase. Un mismo horario no puede reservarse dos veces.
- Agenda: acepta o rechaza reservas. El WhatsApp de la otra parte solo se muestra con reservas aceptadas.
- **Verificación**: sube cédula y título/certificado; un administrador los revisa y, si aprueba, el mentor recibe la insignia **✓ Verificado**.
- Reseñas y calificación promedio visibles en su perfil y en sus clases.

**Suscripción mensual (ambos roles)**
- Mentor: sus clases solo son públicas con verificación **y** suscripción activa. Estudiante: necesita suscripción activa para reservar y publicar solicitudes.
- Pago con **Wompi** (PSE, Nequi, tarjetas). Cada pago suma 30 días; renovar antes de vencer suma desde la fecha de vencimiento.

**KYC (verificación de identidad):** el mentor toca «Verificar mi identidad» (primer paso, sin escribir nada antes), toma foto de su cédula y una selfie con un proveedor de KYC (**Didit**), sube **la foto de su cédula y su título (los dos son obligatorios)** y termina. El número de cédula se lee del documento verificado y queda en su perfil; una misma cédula no puede estar en dos cuentas de mentor. El resultado se compara con su perfil: nombre (y la cédula si la había declarado) (acepta «APELLIDOS NOMBRES» y sin tildes), rostro y prueba de vida. **Si todo coincide el mentor queda verificado automáticamente** (`KYC_AUTO_APROBAR=0` lo desactiva y deja siempre la aprobación al administrador); si algo no coincide pasa al administrador con los motivos; si el proveedor rechaza el documento, el mentor puede reintentar. El título no lo valida el KYC: queda disponible para revisión del administrador. Mientras no haya proveedor conectado se usa la revisión manual de documentos.

**Administración:** cola de verificaciones con vista de documentos, aprobar o rechazar con motivo.

## Ejecutar

Requiere **Node 22.5 o superior** (usa `node:sqlite`; no hay dependencias que instalar).

```bash
PAGOS_SIMULADOS=1 npm run demo   # http://localhost:3100 con datos de ejemplo y pagos de prueba
npm start                        # sin datos de ejemplo
npm test                         # pruebas de la API
```

Cuentas de ejemplo (contraseña `demo12345`): mentores `laura@demo.co`, `andres@demo.co`, `camila@demo.co` (verificados) y `pedro@demo.co` (en revisión); estudiantes `sofia@demo.co` (colegio privado, menor) y `daniel@demo.co` (colegio público); administrador `admin@demo.co`.

### Variables de entorno

| Variable | Descripción |
|---|---|
| `PORT` (3100), `DB_PATH` (`data/artia.db`) | Puerto y archivo SQLite |
| `NODE_ENV=production` | Cookies `Secure` (requiere HTTPS) y desactiva pagos simulados |
| `BASE_URL` | URL pública (p. ej. `https://artia.co`); Wompi vuelve a `BASE_URL/api/pagos/retorno` |
| `RESEND_API_KEY`, `EMAIL_REMITENTE` | Correos con Resend. `EMAIL_REMITENTE` debe usar un dominio verificado en Resend, p. ej. `Artia <avisos@tudominio.com>`. Sin ellas no se envía ningún correo |
| `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` | Llaves de Wompi. Con `pub_test_…` usa el sandbox; con `pub_prod_…`, producción |
| `PAGOS_SIMULADOS=1` | Solo desarrollo: aprueba pagos sin Wompi |
| `PRECIO_MENTOR` (59900), `PRECIO_ESTUDIANTE` (24900) | Precio mensual en COP |
| `KYC_AUTO_APROBAR` (1) | `0` para que el administrador apruebe siempre, aunque el KYC coincida |
| `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID`, `DIDIT_WEBHOOK_SECRET` | Activan el KYC con Didit (ver «Conectar Didit») |
| `KYC_SIMULADO=1` | Solo desarrollo: simula los resultados del proveedor de KYC (nunca en producción) |
| `EMPRESA_RAZON_SOCIAL`, `EMPRESA_NIT`, `EMPRESA_DIRECCION`, `EMPRESA_CORREO`, `EMPRESA_CIUDAD` | Datos de la empresa en los Términos y la Política de privacidad |
| `SOPORTE_CONTACTO` | Correo o WhatsApp de soporte (pie de página y «¿Olvidaste tu contraseña?») |
| `LEGAL_REVISADO=1` | Quita el aviso de «borrador» de los textos legales (solo cuando un abogado los apruebe) |
| `KYC_PROVEEDOR=manual` | Apaga Didit y usa la revisión manual de documentos, sin borrar las llaves |
| `LIMITE_REGISTROS_HORA` (20) | Cuentas que se pueden crear por hora desde una misma conexión |
| `ADMIN_EMAILS` | Correos (separados por coma) que son administradores al registrarse |

### Configurar Wompi

1. Crea tu cuenta en [Wompi](https://comercios.wompi.co) y copia las llaves de pruebas (**Desarrolladores → Secretos**).
2. En el panel de Wompi configura la URL de eventos: `BASE_URL/api/wompi/eventos`.
3. Arranca con las variables anteriores. El pago se confirma de dos formas: al volver el usuario (el servidor consulta la transacción a Wompi, no confía en la URL) y por el webhook (firma verificada). Ambas son idempotentes.

## Estructura

- `server.mjs` — núcleo: acceso, perfiles, clases, solicitudes, despachador HTTP.
- `agenda.mjs` — horarios, disponibilidad, reservas y reseñas.
- `suscripcion.mjs` — pagos y suscripción (Wompi).
- `verificacion.mjs` — documentos y revisión del administrador.
- `supabase/schema.sql` — esquema equivalente para PostgreSQL/Supabase (preparado, sin probar).
- `db.mjs`, `colombia.mjs`, `helpers.mjs` — esquema SQLite, datos de Colombia (ciudades, 20 localidades de Bogotá), utilidades.
- `public/` — interfaz (HTML/CSS/JS sin build, rutas con `#`). `demo.mjs`, `test.mjs`.

## Desplegar (Railway)

1. Crea una cuenta en [railway.com](https://railway.com) y entra con GitHub (da acceso al repositorio `atria`).
2. **New Project → Deploy from GitHub repo** → `csmfntch/atria`. Railway detecta Node y usa `npm start`.
3. En el servicio: **Settings → Volumes → Add Volume** con mount path `/data`. Ahí vive la base de datos SQLite; Atria la encuentra sola (`RAILWAY_VOLUME_MOUNT_PATH`). **Sin volumen se pierden los datos en cada despliegue.**
4. **Settings → Networking → Generate Domain** para tener una URL pública. En **Settings → Deploy** pon el *Healthcheck Path* `/api/salud`.
5. **Variables** (pestaña Variables del servicio):
   - `NODE_ENV=production`, `TRUST_PROXY=1`
   - `ADMIN_EMAILS` (tu correo), `BASE_URL` (la URL pública; si no la pones usa `RAILWAY_PUBLIC_DOMAIN`)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (la llave secreta)
   - `PRECIO_ESTUDIANTE=24900`, `PRECIO_MENTOR=59900` (ya son los valores por defecto)
   - Wompi cuando las tengas: `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`
6. Abre la URL, regístrate con el correo de `ADMIN_EMAILS` y ya eres administrador.
7. Dominio propio: Settings → Networking → Custom Domain (HTTPS automático). Actualiza `BASE_URL`.
8. Wompi: en su panel pon la URL de eventos `BASE_URL/api/wompi/eventos`.

También sirve cualquier host con servidor Node y volumen persistente (Fly.io, un VPS…). **No uses hosting estático** (Netlify, Vercel…): Artia necesita un servidor Node.

## Administración y soporte

En **Administración** (cuentas de `ADMIN_EMAILS`): *Verificaciones* de mentores, *Usuarios* (buscar, **suspender/reactivar**, **clave temporal** para quien olvidó su contraseña: se muestra una sola vez y el usuario debe cambiarla al entrar) y *Reseñas* (eliminar las inapropiadas). Cada usuario puede **cambiar su contraseña** y **eliminar su cuenta** desde «Mi cuenta» (se borran datos personales, documentos y solicitudes, se desactivan sus clases y se cancelan sus reservas futuras; los pagos se conservan sin datos personales).

## Términos, privacidad y autorizaciones

- **Al crear la cuenta** es obligatorio aceptar los *Términos y Condiciones* y la *Política de Tratamiento de Datos* (casilla). Se guarda la **versión** y la **fecha y hora**. Los **mentores** además dan una **autorización expresa** para tratar su cédula, selfie (dato biométrico, sensible) y título; esa autorización se guarda con fecha, se exige antes de subir documentos o iniciar la verificación, y se informa a Didit como consentimiento ya recogido. Los estudiantes menores de edad registran a su acudiente.
- Las páginas están en `#/terminos` y `#/privacidad` (enlaces también en el pie). El texto vive en `public/legal.js` y es un **BORRADOR**: debe revisarlo un abogado colombiano y completarse (razón social, NIT, dirección, correo, ciudad, plazos de conservación, política de reembolsos). Cuando esté aprobado, pon `BORRADOR = false`.
- Si cambias el contenido legal, sube `TERMINOS_VERSION` en `colombia.mjs`: a todos los usuarios se les pedirá aceptar de nuevo.

## Conectar Didit (KYC)

1. En la [consola de Didit](https://business.didit.me) crea un **workflow** de verificación (KYC) que incluya: verificación del documento (ID), prueba de vida (liveness), comparación de rostro (face match) y, si está disponible para Colombia, validación de la cédula contra el registro (database validation). Si falta liveness o face match, el mentor nunca se verifica solo: pasa a revisión manual.
2. Copia el **ID del workflow** y tu **API key** (Developers → API keys; usa una `sk_test_…` de sandbox para probar).
3. En la consola de Didit crea un **destino de webhook**: URL `BASE_URL/api/kyc/webhook`, versión **v3**, evento **`status.updated`**. Copia su **secreto** (`secret_shared_key`).
4. En el servidor define `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID` y `DIDIT_WEBHOOK_SECRET`. Con las tres, el KYC queda activo; sin ellas se usa la revisión manual de documentos.
5. Prueba con un mentor nuevo en sandbox. Si usas «allowed domains» en Didit, agrega `BASE_URL`: Didit devuelve al mentor a `BASE_URL/api/kyc/retorno`.

Seguridad del webhook: se verifica la firma HMAC-SHA256 (`X-Signature` sobre los bytes recibidos o `X-Signature-V2`, y sus variantes `-Previous` al rotar el secreto) y que `X-Timestamp` no tenga más de 5 minutos. **No** se acepta `X-Signature-Simple`, porque no firma la decisión. Los eventos desordenados no pisan resultados más recientes.

## Supabase

Proyecto conectado y esquema creado (`supabase/schema.sql`: 11 tablas con RLS activado y sin políticas, y el bucket privado `documentos-verificacion`).

**Ya funciona:** los documentos de verificación (cédula y título) se guardan en el **bucket privado de Supabase Storage** cuando el servidor arranca con `SUPABASE_URL` (y `SUPABASE_SERVICE_ROLE_KEY` con la llave secreta). Sin esas variables se guardan en la base local (modo desarrollo). Solo el administrador puede leerlos, a través del servidor; el bucket no tiene acceso público. Probado contra el proyecto real: subir, reemplazar (borra el anterior), leer y confirmar que la URL pública falla.

**Falta:** portar el resto de los datos (usuarios, clases, reservas, pagos…) de SQLite a Supabase. Es un cambio grande porque muchas consultas hacen uniones, promedios de reseñas y cruces de horarios que la API web de Supabase no resuelve sola: requiere vistas y funciones SQL en Postgres, reescribir los manejadores como asíncronos y decidir cómo probarlo (el proyecto real o una base local). Mientras tanto el servidor necesita disco persistente para el archivo SQLite.

La llave secreta (`sb_secret_…` / `service_role`) vive solo en el servidor y nunca debe llegar al navegador ni a GitHub.

## Pendiente antes de producción

- **Cobro recurrente automático:** hoy cada mes se renueva con un pago manual. El débito automático requiere fuentes de pago tokenizadas de Wompi.
- **Documentos sensibles:** con Supabase quedan en un bucket privado; define cuánto tiempo conservas las cédulas tras verificar (y bórralas cuando ya no se necesiten). Sin Supabase se guardan en la base local sin cifrar.
- **Menores de edad y datos personales:** valida con un abogado el consentimiento del acudiente y la política de tratamiento de datos (Ley 1581 de 2012, Habeas Data; datos de menores). Falta redactar términos y política.
- Correo de verificación y recuperación de contraseña, notificaciones por correo/WhatsApp, moderación de reseñas, recordatorios de clase.
- Detrás de un proxy, el límite de intentos de login usa la IP del socket: configura el proxy para pasar la IP real.
