// Envío de correos con Resend (https://resend.com). Sin RESEND_API_KEY + EMAIL_REMITENTE queda desactivado y no envía nada.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Plantilla HTML sencilla con la marca de Artia. `parrafos` es texto plano (se escapa). */
export function plantilla({ titulo, parrafos, boton, baseUrl }) {
  const ps = parrafos.map((p) => `<p style="margin:0 0 14px;line-height:1.55;color:#2a2233">${esc(p)}</p>`).join('');
  const b = boton ? `<p style="margin:22px 0"><a href="${esc(boton.url)}" style="background:#FFC83D;color:#1c1524;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;display:inline-block">${esc(boton.texto)}</a></p>` : '';
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f6f3fa;font-family:Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#432C7A;color:#fff;padding:18px 24px;border-radius:14px 14px 0 0;font-family:Georgia,serif;letter-spacing:.2em;font-size:20px">ARTIA</div>
<div style="background:#fff;padding:26px 24px;border-radius:0 0 14px 14px">
<h1 style="margin:0 0 16px;font-size:20px;color:#432C7A">${esc(titulo)}</h1>${ps}${b}
<p style="margin:24px 0 0;font-size:12px;color:#7a7285">Recibes este correo porque tienes una cuenta en Artia. <a href="${esc(baseUrl)}" style="color:#7a7285">${esc(baseUrl.replace(/^https?:\/\//, ''))}</a></p>
</div></div></body></html>`;
}

export function crearCorreo({ apiKey, remitente, baseUrl, fetchFn = globalThis.fetch, log = console } = {}) {
  const activo = Boolean(apiKey && remitente);
  async function enviar({ para, asunto, titulo, parrafos, boton }) {
    if (!activo) return false;
    try {
      const texto = [...parrafos, boton ? `${boton.texto}: ${boton.url}` : ''].filter(Boolean).join('\n\n');
      const r = await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: remitente, to: [para], subject: asunto, html: plantilla({ titulo: titulo ?? asunto, parrafos, boton, baseUrl }), text: texto }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) { log.error(`Resend respondió ${r.status}: ${(await r.text()).slice(0, 200)}`); return false; }
      return true;
    } catch (e) { log.error('Error enviando correo:', e.message); return false; }
  }
  return { activo, enviar };
}
