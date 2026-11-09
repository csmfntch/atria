// Datos de ejemplo para probar la app (npm run demo). Contraseña de todos: demo12345
import { hoyCol, sumarDias, sqlAhora } from './helpers.mjs';

// PNG de 1×1 píxel: documento de ejemplo para la cola de verificación.
const PNG_EJEMPLO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');

export function sembrar(db, { hashClave }) {
  if (db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n > 0) return;
  const hash = hashClave('demo12345');
  const vence = sqlAhora(Date.now() + 30 * 24 * 3600 * 1000);

  const mentor = (email, nombre, ciudad, tel, bio, materias, tarifa, mod, exp, doc, estado) => {
    const id = Number(db.prepare(`INSERT INTO usuarios
      (email, pass_hash, rol, nombre, ciudad, telefono, bio, materias, tarifa, modalidad, experiencia, documento, verificacion_estado)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(email, hash, 'profesor', nombre, ciudad, tel, bio, materias, tarifa, mod, exp, doc, estado).lastInsertRowid);
    if (estado !== 'sin_enviar') {
      db.prepare('INSERT INTO documentos (usuario_id, tipo, mime, datos) VALUES (?,?,?,?)').run(id, 'cedula', 'image/png', PNG_EJEMPLO);
      db.prepare('INSERT INTO documentos (usuario_id, tipo, mime, datos) VALUES (?,?,?,?)').run(id, 'titulo', 'image/png', PNG_EJEMPLO);
    }
    if (estado === 'verificado') db.prepare('INSERT INTO suscripciones (usuario_id, vence) VALUES (?,?)').run(id, vence);
    return id;
  };
  const horario = (id, dias, inicio, fin) => dias.forEach((d) => db.prepare('INSERT INTO horarios (profesor_id, dia, inicio, fin) VALUES (?,?,?,?)').run(id, d, inicio, fin));
  const clase = db.prepare(`INSERT INTO clases
    (profesor_id, titulo, materia, nivel, descripcion, precio_hora, duracion_min, modalidad, ciudad)
    VALUES (?,?,?,?,?,?,?,?,?)`);

  const laura = mentor('laura@demo.co', 'Laura Gómez', 'Bogotá D.C.', '3001234567',
    'Licenciada en Matemáticas de la Universidad Nacional. Me encanta que los números dejen de dar miedo.',
    'Matemáticas, Cálculo, Preparación Saber 11', 45000, 'ambas', '8 años dando refuerzo escolar y preuniversitario.', '52123456', 'verificado');
  const andres = mentor('andres@demo.co', 'Andrés Restrepo', 'Medellín', '3109876543',
    'Ingeniero de sistemas. Enseño programación desde cero, con proyectos reales.',
    'Programación, Excel y ofimática', 60000, 'virtual', '6 años como desarrollador y mentor en bootcamps.', '71654321', 'verificado');
  const camila = mentor('camila@demo.co', 'Camila Ortiz', 'Cali', '3155550101',
    'Profesora de inglés certificada (IELTS 8.0). Clases de conversación y preparación de exámenes.',
    'Inglés', 50000, 'ambas', '10 años en institutos de idiomas.', '31987654', 'verificado');
  mentor('pedro@demo.co', 'Pedro Salazar', 'Bogotá D.C.', '3201112233',
    'Químico con experiencia en preparación para Saber 11.', 'Química, Biología', 40000, 'virtual',
    '5 años en colegios públicos de Bogotá.', '80111222', 'pendiente');

  horario(laura, [1, 2, 3, 4, 5], '14:00', '18:00'); horario(laura, [6], '09:00', '12:00');
  horario(andres, [1, 2, 3, 4, 5], '18:00', '21:00');
  horario(camila, [2, 4], '16:00', '20:00'); horario(camila, [6], '08:00', '12:00');

  const c1 = Number(clase.run(laura, 'Refuerzo de matemáticas para bachillerato', 'Matemáticas', 'Bachillerato', 'Álgebra, geometría y trigonometría con ejercicios al estilo del colegio.', 40000, 60, 'ambas', 'Bogotá D.C.').lastInsertRowid);
  clase.run(laura, 'Preparación intensiva Saber 11 — matemáticas', 'Preparación Saber 11', 'Bachillerato', 'Simulacros, estrategias de tiempo y repaso de los temas más evaluados.', 55000, 90, 'virtual', '');
  clase.run(andres, 'Python desde cero', 'Programación', 'Adultos / profesional', 'Aprende a programar con Python haciendo pequeños proyectos útiles.', 60000, 60, 'virtual', '');
  clase.run(andres, 'Excel para el trabajo', 'Excel y ofimática', 'Adultos / profesional', 'Tablas dinámicas, fórmulas y reportes para tu oficina.', 45000, 60, 'virtual', '');
  const c5 = Number(clase.run(camila, 'Inglés conversacional', 'Inglés', 'Adultos / profesional', 'Pierde el miedo a hablar con conversación guiada sobre temas de tu día a día.', 50000, 60, 'ambas', 'Cali').lastInsertRowid);

  const est = db.prepare(`INSERT INTO usuarios
    (email, pass_hash, rol, nombre, ciudad, telefono, bio, nivel, intereses, colegio_tipo, colegio_nombre, localidad, grado, es_menor, acudiente_nombre, acudiente_celular, es_admin)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const sofia = Number(est.run('sofia@demo.co', hash, 'estudiante', 'Sofía Martínez', 'Bogotá D.C.', '', 'Estudiante de grado 11, quiero mejorar mi puntaje en el Saber 11.',
    'Bachillerato', 'Matemáticas, Inglés', 'privado', 'Colegio Los Nogales', 'Usaquén', '11°', 1, 'Marta Pérez', '3205550202', 0).lastInsertRowid);
  const daniel = Number(est.run('daniel@demo.co', hash, 'estudiante', 'Daniel Rojas', 'Bogotá D.C.', '3017778899', 'Me cuesta el álgebra, necesito ayuda constante.',
    'Bachillerato', 'Matemáticas', 'publico', 'IED Kennedy', 'Kennedy', '10°', 0, '', '', 0).lastInsertRowid);
  est.run('admin@demo.co', hash, 'estudiante', 'Administración Artia', 'Bogotá D.C.', '', '', '', '', 'ninguno', '', '', '', 0, '', '', 1);
  for (const id of [sofia, daniel]) db.prepare('INSERT INTO suscripciones (usuario_id, vence) VALUES (?,?)').run(id, vence);

  // Clases pasadas con reseñas
  const hoy = hoyCol();
  const pasada = db.prepare(`INSERT INTO reservas (clase_id, profesor_id, estudiante_id, fecha, hora, duracion_min, estado, mensaje) VALUES (?,?,?,?,?,?,'aceptada',?)`);
  const resena = db.prepare('INSERT INTO resenas (reserva_id, profesor_id, estudiante_id, calificacion, comentario) VALUES (?,?,?,?,?)');
  const r1 = Number(pasada.run(c1, laura, sofia, sumarDias(hoy, -3), '15:00', 60, 'Repaso de trigonometría').lastInsertRowid);
  resena.run(r1, laura, sofia, 5, 'Explica con mucha paciencia y los ejemplos son muy claros. Subí mi puntaje en el simulacro.');
  const r2 = Number(pasada.run(c1, laura, daniel, sumarDias(hoy, -8), '16:00', 60, '').lastInsertRowid);
  resena.run(r2, laura, daniel, 4, 'Muy buena clase, aunque se quedó corta la hora.');
  const r3 = Number(pasada.run(c5, camila, sofia, sumarDias(hoy, -10), '16:00', 60, '').lastInsertRowid);
  resena.run(r3, camila, sofia, 5, 'Camila hace que hablar inglés sea divertido.');

  db.prepare(`INSERT INTO solicitudes (estudiante_id, materia, descripcion, presupuesto, modalidad, ciudad) VALUES (?,?,?,?,?,?)`)
    .run(sofia, 'Preparación Saber 11', 'Necesito reforzar matemáticas y lectura crítica. Puedo dos tardes por semana.', 40000, 'virtual', 'Bogotá D.C.');

  console.log('Datos de ejemplo cargados (contraseña demo12345):\n' +
    '  mentores: laura@demo.co, andres@demo.co, camila@demo.co (verificados) · pedro@demo.co (en revisión)\n' +
    '  estudiantes: sofia@demo.co (colegio privado, menor) · daniel@demo.co (colegio público)\n' +
    '  administrador: admin@demo.co');
}
