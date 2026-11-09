// Proveedor de KYC: Didit (https://didit.me). Documentación: docs.didit.me
//
//  • Crear sesión:  POST https://verification.didit.me/v3/session/   (cabecera x-api-key)
//                   → { session_id, url }; el mentor completa foto de cédula + selfie en `url`
//                   y Didit lo devuelve a `callback` con ?verificationSessionId=…&status=…
//  • Resultado:     webhook `status.updated` firmado con HMAC-SHA256 (secreto del destino en la consola de Didit)
//
// Seguridad del webhook: se verifica la firma ANTES de leer el contenido. Se acepta X-Signature (bytes exactos
// recibidos) o X-Signature-V2 (JSON canónico), y sus variantes -Previous durante los 24 h posteriores a rotar el
// secreto. NO se acepta X-Signature-Simple: solo firma el sobre y no el cuerpo (la decisión), así que no sirve
// para decidir una verificación de identidad.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { TERMINOS_VERSION } from './colombia.mjs';

const API = 'https://verification.didit.me';
const TOLERANCIA_S = 300;

/** JSON canónico de Didit (V2): llaves ordenadas por punto de código, sin espacios, Unicode sin escapar. */
export function canonico(v) {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    return `{${Object.keys(v).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).map((k) => `${JSON.stringify(k)}:${canonico(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}
const hmac = (secreto, datos) => createHmac('sha256', secreto).update(datos).digest('hex');
const iguales = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
const cab = (headers, nombre) => [headers[nombre], headers[`${nombre}-previous`]].filter(Boolean);

/** Devuelve el evento (objeto) si la firma y la fecha son válidas; si no, null. */
export function verificarFirma(crudo, headers, secreto, ahoraS = Math.floor(Date.now() / 1000)) {
  if (!secreto || !Buffer.isBuffer(crudo) || !crudo.length) return null;
  const ts = Number.parseInt(headers['x-timestamp'], 10);
  if (!Number.isFinite(ts) || Math.abs(ahoraS - ts) > TOLERANCIA_S) return null;
  let evento;
  try { evento = JSON.parse(crudo.toString('utf8')); } catch { return null; }
  if (evento === null || typeof evento !== 'object') return null;
  const bytes = hmac(secreto, crudo);
  if (cab(headers, 'x-signature').some((f) => iguales(f, bytes))) return evento;
  const v2 = cab(headers, 'x-signature-v2');
  if (v2.length) { const c = hmac(secreto, canonico(evento)); if (v2.some((f) => iguales(f, c))) return evento; }
  return null;
}

// Los estados de Didit son 'Approved', 'In Review', 'Kyc Expired'…; se comparan sin distinguir mayúsculas ni espacios.
const clave = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, '');
const ESTADOS = { approved: 'aprobado', declined: 'rechazado', inreview: 'revision', abandoned: 'rechazado', expired: 'rechazado', kycexpired: 'rechazado' };
const todos = (lista) => (Array.isArray(lista) && lista.length ? lista.every((x) => clave(x?.status) === 'approved') : null);

/** Evento `status.updated` de Didit → resultado normalizado para kyc.mjs (null si no es un evento de sesión). */
export function aResultado(evento) {
  if (evento?.webhook_type !== 'status.updated' || !evento.session_id) return null;
  const d = evento.decision ?? {};
  const ids = Array.isArray(d.id_verifications) ? d.id_verifications : [];
  const id = ids.find((x) => clave(x?.status) === 'approved') ?? ids[0] ?? {};
  return {
    sesionId: evento.session_id,
    estado: ESTADOS[clave(evento.status)] ?? 'pendiente',
    numeroDocumento: [id.document_number, id.personal_number].filter(Boolean),
    nombreCompleto: id.full_name ?? [id.first_name, id.last_name].filter(Boolean).join(' '),
    rostroCoincide: todos(d.face_matches),
    vivo: todos(d.liveness_checks),
    registroCoincide: todos(d.database_validations),
    eventoTs: Number.isFinite(evento.created_at) ? evento.created_at : null,
  };
}

export function proveedorDidit({ apiKey, workflowId, webhookSecret, baseUrl, fetchFn = globalThis.fetch }) {
  return {
    nombre: 'didit',
    modo: 'didit',
    async crearSesion({ usuario }) {
      const r = await fetchFn(`${API}/v3/session/`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          workflow_id: workflowId,
          vendor_data: `artia-mentor-${usuario.id}`,
          // Didit añade ?verificationSessionId=…&status=… al volver; por eso pasa por el servidor (no por la ruta con #).
          callback: `${baseUrl}/api/kyc/retorno`,
          callback_method: 'both',
          language: 'es',
          contact_details: { email: usuario.email, send_notification_emails: false, email_lang: 'es' },
          expected_details: { id_country: 'COL', ...(usuario.documento ? { identification_number: usuario.documento } : {}), expected_document_types: ['ID'] },
          metadata: { usuario_id: usuario.id },
          // Ya recogimos la autorización expresa del mentor: Didit no la vuelve a pedir y la deja registrada en la decisión.
          ...(usuario.verificacion_autorizada ? { biometric_consent: { given_at: new Date(usuario.verificacion_autorizada.replace(' ', 'T') + 'Z').toISOString(), text_version: TERMINOS_VERSION } } : {}),
        }),
      });
      if (!r.ok) throw new Error(`Didit ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const d = await r.json();
      if (!d.session_id || !d.url) throw new Error('Didit: respuesta sin session_id o url');
      return { sesionId: d.session_id, url: d.url };
    },
    verificarWebhook: (crudo, headers) => verificarFirma(crudo, headers, webhookSecret),
    aResultado,
  };
}
