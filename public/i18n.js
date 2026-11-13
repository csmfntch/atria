// Idiomas de Artia: español (por defecto) e inglés.
//
// El texto de la interfaz está escrito en español. Para el inglés, `tr()` traduce un texto por su equivalente en este
// diccionario (clave = texto en español; `{}` = un valor que cambia, como un nombre o un número, que debe aparecer
// en el mismo orden en la traducción). Lo que no esté aquí se muestra en español, así que nada se rompe si falta algo.
// Las pantallas de administración y los textos legales siguen en español.

export const IDIOMAS = ['es', 'en'];

const guardado = (() => { try { return localStorage.getItem('idioma'); } catch { return null; } })();
export const idioma = IDIOMAS.includes(guardado) ? guardado : (navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es';
export const EN_ACTIVO = idioma === 'en';
export function cambiarIdioma(nuevo) {
  try { localStorage.setItem('idioma', nuevo); } catch { /* sin almacenamiento: no se recuerda */ }
  location.reload();
}

const EN = {
  // --- navegación y avisos de cuenta ---
  'Buscar clases': 'Find classes', 'Primeros pasos ({}/{})': 'First steps ({}/{})', 'Mis clases': 'My classes', 'Mi agenda': 'My schedule',
  'Lo que busco': 'What I\'m looking for', 'Administración': 'Admin', 'Mi cuenta': 'My account', 'Suscripción': 'Subscription',
  'Ganancias': 'Earnings', 'Verificación': 'Verification', 'Perfil': 'Profile', 'Horarios': 'Availability', 'Agenda': 'Schedule',
  'Solicitudes': 'Requests', 'Salir': 'Log out', 'Ingresar': 'Log in', 'Crear cuenta': 'Sign up', 'Activa tu suscripción': 'Activate your subscription',
  'Menú': 'Menu', 'Principal': 'Main', 'Artia, inicio': 'Artia, home', 'o': 'or', 'y la': 'and the', 'Quitar bloque del {}': 'Remove the {} block', 'Quitar bloque del Domingo': 'Remove the Sunday block', 'Quitar bloque del Lunes': 'Remove the Monday block', 'Quitar bloque del Martes': 'Remove the Tuesday block', 'Quitar bloque del Miércoles': 'Remove the Wednesday block', 'Quitar bloque del Jueves': 'Remove the Thursday block', 'Quitar bloque del Viernes': 'Remove the Friday block', 'Quitar bloque del Sábado': 'Remove the Saturday block', 'mentor': 'mentor', 'estudiante': 'student',
  '✓ Verificado': '✓ Verified', 'Identidad y título revisados por Artia': 'Identity and credentials reviewed by Artia',
  'Algo salió mal. Inténtalo de nuevo.': 'Something went wrong. Please try again.',
  'Entraste con una clave temporal.': 'You signed in with a temporary password.', 'Cámbiala ahora': 'Change it now', 'en «Seguridad de la cuenta».': 'under "Account security".',
  'Actualizamos los': 'We updated the', 'Términos': 'Terms', 'Política de Datos': 'Data Policy', 'Aceptar': 'Accept',
  'Estamos revisando tu verificación. Tus clases serán públicas cuando la aprobemos.': 'We are reviewing your verification. Your classes will be public once we approve it.',
  'Tus clases no son visibles hasta que': 'Your classes are not visible until you', 'verifiques tu identidad': 'verify your identity',
  'Activa tu suscripción para reservar clases.': 'Activate your subscription to book classes.', 'Ir a suscripción': 'Go to subscription',
  'Tu suscripción vence el {}.': 'Your subscription expires on {}.', 'Renovar': 'Renew',
  'Tienes {} {} por calificar.': 'You have {} {} to rate.', 'Calificar ahora': 'Rate now', 'clase': 'class', 'clases': 'classes',
  'Completa tu perfil (colegio y acudiente si eres menor) para poder reservar.': 'Complete your profile (school, and guardian if you are a minor) to be able to book.', 'Ir a mi perfil': 'Go to my profile',
  'Colegio público': 'Public school', 'Colegio privado': 'Private school', 'Sin colegio': 'No school',
  'Virtual y presencial': 'Online and in person', 'Virtual': 'Online', 'Presencial': 'In person', 'Solo virtual': 'Online only',
  'Pendiente': 'Pending', 'Confirmada': 'Confirmed', 'Rechazada': 'Declined', 'Cancelada': 'Cancelled',

  // --- inicio ---
  'El arte de': 'The art of', 'aprender.': 'learning.',
  'Conecta con profesores, creadores y mentores de toda Colombia para dominar nuevas habilidades y oficios. Clases virtuales y presenciales.': 'Connect with teachers, creators and mentors across Colombia to master new skills and crafts. Online and in-person classes.',
  'Encontrar una clase': 'Find a class', 'Conviértete en mentor': 'Become a mentor', 'Publicar lo que busco': 'Post what I\'m looking for',
  'personas más felices ·': 'happier people ·', 'Conectamos metas y pasiones en un solo lugar.': 'We connect goals and passions in one place.',
  'Nuestra misión': 'Our mission', 'Hacer más felices a 10 millones de personas para 2030, conectándolas con quienes pueden guiarlas para que alcancen sus metas y sueños.': 'To make 10 million people happier by 2030, connecting them with those who can guide them to achieve their goals and dreams.',
  'Nuestra visión': 'Our vision', 'Ser el lugar de Latinoamérica donde cualquiera encuentra a quien le enseñe lo que sueña aprender, y donde cada pasión compartida se convierte en una oportunidad.': 'To be the place in Latin America where anyone finds someone to teach them what they dream of learning, and where every shared passion becomes an opportunity.',
  '¿Qué puedes aprender hoy?': 'What can you learn today?', 'Cada categoría trae mentores verificados. Elige la que más te llame y empieza hoy.': 'Every category has verified mentors. Pick the one that calls to you and start today.',
  'Aprenderás': 'You will learn', 'Te llevas': 'You gain', 'Ver disponibilidad': 'See availability',
  'Clases destacadas': 'Featured classes', 'Aún no hay clases publicadas. ¡Sé el primero!': 'No classes published yet. Be the first!',
  '¿Te sumas a ser más feliz?': 'Ready to be happier?', 'Suscríbete a nuestra plataforma y empieza a aprender hoy con mentores verificados.': 'Subscribe to our platform and start learning today with verified mentors.', 'Suscríbete ahora': 'Subscribe now',
  'con': 'with', '/ hora': '/ hour', 'Aún sin reseñas': 'No reviews yet',

  // --- listado de clases ---
  'Clases': 'Classes', 'Todas': 'All', 'Categorías': 'Categories', 'Materias': 'Subjects', 'Todas las materias': 'All subjects', 'Toda Colombia': 'All of Colombia',
  '{} o más': '{} or more', 'clase encontrada': 'class found', 'clases encontradas': 'classes found', 'Limpiar filtros': 'Clear filters',
  'No encontramos clases con esos filtros. Prueba con otros o': 'We found no classes with those filters. Try others or', 'publica lo que buscas': 'post what you are looking for',
  'Filtros{}': 'Filters{}', 'Cualquier modalidad': 'Any format', 'Cualquier calificación': 'Any rating', 'Mejor calificadas': 'Best rated',
  'Precio: menor a mayor': 'Price: low to high', 'Precio: mayor a menor': 'Price: high to low', 'Más recientes': 'Newest', 'Aplicar filtros': 'Apply filters',
  '¿Qué quieres aprender?': 'What do you want to learn?', 'Buscar': 'Search', 'Materia': 'Subject', 'Ciudad': 'City', 'Modalidad': 'Format',
  'Precio máx. por hora (COP)': 'Max price per hour (COP)', 'Precio máximo por hora': 'Max price per hour', 'Calificación mínima': 'Minimum rating', 'Ordenar por': 'Sort by',

  // --- clase ---
  'Esta clase no está disponible para reservas en este momento.': 'This class is not available for booking right now.',
  'Esta es tu clase. Administra tus horarios en': 'This is your class. Manage your availability in',
  'Ingresa': 'Log in', 'crea una cuenta de estudiante': 'create a student account', 'para reservar esta clase.': 'to book this class.',
  'Solo las cuentas de estudiante pueden reservar clases.': 'Only student accounts can book classes.',
  'Antes de reservar completa tu perfil (colegio público o privado y, si eres menor, tu acudiente).': 'Before booking, complete your profile (public or private school and, if you are a minor, your guardian).', 'Completar perfil': 'Complete profile',
  'Para reservar esta clase activa tu suscripción mensual de': 'To book this class, activate your monthly subscription of', '. Al terminar el pago volverás aquí para elegir tu horario.': '. After paying you will come back here to choose your time.',
  'Pagar suscripción y reservar': 'Pay subscription and book',
  'El mentor no tiene horarios libres en los próximos días. Prueba más tarde o': 'The mentor has no free times in the coming days. Try later or',
  'Mensaje para el mentor (opcional)': 'Message for the mentor (optional)', 'Pagar y reservar {}': 'Pay and book {}',
  'Pagas la clase ahora, de forma segura, a través de Artia. El mentor confirma tu reserva y, cuando la acepte, verás su WhatsApp para coordinar. Si no la acepta o no puede darte la clase, te devolvemos todo. Puedes cancelar sin costo hasta 24 horas antes.': 'You pay for the class now, securely, through Artia. The mentor confirms your booking and, once accepted, you will see their WhatsApp to coordinate. If they do not accept or cannot give the class, we refund everything. You can cancel free of charge up to 24 hours before.',
  'Cuéntale tu nivel y qué quieres trabajar': 'Tell them your level and what you want to work on', 'Elige tu horario': 'Choose your time',
  'Clases de {} minutos · Hora de Colombia (GMT-5)': '{}-minute classes · Colombia time (GMT-5)', 'Sin descripción.': 'No description.', '← Volver a las clases': '← Back to classes',
  'por hora · {} min por sesión · {}{}': 'per hour · {} min per session · {}{}', 'Mentor:': 'Mentor:', '· desde': '· from', '/ hora ': '/ hour ', 'reseña': 'review', 'reseñas': 'reviews',
  'Experiencia:': 'Experience:', 'No tiene clases disponibles por ahora.': 'No classes available right now.', 'Todavía no hay reseñas. Las dejan los estudiantes después de cada clase.': 'No reviews yet. Students leave them after each class.',
  'Clases de {}': 'Classes by {}', 'Reseñas': 'Reviews',

  // --- registro / ingreso ---
  'Crea tu cuenta de mentor': 'Create your mentor account', 'Crea tu cuenta de estudiante': 'Create your student account', 'Ingresa como mentor': 'Log in as a mentor', 'Ingresa como estudiante': 'Log in as a student',
  'Publica tus clases, define tus horarios y recibe estudiantes de toda Colombia.': 'Publish your classes, set your availability and welcome students from all over Colombia.',
  'Encuentra mentores verificados y reserva clases en el horario que te sirva.': 'Find verified mentors and book classes at a time that works for you.',
  'Nombre completo': 'Full name', '(mínimo 8 caracteres)': '(at least 8 characters)', '¿Tu colegio es público o privado? (Bogotá)': 'Is your school public or private? (Bogotá)',
  'Soy menor de 18 años (un acudiente deberá registrarse en mi perfil)': 'I am under 18 (a guardian will need to be added to my profile)',
  'Después de crear tu cuenta verificarás tu identidad (cédula, selfie y título) para que tus clases sean públicas.': 'After creating your account you will verify your identity (ID, selfie and credentials) so your classes can be public.',
  'Si soy menor de 18 años, mi acudiente los acepta y me autoriza a usar Artia.': 'If I am under 18, my guardian accepts them and authorizes me to use Artia.',
  'Acepto los': 'I accept the', 'Términos y Condiciones': 'Terms and Conditions', 'Política de Tratamiento de Datos Personales': 'Personal Data Processing Policy',
  '¿Olvidaste tu contraseña?': 'Forgot your password?', '¿Ya tienes cuenta?': 'Already have an account?', '¿Nuevo aquí?': 'New here?', 'Crea tu cuenta': 'Create your account',
  'Soy estudiante': 'I\'m a student', 'Soy mentor': 'I\'m a mentor', 'Correo electrónico': 'Email', 'Contraseña{}': 'Password{}', 'Tipo de cuenta': 'Account type', 'Selecciona tu ciudad': 'Select your city',
  'Autorizo el tratamiento de mis datos personales.': 'I authorize the processing of my personal data.',
  '¡Cuenta creada! Sigue los primeros pasos.': 'Account created! Follow the first steps.', '¡Hola de nuevo, {}!': 'Welcome back, {}!',

  // --- perfil ---
  'Sobre mí': 'About me', 'Cuéntanos de ti': 'Tell us about you', 'Materias que enseñas': 'Subjects you teach', '(marca todas las que ofreces)': '(check all you offer)',
  'Valor por hora (COP)': 'Price per hour (COP)', 'Experiencia y estudios': 'Experience and studies', 'Nivel educativo': 'Education level', 'Grado': 'Grade',
  'Me interesa aprender': 'I want to learn', '(marca todo lo que te interese)': '(check everything you like)', 'Otra': 'Other', '(escríbela)': '(write it in)',
  'Tu colegio': 'Your school', 'Nombre del colegio': 'School name', 'Localidad de Bogotá': 'Bogotá district', 'Soy menor de 18 años': 'I am under 18',
  'Nombre de tu acudiente': 'Guardian\'s name', 'Celular del acudiente': 'Guardian\'s mobile',
  'Los mentores solo ven tu grado y si tu colegio es público o privado, nunca el nombre del colegio. Si eres menor, comparten el contacto de tu acudiente, no el tuyo.': 'Mentors only see your grade and whether your school is public or private, never the school\'s name. If you are a minor, they share your guardian\'s contact, not yours.',
  'Ej. Danza, Fotografía (separa con comas)': 'E.g. Dance, Photography (separate with commas)', 'Otras materias que te interesan': 'Other subjects you are interested in',
  'Eliminar mi cuenta': 'Delete my account',
  'Borramos tus datos personales, tus documentos y tus solicitudes; desactivamos tus clases y cancelamos tus reservas futuras. Los registros de pagos se conservan, sin datos personales, por obligaciones contables. Esta acción no se puede deshacer.': 'We delete your personal data, your documents and your requests; we deactivate your classes and cancel your future bookings. Payment records are kept, without personal data, for accounting obligations. This cannot be undone.',
  'Escribe tu contraseña para confirmar': 'Type your password to confirm', 'Eliminar mi cuenta definitivamente': 'Delete my account permanently',
  'Mi perfil de {} {}': 'My {} profile {}', 'Nombre': 'Name', 'Celular (WhatsApp)': 'Mobile (WhatsApp)', 'Correo': 'Email',
  'Tu celular solo se comparte con la otra persona cuando una reserva es aceptada.': 'Your mobile number is only shared with the other person once a booking is accepted.',
  'Guardar perfil': 'Save profile', 'Seguridad de la cuenta': 'Account security', 'Contraseña actual': 'Current password', 'Nueva contraseña (mínimo 8 caracteres)': 'New password (at least 8 characters)', 'Cambiar contraseña': 'Change password',
  'Perfil guardado': 'Profile saved', 'Contraseña cambiada': 'Password changed', 'Tu cuenta fue eliminada': 'Your account was deleted', '¿Seguro que quieres eliminar tu cuenta? No se puede deshacer.': 'Are you sure you want to delete your account? This cannot be undone.',

  // --- suscripción ---
  '¡Pago aprobado! Ya puedes publicar tu solicitud.': 'Payment approved! You can now post your request.', '¡Pago aprobado! Ya puedes elegir tu horario.': 'Payment approved! You can now choose your time.',
  '¡Pago aprobado! Tu suscripción está activa.': 'Payment approved! Your subscription is active.', 'Tu pago está en proceso. Se activará en cuanto el banco lo confirme.': 'Your payment is processing. It will activate as soon as the bank confirms it.',
  'El pago no se completó. Puedes intentarlo de nuevo.': 'The payment was not completed. You can try again.',
  'Mentores con identidad verificada (cédula, selfie y título revisados)': 'Mentors with verified identity (ID, selfie and credentials reviewed)',
  'Pagos seguros a través de Artia y devolución si la clase no se da': 'Secure payments through Artia and a refund if the class does not take place',
  'Acceso a toda la oferta de clases': 'Access to all classes', 'Agenda para reservar y ver tus clases en un solo lugar': 'A schedule to book and see your classes in one place',
  'Contacto directo con tu mentor por WhatsApp al confirmar la reserva': 'Direct contact with your mentor on WhatsApp once the booking is confirmed',
  'Publica lo que buscas y recibe ofertas': 'Post what you are looking for and receive offers', 'Reseñas reales de otros estudiantes': 'Real reviews from other students',
  'Vigente hasta el': 'Valid until', '. Si renuevas ahora, se suman 30 días a tu fecha de vencimiento.': '. If you renew now, 30 days are added to your expiry date.',
  'Los pagos aún no están disponibles. Intenta más tarde.': 'Payments are not available yet. Please try later.', 'Modo de pruebas: no se cobra dinero real.': 'Test mode: no real money is charged.',
  'Pago seguro con Wompi (PSE, Nequi y tarjetas). Cada pago cubre 30 días; recuerda renovarlo antes de que venza.': 'Secure payment with Wompi (PSE, Nequi and cards). Each payment covers 30 days; remember to renew it before it expires.',
  'Fecha': 'Date', 'Valor': 'Amount', 'Estado': 'Status', 'Aún no tienes pagos.': 'You have no payments yet.', 'Plan {}': '{} plan', '/ mes': '/ month',
  'Con tu suscripción mantenemos la plataforma segura: verificamos a cada mentor, cuidamos tus datos y te damos la agenda y las herramientas para reservar sin complicaciones.': 'With your subscription we keep the platform safe: we verify every mentor, protect your data and give you the schedule and tools to book hassle-free.',
  'Historial de pagos': 'Payment history', 'Renovar ': 'Renew ', 'Pagar': 'Pay', 'Activa': 'Active', 'Inactiva': 'Inactive', 'Estudiante': 'Student', 'Mentor (sin costo)': 'Mentor (free)',
  'Suscripción activada (modo de pruebas)': 'Subscription activated (test mode)',

  // --- verificación del mentor ---
  'Verificación de mentor': 'Mentor verification', 'Sin iniciar': 'Not started', 'En proceso': 'In progress', 'Identidad confirmada': 'Identity confirmed', 'Requiere revisión manual': 'Needs manual review', 'No se pudo verificar': 'Could not be verified',
  'Sin enviar': 'Not submitted', 'En revisión': 'Under review', 'Verificado': 'Verified', 'Rechazado': 'Rejected', 'Cargado': 'Uploaded', 'Falta': 'Missing',
  'Estamos procesando tu verificación de identidad. Esto toma unos segundos; esta página se actualiza sola.': 'We are processing your identity verification. This takes a few seconds; this page updates by itself.',
  'Motivo: {}. Corrige y vuelve a enviar.': 'Reason: {}. Fix it and submit again.', 'Recibimos tu información. Un administrador la revisará pronto.': 'We received your information. An administrator will review it soon.',
  'Tu identidad fue verificada. Tus clases muestran la insignia': 'Your identity was verified. Your classes show the badge',
  'Autorización': 'Authorization', 'Autorizar y continuar': 'Authorize and continue', '1. Verifica tu identidad': '1. Verify your identity', '2. Documentos': '2. Documents', 'Obligatorios': 'Required',
  'Para publicar tus clases necesitamos': 'To publish your classes we need', 'los dos documentos': 'both documents', '. Un administrador los puede revisar.': '. An administrator may review them.',
  'Estado:': 'Status:', '¿Con qué documento te vas a verificar?': 'Which document will you verify with?', 'Cédula de ciudadanía de Colombia': 'Colombian national ID (cédula de ciudadanía)',
  'Documento de otro país: pasaporte, cédula de extranjería u otro documento de identidad vigente': 'Document from another country: passport, foreigner ID or another valid identity document',
  'Verificar mi identidad': 'Verify my identity', 'Repetir verificación': 'Repeat verification',
  'No tienes que escribir tu número de documento: lo leemos del documento. Tomarás una foto de tu cédula o pasaporte y una selfie. Comprobamos que el documento sea real, que coincida con tu nombre, y que la selfie sea tuya.{}': 'You do not need to type your document number: we read it from the document. You will take a photo of your ID or passport and a selfie. We check that the document is real, matches your name, and that the selfie is yours.{}',
  'Foto de tu documento de identidad *': 'Photo of your identity document *', 'Cédula (por ambos lados) o pasaporte. JPG, PNG o PDF, máximo 4 MB. Debe verse completa y legible.': 'ID (both sides) or passport. JPG, PNG or PDF, max 4 MB. It must be fully visible and legible.',
  'Título, diploma o certificado *': 'Degree, diploma or certificate *', 'Del estudio o experiencia que respalda lo que enseñas (JPG, PNG o PDF, máximo 4 MB).': 'Of the study or experience that backs what you teach (JPG, PNG or PDF, max 4 MB).',
  'Terminar verificación': 'Finish verification', 'Enviar a revisión': 'Submit for review', 'Para continuar falta: {}.': 'To continue you still need to: {}.',
  'Solo el equipo de Artia ve tus documentos. No se muestran en tu perfil público.': 'Only the Artia team sees your documents. They are not shown on your public profile.',
  'escribir tu nombre y apellido completos en tu perfil': 'write your full first and last name in your profile', 'verificar tu identidad (paso 1)': 'verify your identity (step 1)',
  'subir la foto de tu documento de identidad': 'upload the photo of your identity document', 'subir tu título o certificado': 'upload your degree or certificate',
  'El archivo supera los 4 MB.': 'The file is over 4 MB.', 'No se pudo subir el archivo.': 'The file could not be uploaded.', 'Documento cargado': 'Document uploaded',
  '¡Verificado automáticamente!': 'Verified automatically!', 'Resultado procesado': 'Result processed', '¡Verificado! Tus clases ya muestran la insignia.': 'Verified! Your classes now show the badge.', 'Enviado a revisión': 'Submitted for review', 'Autorización registrada': 'Authorization recorded',

  // --- clases y horarios del mentor ---
  'Pausada': 'Paused', 'Oculta: {}': 'Hidden: {}', 'Visible': 'Visible', 'Editar': 'Edit', 'Eliminar': 'Delete', 'Aún no has publicado clases. Crea la primera aquí abajo.': 'You have not published any classes yet. Create your first one below.',
  'Editar clase': 'Edit class', 'Publicar una clase': 'Publish a class', 'Todos los niveles': 'All levels', 'Clase visible para estudiantes': 'Class visible to students', 'Guardar cambios': 'Save changes', 'Publicar clase': 'Publish class', 'Cancelar': 'Cancel',
  'Título': 'Title', 'Nivel': 'Level', 'Descripción': 'Description', 'Precio por hora (COP)': 'Price per hour (COP)', 'Duración por sesión (min)': 'Session length (min)', 'Ciudad (para presencial)': 'City (for in-person)',
  'Ej. Refuerzo de matemáticas para bachillerato': 'E.g. Math tutoring for high school', 'Sin disponibilidad': 'No availability', 'Desde': 'From', 'Hasta': 'To', 'Quitar': 'Remove', '+ Agregar bloque': '+ Add block', 'Mis horarios': 'My availability',
  'Define en qué horas puedes dar clase cada semana (hora de Colombia). Los estudiantes reservarán dentro de estos bloques, en espacios de la duración de cada clase.': 'Set the hours you can teach each week (Colombia time). Students will book within these blocks, in slots the length of each class.',
  'Guardar horarios': 'Save availability', 'Horarios guardados': 'Availability saved', 'Clase actualizada': 'Class updated', '¡Clase publicada!': 'Class published!', '¿Eliminar esta clase?': 'Delete this class?',
  'Primaria': 'Primary school', 'Bachillerato': 'High school', 'Preuniversitario': 'Pre-university', 'Universitario': 'University', 'Adultos / profesional': 'Adults / professional',
  'Preescolar': 'Preschool', 'Técnico / tecnológico': 'Technical / vocational', 'Otro': 'Other',

  // --- solicitudes ---
  'Sin detalles.': 'No details.', 'a convenir': 'to be agreed', 'Ya enviaste una oferta': 'You already sent an offer', 'Clase que ofreces (opcional)': 'Class you offer (optional)', 'Tu mensaje': 'Your message', 'Enviar oferta': 'Send offer',
  'Hola, puedo ayudarte con esto. Mi experiencia es…': 'Hi, I can help you with this. My experience is…', 'No hay solicitudes abiertas por ahora.': 'There are no open requests right now.', 'Estudiantes que buscan clase': 'Students looking for a class',
  'Para publicar una solicitud activa tu suscripción mensual de': 'To post a request, activate your monthly subscription of', '. Al terminar el pago volverás aquí.': '. After paying you will come back here.', 'Pagar suscripción': 'Pay subscription',
  'Ver clase: {}': 'See class: {}', 'Ofertas de mentores ({})': 'Offers from mentors ({})', 'Eliminar solicitud': 'Delete request', 'Aún no has publicado solicitudes.': 'You have not posted any requests yet.',
  'Lo que estoy buscando': 'What I\'m looking for', 'Publicar una solicitud': 'Post a request', 'Presupuesto por hora (COP, 0 = a convenir)': 'Budget per hour (COP, 0 = to be agreed)', 'Detalles': 'Details', 'Publicar solicitud': 'Post request',
  'Mis solicitudes': 'My requests', 'Tu nivel, tus metas, horarios disponibles…': 'Your level, your goals, your available times…', 'Solicitud publicada': 'Request posted', 'Oferta enviada': 'Offer sent', '¿Eliminar esta solicitud?': 'Delete this request?',

  // --- agenda y reservas ---
  'Pendiente de pago': 'Payment pending', 'Recibes': 'You receive', '(valor {} − comisión de Artia {})': '(price {} − Artia commission {})', '· se te paga con la liquidación mensual': '· paid to you in the monthly payout',
  'Total a pagar': 'Total to pay', 'Pagado': 'Paid', 'Devolución en proceso': 'Refund in progress', 'Devuelto': 'Refunded', '· te lo devolveremos a tu medio de pago': '· we will refund it to your payment method',
  'Contacto con {}:': 'Contact with {}:', 'WhatsApp {}': 'WhatsApp {}', 'La otra persona aún no tiene celular en su perfil.': 'The other person has not added a mobile number yet.',
  'Reseña del estudiante': 'Student review', 'Tu reseña': 'Your review', '📅 Google Calendar': '📅 Google Calendar', '📅 Apple / Outlook (.ics)': '📅 Apple / Outlook (.ics)', 'Aceptar ': 'Accept ', 'Rechazar': 'Decline', 'Pagar ahora {}': 'Pay now {}',
  '¿Cómo fue tu clase?': 'How was your class?', 'Calificación': 'Rating', 'Selecciona': 'Select', 'Comentario (opcional)': 'Comment (optional)', 'Publicar reseña': 'Post review', 'Cuéntales a otros estudiantes cómo te fue': 'Tell other students how it went',
  'Muy mala': 'Very bad', 'Mala': 'Bad', 'Regular': 'Okay', 'Buena': 'Good', 'Excelente': 'Excellent',
  'Pago aprobado (modo de pruebas). El mentor ya puede aceptar tu reserva.': 'Payment approved (test mode). The mentor can now accept your booking.', 'Mi agenda de clases': 'My class schedule',
  '¡Pago recibido! Ahora el mentor debe aceptar tu reserva; te avisaremos por correo.': 'Payment received! Now the mentor must accept your booking; we will email you.',
  'Tu pago está en proceso. Se confirmará en cuanto el banco lo apruebe.': 'Your payment is processing. It will be confirmed as soon as the bank approves it.',
  'El pago no se completó y tu horario se liberó. Puedes intentarlo de nuevo desde la clase.': 'The payment was not completed and your time slot was released. You can try again from the class page.',
  'solicitud pendiente': 'pending request', 'solicitudes pendientes': 'pending requests', 'Tienes {} {} por responder.': 'You have {} {} to answer.',
  'Por calificar': 'To rate', 'Tu opinión ayuda a otros estudiantes y a tu mentor. Elige las estrellas; escribir un comentario es opcional.': 'Your opinion helps other students and your mentor. Pick the stars; writing a comment is optional.',
  'Cuando un estudiante reserve, aparecerá aquí.': 'When a student books, it will show up here.', 'Busca una clase': 'Find a class', 'y reserva tu horario.': 'and book your time.', 'No tienes clases próximas. {}': 'You have no upcoming classes. {}',
  'Historial': 'History', 'Próximas clases': 'Upcoming classes', '📅 Sincroniza tu calendario': '📅 Sync your calendar',
  'Agrega este enlace una sola vez a Google Calendar, Apple Calendar u Outlook y tus clases aparecerán (y se actualizarán) solas. Es personal: no lo compartas.': 'Add this link once to Google Calendar, Apple Calendar or Outlook and your classes will appear (and update) on their own. It is personal: do not share it.',
  'Obtener mi enlace': 'Get my link', 'Tu enlace de calendario': 'Your calendar link', 'Abrir en mi app de calendario': 'Open in my calendar app', 'Agregar a Google Calendar': 'Add to Google Calendar', 'Generar enlace nuevo': 'Generate new link',
  'El enlace anterior dejará de funcionar. ¿Generar uno nuevo?': 'The previous link will stop working. Generate a new one?',
  'Faltan menos de 24 horas para la clase: si la cancelas no habrá devolución del pago. ¿Cancelar de todos modos?': 'There are less than 24 hours left before the class: if you cancel, the payment will not be refunded. Cancel anyway?', '¿Cancelar esta clase?': 'Cancel this class?',
  'Sesión cerrada': 'Logged out', 'Gracias por aceptar': 'Thanks for accepting',

  // --- ganancias del mentor ---
  'Publicar tus clases en Artia no cuesta nada. El estudiante paga la clase a Artia al reservar, y cada mes te pagamos lo acumulado, descontando una comisión de': 'Publishing your classes on Artia is free. The student pays Artia for the class when booking, and every month we pay you what you accumulated, minus a commission of',
  'Por pagarte': 'To be paid to you', ': {} {} · valor {} − comisión {} =': ': {} {} · price {} − commission {} =', 'Aún no tienes clases dadas pendientes de pago.': 'You have no taught classes pending payment yet.',
  'clase pagada y confirmada está': 'paid and confirmed class is', 'clases pagadas y confirmadas están': 'paid and confirmed classes are', '{} {} por realizarse; sumarán a tus ganancias cuando se den.': '{} {} still to take place; they will add to your earnings once given.',
  'Agrega tu cuenta para que podamos pagarte cada mes.': 'Add your account so we can pay you every month.', 'Cuenta de ahorros': 'Savings account', 'Cuenta corriente': 'Checking account', 'Nequi': 'Nequi', 'Daviplata': 'Daviplata',
  '(valor {} − comisión {})': '(price {} − commission {})', 'Transferencia {} · {}': 'Transfer {} · {}', 'Pagos recibidos': 'Payments received', 'Datos para recibir tus pagos': 'Details to receive your payments', 'Tipo': 'Type',
  'Banco (si es cuenta bancaria)': 'Bank (if it is a bank account)', 'Número de cuenta o celular': 'Account number or mobile', 'Nombre del titular': 'Account holder\'s name', 'Guardar': 'Save',
  'Solo tú y el equipo de Artia pueden ver estos datos.': 'Only you and the Artia team can see this information.', 'Debe coincidir con tu cédula': 'Must match your ID', 'Datos guardados': 'Details saved',

  // --- primeros pasos ---
  '¡Todo listo!': 'All set!', 'Bienvenid@, {}': 'Welcome, {}', 'Sigue estos pasos para publicar tus clases y recibir estudiantes.': 'Follow these steps to publish your classes and welcome students.',
  'Sigue estos pasos para reservar tu primera clase en minutos.': 'Follow these steps to book your first class in minutes.', 'Listo': 'Done', 'Ver mi agenda': 'See my schedule', '{} de {} pasos completados': '{} of {} steps completed',
  'Completa tu perfil': 'Complete your profile', 'Elige y reserva tu primera clase (pagas la suscripción al reservar)': 'Choose and book your first class (you pay the subscription when booking)',
  'Verifica tu identidad (cédula y título)': 'Verify your identity (ID and credentials)', 'Agrega los datos para recibir tus pagos': 'Add your details to receive payments', 'Publica tu primera clase': 'Publish your first class', 'Define tus horarios disponibles': 'Set your available hours',
  'En revisión ': 'Under review', 'Empezar': 'Start', 'Ir': 'Go',

  // --- ayuda con la clave y otros ---
  'Por ahora la recuperamos con ayuda de nuestro equipo.': 'For now we recover it with the help of our team.', 'Escríbenos {}': 'Write to us {}', 'desde el correo con el que te registraste': 'from the email you signed up with',
  'Confirmaremos que eres tú y te daremos una': 'We will confirm it is you and give you a', 'clave temporal': 'temporary password', 'Entra con ella: Artia te pedirá cambiarla por una nueva.': 'Log in with it: Artia will ask you to change it for a new one.', 'Volver a ingresar': 'Back to log in',
  'a nuestro canal de soporte': 'at our support channel', 'Página no encontrada.': 'Page not found.', 'Ir al inicio': 'Go to home', 'Soporte: {}': 'Support: {}',
  'Borrador.': 'Draft.', 'Este texto debe ser revisado por un abogado y completado antes de publicar la plataforma.': 'This text must be reviewed by a lawyer and completed before the platform is published.',
  'Política de Tratamiento de Datos': 'Data Processing Policy', 'Versión {} ·': 'Version {} ·',
  'Los documentos legales están en español; en caso de diferencia, prevalece la versión en español.': 'Legal documents are in Spanish; in case of any difference, the Spanish version prevails.',

  // --- pie de página y meta ---
  'Artia · El arte de aprender': 'Artia · The art of learning',
  'Precios en pesos colombianos (COP) · Las clases se pagan de forma segura a través de Artia.': 'Prices in Colombian pesos (COP) · Classes are paid securely through Artia.',
  'Artia — el arte de aprender': 'Artia — the art of learning',

  // --- catálogo: categorías y materias ---
  'Idiomas': 'Languages', 'Ciencias y números': 'Science and numbers', 'Humanidades': 'Humanities', 'Bienestar y espiritualidad': 'Wellness and spirituality', 'Arte y creatividad': 'Art and creativity', 'Deportes': 'Sports', 'Tecnología': 'Technology',
  'Business': 'Business', 'Psicoterapia': 'Psychotherapy', 'Danza': 'Dance', 'Música': 'Music', 'Juegos de mesa': 'Board games', 'Pastelería': 'Pastry', 'Cocina': 'Cooking', 'Enología': 'Wine studies', 'Decoración': 'Interior decor',
  'Inglés': 'English', 'Francés': 'French', 'Alemán': 'German', 'Italiano': 'Italian', 'Matemáticas': 'Mathematics', 'Física': 'Physics', 'Química': 'Chemistry', 'Contabilidad': 'Accounting', 'Ciencias sociales': 'Social sciences', 'Escritura': 'Writing',
  'Yoga': 'Yoga', 'Pilates': 'Pilates', 'Astrología': 'Astrology', 'Reiki': 'Reiki', 'Ángeles': 'Angels', 'Tarot': 'Tarot', 'Cerámica': 'Ceramics', 'Arte': 'Art', 'Tenis': 'Tennis', 'Pádel': 'Padel', 'Rutinas de ejercicio': 'Workout routines', 'Golf': 'Golf',
  'Inteligencia artificial': 'Artificial intelligence', 'UX/UI Design': 'UX/UI Design', 'Programación': 'Programming', 'Finanzas personales': 'Personal finance', 'Finanzas': 'Finance', 'Startups': 'Startups',
  'Hablar, entender y escribir un nuevo idioma con confianza, en situaciones reales.': 'Speak, understand and write a new language with confidence, in real situations.',
  'Nuevas oportunidades de trabajo, viajes y amistades en cualquier parte del mundo.': 'New job opportunities, travel and friendships anywhere in the world.',
  'Razonar con lógica y resolver problemas, de las matemáticas a la contabilidad.': 'Reason logically and solve problems, from mathematics to accounting.',
  'Seguridad para rendir en tus estudios y manejar tu dinero con criterio.': 'Confidence to excel in your studies and manage your money wisely.',
  'Entender la sociedad, ordenar tus ideas y escribir con claridad y estilo.': 'Understand society, organize your ideas and write with clarity and style.',
  'Pensamiento crítico y una voz propia para contar tu historia.': 'Critical thinking and a voice of your own to tell your story.',
  'Cuidar tu cuerpo y tu mente con yoga, pilates y prácticas de autoconocimiento.': 'Take care of your body and mind with yoga, pilates and self-knowledge practices.',
  'Más calma, energía y equilibrio para tu día a día.': 'More calm, energy and balance for your everyday life.',
  'Crear con tus manos y tu imaginación, desde la cerámica hasta el arte.': 'Create with your hands and your imagination, from ceramics to art.',
  'Un espacio para expresarte, soltar el estrés y sentir orgullo de lo que haces.': 'A space to express yourself, let go of stress and feel proud of what you make.',
  'Mejorar tu técnica y tu condición física en tenis, pádel, golf y rutinas de ejercicio.': 'Improve your technique and fitness in tennis, padel, golf and workout routines.',
  'Salud, disciplina y nuevos planes para compartir con otros.': 'Health, discipline and new plans to share with others.',
  'Diseñar, programar y usar la inteligencia artificial para crear y automatizar.': 'Design, code and use artificial intelligence to create and automate.',
  'Habilidades muy buscadas que abren puertas y te permiten construir tus propias ideas.': 'In-demand skills that open doors and let you build your own ideas.',
  'Manejar tus finanzas, entender el dinero y dar los primeros pasos para crear una empresa.': 'Manage your finances, understand money and take the first steps to start a company.',
  'Autonomía financiera y las herramientas para convertir una idea en un negocio.': 'Financial independence and the tools to turn an idea into a business.',
  'Espacios guiados por profesionales para entender mejor tus emociones y tus relaciones.': 'Professionally guided spaces to better understand your emotions and relationships.',
  'Más bienestar emocional y herramientas para los retos de la vida.': 'More emotional well-being and tools for life\'s challenges.',
  'Moverte con ritmo y expresión, desde tus primeros pasos hasta coreografías completas.': 'Move with rhythm and expression, from your first steps to full choreographies.',
  'Alegría, confianza en tu cuerpo y una forma divertida de ejercitarte.': 'Joy, confidence in your body and a fun way to exercise.',
  'Tocar un instrumento, cantar o leer música con un guía a tu lado.': 'Play an instrument, sing or read music with a guide by your side.',
  'El placer de crear música y una pasión que te acompaña toda la vida.': 'The joy of making music and a passion that stays with you for life.',
  'Reglas, estrategias y trucos para jugar mejor y descubrir juegos nuevos.': 'Rules, strategies and tricks to play better and discover new games.',
  'Planes entretenidos con amigos y familia, y un buen entrenamiento para tu mente.': 'Fun plans with friends and family, and a great workout for your mind.',
  'Técnicas para hornear y decorar tortas, postres y panes.': 'Techniques to bake and decorate cakes, desserts and breads.',
  'Un talento para sorprender a los tuyos y, si quieres, una idea de emprendimiento.': 'A talent to surprise your loved ones and, if you want, a business idea.',
  'Cocinar con técnica y sabor, de lo básico a recetas con sello propio.': 'Cook with technique and flavor, from the basics to recipes with your own touch.',
  'Comer mejor, ahorrar y disfrutar de compartir un plato hecho por ti.': 'Eat better, save money and enjoy sharing a dish you made.',
  'Conocer el vino: cómo se hace, cómo se cata y con qué se disfruta.': 'Get to know wine: how it is made, how it is tasted and what to enjoy it with.',
  'Criterio para elegir, maridar y disfrutar cada copa.': 'Good judgment to choose, pair and enjoy every glass.',
  'Transformar tus espacios con color, luz y distribución.': 'Transform your spaces with color, light and layout.',
  'Un hogar que se siente tuyo y el ojo para crear ambientes especiales.': 'A home that feels like yours and the eye to create special atmospheres.',
  'Público (oficial)': 'Public (state)', 'Privado': 'Private', 'No estoy en un colegio': 'I am not in school',
  'Domingo': 'Sunday', 'Lunes': 'Monday', 'Martes': 'Tuesday', 'Miércoles': 'Wednesday', 'Jueves': 'Thursday', 'Viernes': 'Friday', 'Sábado': 'Saturday',

  // --- mensajes del servidor ---
  'Debes iniciar sesión.': 'You must log in.', 'Solo disponible para {}.': 'Only available for {}.', 'Necesitas una suscripción activa. Actívala en la sección «Suscripción».': 'You need an active subscription. Activate it in the "Subscription" section.',
  'Tu cuenta de mentor aún no está verificada.': 'Your mentor account is not verified yet.', 'Elige una {} de la lista.': 'Choose a {} from the list.', '«{}» no está en la lista de materias.': '"{}" is not in the subject list.',
  'La contraseña debe tener al menos 8 caracteres.': 'The password must be at least 8 characters.', 'Demasiadas cuentas creadas desde esta conexión. Inténtalo más tarde.': 'Too many accounts created from this connection. Try again later.',
  'Elige si eres mentor o estudiante.': 'Choose whether you are a mentor or a student.', 'El correo no es válido.': 'The email is not valid.',
  'Indica si tu colegio es público, privado o si no estás en un colegio.': 'Say whether your school is public, private, or whether you are not in school.',
  'Debes aceptar los Términos y Condiciones y la Política de Tratamiento de Datos para crear tu cuenta.': 'You must accept the Terms and Conditions and the Data Processing Policy to create your account.',
  'Para ser mentor debes autorizar la verificación de tu identidad (cédula, selfie y documentos).': 'To be a mentor you must authorize the verification of your identity (ID, selfie and documents).',
  'Ya existe una cuenta con ese correo.': 'An account with that email already exists.', 'Demasiados intentos. Espera unos minutos.': 'Too many attempts. Wait a few minutes.', 'Correo o contraseña incorrectos.': 'Incorrect email or password.',
  'Esta cuenta es de mentor. Ingresa por «Soy mentor».': 'This is a mentor account. Log in through "I\'m a mentor".', 'Esta cuenta es de estudiante. Ingresa por «Soy estudiante».': 'This is a student account. Log in through "I\'m a student".',
  'Tu cuenta está suspendida o fue eliminada.{}': 'Your account is suspended or was deleted.{}', 'La contraseña actual no es correcta.': 'The current password is not correct.', 'La contraseña no es correcta.': 'The password is not correct.',
  'Debes aceptar los Términos y la Política de Tratamiento de Datos.': 'You must accept the Terms and the Data Processing Policy.',
  'El celular debe tener 10 dígitos y empezar por 3 (ej. 300 123 4567).': 'The mobile number must have 10 digits and start with 3 (e.g. 300 123 4567).', 'Selecciona una ciudad de la lista.': 'Select a city from the list.',
  'Modalidad no válida.': 'Invalid format.', 'Selecciona una localidad de Bogotá de la lista.': 'Select a Bogotá district from the list.', 'Selecciona un grado de la lista.': 'Select a grade from the list.',
  'El celular del acudiente debe tener 10 dígitos y empezar por 3.': 'The guardian\'s mobile number must have 10 digits and start with 3.', 'Mentor no encontrado.': 'Mentor not found.', 'Clase no encontrada.': 'Class not found.',
  'Indica la ciudad para clases presenciales.': 'Enter the city for in-person classes.', 'Indica tu ciudad para clases presenciales.': 'Enter your city for in-person classes.', 'Solicitud no encontrada.': 'Request not found.', 'Esa clase no es tuya.': 'That class is not yours.',
  'Ya enviaste una oferta a esta solicitud.': 'You already sent an offer to this request.', 'Elige una fecha y una hora.': 'Choose a date and a time.', 'La fecha está fuera del rango disponible.': 'The date is outside the available range.',
  'Ese horario ya no está disponible. Elige otro.': 'That time is no longer available. Choose another.', 'Ya tienes otra clase reservada a esa hora.': 'You already have another class booked at that time.', 'Ese horario acaba de ser reservado. Elige otro.': 'That time was just booked. Choose another.',
  'Reserva no encontrada.': 'Booking not found.', 'Esta reserva está esperando el pago.': 'This booking is waiting for payment.', 'Esa clase ya pasó.': 'That class has already taken place.', 'No puedes hacer ese cambio.': 'You cannot make that change.',
  'Solo puedes calificar clases que fueron aceptadas.': 'You can only rate classes that were accepted.', 'Podrás calificar cuando termine la clase.': 'You will be able to rate once the class ends.', 'Ya calificaste esta clase.': 'You already rated this class.',
  'Antes debes autorizar el tratamiento de tu cédula, tu selfie y tus documentos para verificar tu identidad.': 'First you must authorize the processing of your ID, selfie and documents to verify your identity.', 'Debes marcar la autorización para continuar.': 'You must check the authorization to continue.',
  'Adjunta un archivo.': 'Attach a file.', 'El archivo debe ser una imagen JPG, PNG o un PDF.': 'The file must be a JPG or PNG image or a PDF.', 'No pudimos guardar el documento. Inténtalo de nuevo.': 'We could not save the document. Please try again.',
  'La verificación de identidad aún no está disponible.': 'Identity verification is not available yet.', 'Tu cuenta ya está verificada.': 'Your account is already verified.',
  'Escribe tu nombre y apellido completos en tu perfil, como aparecen en tu cédula.': 'Write your full first and last name in your profile, as they appear on your ID.', 'No pudimos iniciar la verificación. Inténtalo de nuevo.': 'We could not start the verification. Please try again.',
  'Ya enviaste tu verificación.': 'You already submitted your verification.', 'Sube la foto de tu documento de identidad (cédula o pasaporte).': 'Upload the photo of your identity document (ID or passport).', 'Sube tu título o certificado.': 'Upload your degree or certificate.',
  'Completa primero la verificación de identidad.': 'Complete the identity verification first.', 'Sube tu cédula y tu título o certificado.': 'Upload your ID and your degree or certificate.', 'Documento no encontrado.': 'Document not found.',
  'Los pagos aún no están configurados.': 'Payments are not set up yet.', 'Esta reserva ya no está pendiente de pago.': 'This booking is no longer pending payment.', 'Elige el tipo de cuenta.': 'Choose the account type.', 'El número de cuenta o celular no es válido.': 'The account number or mobile is not valid.',
  'Pago no encontrado.': 'Payment not found.', 'Enlace no válido.': 'Invalid link.', 'Solicitud demasiado grande.': 'Request too large.', 'Falta el {}.': 'The {} is missing.', 'El {} no es válido.': 'The {} is not valid.',
  'Formato de horarios no válido.': 'Invalid availability format.', 'Demasiados bloques de horario.': 'Too many time blocks.', 'Día no válido.': 'Invalid day.', 'Las horas deben tener el formato HH:MM.': 'Times must use the HH:MM format.',
  'La hora de inicio debe ser anterior a la hora de fin.': 'The start time must be before the end time.', 'Hay bloques de horario que se cruzan el mismo día.': 'Some time blocks overlap on the same day.',
  'Tipo de documento no válido.': 'Invalid document type.',
};

// Patrones: claves con {} se convierten en expresiones regulares.
const exactos = new Map();
const patrones = [];
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const [k, v] of Object.entries(EN)) {
  if (k.includes('{}')) {
    const literal = k.replace(/\{\}/g, '').replace(/[^A-Za-zÁÉÍÓÚáéíóúñ]/g, '');
    if (literal.length >= 4) patrones.push([new RegExp('^' + k.split('{}').map(escapar).join('([\\s\\S]*?)') + '$'), v]);
  } else exactos.set(k, v);
}
const rellenar = (plantilla, grupos) => { let i = 0; return plantilla.replace(/\{\}/g, () => grupos[i++] ?? ''); };

/** Traduce un texto si hay equivalente; si no, lo devuelve igual. */
export function tr(texto) {
  if (!EN_ACTIVO || typeof texto !== 'string' || !texto) return texto;
  const e = exactos.get(texto);
  if (e !== undefined) return e;
  const limpio = texto.trim();
  if (limpio !== texto) {
    const t = tr(limpio);
    return t === limpio ? texto : texto.slice(0, texto.indexOf(limpio)) + t + texto.slice(texto.indexOf(limpio) + limpio.length);
  }
  for (const [re, v] of patrones) {
    const m = re.exec(texto);
    if (m) return rellenar(v, m.slice(1));
  }
  return texto;
}

const MARCA = '\u0001';
const cache = new WeakMap();
/** Traduce las partes estáticas de una plantilla html`...` (solo texto entre etiquetas y atributos placeholder/aria-label/title/alt). */
export function trPlantilla(strings) {
  if (!EN_ACTIVO) return { strings, texto: null };
  let r = cache.get(strings);
  if (r) return r;
  const unido = strings.join(MARCA);
  // contexto de cada interpolación: ¿está en texto (true) o dentro de una etiqueta (false)?
  const contexto = [];
  let dentro = false;
  for (const ch of unido) {
    if (ch === '<') dentro = true;
    else if (ch === '>') dentro = false;
    else if (ch === MARCA) contexto.push(!dentro);
  }
  const traducido = unido
    .replace(/(^|>)([^<>]+)(?=<|$)/g, (todo, pre, parte) => {
      const clave = parte.replace(/\s+/g, ' ').trim().replace(new RegExp(MARCA, 'g'), '{}');
      if (!clave || clave === '{}') return todo;
      const t = clave.includes('{}') ? tr(clave) : tr(clave);
      if (t === clave) return todo;
      // se conservan los espacios de los extremos; las {} vuelven a ser marcas, en el mismo orden
      const lead = parte.match(/^\s*/)[0], trail = parte.match(/\s*$/)[0];
      return pre + lead + t.replace(/\{\}/g, MARCA) + trail;
    })
    .replace(/(placeholder|aria-label|title|alt)="([^"\u0001]+)"/g, (todo, a, v) => { const t = tr(v); return t === v ? todo : `${a}="${t}"`; });
  const nuevas = traducido.split(MARCA);
  r = { strings: nuevas.length === strings.length ? nuevas : strings, texto: contexto };
  cache.set(strings, r);
  return r;
}

/** Traduce los nodos de texto y atributos de un trozo de la página que no se genera con html`` (cabecera, pie). */
export function traducirDom(raiz) {
  if (!EN_ACTIVO || !raiz) return;
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const t = tr(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; }
  for (const el of raiz.querySelectorAll('[aria-label],[title],[placeholder]')) {
    for (const a of ['aria-label', 'title', 'placeholder']) if (el.hasAttribute(a)) el.setAttribute(a, tr(el.getAttribute(a)));
  }
}
