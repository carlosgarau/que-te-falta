# Respuestas preparadas para App Store Connect

Valores previstos para la primera versión de **¿Qué te falta?**. Deben copiarse en App Store Connect cuando Apple active la membresía.

## Nueva aplicación

- Plataforma: iOS.
- Nombre público: `¿Qué te falta?`.
- Idioma principal: Español (España).
- Bundle ID: `com.carlosgarau.lacompra`.
- SKU: `LA-COMPRA-IOS-001`.
- Acceso de usuarios: completo.
- Compatibilidad inicial: iPhone, iOS 15 o posterior, orientación vertical.
- Precio: gratis.
- Compras integradas: no.
- Inicio de sesión: opcional para el uso personal y necesario para compartir o sincronizar listas. Compatible con Apple y Google.

## Categorías y derechos

- Categoría principal: Compras.
- Categoría secundaria: Productividad.
- Contenido editorial de terceros: no.
- Derechos de contenido: la aplicación solo muestra contenido introducido por las personas que usan la lista.
- Made for Kids: no.

## Privacidad

- Seguimiento, publicidad y analítica: no.
- Nombre y correo electrónico: sí, únicamente al iniciar sesión con Apple o Google.
  - Finalidad: funcionalidad de la aplicación y gestión de miembros.
  - Vinculado con la identidad: sí.
  - Usado para seguimiento: no.
- Foto de perfil: sí, si el proveedor de acceso la facilita.
  - Finalidad: mostrar la identidad dentro de la lista compartida.
  - Vinculada con la identidad: sí.
  - Usada para seguimiento: no.
- Fotos de productos: opcionales, únicamente cuando la persona decide hacer o elegir una foto al editar un producto.
  - Finalidad: identificar una marca, tamaño o envase dentro de la lista.
  - Vinculadas con la identidad: sí cuando la lista se comparte mediante una cuenta.
  - Usadas para seguimiento: no.
- Teléfono, contactos y ubicación: no se recopilan.
- Audio: no se almacena; el micrófono se activa únicamente al pulsar el botón de voz.
- Contenido del usuario: sí, únicamente productos, cantidades, listas, caducidades y fotos opcionales cuando se activa una lista compartida.
  - Finalidad: funcionalidad de la aplicación.
  - Vinculado con la identidad: sí cuando se comparte mediante una cuenta.
  - Usado para seguimiento: no.
- Historial de compras: sí, cuando se activa una lista compartida.
  - Finalidades: personalización del producto y funcionalidad de la aplicación.
  - Vinculado con la identidad: sí cuando se comparte mediante una cuenta.
  - Usado para seguimiento: no.
- Identificador del dispositivo: identificador aleatorio de instalación para sincronización.
  - Finalidad: funcionalidad de la aplicación.
  - Vinculado con la identidad: no.
  - Usado para seguimiento: no.
- Identificador de usuario: sí, generado por Firebase Authentication.
  - Finalidad: autenticación, sincronización y permisos de acceso.
  - Vinculado con la identidad: sí.
  - Usado para seguimiento: no.
- Servidor: Firebase Authentication y Firebase Realtime Database. El acceso a las listas nuevas está limitado a sus miembros autenticados; los enlaces antiguos con contraseña mantienen su cifrado en el dispositivo durante la transición.
- URL de privacidad: `https://carlosgarau.github.io/que-te-falta/privacy.html`.
- URL de opciones de privacidad: `https://carlosgarau.github.io/que-te-falta/privacy.html`.
- Eliminación de cuenta: disponible en Ajustes. La app exige una autenticación reciente y, para cuentas de Apple, revoca la autorización antes de eliminar la cuenta y los datos.

Respuestas locales revisadas el 16 de agosto de 2026. Antes del reenvío deben contrastarse y publicarse de nuevo en App Store Connect para que coincidan con esta versión.

## Clasificación por edades

Respuestas confirmadas en App Store Connect con clasificación general 4+:

- Controles parentales y verificación de edad: no.
- Garantía o estimación de edad: no.
- Acceso web sin restricciones: no.
- Contenido generado por usuarios con distribución amplia: no. Las listas solo se comparten con cuentas invitadas expresamente.
- Red social, mensajería o chat: no.
- Funciones de red social: no. Las listas son privadas, sin perfiles públicos, publicaciones ni descubrimiento de personas.
- Publicidad: no.
- Temas maduros, violencia, sexualidad, drogas, armas o lenguaje ofensivo: ninguno.
- Información médica, de tratamiento, salud o bienestar: no.
- Concursos, apuestas, juegos de azar o cajas de botín: no.
- Made for Kids: no.
- Modificación manual de la clasificación: no aplicable.

## Cifrado y exportación

- `ITSAppUsesNonExemptEncryption`: `NO`.
- La aplicación utiliza HTTPS y AES-GCM estándar para proteger listas compartidas.
- Respuesta prevista: cifrado exento, sin documentación adicional.
- Debe confirmarse en el cuestionario de exportación antes de subir la compilación final.

## Unión Europea - DSA

- Estado previsto: **no comerciante**, únicamente si la aplicación sigue siendo un proyecto personal gratuito, sin publicidad, compras ni intención de comercialización.
- Apple exige una autoevaluación del titular. Carlos debe confirmar personalmente esta declaración antes del envío.
- Si la aplicación se monetiza o pasa a formar parte de una actividad profesional, deberá revisarse el estado.

## Información para TestFlight

- Descripción beta: `Lista familiar por voz con listas compartidas y control de caducidad.`
- Funciones que probar: voz, lectura en alto, lista privada entre dos iPhone, invitaciones, notificaciones de caducidad y listas especiales.
- Correo de comentarios: el correo de la Cuenta de Apple del titular.

## Información para App Review

- Persona de contacto: Carlos Garau Covas.
- Inicio de sesión obligatorio para revisar la app: no. Las funciones locales se prueban sin cuenta. Para comprobar el intercambio privado, Apple puede usar <strong>Iniciar sesión con Apple</strong>; el flujo exacto y la grabación se incluyen en las notas.
- Notas: usar las incluidas en `APP_STORE_METADATA.md`.
- URL de soporte: `https://carlosgarau.github.io/que-te-falta/support.html`.
- Publicación: manual después de la aprobación.
