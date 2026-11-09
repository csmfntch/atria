// Datos específicos de Colombia.

export const CIUDADES = [
  'Bogotá D.C.', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Cúcuta',
  'Bucaramanga', 'Pereira', 'Santa Marta', 'Ibagué', 'Manizales', 'Pasto',
  'Villavicencio', 'Armenia', 'Neiva', 'Montería', 'Valledupar', 'Popayán',
  'Sincelejo', 'Tunja', 'Florencia', 'Riohacha', 'Quibdó', 'Yopal',
  'Soacha', 'Envigado', 'Bello', 'Itagüí', 'Palmira', 'Buenaventura',
];

export const MATERIAS = [
  'Matemáticas', 'Física', 'Química', 'Biología', 'Lenguaje y literatura',
  'Inglés', 'Francés', 'Alemán', 'Ciencias sociales', 'Programación',
  'Excel y ofimática', 'Preparación Saber 11', 'Preparación ICFES / Saber Pro',
  'Música', 'Guitarra', 'Piano', 'Dibujo y arte', 'Contabilidad',
  'Estadística', 'Cálculo', 'Refuerzo escolar (primaria)', 'Otra',
];

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

// Cédula de ciudadanía / extranjería: 5 a 12 dígitos.
export const normalizarDocumento = (v) => {
  const d = String(v ?? '').replace(/[.\s-]/g, '');
  return /^\d{5,12}$/.test(d) ? d : null;
};

// Celular colombiano: 10 dígitos que empiezan por 3 (acepta prefijo +57 / 57).
export function normalizarCelular(valor) {
  let d = String(valor ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  return /^3\d{9}$/.test(d) ? d : null;
}
