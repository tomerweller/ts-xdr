#!/bin/bash
set -e

cd "$(dirname "$0")/.."

ESBUILD="npx esbuild"
OUT_DIR="bundle-analysis/dist"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

echo "=== Bundle Analysis ==="
echo ""

# 1. Modern packages (ts-stellar-xdr)
echo "--- Bundling: Modern (ts-stellar-xdr) ---"
$ESBUILD bundle-analysis/example-modern.ts \
  --bundle --minify --format=esm --target=es2022 --platform=browser \
  --outfile="$OUT_DIR/modern.js" \
  --metafile="$OUT_DIR/modern-meta.json" 2>&1

# 2. Official @stellar/stellar-sdk
echo "--- Bundling: Official @stellar/stellar-sdk ---"
$ESBUILD bundle-analysis/example-official-sdk.ts \
  --bundle --minify --format=esm --target=es2022 --platform=browser \
  --outfile="$OUT_DIR/official-sdk.js" \
  --metafile="$OUT_DIR/official-sdk-meta.json" 2>&1

# 3. Compatibility layer @stellar/stellar-sdk-comp
echo "--- Bundling: Compat @stellar/stellar-sdk-comp ---"
$ESBUILD bundle-analysis/example-compat-sdk.ts \
  --bundle --minify --format=esm --target=es2022 --platform=browser \
  --outfile="$OUT_DIR/compat-sdk.js" \
  --metafile="$OUT_DIR/compat-sdk-meta.json" 2>&1

echo ""
echo "=== Results ==="
echo ""

for name in modern official-sdk compat-sdk; do
  RAW=$(wc -c < "$OUT_DIR/$name.js" | tr -d ' ')
  GZIP=$(gzip -c "$OUT_DIR/$name.js" | wc -c | tr -d ' ')
  BROTLI=""
  if command -v brotli &> /dev/null; then
    BROTLI=$(brotli -c "$OUT_DIR/$name.js" | wc -c | tr -d ' ')
    printf "%-20s  raw: %8s  gzip: %8s  brotli: %8s\n" "$name" "$(numfmt --to=iec $RAW 2>/dev/null || echo ${RAW}B)" "$(numfmt --to=iec $GZIP 2>/dev/null || echo ${GZIP}B)" "$(numfmt --to=iec $BROTLI 2>/dev/null || echo ${BROTLI}B)"
  else
    printf "%-20s  raw: %8s  gzip: %8s\n" "$name" "${RAW} bytes" "${GZIP} bytes"
  fi
done

echo ""
echo "=== Detailed Sizes (bytes) ==="
echo ""
for name in modern official-sdk compat-sdk; do
  RAW=$(wc -c < "$OUT_DIR/$name.js" | tr -d ' ')
  GZIP=$(gzip -c "$OUT_DIR/$name.js" | wc -c | tr -d ' ')
  RAW_KB=$(echo "scale=1; $RAW / 1024" | bc)
  GZIP_KB=$(echo "scale=1; $RAW / 1024" | bc)
  GZIP_KB=$(echo "scale=1; $GZIP / 1024" | bc)
  echo "$name:"
  echo "  Raw:  ${RAW} bytes (${RAW_KB} KB)"
  echo "  Gzip: ${GZIP} bytes (${GZIP_KB} KB)"
done
