// Datos de ejemplo para probar la app (npm run demo). Contraseña de todos: demo12345
export function sembrar(db, { hashClave }) {
  if (db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n > 0) return;
  const hash = hashClave('demo12345');
  const usuario = db.prepare(`INSERT INTO usuarios
    (email, pass_hash, rol, nombre, ciudad, telefono, bio, materias, tarifa, modalidad, experiencia, nivel, intereses)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const clase = db.prepare(`INSERT INTO clases
    (profesor_id, titulo, materia, nivel, descripcion, precio_hora, duracion_min, modalidad, ciudad)
    VALUES (?,?,?,?,?,?,?,?,?)`);

  const prof = (email, nombre, ciudad, tel, bio, materias, tarifa, mod, exp) =>
    Number(usuario.run(email, hash, 'profesor', nombre, ciudad, tel, bio, materias, tarifa, mod, exp, '', '').lastInsertRowid);

  const laura = prof('laura@demo.co', 'Laura Gómez', 'Bogotá D.C.', '3001234567',
    'Licenciada en Matemáticas de la Universidad Nacional. Me encanta que los números dejen de dar miedo.',
    'Matemáticas, Cálculo, Preparación Saber 11', 45000, 'ambas', '8 años dando refuerzo escolar y preuniversitario.');
  const andres = prof('andres@demo.co', 'Andrés Restrepo', 'Medellín', '3109876543',
    'Ingeniero de sistemas. Enseño programación desde cero, con proyectos reales.',
    'Programación, Excel y ofimática', 60000, 'virtual', '6 años como desarrollador y mentor en bootcamps.');
  const camila = prof('camila@demo.co', 'Camila Ortiz', 'Cali', '3155550101',
    'Profesora de inglés certificada (IELTS 8.0). Clases de conversación y preparación de exámenes.',
    'Inglés', 50000, 'ambas', '10 años en institutos de idiomas.');

  clase.run(laura, 'Refuerzo de matemáticas para bachillerato', 'Matemáticas', 'Bachillerato', 'Álgebra, geometría y trigonometría con ejercicios al estilo del colegio.', 40000, 60, 'ambas', 'Bogotá D.C.');
  clase.run(laura, 'Preparación intensiva Saber 11 — matemáticas', 'Preparación Saber 11', 'Bachillerato', 'Simulacros, estrategias de tiempo y repaso de los temas más evaluados.', 55000, 90, 'virtual', '');
  clase.run(andres, 'Python desde cero', 'Programación', 'Adultos / profesional', 'Aprende a programar con Python haciendo pequeños proyectos útiles.', 60000, 60, 'virtual', '');
  clase.run(andres, 'Excel para el trabajo', 'Excel y ofimática', 'Adultos / profesional', 'Tablas dinámicas, fórmulas y reportes para tu oficina.', 45000, 60, 'virtual', '');
  clase.run(camila, 'Inglés conversacional', 'Inglés', 'Adultos / profesional', 'Pierde el miedo a hablar con conversación guiada sobre temas de tu día a día.', 50000, 60, 'ambas', 'Cali');

  const est = Number(usuario.run('sofia@demo.co', hash, 'estudiante', 'Sofía Martínez', 'Barranquilla', '3205550202',
    'Estudiante de grado 11, quiero mejorar mi puntaje en el Saber 11.', '', 0, 'ambas', '', 'Bachillerato', 'Matemáticas, Inglés').lastInsertRowid);
  db.prepare(`INSERT INTO solicitudes (estudiante_id, materia, descripcion, presupuesto, modalidad, ciudad)
    VALUES (?,?,?,?,?,?)`).run(est, 'Preparación Saber 11',
    'Necesito reforzar matemáticas y lectura crítica. Puedo dos tardes por semana.', 40000, 'virtual', 'Barranquilla');
  console.log('Datos de ejemplo cargados (laura@demo.co, andres@demo.co, camila@demo.co, sofia@demo.co / demo12345).');
}
