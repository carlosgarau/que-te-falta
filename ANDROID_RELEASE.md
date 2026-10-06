# Preparación de Android

La aplicación Android reutiliza la misma interfaz, datos y lógica que las versiones web e iOS. El identificador técnico neutral es `app.quetefalta.mobile` y el nombre visible es «¿Qué te falta?».

## Estado técnico

- Proyecto nativo de Capacitor generado en `android/`.
- Compatibilidad mínima: Android 7.0 (API 24).
- Objetivo de compilación: Android API 36.
- Micrófono, lectura de órdenes, notificaciones de caducidad y hoja de compartir conectados a sus complementos nativos.
- Los enlaces `lacompra://?command=...` y `lacompra://?invitacion=...` abren la aplicación y entregan la orden o invitación.
- La URL compartida de la web está declarada como Android App Link y la app procesa directamente su parámetro `invitacion`.
- Cada cambio en la rama `codex/android` genera automáticamente una APK de prueba en GitHub Actions.

## Firebase y acceso con Google

Antes de probar el inicio de sesión nativo hay que registrar en el proyecto Firebase `la-compra-familiar` una aplicación Android con el paquete `app.quetefalta.mobile`.

El proyecto ya tiene registradas las huellas SHA-1 y SHA-256 de la clave de subida y de la clave de firma de Google Play. La configuración descargada contiene ambos clientes Android y debe colocarse en:

```text
android/app/google-services.json
```

El archivo está ignorado por Git y se inyecta en las compilaciones mediante el secreto `ANDROID_GOOGLE_SERVICES_JSON`. `pnpm check:google-play` impide generar una versión si Android e iOS dejan de apuntar al mismo proyecto Firebase.

## Compilación local

Con Android Studio y JDK 21 instalados:

```bash
pnpm install --frozen-lockfile
pnpm android:sync
pnpm android:open
```

Desde Android Studio se puede ejecutar en un teléfono o emulador. En Windows también se puede generar la APK de prueba desde `android/` con:

```powershell
.\gradlew.bat assembleDebug
```

## Pendiente para Google Play

1. Crear y verificar la cuenta de Google Play Console.
2. Reservar la ficha «¿Qué te falta?» y completar contacto, privacidad y seguridad de datos.
3. Probar voz, notificaciones, compartir, sincronización y acceso con Google en un Android real.
4. Subir el Android App Bundle (`.aab`) firmado primero a pruebas internas.
5. Completar la prueba cerrada exigida por Google Play antes de pedir acceso a producción.
6. Preparar icono, gráfico destacado y capturas de teléfono Android.

## Publicación automatizada

La acción manual «Preparar Android para Google Play» genera un `.aab` firmado de la versión 1.0.4 (código 4). La clave privada se conserva fuera del repositorio y GitHub solo recibe una copia cifrada como secreto.

Cuando exista la aplicación en Play Console y esté preparada la cuenta de servicio, añade el secreto `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` y ejecuta la misma acción con `upload_to_play=true` para subirla como borrador a pruebas internas.
