# Artia

Plataforma en español para conectar **mentores** (profesores) y **estudiantes** en Colombia. Precios en COP, ciudades colombianas, hora de Colombia (GMT-5), celulares `3XX XXX XXXX` y contacto por WhatsApp.

## Qué hace

**Acceso:** ingreso y registro separados por rol («Soy estudiante» / «Soy mentor»).

**Estudiante**
- Perfil con ciudad, grado y **colegio público o privado** (nombre y localidad de Bogotá). Los mentores solo ven el grado y el tipo de colegio, nunca el nombre.
- Si es menor de 18 años registra a su **acudiente**; al mentor se le comparte el celular del acudiente, no el del menor.
- Busca clases (texto, materia, ciudad, modalidad, precio) y **reserva un horario** disponible del mentor.
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
| `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` | Llaves de Wompi. Con `pub_test_…` usa el sandbox; con `pub_prod_…`, producción |
| `PAGOS_SIMULADOS=1` | Solo desarrollo: aprueba pagos sin Wompi |
| `PRECIO_MENTOR` (49900), `PRECIO_ESTUDIANTE` (19900) | Precio mensual en COP (**valores de ejemplo**, defínelos tú) |
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
- `db.mjs`, `colombia.mjs`, `helpers.mjs` — esquema SQLite, datos de Colombia (ciudades, 20 localidades de Bogotá), utilidades.
- `public/` — interfaz (HTML/CSS/JS sin build, rutas con `#`). `demo.mjs`, `test.mjs`.

## Pendiente antes de producción

- **Hosting:** servidor Node con disco persistente (Render, Railway, Fly.io, VPS).
- **Cobro recurrente automático:** hoy cada mes se renueva con un pago manual. El débito automático requiere fuentes de pago tokenizadas de Wompi.
- **Documentos sensibles:** las cédulas se guardan en la base de datos sin cifrar. Cifra el disco/la BD, limita el acceso y define cuánto tiempo las conservas.
- **Menores de edad y datos personales:** valida con un abogado el consentimiento del acudiente y la política de tratamiento de datos (Ley 1581 de 2012, Habeas Data; datos de menores). Falta redactar términos y política.
- Correo de verificación y recuperación de contraseña, notificaciones por correo/WhatsApp, moderación de reseñas, recordatorios de clase.
- Detrás de un proxy, el límite de intentos de login usa la IP del socket: configura el proxy para pasar la IP real.
