#!/bin/bash
# generate-pin-hash.sh — Linux / macOS PIN hash generator
# Usage: ./generate-pin-hash.sh [4-digit-PIN]
# If no argument is given, prompts for PIN interactively.

ITERATIONS=100000

hash_pin() {
  if command -v node >/dev/null 2>&1; then
    node -e "
      const crypto = require('crypto');
      let buf = Buffer.from('$1', 'utf8');
      for (let i = 0; i < $ITERATIONS; i++) {
        buf = crypto.createHash('sha256').update(buf).digest();
      }
      console.log(buf.toString('hex'));
    "
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "
import hashlib
buf = b'$1'
for _ in range($ITERATIONS):
    buf = hashlib.sha256(buf).digest()
print(buf.hex())
"
  else
    echo "Error: Node.js or Python3 is required." >&2
    exit 1
  fi
}

if [ -n "$1" ]; then
  PIN="$1"
else
  read -rp "Enter 4-digit PIN: " PIN
fi

if ! echo "$PIN" | grep -qE '^[0-9]{4}$'; then
  echo "Error: PIN must be exactly 4 digits." >&2
  exit 1
fi

HASH=$(hash_pin "$PIN")

echo ""
echo "PIN          : $PIN"
echo "Iterations   : $ITERATIONS"
echo "Hash         : $HASH"
echo ""
echo "Copy this hash into your security-audit.js / test.html files."
