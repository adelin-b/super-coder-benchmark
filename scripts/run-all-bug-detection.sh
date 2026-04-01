#!/bin/bash
# Run bug detection for a method/task combo
# Usage: run-all-bug-detection.sh <method_dir> <bugs_dir>
# e.g.: run-all-bug-detection.sh experiments/A_plain_ts/BL-2 references/BL-2/bugs

METHOD_DIR="$1"
BUGS_DIR="$2"

if [ ! -d "$BUGS_DIR" ] || [ -z "$(ls $BUGS_DIR/bug*.ts 2>/dev/null)" ]; then
  echo "SKIP: No bugs in $BUGS_DIR"
  exit 0
fi

echo "=== Bug Detection: $METHOD_DIR ==="

# Find the implementation and test files
IMPL_FILE=$(find "$METHOD_DIR" -name "*.ts" ! -name "*.test.ts" ! -name "*.d.ts" | head -1)
TEST_FILE=$(find "$METHOD_DIR" -name "*.test.ts" | head -1)

if [ -z "$IMPL_FILE" ] || [ -z "$TEST_FILE" ]; then
  echo "ERROR: Missing impl or test file in $METHOD_DIR"
  exit 1
fi

for BUG_FILE in "$BUGS_DIR"/bug*.ts; do
  BUG_NAME=$(basename "$BUG_FILE" .ts)
  cp "$IMPL_FILE" "$IMPL_FILE.bak"
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
