# Widget de lista familiar — prototipo no visible

Estado: **bloqueado para activación y pendiente de revisión visual**. Estos dos
archivos Swift no pertenecen a ningún target del proyecto. No existe `@main`
del widget, así que no aparece en la galería ni altera la aplicación instalada.

## Bloqueo comprobado antes de editar

- `ios/App/App/App.entitlements` solo declara Sign in with Apple; no contiene
  `com.apple.security.application-groups`.
- `project.pbxproj` solo define el target `App` y firma Release manualmente con
  el perfil `La compra App Store`.
- La acción `ios-testflight.yml` solo descarga/instala **un** perfil App Store
  y exporta el IPA con **un** identificador de app. No podría firmar una
  extensión Widget con identificador propio.
- FirebaseAuth guarda hoy la sesión en el llavero privado de la app. Una
  extensión separada no puede suponer que comparte esa sesión. Cambiar a un
  llavero compartido exige capacidad autorizada y migración explícita del
  usuario existente; hacerlo sin migración cerraría la sesión.

Apple exige registrar el App Group, asociarlo a los App IDs y regenerar los
perfiles al cambiar capacidades. Firebase exige que app y extensión usen el
mismo grupo de acceso de Keychain. Por tanto, añadir entitlements en código
sin configurar Apple Developer y la firma externa sería una falsa solución.

Referencias oficiales:

- <https://developer.apple.com/help/account/identifiers/register-an-app-group>
- <https://developer.apple.com/help/account/identifiers/enable-app-capabilities>
- <https://developer.apple.com/documentation/xcode/configuring-app-groups>
- <https://firebase.google.com/docs/auth/ios/single-sign-on>
- <https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities>

## Contrato implementado en el prototipo

- El usuario elige entre sus listas de tipo `family` con rol `owner` o `editor`.
- La vista mediana/grande muestra pendientes y conserva un producto marcado
  visible para poder deshacer sin abrir la app.
- El botón ejecuta un App Intent con `openAppWhenRun = false`. Solo se
  considera éxito cuando Firebase confirma el `PUT`.
- Lectura y escritura validan la cuenta actual, la membresía y las reglas de
  Firebase. La escritura conserva el resto del estado, usa ETag/`if-match` y
  repite solo conflictos 412 confirmados; nunca repite una escritura de
  resultado ambiguo por fallo de red.
- No se guardan productos ni tokens en `UserDefaults`. Si falta sesión,
  permiso o Internet, se muestra un estado explicativo sin productos antiguos
  ni botones que aparenten funcionar.
- WidgetKit solicita una nueva timeline a los cinco minutos, pero **no
  garantiza actualización en tiempo real**. Tras un toque, el sistema recarga
  la timeline. Para reflejar inmediatamente cambios desde la app haría falta
  un bridge de `WidgetCenter.reloadTimelines` todavía no conectado.

## Requisitos para activarlo en otra fase

1. Registrar el grupo propuesto `group.com.carlosgarau.lacompra` (o ajustar
   ambos targets al identificador que se apruebe) en Apple Developer.
2. Activar App Groups para `com.carlosgarau.lacompra` y registrar el App ID
   explícito `com.carlosgarau.lacompra.widget`; asociar el mismo grupo a ambos.
3. Regenerar el perfil App Store de la app y crear un perfil de distribución
   para la extensión. Adaptar la firma y exportación del workflow para ambos.
4. Añadir los entitlements correctos a ambos targets. En la app, migrar la
   sesión de FirebaseAuth del llavero actual al compartido siguiendo la guía
   oficial (`getStoredUser`, `useUserAccessGroup`, `updateCurrentUser`) antes
   de activar el widget; comprobar entrada y salida de Google/Apple y cambio
   de cuenta. No copiar manualmente ID tokens a preferencias.
5. Crear el target WidgetKit iOS 17+, enlazar FirebaseAuth/FirebaseCore,
   aportar configuración Firebase válida para la extensión, incluir estos
   Swift y añadir un `@main` WidgetBundle. Entonces compilar con Xcode 26.
6. Probar en dos iPhone reales: alta, cuenta equivocada, cierre de sesión,
   invitación revocada, conexión ausente, toques simultáneos, marcar/desmarcar
   y actualización desde el otro móvil. Capturar mediano/grande, texto largo,
   estado vacío y errores; solicitar revisión creativa ciega antes de mostrar
   o distribuir el widget.

La fuente Swift es una propuesta técnica y visual, **no una compilación ni una
prueba funcional en iOS**. Este equipo Windows no dispone de Xcode/simulador;
`tests-widget.mjs` comprueba el bloqueo de activación y contratos estáticos.
