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
adb shell am start -W -n "$activity" >/dev/null
sleep 8
adb exec-out screencap -p > "$output/acceso-android.png"

dump_ui() {
  adb shell uiautomator dump /sdcard/window.xml >/dev/null
  adb pull /sdcard/window.xml "$output/window.xml" >/dev/null
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
if ! tap_text "Seguir sin cuenta" && ! tap_text "Ahora no"; then
  echo "No se encontró la acción para continuar sin cuenta en Android" >&2
  exit 1
fi
sleep 3
adb exec-out screencap -p > "$output/lista-vacia-android.png"

dump_ui
if tap_text "Apunta un producto"; then
  adb shell input text "Tomates"
  adb shell input keyevent 66
  sleep 2
  adb exec-out screencap -p > "$output/lista-con-producto-android.png"
fi

test -s "$output/acceso-android.png"
test -s "$output/lista-vacia-android.png"
