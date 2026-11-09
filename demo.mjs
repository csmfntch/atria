// Datos de ejemplo para probar la app (npm run demo). Contraseña de todos: demo12345
import { hoyCol, sumarDias, sqlAhora } from './helpers.mjs';

// PNG de 1×1 píxel: documento de ejemplo para la cola de verificación.
const PNG_EJEMPLO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');

// [email, nombre, ciudad, celular, bio, materias, tarifa, modalidad, experiencia, cédula, clases[], horario]
// clase: [título, materia, nivel, descripción, precio/h, duración, modalidad, ciudad]
const MENTORES = [
  ['laura@demo.co', 'Laura Gómez', 'Bogotá D.C.', '3001234567',
    'Licenciada en Matemáticas de la Universidad Nacional. Me encanta que los números dejen de dar miedo.',
    'Matemáticas, Física', 45000, 'ambas', '8 años dando refuerzo escolar y preuniversitario.', '52123456',
    [['Refuerzo de matemáticas para bachillerato', 'Matemáticas', 'Bachillerato', 'Álgebra, geometría y trigonometría con ejercicios al estilo del colegio.', 40000, 60, 'ambas', 'Bogotá D.C.'],
     ['Física para el Saber 11', 'Física', 'Bachillerato', 'Cinemática, dinámica y energía con simulacros tipo ICFES.', 45000, 90, 'virtual', '']],
    { dias: [1, 2, 3, 4, 5], ini: '14:00', fin: '18:00', extra: [[6, '09:00', '12:00']] }],
  ['andres@demo.co', 'Andrés Restrepo', 'Medellín', '3109876543',
    'Ingeniero de sistemas. Enseño inteligencia artificial aplicada con proyectos reales.',
    'Inteligencia artificial', 70000, 'virtual', '6 años como desarrollador y mentor en bootcamps.', '71654321',
    [['IA para tu trabajo: ChatGPT y automatización', 'Inteligencia artificial', 'Adultos / profesional', 'Aprende a usar la IA para ahorrar horas de trabajo cada semana.', 70000, 60, 'virtual', '']],
    { dias: [1, 2, 3, 4, 5], ini: '18:00', fin: '21:00' }],
  ['camila@demo.co', 'Camila Ortiz', 'Cali', '3155550101',
    'Profesora de idiomas certificada (IELTS 8.0, DELF B2). Clases de conversación y preparación de exámenes.',
    'Inglés, Francés', 50000, 'ambas', '10 años en institutos de idiomas.', '31987654',
    [['Inglés conversacional', 'Inglés', 'Adultos / profesional', 'Pierde el miedo a hablar con conversación guiada sobre temas de tu día a día.', 50000, 60, 'ambas', 'Cali'],
     ['Francés desde cero', 'Francés', 'Adultos / profesional', 'Pronunciación, vocabulario esencial y tus primeras conversaciones en francés.', 55000, 60, 'virtual', '']],
    { dias: [2, 4], ini: '16:00', fin: '20:00', extra: [[6, '08:00', '12:00']] }],
  ['giulia@demo.co', 'Giulia Rossi', 'Bogotá D.C.', '3126667788',
    'Italiana residente en Bogotá. Enseño italiano y alemán con enfoque en viajes y trabajo.',
    'Italiano, Alemán', 60000, 'ambas', '7 años enseñando idiomas a adultos.', '1100223344',
    [['Italiano para viajar', 'Italiano', 'Adultos / profesional', 'Habla italiano desde la primera clase: restaurantes, viajes y cultura.', 60000, 60, 'ambas', 'Bogotá D.C.']],
    { dias: [1, 3, 5], ini: '10:00', fin: '14:00' }],
  ['valeria@demo.co', 'Valeria Núñez', 'Bogotá D.C.', '3134445566',
    'Instructora certificada de yoga y pilates. Clases para todos los niveles, en casa o en línea.',
    'Yoga, Pilates', 55000, 'ambas', '9 años como instructora en estudios de Bogotá.', '52998877',
    [['Yoga para principiantes', 'Yoga', 'Adultos / profesional', 'Respiración, posturas básicas y relajación para soltar el estrés.', 50000, 60, 'ambas', 'Bogotá D.C.'],
     ['Pilates en casa', 'Pilates', 'Adultos / profesional', 'Fortalece tu core y mejora tu postura con rutinas guiadas.', 55000, 60, 'virtual', '']],
    { dias: [1, 2, 3, 4, 5], ini: '06:00', fin: '09:00' }],
  ['isabella@demo.co', 'Isabella Montoya', 'Medellín', '3176543210',
    'Guía de bienestar espiritual: tarot, astrología y reiki, con respeto y sin promesas milagrosas.',
    'Tarot, Astrología, Reiki', 65000, 'virtual', '12 años acompañando procesos de autoconocimiento.', '43556677',
    [['Introducción al tarot', 'Tarot', 'Adultos / profesional', 'Aprende los arcanos mayores y cómo leer una tirada sencilla.', 60000, 60, 'virtual', ''],
     ['Tu carta natal: astrología desde cero', 'Astrología', 'Adultos / profesional', 'Descubre tu sol, luna y ascendente y cómo interpretarlos.', 65000, 90, 'virtual', ''],
     ['Reiki nivel 1', 'Reiki', 'Adultos / profesional', 'Fundamentos del reiki y autotratamiento.', 70000, 90, 'virtual', '']],
    { dias: [2, 3, 4, 5, 6], ini: '15:00', fin: '19:00' }],
  ['santiago@demo.co', 'Santiago Vélez', 'Bogotá D.C.', '3187778899',
    'Entrenador de tenis y pádel, ex jugador federado. Rutinas de ejercicio para todas las edades.',
    'Tenis, Pádel, Rutinas de ejercicio', 80000, 'presencial', '11 años como entrenador en clubes de Bogotá.', '80445566',
    [['Clases de tenis', 'Tenis', 'Adultos / profesional', 'Técnica de golpes, juego y condición física en cancha.', 80000, 60, 'presencial', 'Bogotá D.C.'],
     ['Pádel para principiantes', 'Pádel', 'Adultos / profesional', 'Reglas, golpes básicos y estrategia de dobles.', 75000, 60, 'presencial', 'Bogotá D.C.'],
     ['Rutinas de ejercicio a tu medida', 'Rutinas de ejercicio', 'Adultos / profesional', 'Plan personalizado de entrenamiento con seguimiento.', 60000, 60, 'ambas', 'Bogotá D.C.']],
    { dias: [1, 2, 3, 4, 5], ini: '06:00', fin: '09:00', extra: [[6, '08:00', '12:00']] }],
  ['daniela@demo.co', 'Daniela Pardo', 'Cartagena', '3198889900',
    'Ceramista y artista plástica. Talleres de cerámica y dibujo para quienes quieren crear con las manos.',
    'Cerámica, Arte', 55000, 'presencial', '8 años de taller y exposiciones.', '45667788',
    [['Taller de cerámica: tu primera pieza', 'Cerámica', 'Adultos / profesional', 'Modelado a mano y torno. Te llevas tu pieza horneada.', 65000, 120, 'presencial', 'Cartagena'],
     ['Dibujo y acuarela', 'Arte', 'Adultos / profesional', 'Fundamentos de dibujo, color y composición.', 45000, 90, 'ambas', 'Cartagena']],
    { dias: [3, 4, 5], ini: '09:00', fin: '17:00', extra: [[6, '09:00', '13:00']] }],
  ['julian@demo.co', 'Julián Herrera', 'Bogotá D.C.', '3201239876',
    'Contador público y escritor. Te ayudo con la contabilidad de tu negocio y con tus textos.',
    'Contabilidad, Escritura, Ciencias sociales', 50000, 'virtual', '9 años en consultoría contable.', '79334455',
    [['Contabilidad básica para tu negocio', 'Contabilidad', 'Adultos / profesional', 'Libros contables, impuestos básicos y control de costos.', 50000, 60, 'virtual', ''],
     ['Taller de escritura', 'Escritura', 'Bachillerato', 'Redacta ensayos y textos claros y bien argumentados.', 40000, 60, 'virtual', '']],
    { dias: [1, 2, 3, 4, 5], ini: '19:00', fin: '21:00' }],
];

export function sembrar(db, { hashClave }) {
  if (db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n > 0) return;
  const hash = hashClave('demo12345');
  const vence = sqlAhora(Date.now() + 30 * 24 * 3600 * 1000);

  const insMentor = db.prepare(`INSERT INTO usuarios
    (email, pass_hash, rol, nombre, ciudad, telefono, bio, materias, tarifa, modalidad, experiencia, documento, verificacion_estado)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insDoc = db.prepare('INSERT INTO documentos (usuario_id, tipo, mime, datos) VALUES (?,?,?,?)');
  const insSub = db.prepare('INSERT INTO suscripciones (usuario_id, vence) VALUES (?,?)');
  const insHor = db.prepare('INSERT INTO horarios (profesor_id, dia, inicio, fin) VALUES (?,?,?,?)');
  const insClase = db.prepare(`INSERT INTO clases
    (profesor_id, titulo, materia, nivel, descripcion, precio_hora, duracion_min, modalidad, ciudad) VALUES (?,?,?,?,?,?,?,?,?)`);

  const ids = {}, clases = {};
  for (const [email, nombre, ciudad, tel, bio, materias, tarifa, mod, exp, cedula, lista, hor] of MENTORES) {
    const id = Number(insMentor.run(email, hash, 'profesor', nombre, ciudad, tel, bio, materias, tarifa, mod, exp, cedula, 'verificado').lastInsertRowid);
    insDoc.run(id, 'cedula', 'image/png', PNG_EJEMPLO); insDoc.run(id, 'titulo', 'image/png', PNG_EJEMPLO);
    insSub.run(id, vence);
    for (const d of hor.dias) insHor.run(id, d, hor.ini, hor.fin);
    for (const [d, i, f] of hor.extra ?? []) insHor.run(id, d, i, f);
    ids[email] = id;
    clases[email] = lista.map((c) => Number(insClase.run(id, ...c).lastInsertRowid));
  }
  // Mentor en revisión (para probar la cola del administrador)
  const pedro = Number(insMentor.run('pedro@demo.co', hash, 'profesor', 'Pedro Salazar', 'Bogotá D.C.', '3201112233',
    'Químico con experiencia en preparación para Saber 11.', 'Química', 40000, 'virtual', '5 años en colegios públicos de Bogotá.', '80111222', 'pendiente').lastInsertRowid);
  insDoc.run(pedro, 'cedula', 'image/png', PNG_EJEMPLO); insDoc.run(pedro, 'titulo', 'image/png', PNG_EJEMPLO);

  const est = db.prepare(`INSERT INTO usuarios
    (email, pass_hash, rol, nombre, ciudad, telefono, bio, nivel, intereses, colegio_tipo, colegio_nombre, localidad, grado, es_menor, acudiente_nombre, acudiente_celular, es_admin)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const sofia = Number(est.run('sofia@demo.co', hash, 'estudiante', 'Sofía Martínez', 'Bogotá D.C.', '', 'Estudiante de grado 11, quiero mejorar mi puntaje en el Saber 11.',
    'Bachillerato', 'Matemáticas, Inglés', 'privado', 'Colegio Los Nogales', 'Usaquén', '11°', 1, 'Marta Pérez', '3205550202', 0).lastInsertRowid);
  const daniel = Number(est.run('daniel@demo.co', hash, 'estudiante', 'Daniel Rojas', 'Bogotá D.C.', '3017778899', 'Me cuesta el álgebra, necesito ayuda constante.',
    'Bachillerato', 'Matemáticas', 'publico', 'IED Kennedy', 'Kennedy', '10°', 0, '', '', 0).lastInsertRowid);
  est.run('admin@demo.co', hash, 'estudiante', 'Administración Artia', 'Bogotá D.C.', '', '', '', '', 'ninguno', '', '', '', 0, '', '', 1);
  for (const id of [sofia, daniel]) insSub.run(id, vence);

  // Clases ya ocurridas con reseñas
  const hoy = hoyCol();
  const pasada = db.prepare(`INSERT INTO reservas (clase_id, profesor_id, estudiante_id, fecha, hora, duracion_min, estado, mensaje) VALUES (?,?,?,?,?,?,'aceptada',?)`);
  const resena = db.prepare('INSERT INTO resenas (reserva_id, profesor_id, estudiante_id, calificacion, comentario) VALUES (?,?,?,?,?)');
  const dejar = (email, claseIdx, est, dias, hora, nota, texto, msg = '') => {
    const r = Number(pasada.run(clases[email][claseIdx], ids[email], est, sumarDias(hoy, -dias), hora, 60, msg).lastInsertRowid);
    resena.run(r, ids[email], est, nota, texto);
  };
  dejar('laura@demo.co', 0, sofia, 3, '15:00', 5, 'Explica con mucha paciencia y los ejemplos son muy claros. Subí mi puntaje en el simulacro.', 'Repaso de trigonometría');
  dejar('laura@demo.co', 0, daniel, 8, '16:00', 4, 'Muy buena clase, aunque se quedó corta la hora.');
  dejar('camila@demo.co', 0, sofia, 10, '16:00', 5, 'Camila hace que hablar inglés sea divertido.');
  dejar('valeria@demo.co', 0, sofia, 5, '07:00', 5, 'Una clase muy tranquila, salí relajadísima.');
  dejar('santiago@demo.co', 0, daniel, 6, '07:00', 4, 'Buen entrenador, corrige muy bien la técnica.');
  dejar('isabella@demo.co', 0, sofia, 12, '16:00', 5, 'Muy respetuosa y clara en sus explicaciones.');

  db.prepare(`INSERT INTO solicitudes (estudiante_id, materia, descripcion, presupuesto, modalidad, ciudad) VALUES (?,?,?,?,?,?)`)
    .run(sofia, 'Matemáticas', 'Necesito reforzar matemáticas para el Saber 11. Puedo dos tardes por semana.', 40000, 'virtual', 'Bogotá D.C.');

  console.log('Datos de ejemplo cargados (contraseña demo12345):\n' +
    `  mentores verificados: ${MENTORES.map((m) => m[0]).join(', ')}\n  mentor en revisión: pedro@demo.co\n` +
    '  estudiantes: sofia@demo.co (colegio privado, menor) · daniel@demo.co (colegio público)\n  administrador: admin@demo.co');
}
