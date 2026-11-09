# Atria

Plataforma en español para conectar **profesores** y **estudiantes** en Colombia. Precios en COP, ciudades colombianas, celulares con formato `3XX XXX XXXX` y contacto por WhatsApp.

## Qué hace

**Perfil de profesor**
- Perfil con ciudad, bio, materias, valor por hora, modalidad (virtual / presencial / ambas) y experiencia.
- Publica, edita, pausa y elimina **clases** (título, materia, nivel, precio por hora, duración, ciudad).
- Recibe **reservas** de estudiantes y las acepta o rechaza.
- Ve las **solicitudes** que publican los estudiantes y les envía ofertas (opcionalmente con una de sus clases).

**Perfil de estudiante**
- Perfil con ciudad, nivel educativo e intereses.
- Busca clases por texto, materia, ciudad, modalidad y precio máximo.
- Solicita una clase con un mensaje; puede cancelar.
- Publica **solicitudes** («busco clases de…») y recibe ofertas de profesores.

**Privacidad:** el celular de cada persona solo se muestra a la otra cuando el profesor acepta la reserva. Las solicitudes no exponen datos de contacto del estudiante.

## Ejecutar

Requiere **Node 22.5 o superior** (usa `node:sqlite`; no hay dependencias que instalar).

```bash
npm run demo     # arranca en http://localhost:3100 con datos de ejemplo
npm start         # arranca sin datos de ejemplo
npm test          # pruebas de la API
```

Cuentas de ejemplo (contraseña `demo12345`): `laura@demo.co`, `andres@demo.co`, `camila@demo.co` (profesores) y `sofia@demo.co` (estudiante).

Variables de entorno: `PORT` (3100), `DB_PATH` (`data/atria.db`), `NODE_ENV=production` (cookies `Secure`, requiere HTTPS).

## Estructura

- `server.mjs` — API JSON + archivos estáticos (sesiones por cookie HttpOnly, contraseñas con scrypt).
- `db.mjs` — esquema SQLite.
- `colombia.mjs` — ciudades, materias, niveles y validación de celular colombiano.
- `public/` — interfaz (HTML/CSS/JS sin build, rutas con `#`).
- `demo.mjs` — datos de ejemplo. `test.mjs` — pruebas.

## Pendiente antes de producción

- **Hosting:** necesita un servidor Node con disco persistente (Render, Railway, Fly.io, un VPS…). No funciona en hosting estático como el resto de este repositorio.
- **Pagos:** hoy el pago se acuerda entre las partes. Integrar PSE / Nequi / tarjetas (p. ej. Wompi o Mercado Pago).
- Verificación de correo y recuperación de contraseña, calendario de horarios, calificaciones y reseñas, moderación.
- Si despliegas detrás de un proxy, el límite de intentos de login usa la IP del socket: configura el proxy para pasar la IP real.
- Términos de uso y política de tratamiento de datos (Ley 1581 de 2012, Habeas Data).
