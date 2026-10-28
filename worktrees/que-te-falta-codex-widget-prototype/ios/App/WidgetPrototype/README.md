# Widget de ¿Qué te falta? — prototipo no visible

Estado: **PENDIENTE DE PRUEBA TÉCNICA Y REVISIÓN CREATIVA**. Esta rama contiene
un target WidgetKit iOS 17+ independiente, pero la app **no lo incrusta**. No
hay widget nuevo en la aplicación instalada ni controles expuestos al usuario.

## Configuración comprobada

- Apple Developer tiene el App Group `group.com.carlosgarau.lacompra`, asociado
  solo a `com.carlosgarau.lacompra` y `com.carlosgarau.lacompra.widget`.
- Se regeneró el perfil `La compra App Store` (ID `Q744X4D586`) y se creó
  `Que Te Falta Widget App Store` (ID `9D6QCBMFDP`). No se ha compilado ni
  distribuido la extensión con esos perfiles.
- El target widget **no incluye** el `GoogleService-Info.plist` de la app
  principal: su bundle ID es diferente. Falta registrar la extensión como
  app iOS en el proyecto Firebase y añadir su plist propio al target, tras
  verificar el ID, proyecto, URL de Realtime Database y acceso a Auth.
- `WidgetSessionPlugin.swift` es un borrador de puente para migrar la sesión
  privada de FirebaseAuth al llavero compartido. No está incluido en App
  Sources ni registrado en Capacitor; `native-bridge.mjs` sigue intacto. Así
  evitamos cerrar sesiones o cambiar la autenticación de la app publicada.
- El flujo de firma y subida iOS sigue sin cambios. No se ha enviado ningún
  IPA a TestFlight ni a App Store Connect.

Referencias: [App Groups de Apple](https://developer.apple.com/documentation/xcode/configuring-app-groups),
[inicio de sesión compartido de Firebase](https://firebase.google.com/docs/auth/ios/single-sign-on),
[configuración de Firebase iOS](https://firebase.google.com/docs/ios/setup).

## Qué hace el prototipo

Permite elegir una lista familiar con rol owner/editor. La vista mediana o
grande muestra pendientes y conserva un producto recién marcado para poder
desmarcarlo. Cada toque solicita una escritura condicional con ETag; se
comprueba identidad y membresía y se confía en las reglas de Firebase como
límite final. Los fallos de conexión ambiguos no se reintentan como escrituras.
No se almacenan productos ni tokens en `UserDefaults`. Son contratos de
fuente, **no funcionalidad verificada en iPhone**.

## Puertas de activación

1. Obtener la configuración Firebase propia de la extensión y comprobar las
   reglas/consultas contra una lista de prueba. Nunca reutilizar el plist de
   la app principal.
2. Compilar app y extensión con Xcode 26 en macOS, revisar entitlements y
   perfiles firmados, y probar la migración de sesión existente con Google y
   Apple, cierre, cambio y eliminación de cuenta.
3. Verificar en dos iPhone las invitaciones revocadas, el uso sin red, toques
   simultáneos y la sincronización. WidgetKit puede conservar una timeline
   antigua tras cerrar sesión o revocar acceso: no distribuir nombres de
   productos hasta demostrar que se ocultan con seguridad.
4. Obtener capturas actuales de tamaños mediano/grande, texto accesible,
   estados vacío/error y revisión creativa independiente. Sin esa evidencia,
   el estado visual es **PENDIENTE DE REVISIÓN**, no aprobado.
5. Solo después, registrar el puente, incorporar el widget a la app y adaptar
   la firma de la extensión en CI. Probar primero sin subir, luego solicitar
   autorización explícita para publicar.

`tests-widget.mjs` comprueba invariantes estáticos. Este equipo Windows no
tiene Xcode y no se ha hecho una prueba de compilación Swift.
