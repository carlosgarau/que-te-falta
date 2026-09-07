# Siri para la próxima actualización

Implementación nativa para iOS 16 o posterior. No requiere crear un atajo manual ni abrir la pantalla de la app para añadir. iOS 15 conserva el uso normal de la aplicación y el enlace del atajo anterior.

## Uso

Después de instalar la actualización, abrir la app e iniciar sesión una vez:

- «Oye Siri, añade patatas en Qué te falta».
- «Oye Siri, agrega leche en Qué te falta».
- «Oye Siri, añade un producto en Qué te falta»: Siri pregunta el producto.

La acción usa la lista familiar seleccionada en la app. Si no hay preferencia válida y hay varias listas, pregunta cuál. El parámetro Lista permite también elegir otra lista compartida desde la acción del sistema.

El catálogo inicial facilita reconocer productos habituales. `EntityStringQuery` admite nombres libres, pero Siri puede pedir el producto por separado cuando no consigue resolver una frase completa. La frase genérica sin el nombre de la aplicación puede dirigirse a Recordatorios; no se anuncia como garantizada.

Si el producto ya existe, Siri pregunta antes de aumentar su cantidad. Una unidad distinta requiere confirmación y se guarda como otra entrada. Cancelar no guarda ninguna parte de la petición. La confirmación se vuelve a comprobar si otro familiar modifica la cantidad mientras Siri escucha.

Es necesario tener una sesión activa y conexión a Internet. No se mantiene una cola secreta de cambios sin conexión: Siri informa del fallo y solo confirma éxito tras guardar o verificar el recibo de la operación. Si la respuesta de red es ambigua, pide revisar la lista antes de repetir.

## Implementación y verificación

- App Intents y App Shortcuts en `ShoppingIntents.swift`; ejecución en segundo plano.
- Sesión FirebaseAuth de la propia app. No se duplican tokens en preferencias.
- Parser, categorías e historial compartidos con `core.mjs`, empaquetados para JavaScriptCore.
- Lectura y escritura condicional con ETag; las confirmaciones no sobrescriben cambios simultáneos.
- La app aplica sus cambios sobre la versión actual para conservar productos añadidos por Siri. Los clientes antiguos que aún escriban estados completos deben actualizarse también.
- Pruebas de duplicados, unidades, cancelación antes de escribir, recibos, cambios simultáneos y ejecución sin navegador en `tests-siri.mjs`.
- Compilación en Xcode 26 y prueba del motor JavaScriptCore en macOS mediante CI.

## Prueba necesaria antes de enviar a revisión

En un iPhone con Siri en español y dos cuentas de prueba: añadir Patatas con la app cerrada; confirmar y cancelar repetidos; dictar un producto no sugerido; probar una lista especial y dos listas familiares; modificar la cantidad desde el segundo móvil durante la confirmación; comprobar inicio de sesión, cierre de sesión, revocación de acceso, modo avión y reanudación de la app. Verificar que el segundo móvil recibe los cambios y que Siri pronuncia la confirmación.

La compilación automatizada no sustituye esta prueba de reconocimiento de voz en un iPhone real. Esta rama prepara la próxima actualización; no inicia el envío a App Store.

Referencias: [App Shortcuts](https://developer.apple.com/documentation/appintents/app-shortcuts), [parámetros](https://developer.apple.com/documentation/appintents/adding-parameters-to-an-app-intent), [Firebase REST condicional](https://firebase.google.com/docs/reference/rest/database).
