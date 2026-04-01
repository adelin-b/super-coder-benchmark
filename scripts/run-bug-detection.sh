#!/bin/bash
# Run bug detection: copy method's test into references/BL-1/bugs/ context
# and swap the reference impl with each bug variant
# Usage: ./scripts/run-bug-detection.sh <method_dir>

METHOD_DIR="$1"
REF_DIR="references/BL-1"
TEST_FILE="$METHOD_DIR/pricing.test.ts"
IMPL_FILE="$METHOD_DIR/pricing.ts"

if [ ! -f "$TEST_FILE" ] || [ ! -f "$IMPL_FILE" ]; then
  echo "ERROR: Missing test or impl file in $METHOD_DIR"
  exit 1
fi

echo "=== Bug Detection for $METHOD_DIR ==="

# For each bug, swap the method's own implementation with the buggy one
# We need standalone bug files — let's create them by taking the method's
# impl and applying the bug pattern

ORIG_IMPL=$(cat "$IMPL_FILE")

for BUG_NUM in 1 2 3 4; do
  BUG_FILE="$REF_DIR/bugs/bug${BUG_NUM}-*.ts"
  BUG_FILE=$(ls $BUG_FILE 2>/dev/null)
  [ -z "$BUG_FILE" ] && continue
  BUG_NAME=$(basename "$BUG_FILE" .ts)
  
  echo "--- Testing $BUG_NAME ---"
  
  # Backup and swap: put the REFERENCE buggy impl (standalone version) in place of method's impl
  cp "$IMPL_FILE" "$IMPL_FILE.bak"
  
  # Create a standalone buggy version based on the reference bug file
  # but without the import from ../pricing.js
  # Extract the actual functions from the bug file, add missing types
  cat > "$IMPL_FILE" << 'TYPES_HEADER'
export interface PricingResult {
  prixAffiche: number;
  vendorShare: number;
  commissionShare: number;
}

export interface BatchPricingResult {
  results: PricingResult[];
  totalPrixAffiche: number;
  totalVendorShare: number;
  totalCommissionShare: number;
}

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

TYPES_HEADER
  
  # Extract the functions from the bug file (skip imports and type exports)
  grep -v "^import " "$BUG_FILE" | grep -v "^export { " | grep -v "^/\*\*" | grep -v "^ \*" | grep -v "^\*/" >> "$IMPL_FILE"
  
  # Run method's tests
  OUTPUT=$(npx vitest run "$TEST_FILE" 2>&1)
  EXIT_CODE=$?
  
  if [ $EXIT_CODE -ne 0 ]; then
    FAIL_COUNT=$(echo "$OUTPUT" | grep -oP '\d+ failed' | head -1)
    echo "CAUGHT: $BUG_NAME ($FAIL_COUNT)"
    echo "$OUTPUT" | grep -E "AssertionError|expected|toEqual|toBe" | head -3
  else
    echo "MISSED: $BUG_NAME (all tests passed — bug not detected)"
  fi
  
  # Restore
  cp "$IMPL_FILE.bak" "$IMPL_FILE"
  rm "$IMPL_FILE.bak"
  echo ""
done

echo "=== Done ==="
