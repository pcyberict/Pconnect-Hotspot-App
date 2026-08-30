#!/bin/sh
set -eu

ROOT="${1:-artifacts/pconnect/public}"

if [ ! -d "$ROOT" ]; then
  echo "Static image directory not found: $ROOT" >&2
  exit 1
fi

count=0
saved=0
list_file=$(mktemp)
trap 'rm -f "$list_file"' EXIT
find "$ROOT" -type f -iname '*.webp' -print > "$list_file"

while IFS= read -r image; do
  temporary="${image}.compressed"
  original_size=$(wc -c < "$image")

  # Keep the original file name and URL while reducing the WebP payload.
  # The temporary file prevents a failed conversion from damaging the asset.
  if cwebp -quiet -mt -q 82 -m 6 "$image" -o "$temporary"; then
    compressed_size=$(wc -c < "$temporary")
    if [ "$compressed_size" -lt "$original_size" ]; then
      mv "$temporary" "$image"
      saved=$((saved + original_size - compressed_size))
    else
      rm -f "$temporary"
    fi
    count=$((count + 1))
  else
    rm -f "$temporary"
    echo "Warning: could not compress $image" >&2
  fi
done

echo "Compressed ${count} WebP image(s), saved ${saved} bytes."