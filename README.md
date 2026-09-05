# ¿Qué te falta?

Lista familiar para iPhone, Android y web, pensada para usarla con una mano o mediante la voz.

## Funciones principales

- Añade varios productos con una sola frase y agrúpalos por familias.
- Detecta repetidos y pregunta si debe aumentar la cantidad.
- Permite tachar productos desde el móvil y conserva el historial real.
- Mantiene listas puntuales independientes, por ejemplo «Navidad».
- Controla caducidades, avisa 3 días y 1 día antes y recomienda congelar cuando corresponde.
- Lee la lista en voz alta y entiende órdenes como «¿qué hay en la lista?».
- Comparte la lista familiar o una lista puntual mediante la hoja nativa del móvil, incluido WhatsApp.
- Inicia sesión con Google o Apple solo cuando quieras compartir y sincronizar.
- Da acceso a cada lista por separado y permite consultar o retirar miembros.
- Funciona sin cuenta para uso personal: los datos locales permanecen en el dispositivo.

## Cuentas y seguridad al compartir

Las listas nuevas se comparten únicamente entre cuentas autorizadas mediante Firebase Authentication. Una invitación aleatoria da acceso solo a la lista elegida; la persona invitada debe iniciar sesión y aceptarla. La persona propietaria puede retirar miembros y eliminar su cuenta y sus datos desde la aplicación.

Las listas antiguas compartidas mediante contraseña mantienen durante la transición su cifrado AES-256-GCM en el dispositivo.

Las reglas del servidor están en `database.rules.json`. Antes de publicar una versión que cambie el uso compartido, autentícate con Firebase CLI y despliega únicamente esas reglas:

```bash
firebase login
pnpm firebase:deploy:rules
```

La regla de aceptación fija al invitado como editor; una invitación nunca puede convertirlo en propietario.

## Desarrollo

Requisitos: Node.js y pnpm. Para compilar iOS hace falta macOS con Xcode 26 o posterior; para Android, Android Studio con JDK 21.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build:web
pnpm ios:sync
pnpm ios:open
```

Para Android:

```bash
pnpm android:sync
pnpm android:open
```

`pnpm build:web` crea `www/`, la versión empaquetada dentro de la aplicación. Los proyectos nativos están en `ios/App/App.xcodeproj` y `android/`.

## Siri y Atajos

La aplicación iOS acepta órdenes mediante el esquema:

```text
lacompra://?command=ORDEN_CODIFICADA
```

En el Atajo «Abre ¿Qué te falta?», conserva las acciones para pedir texto y codificarlo, pero cambia la URL web por `lacompra://?command=` seguida de la variable codificada. La versión web continúa admitiendo:

```text
https://carlosgarau.github.io/que-te-falta/?command=ORDEN_CODIFICADA
```

## Publicación

- [Preparación y subida a App Store](APP_STORE.md)
- [Textos y datos para App Store Connect](APP_STORE_METADATA.md)
- [Respuestas de App Store Connect](APP_STORE_CONNECT_ANSWERS.md)
- [Plan de capturas](APP_STORE_SCREENSHOTS.md)
- [Checklist de activación](APP_STORE_ACTIVATION_CHECKLIST.md)
- [Preparación y publicación en Android](ANDROID_RELEASE.md)
- [Política de privacidad](privacy.html)
- [Ayuda y contacto](support.html)
