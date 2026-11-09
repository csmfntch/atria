// KYC (verificación de identidad) — lógica independiente del proveedor.
//
// Un proveedor (Didit, etc.) verifica la cédula con foto y selfie y nos devuelve un resultado normalizado:
//   { sesionId, estado: 'aprobado'|'rechazado'|'revision'|'pendiente',
//     numeroDocumento, nombreCompleto, rostroCoincide: bool|null, vivo: bool|null,
//     registroCoincide: bool|null (cédula contra el registro oficial, si el flujo lo incluye), eventoTs: segundos|null }
// Aquí decidimos si ese resultado coincide con lo que el mentor declaró en su perfil.
import { randomBytes } from 'node:crypto';
import { normalizarDocumento } from './colombia.mjs';

/** Minúsculas, sin tildes ni signos: «José  Núñez-Pérez» → «jose nunez perez». */
export const normalizarNombre = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * El nombre del perfil debe estar contenido en el del documento (en Colombia el documento trae
 * «APELLIDOS NOMBRES», así que no importa el orden). Se exigen al menos dos palabras para evitar coincidencias débiles.
 */
export function coincideNombre(nombrePerfil, nombreDocumento) {
  const perfil = normalizarNombre(nombrePerfil).split(' ').filter(Boolean);
  const doc = new Set(normalizarNombre(nombreDocumento).split(' ').filter(Boolean));
  return perfil.length >= 2 && perfil.every((p) => doc.has(p));
}

/** Primer número de cédula válido que trae el resultado del proveedor (o '' si no hay). */
export const primerNumero = (r) => [].concat(r.numeroDocumento ?? []).map(normalizarDocumento).find(Boolean) ?? '';

/**
 * Resultado normalizado + perfil del mentor → decisión y motivos (para mostrar al administrador).
 * El mentor ya NO escribe su cédula antes: el número sale del documento verificado. Si había uno declarado,
 * debe coincidir; `duplicada` indica que otra cuenta de mentor ya usa esa cédula.
 */
export function evaluarResultado(usuario, r, { duplicada = false } = {}) {
  if (r.estado === 'pendiente') return { kyc: 'pendiente', motivos: [] };
  if (r.estado === 'rechazado') return { kyc: 'rechazado', motivos: ['El proveedor no pudo verificar el documento.'] };
  const motivos = [];
  if (r.estado === 'revision') motivos.push('El proveedor marcó el caso para revisión manual.');
  // El número puede venir en más de un campo (p. ej. document_number y personal_number): basta con que uno coincida.
  const numeros = [].concat(r.numeroDocumento ?? []).map(normalizarDocumento).filter(Boolean);
  if (usuario.documento) { if (!numeros.includes(usuario.documento)) motivos.push('El número de cédula del documento no coincide con el declarado.'); }
  else if (!numeros.length) motivos.push('No se pudo leer el número de cédula del documento.');
  if (duplicada) motivos.push('Esa cédula ya está registrada en otra cuenta de mentor.');
  if (!coincideNombre(usuario.nombre, r.nombreCompleto)) motivos.push('El nombre del documento no coincide con el del perfil (se necesitan nombre y apellido).');
  if (r.rostroCoincide !== true) motivos.push(r.rostroCoincide === false ? 'El rostro de la selfie no coincide con la foto del documento.' : 'No se verificó el rostro contra el documento.');
  if (r.vivo !== true) motivos.push(r.vivo === false ? 'No se confirmó que la selfie fuera de una persona real (prueba de vida).' : 'No se hizo la prueba de vida.');
  if (r.registroCoincide === false) motivos.push('La cédula no coincide con los datos del registro oficial.');
  return { kyc: motivos.length ? 'revision' : 'aprobado', motivos };
}

/** Resumen que guardamos (sin imágenes ni datos de más; solo lo necesario para auditar la decisión). */
export const resumen = (proveedor, r, decision) => JSON.stringify({
  proveedor, estado_proveedor: r.estado, decision: decision.kyc, motivos: decision.motivos,
  rostro: r.rostroCoincide ?? null, vivo: r.vivo ?? null, registro: r.registroCoincide ?? null,
  evento_ts: r.eventoTs ?? null, fecha: new Date().toISOString(),
});

/**
 * Proveedor simulado SOLO para desarrollo (KYC_SIMULADO=1, nunca en producción):
 * permite probar los tres desenlaces sin pagar ni usar documentos reales.
 */
export function proveedorSimulado() {
  return {
    nombre: 'simulado',
    modo: 'simulado',
    async crearSesion() { return { sesionId: `sim-${randomBytes(6).toString('hex')}`, url: null }; },
    /** Construye el resultado normalizado de un desenlace de prueba para el mentor dado. */
    resultadoDePrueba(usuario, sesionId, desenlace) {
      if (desenlace === 'rechazado') return { sesionId, estado: 'rechazado' };
      if (desenlace === 'no_coincide') return { sesionId, estado: 'aprobado', numeroDocumento: '99999999', nombreCompleto: 'OTRA PERSONA', rostroCoincide: true, vivo: true };
      return { sesionId, estado: 'aprobado', numeroDocumento: usuario.documento || '1020304050', nombreCompleto: usuario.nombre.toUpperCase(), rostroCoincide: true, vivo: true };
    },
  };
}
