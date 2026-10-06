#!/usr/bin/env bash
set -euo pipefail

package="app.quetefalta.mobile"
activity="${package}/.MainActivity"
apk="android/app/build/outputs/apk/release/app-release.apk"
output="android-smoke"

test -s "$apk"
mkdir -p "$output"
adb install -r "$apk"
adb shell pm clear "$package" >/dev/null
adb shell input keyevent KEYCODE_WAKEUP || true
adb shell wm dismiss-keyguard || true
adb shell am start -W -n "$activity" >/dev/null
sleep 10

dump_ui() {
  local attempt
  adb shell rm -f /sdcard/window.xml >/dev/null 2>&1 || true
  for attempt in $(seq 1 15); do
    if adb shell uiautomator dump --compressed /sdcard/window.xml >/dev/null 2>&1 \
      && adb pull /sdcard/window.xml "$output/window.xml" >/dev/null 2>&1 \
      && grep -q '<hierarchy' "$output/window.xml"; then
      return 0
    fi
    echo "Esperando a que la interfaz Android sea accesible ($attempt/15)..."
    sleep 2
  done
  echo "No se pudo leer la jerarquía de la pantalla Android" >&2
  adb shell dumpsys window windows | grep -E 'mCurrentFocus|mFocusedApp' || true
  return 1
}

tap_text() {
  local query="$1"
  local coordinates
  coordinates="$(python3 - "$output/window.xml" "$query" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

path, query = sys.argv[1], sys.argv[2].casefold()
for node in ET.parse(path).iter("node"):
    searchable = " ".join(str(value) for value in node.attrib.values()).casefold()
    if query not in searchable:
        continue
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if match:
        left, top, right, bottom = map(int, match.groups())
        print((left + right) // 2, (top + bottom) // 2)
        break
PY
)"
  test -n "$coordinates" || return 1
  adb shell input tap $coordinates
}

dump_ui
sleep 2
adb exec-out screencap -p > "$output/acceso-android.png"
if ! tap_text "Seguir sin cuenta" && ! tap_text "Ahora no"; then
  echo "La jerarquía de WebView aún no expone el botón; usando su posición verificada en Pixel 7 Pro"
  adb shell input tap 720 2280
fi
sleep 3
adb exec-out screencap -p > "$output/lista-vacia-android.png"

dump_ui
if coordinates="$(python3 - "$output/window.xml" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

for node in ET.parse(sys.argv[1]).iter("node"):
    if node.attrib.get("class") != "android.widget.EditText":
        continue
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if match:
        left, top, right, bottom = map(int, match.groups())
        print((left + right) // 2, (top + bottom) // 2)
        break
PY
)" && test -n "$coordinates"; then
  adb shell input tap $coordinates
  adb shell input text "Tomates"
  sleep 1
  adb exec-out screencap -p > "$output/teclado-android.png"
  adb shell input keyevent 66
  sleep 3
  adb shell input keyevent 4 || true
  sleep 1
  adb exec-out screencap -p > "$output/lista-con-producto-android.png"
fi

dump_ui
if tap_text "Ajustes"; then
  sleep 2
  adb exec-out screencap -p > "$output/ajustes-android.png"
  dump_ui
  if tap_text "Datos y privacidad"; then
    sleep 2
    adb exec-out screencap -p > "$output/ajustes-final-android.png"
  fi
fi

test -s "$output/acceso-android.png"
test -s "$output/lista-vacia-android.png"
test -s "$output/teclado-android.png"
test -s "$output/lista-con-producto-android.png"
test -s "$output/ajustes-android.png"
test -s "$output/ajustes-final-android.png"
