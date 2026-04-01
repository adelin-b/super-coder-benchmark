#!/bin/bash
METHOD_DIR="$1"
BUGS_DIR="references/SAAS-1/bugs"
TEST_FILE="$METHOD_DIR/rbac.test.ts"
IMPL_FILE="$METHOD_DIR/rbac.ts"

echo "=== Bug Detection SAAS-1: $METHOD_DIR ==="

for BUG_FILE in "$BUGS_DIR"/bug*.ts; do
  BUG_NAME=$(basename "$BUG_FILE" .ts)
  cp "$IMPL_FILE" "$IMPL_FILE.bak"
  # Copy bug file and add missing exports if needed
  cp "$BUG_FILE" "$IMPL_FILE"
  OUTPUT=$(npx vitest run "$TEST_FILE" 2>&1)
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    FAIL_COUNT=$(echo "$OUTPUT" | grep -oP '\d+ failed' | head -1)
    echo "CAUGHT: $BUG_NAME ($FAIL_COUNT)"
  else
    echo "MISSED: $BUG_NAME"
  fi
  cp "$IMPL_FILE.bak" "$IMPL_FILE"
  rm "$IMPL_FILE.bak"
done
echo ""
