# Preparación de Android

La aplicación Android reutiliza la misma interfaz, datos y lógica que las versiones web e iOS. El identificador técnico neutral es `app.quetefalta.mobile` y el nombre visible es «¿Qué te falta?».

## Estado técnico

- Proyecto nativo de Capacitor generado en `android/`.
- Compatibilidad mínima: Android 7.0 (API 24).
- Objetivo de compilación: Android API 36.
- Micrófono, lectura de órdenes, notificaciones de caducidad y hoja de compartir conectados a sus complementos nativos.
- El enlace `lacompra://?command=...` abre la aplicación y entrega la orden.
- Cada cambio en la rama `codex/android` genera automáticamente una APK de prueba en GitHub Actions.

## Firebase y acceso con Google

Antes de probar el inicio de sesión nativo hay que registrar en el proyecto Firebase `la-compra-familiar` una aplicación Android con el paquete `app.quetefalta.mobile`.

Después, descarga `google-services.json` y colócalo en:

```text
android/app/google-services.json
```

El archivo está ignorado por Git. Para que Google acepte las compilaciones instaladas, Firebase debe tener las huellas SHA-1 y SHA-256 de las claves de firma de prueba y de publicación.

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
3. Crear una clave de firma de publicación y guardarla fuera del repositorio.
4. Añadir `google-services.json` y las huellas SHA de las claves a Firebase.
5. Probar voz, notificaciones, compartir, sincronización y acceso con Google en un Android real.
6. Generar un Android App Bundle (`.aab`) firmado y subirlo primero a pruebas internas.
7. Preparar icono, gráfico destacado y capturas de teléfono Android.
