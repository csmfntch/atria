// Textos legales de Artia — BORRADOR.
//
// ⚠ Estos textos son una base de trabajo. Deben ser revisados y ajustados por un abogado colombiano antes de
// publicar la plataforma. Completa los datos entre [CORCHETES] (razón social, NIT, dirección, correo, ciudad…).
// Datos de la empresa: variables EMPRESA_* en el servidor. Cuando un abogado apruebe los textos, define LEGAL_REVISADO=1
// (quita el aviso de borrador) y busca los dos marcadores [AJUSTAR…] de abajo (reembolsos y plazo de conservación).
// Si cambias el contenido, sube TERMINOS_VERSION en colombia.mjs: se pedirá aceptar de nuevo.
/** Datos de la empresa (los define el servidor con variables de entorno); si faltan, queda el marcador entre corchetes. */
export const datosEmpresa = (e = {}) => ({
  nombre: e.nombre || '[RAZÓN SOCIAL DE ARTIA]',
  nit: e.nit || '[NIT]',
  direccion: e.direccion || '[DIRECCIÓN, CIUDAD, COLOMBIA]',
  correo: e.correo || '[CORREO PARA SOLICITUDES DE DATOS Y SOPORTE]',
  ciudad: e.ciudad || '[CIUDAD]',
});

export const terminos = (EMPRESA) => ({
  titulo: 'Términos y Condiciones de Uso',
  secciones: [
    ['1. Quiénes somos y qué hacemos',
      [`Artia es una plataforma en línea operada por ${EMPRESA.nombre} (NIT ${EMPRESA.nit}) que pone en contacto a estudiantes con mentores (profesores, instructores y guías) para tomar clases en Colombia. Artia es un intermediario tecnológico: no es el empleador, socio ni representante de los mentores, y las clases se acuerdan entre el mentor y el estudiante.`]],
    ['2. Aceptación',
      ['Al crear una cuenta o usar Artia declaras que leíste y aceptas estos Términos y la Política de Tratamiento de Datos Personales. Si no estás de acuerdo, no uses la plataforma.']],
    ['3. Cuentas y edad',
      ['Debes dar información veraz y mantener segura tu contraseña. Eres responsable de lo que ocurra en tu cuenta.',
       'Las personas menores de 18 años solo pueden usar Artia con la autorización de su madre, padre o representante legal (acudiente), cuyos datos de contacto son obligatorios. Los mentores deben ser mayores de edad.']],
    ['4. Mentores y verificación de identidad',
      ['Para publicar clases, el mentor debe verificar su identidad con su cédula de ciudadanía, una selfie y un título, diploma o certificado que respalde lo que enseña. Estos datos se tratan como se explica en la Política de Tratamiento de Datos.',
       'Los mentores extranjeros pueden verificarse con su pasaporte, cédula de extranjería u otro documento de identidad vigente, y son responsables de contar con la autorización migratoria o de trabajo que la ley colombiana exija para dar clases.',
       'La insignia «Verificado» indica que la identidad del mentor fue comprobada y que se revisaron sus documentos. No garantiza la calidad de sus clases ni reemplaza tu propio criterio.',
       'Artia puede rechazar, suspender o retirar a un mentor que entregue información falsa o incumpla estos Términos.']],
    ['5. Suscripciones y pagos',
      ['Para usar ciertas funciones de Artia (publicar clases, reservar, enviar o responder solicitudes) se requiere una suscripción mensual, con el precio vigente que se muestra antes de pagar, en pesos colombianos (COP).',
       'Los pagos se procesan por Wompi (PSE, Nequi y tarjetas). Artia no almacena los datos de tus tarjetas. Cada pago cubre 30 días y no se renueva automáticamente: debes renovarlo antes de que venza.',
       'Las clases se pagan directamente entre el mentor y el estudiante, fuera de Artia, salvo que se indique otra cosa. [AJUSTAR: política de devoluciones y reembolsos de la suscripción, conforme al Estatuto del Consumidor — Ley 1480 de 2011.]']],
    ['6. Reservas, cancelaciones y reseñas',
      ['Una reserva queda confirmada cuando el mentor la acepta. Ambas partes pueden cancelar antes de la clase. Los datos de contacto (WhatsApp) se comparten solo cuando el mentor acepta la reserva; si el estudiante es menor de edad, el mentor recibe el contacto del acudiente.',
       'Solo el estudiante que tomó una clase puede calificarla, una vez ocurrida. Las reseñas deben ser honestas, respetuosas y no incluir datos personales de terceros.']],
    ['7. Conducta prohibida',
      ['Está prohibido suplantar a otra persona, publicar contenido ilegal, engañoso, discriminatorio o que ponga en riesgo a menores, acosar, ofrecer servicios no permitidos por la ley colombiana, intentar eludir la verificación o vulnerar la seguridad de la plataforma.',
       'Las clases de bienestar y espiritualidad (por ejemplo tarot, astrología o reiki) son de carácter recreativo y de autoconocimiento; no reemplazan atención médica, psicológica, jurídica ni financiera, y los mentores no deben prometer resultados.']],
    ['8. Seguridad de menores',
      ['Recomendamos que las clases de menores se hagan con conocimiento de su acudiente. Artia puede suspender cuentas ante cualquier indicio de riesgo para un menor y colaborar con las autoridades competentes.']],
    ['9. Responsabilidad',
      ['Artia no es parte de la relación entre mentor y estudiante ni responde por la calidad, resultados, puntualidad o seguridad de las clases, ni por acuerdos hechos fuera de la plataforma, en los límites permitidos por la ley.',
       'Haremos esfuerzos razonables para que la plataforma funcione sin interrupciones, pero no garantizamos disponibilidad continua.']],
    ['10. Propiedad intelectual',
      ['La marca Artia, su diseño y su software pertenecen a Artia. Los mentores conservan los derechos sobre el contenido de sus clases y nos autorizan a mostrarlo en la plataforma mientras su cuenta esté activa.']],
    ['11. Cambios y terminación',
      ['Podemos actualizar estos Términos; si el cambio es relevante te pediremos aceptarlos de nuevo. Puedes cerrar tu cuenta cuando quieras escribiendo a ' + EMPRESA.correo + '.']],
    ['12. Ley aplicable',
      ['Estos Términos se rigen por las leyes de la República de Colombia. Cualquier controversia se someterá a los jueces competentes de ' + EMPRESA.ciudad + ', Colombia, sin perjuicio de los derechos del consumidor ante la Superintendencia de Industria y Comercio.']],
  ],
});

export const privacidad = (EMPRESA) => ({
  titulo: 'Política de Tratamiento de Datos Personales',
  secciones: [
    ['1. Responsable del tratamiento',
      [`${EMPRESA.nombre}, NIT ${EMPRESA.nit}, domicilio en ${EMPRESA.direccion}. Contacto para consultas y reclamos: ${EMPRESA.correo}. Esta política se adopta conforme a la Ley 1581 de 2012 y sus decretos reglamentarios.`]],
    ['2. Datos que tratamos',
      ['Datos de cuenta y contacto: nombre, correo, ciudad, celular y contraseña (guardada cifrada).',
       'Datos de estudiantes: grado, tipo de colegio (público o privado), nombre del colegio y localidad en Bogotá, y, si son menores de edad, nombre y celular de su acudiente.',
       'Datos de mentores: materias, tarifa, experiencia y horarios; y, para la verificación, número de cédula, imagen de la cédula, selfie y título o certificado.',
       'Datos de uso: reservas, mensajes de solicitudes, reseñas, suscripciones y pagos (referencia y estado; no guardamos números de tarjeta).']],
    ['3. Datos sensibles y de menores — autorización expresa',
      ['La selfie y la comparación del rostro con la cédula son datos biométricos, y por lo tanto datos sensibles. No estás obligado a autorizar su tratamiento; si no lo haces, no podremos verificarte como mentor.',
       'Los datos de niños, niñas y adolescentes solo se tratan con autorización de su representante legal y respetando el interés superior del menor; los usamos únicamente para facilitar sus clases, y los mentores solo ven su grado y el tipo de colegio, nunca el nombre del colegio ni el celular del menor (reciben el contacto del acudiente).']],
    ['4. Para qué usamos tus datos (finalidades)',
      ['Crear y administrar tu cuenta; conectar a estudiantes y mentores; gestionar reservas, agenda y reseñas; verificar la identidad y los títulos de los mentores y prevenir fraudes y suplantaciones; cobrar y administrar suscripciones; enviarte avisos del servicio; cumplir obligaciones legales; y mejorar la plataforma con información agregada.']],
    ['5. Con quién compartimos tus datos (encargados y proveedores)',
      ['Compartimos datos solo en lo necesario con proveedores que los tratan por nuestra cuenta: Didit (verificación de identidad, incluida la comparación biométrica), Wompi (pagos), Supabase (almacenamiento de documentos) y Railway (alojamiento del servicio). Algunos pueden estar fuera de Colombia, lo que implica transmisión o transferencia internacional de datos con las garantías exigidas por la ley.',
       'Entre mentor y estudiante solo se comparte el celular cuando una reserva es aceptada. No vendemos tus datos.']],
    ['6. Tus derechos',
      ['Como titular puedes conocer, actualizar y rectificar tus datos; pedir prueba de la autorización; ser informado del uso que damos a tus datos; presentar quejas ante la Superintendencia de Industria y Comercio; revocar la autorización y solicitar la supresión de tus datos cuando no exista un deber legal o contractual de conservarlos; y acceder gratuitamente a ellos.',
       `Ejerce tus derechos escribiendo a ${EMPRESA.correo}. Responderemos las consultas en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles, prorrogables conforme a la ley.`]],
    ['7. Conservación y seguridad',
      ['Conservamos tus datos mientras tengas cuenta y por el tiempo necesario para cumplir obligaciones legales. Las imágenes de la cédula y los documentos se guardan en un almacenamiento privado, con acceso restringido a personal autorizado de Artia, y se eliminan [AJUSTAR: plazo, por ejemplo X meses] después de cerrada la cuenta o de revocada la autorización, salvo deber legal de conservarlos.',
       'Aplicamos medidas técnicas y organizativas razonables para proteger tus datos, pero ningún sistema es completamente infalible.']],
    ['8. Vigencia',
      ['Esta política rige desde su publicación. Si cambia de forma sustancial te lo informaremos y pediremos tu autorización cuando la ley lo exija.']],
  ],
});

export const AUTORIZACION_VERIFICACION =
  'Autorizo de forma expresa, previa e informada a Artia y a su proveedor Didit para tratar mi cédula, la foto de mi documento, mi selfie (dato biométrico, sensible) y mi título o certificado, con el único fin de verificar mi identidad y mis credenciales como mentor y prevenir fraudes. Sé que no estoy obligado a autorizarlo, aunque sin hacerlo no podré ser mentor, y que puedo revocar esta autorización escribiendo al correo indicado en la Política de Tratamiento de Datos.';
