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
  { nombre: 'Idiomas', materias: ['Inglés', 'Francés', 'Alemán', 'Italiano'] },
  { nombre: 'Ciencias y números', materias: ['Matemáticas', 'Física', 'Química', 'Contabilidad'] },
  { nombre: 'Humanidades', materias: ['Ciencias sociales', 'Escritura'] },
  { nombre: 'Bienestar y espiritualidad', materias: ['Yoga', 'Pilates', 'Astrología', 'Reiki', 'Ángeles', 'Tarot'] },
  { nombre: 'Arte y creatividad', materias: ['Cerámica', 'Arte'] },
  { nombre: 'Deportes', materias: ['Tenis', 'Pádel', 'Rutinas de ejercicio'] },
  { nombre: 'Tecnología', materias: ['Inteligencia artificial'] },
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

export const TERMINOS_VERSION = '2026-11-09';
