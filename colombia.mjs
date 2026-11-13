// Datos específicos de Colombia.

export const CIUDADES = [
  'Bogotá D.C.', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Cúcuta',
  'Bucaramanga', 'Pereira', 'Santa Marta', 'Ibagué', 'Manizales', 'Pasto',
  'Villavicencio', 'Armenia', 'Neiva', 'Montería', 'Valledupar', 'Popayán',
  'Sincelejo', 'Tunja', 'Florencia', 'Riohacha', 'Quibdó', 'Yopal',
  'Soacha', 'Envigado', 'Bello', 'Itagüí', 'Palmira', 'Buenaventura',
];

// Catálogo de clases por categoría (para los filtros del marketplace).
export const CATEGORIAS = [
  { nombre: 'Idiomas', materias: ['Inglés', 'Francés', 'Alemán', 'Italiano'],
    aprenderas: 'Hablar, entender y escribir un nuevo idioma con confianza, en situaciones reales.',
    ganas: 'Nuevas oportunidades de trabajo, viajes y amistades en cualquier parte del mundo.' },
  { nombre: 'Ciencias y números', materias: ['Matemáticas', 'Física', 'Química', 'Contabilidad'],
    aprenderas: 'Razonar con lógica y resolver problemas, de las matemáticas a la contabilidad.',
    ganas: 'Seguridad para rendir en tus estudios y manejar tu dinero con criterio.' },
  { nombre: 'Humanidades', materias: ['Ciencias sociales', 'Escritura'],
    aprenderas: 'Entender la sociedad, ordenar tus ideas y escribir con claridad y estilo.',
    ganas: 'Pensamiento crítico y una voz propia para contar tu historia.' },
  { nombre: 'Bienestar y espiritualidad', materias: ['Yoga', 'Pilates', 'Astrología', 'Reiki', 'Ángeles', 'Tarot'],
    aprenderas: 'Cuidar tu cuerpo y tu mente con yoga, pilates y prácticas de autoconocimiento.',
    ganas: 'Más calma, energía y equilibrio para tu día a día.' },
  { nombre: 'Arte y creatividad', materias: ['Cerámica', 'Arte'],
    aprenderas: 'Crear con tus manos y tu imaginación, desde la cerámica hasta el arte.',
    ganas: 'Un espacio para expresarte, soltar el estrés y sentir orgullo de lo que haces.' },
  { nombre: 'Deportes', materias: ['Tenis', 'Pádel', 'Rutinas de ejercicio', 'Golf'],
    aprenderas: 'Mejorar tu técnica y tu condición física en tenis, pádel, golf y rutinas de ejercicio.',
    ganas: 'Salud, disciplina y nuevos planes para compartir con otros.' },
  { nombre: 'Tecnología', materias: ['Inteligencia artificial', 'UX/UI Design', 'Programación'],
    aprenderas: 'Diseñar, programar y usar la inteligencia artificial para crear y automatizar.',
    ganas: 'Habilidades muy buscadas que abren puertas y te permiten construir tus propias ideas.' },
  { nombre: 'Business', materias: ['Finanzas personales', 'Finanzas', 'Startups'],
    aprenderas: 'Manejar tus finanzas, entender el dinero y dar los primeros pasos para crear una empresa.',
    ganas: 'Autonomía financiera y las herramientas para convertir una idea en un negocio.' },
  { nombre: 'Psicoterapia', materias: ['Psicoterapia'],
    aprenderas: 'Espacios guiados por profesionales para entender mejor tus emociones y tus relaciones.',
    ganas: 'Más bienestar emocional y herramientas para los retos de la vida.' },
  { nombre: 'Danza', materias: ['Danza'],
    aprenderas: 'Moverte con ritmo y expresión, desde tus primeros pasos hasta coreografías completas.',
    ganas: 'Alegría, confianza en tu cuerpo y una forma divertida de ejercitarte.' },
  { nombre: 'Música', materias: ['Música'],
    aprenderas: 'Tocar un instrumento, cantar o leer música con un guía a tu lado.',
    ganas: 'El placer de crear música y una pasión que te acompaña toda la vida.' },
  { nombre: 'Juegos de mesa', materias: ['Juegos de mesa'],
    aprenderas: 'Reglas, estrategias y trucos para jugar mejor y descubrir juegos nuevos.',
    ganas: 'Planes entretenidos con amigos y familia, y un buen entrenamiento para tu mente.' },
  { nombre: 'Pastelería', materias: ['Pastelería'],
    aprenderas: 'Técnicas para hornear y decorar tortas, postres y panes.',
    ganas: 'Un talento para sorprender a los tuyos y, si quieres, una idea de emprendimiento.' },
  { nombre: 'Cocina', materias: ['Cocina'],
    aprenderas: 'Cocinar con técnica y sabor, de lo básico a recetas con sello propio.',
    ganas: 'Comer mejor, ahorrar y disfrutar de compartir un plato hecho por ti.' },
  { nombre: 'Enología', materias: ['Enología'],
    aprenderas: 'Conocer el vino: cómo se hace, cómo se cata y con qué se disfruta.',
    ganas: 'Criterio para elegir, maridar y disfrutar cada copa.' },
  { nombre: 'Decoración', materias: ['Decoración'],
    aprenderas: 'Transformar tus espacios con color, luz y distribución.',
    ganas: 'Un hogar que se siente tuyo y el ojo para crear ambientes especiales.' },
];
export const MATERIAS = CATEGORIAS.flatMap((c) => c.materias);
export const materiasDe = (categoria) => CATEGORIAS.find((c) => c.nombre === categoria)?.materias ?? [];

export const NIVELES = [
  'Primaria', 'Bachillerato', 'Preuniversitario', 'Universitario', 'Adultos / profesional',
];

export const MODALIDADES = ['virtual', 'presencial', 'ambas'];

// Las 20 localidades de Bogotá D.C.
export const LOCALIDADES_BOGOTA = [
  'Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme', 'Tunjuelito', 'Bosa',
  'Kennedy', 'Fontibón', 'Engativá', 'Suba', 'Barrios Unidos', 'Teusaquillo',
  'Los Mártires', 'Antonio Nariño', 'Puente Aranda', 'La Candelaria',
  'Rafael Uribe Uribe', 'Ciudad Bolívar', 'Sumapaz',
];

// Tipo de colegio: público (oficial / distrital) o privado.
export const COLEGIO_TIPOS = { publico: 'Público (oficial)', privado: 'Privado', ninguno: 'No estoy en un colegio' };

export const GRADOS = [
  'Preescolar', '1°', '2°', '3°', '4°', '5°', '6°', '7°', '8°', '9°', '10°', '11°',
  'Técnico / tecnológico', 'Universitario', 'Otro',
];

export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Número de documento de identidad: cédula (solo dígitos) o de otro país (pasaporte, extranjería…: letras y números).
// Se guarda en mayúsculas y sin puntos, espacios ni guiones. Entre 5 y 20 caracteres.
export const normalizarDocumento = (v) => {
  const d = String(v ?? '').replace(/[.\s-]/g, '').toUpperCase();
  return /^[A-Z0-9]{5,20}$/.test(d) ? d : null;
};

// Celular colombiano: 10 dígitos que empiezan por 3 (acepta prefijo +57 / 57).
export function normalizarCelular(valor) {
  let d = String(valor ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  return /^3\d{9}$/.test(d) ? d : null;
}

// Versión vigente de los Términos y la Política de privacidad. Súbela cuando cambien los textos: se pedirá aceptarlos de nuevo.
export const ORIGENES_DOCUMENTO = ['colombiano', 'extranjero'];

export const TERMINOS_VERSION = '2026-11-12';
