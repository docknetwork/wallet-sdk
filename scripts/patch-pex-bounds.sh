#!/bin/bash
# Patches @docknetwork/credential-sdk pex-bounds to use Number.MAX_SAFE_INTEGER
# instead of hardcoded values that overflow in browser environments.
# Run after npm install until the fix is upstreamed to credential-sdk.

SDK_DIR="node_modules/@docknetwork/credential-sdk/dist"

for file in "$SDK_DIR/esm/pex/pex-bounds.js" "$SDK_DIR/cjs/pex/pex-bounds.cjs"; do
  if [ -f "$file" ]; then
    sed -i.bak \
      -e 's/const MAX_INTEGER = 100 \*\* 9;/const MAX_INTEGER = Number.MAX_SAFE_INTEGER;/' \
      -e 's/const MIN_INTEGER = -4294967295;/const MIN_INTEGER = Number.MIN_SAFE_INTEGER;/' \
      -e 's/const MAX_NUMBER = 100 \*\* 5;/const MAX_NUMBER = Number.MAX_SAFE_INTEGER;/' \
      -e 's/const MIN_NUMBER = -4294967294;/const MIN_NUMBER = Number.MIN_SAFE_INTEGER;/' \
      "$file"
    rm -f "$file.bak"
    echo "Patched $file"
  else
    echo "Warning: $file not found"
  fi
done
