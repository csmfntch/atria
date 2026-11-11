// Avisos por correo: nueva reserva, cambios de estado, ofertas, recordatorio 24 h antes y petición de reseña.
import { aMinutos, hoyCol, minutosAhoraCol, sumarDias } from './helpers.mjs';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const cop = (n) => '$' + Number(n).toLocaleString('es-CO');
const cuando = (fecha, hora) => {
  const d = new Date(`${fecha}T12:00:00Z`);
  const [h, m] = hora.split(':').map(Number);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}, ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'} (hora de Colombia)`;
};

export function crearNotificador({ q, correo, baseUrl, mantenimiento }) {
  const enlace = (hash, texto) => ({ texto, url: `${baseUrl}/#/${hash}` });
  const reserva = (id) => q(`SELECT r.*, c.titulo, c.materia, e.nombre AS est_nombre, e.email AS est_email, e.suspendido AS est_susp,
      p.nombre AS prof_nombre, p.email AS prof_email, p.suspendido AS prof_susp
    FROM reservas r JOIN clases c ON c.id = r.clase_id JOIN usuarios e ON e.id = r.estudiante_id JOIN usuarios p ON p.id = r.profesor_id WHERE r.id = ?`).get(id);
  const valido = (email, susp) => email && !susp && !email.endsWith('@artia.invalid');
  const enviar = (para, susp, datos) => { if (correo.activo && valido(para, susp)) void correo.enviar({ para, ...datos }); };
  const nombre1 = (n) => String(n).split(' ')[0];

  return {
    /** El pago de la clase se confirmó: avisa al mentor (que ya puede aceptarla) y al estudiante. */
    reservaPagada(id) {
      const r = reserva(id); if (!r) return;
      enviar(r.prof_email, r.prof_susp, {
        asunto: `Nueva solicitud de reserva: ${r.titulo}`, titulo: 'Tienes una nueva solicitud de reserva',
        parrafos: [`Hola ${nombre1(r.prof_nombre)}, ${r.est_nombre} quiere tomar «${r.titulo}» el ${cuando(r.fecha, r.hora)}.`, ...(r.mensaje ? [`Mensaje: “${r.mensaje}”`] : []), 'Acéptala o recházala desde tu agenda para que el estudiante lo sepa.'],
        boton: enlace('agenda', 'Ver mi agenda'),
      });
      enviar(r.est_email, r.est_susp, {
        asunto: `Pago recibido: ${r.titulo}`, titulo: 'Recibimos tu pago',
        parrafos: [`Hola ${nombre1(r.est_nombre)}, recibimos tu pago de ${cop(r.monto_cop)} por «${r.titulo}» (${cuando(r.fecha, r.hora)}).`, `Ahora ${r.prof_nombre} debe aceptar tu reserva. Si no la acepta o no puede darte la clase, te devolvemos el valor completo.`],
        boton: enlace('agenda', 'Ver mi agenda'),
      });
    },
    devuelta(id) {
      const r = reserva(id); if (!r) return;
      enviar(r.est_email, r.est_susp, {
        asunto: `Devolución realizada: ${r.titulo}`, titulo: 'Te devolvimos tu pago',
        parrafos: [`Hola ${nombre1(r.est_nombre)}, hicimos la devolución de ${cop(r.monto_cop)} de «${r.titulo}». Según tu banco o medio de pago, puede tardar unos días en verse reflejada.`],
      });
    },
    liquidacion(profId, mes, neto, referencia) {
      const p = q('SELECT nombre, email, suspendido FROM usuarios WHERE id = ?').get(profId); if (!p) return;
      enviar(p.email, p.suspendido, {
        asunto: `Te pagamos las clases de ${mes}`, titulo: 'Pago de tus clases',
        parrafos: [`Hola ${nombre1(p.nombre)}, te transferimos ${cop(neto)} por tus clases de ${mes} (ya descontada la comisión de Artia). Referencia: ${referencia}.`],
        boton: enlace('ganancias', 'Ver mis ganancias'),
      });
    },
    /** `por`: id de quien hizo el cambio. */
    reservaEstado(id, estado, por) {
      const r = reserva(id); if (!r) return;
      const cuandoTxt = cuando(r.fecha, r.hora);
      if (estado === 'aceptada') enviar(r.est_email, r.est_susp, {
        asunto: `Reserva confirmada: ${r.titulo}`, titulo: '¡Tu clase está confirmada!',
        parrafos: [`Hola ${nombre1(r.est_nombre)}, ${r.prof_nombre} aceptó tu reserva de «${r.titulo}» para el ${cuandoTxt}.`, 'Ya puedes ver su contacto en tu agenda y agregar la clase a tu calendario.'],
        boton: enlace('agenda', 'Ver mi agenda'),
      });
      else if (estado === 'rechazada') enviar(r.est_email, r.est_susp, {
        asunto: `Tu reserva no fue aceptada: ${r.titulo}`, titulo: 'Tu reserva no pudo confirmarse',
        parrafos: [`Hola ${nombre1(r.est_nombre)}, ${r.prof_nombre} no pudo aceptar tu reserva de «${r.titulo}» del ${cuandoTxt}.`, 'Te devolveremos el valor completo de la clase. Puedes elegir otro horario u otro mentor.'],
        boton: enlace('clase/' + r.clase_id, 'Elegir otro horario'),
      });
      else if (estado === 'cancelada') {
        const porEst = por === r.estudiante_id;
        enviar(porEst ? r.prof_email : r.est_email, porEst ? r.prof_susp : r.est_susp, {
          asunto: `Clase cancelada: ${r.titulo}`, titulo: 'Se canceló una clase',
          parrafos: [`Hola ${nombre1(porEst ? r.prof_nombre : r.est_nombre)}, ${porEst ? r.est_nombre : r.prof_nombre} canceló «${r.titulo}» del ${cuandoTxt}.`],
          boton: enlace('agenda', 'Ver mi agenda'),
        });
      }
    },
    oferta(solicitudId, profId) {
      const s = q(`SELECT s.materia, e.nombre, e.email, e.suspendido FROM solicitudes s JOIN usuarios e ON e.id = s.estudiante_id WHERE s.id = ?`).get(solicitudId);
      const p = q('SELECT nombre FROM usuarios WHERE id = ?').get(profId);
      if (!s || !p) return;
      enviar(s.email, s.suspendido, {
        asunto: `${p.nombre} respondió tu solicitud de ${s.materia}`, titulo: 'Recibiste una oferta de un mentor',
        parrafos: [`Hola ${nombre1(s.nombre)}, ${p.nombre} te envió una oferta para tu solicitud de ${s.materia}.`],
        boton: enlace('solicitudes', 'Ver la oferta'),
      });
    },
    /** Se ejecuta cada pocos minutos: recordatorio 24 h antes y petición de reseña ~30 min después de la clase. */
    procesar() {
      mantenimiento?.();
      if (!correo.activo) return;
      const hoy = hoyCol(), ahora = minutosAhoraCol();
      for (const r of q(`SELECT id, fecha, hora, duracion_min FROM reservas WHERE estado = 'aceptada' AND aviso_recordatorio = 0 AND fecha BETWEEN ? AND ?`).all(hoy, sumarDias(hoy, 1))) {
        const falta = (r.fecha > hoy ? 1440 : 0) + aMinutos(r.hora) - ahora;
        if (falta <= 0 || falta > 1440) continue;
        q('UPDATE reservas SET aviso_recordatorio = 1 WHERE id = ?').run(r.id);
        const x = reserva(r.id);
        for (const [email, susp, nom, otro] of [[x.est_email, x.est_susp, x.est_nombre, x.prof_nombre], [x.prof_email, x.prof_susp, x.prof_nombre, x.est_nombre]]) {
          enviar(email, susp, {
            asunto: `Recordatorio: ${x.titulo} es mañana`, titulo: 'Tu clase es pronto',
            parrafos: [`Hola ${nombre1(nom)}, te recordamos tu clase «${x.titulo}» con ${otro}: ${cuando(x.fecha, x.hora)}.`],
            boton: enlace('agenda', 'Ver mi agenda'),
          });
        }
      }
      for (const r of q(`SELECT id, fecha, hora, duracion_min FROM reservas r WHERE estado = 'aceptada' AND aviso_resena = 0 AND fecha BETWEEN ? AND ?
          AND NOT EXISTS (SELECT 1 FROM resenas WHERE reserva_id = r.id)`).all(sumarDias(hoy, -7), hoy)) {
        const termino = aMinutos(r.hora) + r.duracion_min + 30;
        if (r.fecha === hoy && termino > ahora) continue;
        q('UPDATE reservas SET aviso_resena = 1 WHERE id = ?').run(r.id);
        const x = reserva(r.id);
        enviar(x.est_email, x.est_susp, {
          asunto: `¿Cómo te fue en tu clase con ${x.prof_nombre}?`, titulo: '¿Cómo fue tu clase?',
          parrafos: [`Hola ${nombre1(x.est_nombre)}, esperamos que tu clase «${x.titulo}» con ${x.prof_nombre} haya salido muy bien.`, 'Califícala con estrellas (escribir un comentario es opcional): ayuda a otros estudiantes y a tu mentor.'],
          boton: enlace('agenda', 'Calificar mi clase'),
        });
      }
    },
  };
}
