// Almacén de documentos de verificación en Supabase Storage (bucket PRIVADO).
// Si no hay SUPABASE_URL, el servidor guarda los documentos en la base de datos local (modo desarrollo).
//
// La llave secreta (service_role / sb_secret_…) vive solo en el servidor. En esta sesión de desarrollo el proxy
// la inyecta, por eso SUPABASE_SERVICE_ROLE_KEY puede faltar (se envía un marcador que el proxy reemplaza).
const BUCKET = 'documentos-verificacion';

export function crearAlmacen({ url, key, fetchFn = globalThis.fetch }) {
  const base = `${url.replace(/\/$/, '')}/storage/v1/object/${BUCKET}`;
  const cabeceras = { apikey: key || 'proxy-injected' };
  const objeto = (ruta) => `${base}/${ruta.split('/').map(encodeURIComponent).join('/')}`;
  const falla = async (r, que) => { throw new Error(`Supabase Storage (${que}): ${r.status} ${(await r.text()).slice(0, 200)}`); };

  return {
    async guardar(ruta, buffer, mime) {
      const r = await fetchFn(objeto(ruta), { method: 'POST', headers: { ...cabeceras, 'Content-Type': mime, 'x-upsert': 'true' }, body: buffer });
      if (!r.ok) await falla(r, 'subir');
    },
    async leer(ruta) {
      const r = await fetchFn(objeto(ruta), { headers: cabeceras });
      if (!r.ok) await falla(r, 'leer');
      return Buffer.from(await r.arrayBuffer());
    },
    async borrar(ruta) {
      const r = await fetchFn(objeto(ruta), { method: 'DELETE', headers: cabeceras });
      if (!r.ok && r.status !== 404) await falla(r, 'borrar');
    },
  };
}
