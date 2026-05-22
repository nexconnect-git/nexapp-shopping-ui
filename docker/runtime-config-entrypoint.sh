#!/bin/sh
set -eu

escape_js_string() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

GOOGLE_MAPS_API_KEY_ESCAPED="$(escape_js_string "${GOOGLE_MAPS_API_KEY:-}")"
GOOGLE_MAPS_MAP_ID_ESCAPED="$(escape_js_string "${GOOGLE_MAPS_MAP_ID:-}")"

CONFIG="window.__NEXCONNECT_CONFIG__ = Object.assign({}, window.__NEXCONNECT_CONFIG__ || {}, {\"googleMapsApiKey\":\"${GOOGLE_MAPS_API_KEY_ESCAPED}\",\"googleMapsMapId\":\"${GOOGLE_MAPS_MAP_ID_ESCAPED}\"});"

for target_dir in \
  /usr/share/nginx/html/sa \
  /usr/share/nginx/html/sa/admin \
  /usr/share/nginx/html/sa/vendor \
  /usr/share/nginx/html/sa/delivery
do
  if [ -d "$target_dir" ]; then
    printf '%s\n' "$CONFIG" > "$target_dir/runtime-config.js"
  fi
done

exec nginx -g 'daemon off;'
