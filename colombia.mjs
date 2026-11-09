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

// Celular colombiano: 10 dígitos que empiezan por 3 (acepta prefijo +57 / 57).
export function normalizarCelular(valor) {
  let d = String(valor ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  return /^3\d{9}$/.test(d) ? d : null;
}
