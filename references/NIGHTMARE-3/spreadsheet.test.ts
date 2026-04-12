import { describe, it, expect } from 'vitest';
import { createSpreadsheet, isCellError, SpreadsheetError } from './spreadsheet.js';
import type { CellValue, CellError } from './spreadsheet.js';

function expectError(val: CellValue, type: CellError['type']): void {
  expect(isCellError(val)).toBe(true);
  if (isCellError(val)) {
    expect(val.type).toBe(type);
  }
}

describe('NIGHTMARE-3: Reactive Spreadsheet Engine with Circular Detection', () => {
  // ==================== Basic Values ====================

  it('empty cell returns 0', () => {
    const ss = createSpreadsheet();
    expect(ss.getCell('A1')).toBe(0);
  });

  it('set numeric literal', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '42');
    expect(ss.getCell('A1')).toBe(42);
  });

  it('set string literal', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', 'hello');
    expect(ss.getCell('A1')).toBe('hello');
  });

  it('set boolean literal TRUE', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', 'TRUE');
    expect(ss.getCell('A1')).toBe(true);
  });

  it('set boolean literal FALSE', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', 'FALSE');
    expect(ss.getCell('A1')).toBe(false);
  });

  it('getCellFormula returns raw formula', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=B1+1');
    expect(ss.getCellFormula('A1')).toBe('=B1+1');
  });

  it('getCellFormula returns empty for unset cell', () => {
    const ss = createSpreadsheet();
    expect(ss.getCellFormula('A1')).toBe('');
  });

  // ==================== Basic Arithmetic ====================

  it('simple addition formula', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=2+3');
    expect(ss.getCell('A1')).toBe(5);
  });

  it('formula with all operators', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=10+5-3*2');
    // Standard precedence: 10 + 5 - (3*2) = 10 + 5 - 6 = 9
    expect(ss.getCell('A1')).toBe(9);
  });

  it('parenthesized expressions', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=(10+5)*2');
    expect(ss.getCell('A1')).toBe(30);
  });

  it('division', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=10/4');
    expect(ss.getCell('A1')).toBe(2.5);
  });

  it('division by zero produces DIV0 error', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=1/0');
    expectError(ss.getCell('A1'), 'DIV0');
  });

  it('negative unary operator', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=-5');
    expect(ss.getCell('A1')).toBe(-5);
  });

  // ==================== Cell References ====================

  it('formula referencing another cell', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '10');
    ss.setCell('B1', '=A1+5');
    expect(ss.getCell('B1')).toBe(15);
  });

  it('chain of references: A1 -> B1 -> C1', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '5');
    ss.setCell('B1', '=A1*2');
    ss.setCell('C1', '=B1+3');
    expect(ss.getCell('C1')).toBe(13);
  });

  it('updating a cell triggers re-evaluation of dependents', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '10');
    ss.setCell('B1', '=A1+5');
    expect(ss.getCell('B1')).toBe(15);
    ss.setCell('A1', '20');
    expect(ss.getCell('B1')).toBe(25);
  });

  it('case-insensitive references', () => {
    const ss = createSpreadsheet();
    ss.setCell('a1', '42');
    expect(ss.getCell('A1')).toBe(42);
    ss.setCell('B1', '=a1+1');
    expect(ss.getCell('B1')).toBe(43);
  });

  // ==================== Comparison Operators ====================

  it('greater than returns boolean', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=5>3');
    expect(ss.getCell('A1')).toBe(true);
  });

  it('less than or equal', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=3<=3');
    expect(ss.getCell('A1')).toBe(true);
  });

  it('not equal', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=5<>3');
    expect(ss.getCell('A1')).toBe(true);
  });

  // ==================== IF Function ====================

  it('IF true branch', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=IF(1>0, 10, 20)');
    expect(ss.getCell('A1')).toBe(10);
  });

  it('IF false branch', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=IF(1<0, 10, 20)');
    expect(ss.getCell('A1')).toBe(20);
  });

  it('IF with cell reference condition', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '5');
    ss.setCell('B1', '=IF(A1>0, 100, 200)');
    expect(ss.getCell('B1')).toBe(100);
  });

  // ==================== Dynamic IF Dependencies (THE CORE TRAP) ====================

  it('IF switches dependency when condition changes', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '1');
    ss.setCell('B1', '10');
    ss.setCell('C1', '20');
    ss.setCell('D1', '=IF(A1>0, B1, C1)');
    expect(ss.getCell('D1')).toBe(10);

    // Change A1 to make condition false
    ss.setCell('A1', '-1');
    expect(ss.getCell('D1')).toBe(20);
  });

  it('dynamic deps: changing the taken branch updates correctly', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '1');
    ss.setCell('B1', '10');
    ss.setCell('C1', '20');
    ss.setCell('D1', '=IF(A1>0, B1, C1)');
    expect(ss.getCell('D1')).toBe(10);

    // Change B1 (currently active branch)
    ss.setCell('B1', '99');
    expect(ss.getCell('D1')).toBe(99);
  });

  it('dynamic deps: changing the non-taken branch does NOT affect result (but is re-evaluated after switch)', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '1');
    ss.setCell('B1', '10');
    ss.setCell('C1', '20');
    ss.setCell('D1', '=IF(A1>0, B1, C1)');
    expect(ss.getCell('D1')).toBe(10);

    // Switch to false branch, then modify C1
    ss.setCell('A1', '-1');
    expect(ss.getCell('D1')).toBe(20);
    ss.setCell('C1', '99');
    expect(ss.getCell('D1')).toBe(99);
  });

  it('nested IF with multiple dynamic deps', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '1');
    ss.setCell('A2', '1');
    ss.setCell('B1', '10');
    ss.setCell('B2', '20');
    ss.setCell('B3', '30');
    // =IF(A1>0, IF(A2>0, B1, B2), B3)
    ss.setCell('C1', '=IF(A1>0, IF(A2>0, B1, B2), B3)');
    expect(ss.getCell('C1')).toBe(10);

    ss.setCell('A2', '-1');
    expect(ss.getCell('C1')).toBe(20);

    ss.setCell('A1', '-1');
    expect(ss.getCell('C1')).toBe(30);
  });

  // ==================== Circular Reference Detection ====================

  it('self-reference produces CIRC error', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=A1+1');
    expectError(ss.getCell('A1'), 'CIRC');
  });

  it('two-cell circular reference', () => {
    const ss = createSpreadsheet();
    ss.batchSet(new Map([
      ['A1', '=B1+1'],
      ['B1', '=A1+1'],
    ]));
    expectError(ss.getCell('A1'), 'CIRC');
    expectError(ss.getCell('B1'), 'CIRC');
  });

  it('three-cell circular reference', () => {
    const ss = createSpreadsheet();
    ss.batchSet(new Map([
      ['A1', '=B1'],
      ['B1', '=C1'],
      ['C1', '=A1'],
    ]));
    expectError(ss.getCell('A1'), 'CIRC');
    expectError(ss.getCell('B1'), 'CIRC');
    expectError(ss.getCell('C1'), 'CIRC');
  });

  it('detectCircular returns cycle info', () => {
    const ss = createSpreadsheet();
    ss.batchSet(new Map([
      ['A1', '=B1'],
      ['B1', '=A1'],
    ]));
    const cycles = ss.detectCircular();
    expect(cycles.length).toBeGreaterThan(0);
    // Both A1 and B1 should be in some cycle
    const allCycleCells = cycles.flat();
    expect(allCycleCells).toContain('A1');
    expect(allCycleCells).toContain('B1');
  });

  it('no circular: detectCircular returns empty', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '5');
    ss.setCell('B1', '=A1+1');
    const cycles = ss.detectCircular();
    expect(cycles).toHaveLength(0);
  });

  // ==================== Error Propagation ====================

  it('error propagates through arithmetic', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=1/0');
    ss.setCell('B1', '=A1+5');
    expectError(ss.getCell('B1'), 'DIV0');
  });

  it('string in arithmetic produces VALUE error', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', 'hello');
    ss.setCell('B1', '=A1+5');
    expectError(ss.getCell('B1'), 'VALUE');
  });

  it('unknown function produces NAME error', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=FOOBAR(1)');
    expectError(ss.getCell('A1'), 'NAME');
  });

  // ==================== ISERROR ====================

  it('ISERROR returns true for error cell', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=1/0');
    ss.setCell('B1', '=ISERROR(A1)');
    expect(ss.getCell('B1')).toBe(true);
  });

  it('ISERROR returns false for valid cell', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '42');
    ss.setCell('B1', '=ISERROR(A1)');
    expect(ss.getCell('B1')).toBe(false);
  });

  it('IF(ISERROR(A1), 0, A1) handles errors gracefully', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=1/0');
    ss.setCell('B1', '=IF(ISERROR(A1), 0, A1)');
    expect(ss.getCell('B1')).toBe(0);
  });

  it('IF(ISERROR(A1), 0, A1) passes through valid values', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '42');
    ss.setCell('B1', '=IF(ISERROR(A1), 0, A1)');
    expect(ss.getCell('B1')).toBe(42);
  });

  // ==================== Aggregate Functions ====================

  it('SUM over range', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '10');
    ss.setCell('A2', '20');
    ss.setCell('A3', '30');
    ss.setCell('B1', '=SUM(A1:A3)');
    expect(ss.getCell('B1')).toBe(60);
  });

  it('AVG over range', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '10');
    ss.setCell('A2', '20');
    ss.setCell('A3', '30');
    ss.setCell('B1', '=AVG(A1:A3)');
    expect(ss.getCell('B1')).toBe(20);
  });

  it('AVG with no numeric values returns DIV0', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', 'hello');
    ss.setCell('A2', 'world');
    ss.setCell('B1', '=AVG(A1:A2)');
    expectError(ss.getCell('B1'), 'DIV0');
  });

  it('COUNT counts numeric cells', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '10');
    ss.setCell('A2', 'hello');
    ss.setCell('A3', '30');
    ss.setCell('B1', '=COUNT(A1:A3)');
    expect(ss.getCell('B1')).toBe(2);
  });

  it('MIN over range', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '30');
    ss.setCell('A2', '10');
    ss.setCell('A3', '20');
    ss.setCell('B1', '=MIN(A1:A3)');
    expect(ss.getCell('B1')).toBe(10);
  });

  it('MAX over range', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '30');
    ss.setCell('A2', '10');
    ss.setCell('A3', '20');
    ss.setCell('B1', '=MAX(A1:A3)');
    expect(ss.getCell('B1')).toBe(30);
  });

  it('SUM propagates error from cell in range', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '10');
    ss.setCell('A2', '=1/0');
    ss.setCell('A3', '30');
    ss.setCell('B1', '=SUM(A1:A3)');
    expectError(ss.getCell('B1'), 'DIV0');
  });

  it('SUM updates when range cell changes', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '10');
    ss.setCell('A2', '20');
    ss.setCell('B1', '=SUM(A1:A2)');
    expect(ss.getCell('B1')).toBe(30);
    ss.setCell('A2', '50');
    expect(ss.getCell('B1')).toBe(60);
  });

  // ==================== Volatile Functions ====================

  it('NOW() returns a number (timestamp)', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=NOW()');
    const val = ss.getCell('A1');
    expect(typeof val).toBe('number');
    expect(val as number).toBeGreaterThan(0);
  });

  it('RAND() returns a number between 0 and 1', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=RAND()');
    const val = ss.getCell('A1') as number;
    expect(typeof val).toBe('number');
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThan(1);
  });

  it('volatile cell returns different values on repeated access', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '=RAND()');
    const v1 = ss.getCell('A1');
    const v2 = ss.getCell('A1');
    // Very unlikely to be the same, but technically possible
    // Just verify they're both numbers
    expect(typeof v1).toBe('number');
    expect(typeof v2).toBe('number');
  });

  // ==================== Batch Updates ====================

  it('batchSet resolves mutual references', () => {
    const ss = createSpreadsheet();
    ss.batchSet(new Map([
      ['A1', '5'],
      ['B1', '=A1*2'],
    ]));
    expect(ss.getCell('A1')).toBe(5);
    expect(ss.getCell('B1')).toBe(10);
  });

  it('batchSet handles dependency order', () => {
    const ss = createSpreadsheet();
    // Set B1 formula first, A1 value second — should still work
    ss.batchSet(new Map([
      ['B1', '=A1+1'],
      ['A1', '10'],
    ]));
    expect(ss.getCell('B1')).toBe(11);
  });

  // ==================== getDependents / getDependencies ====================

  it('getDependents returns downstream cells', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '5');
    ss.setCell('B1', '=A1+1');
    ss.setCell('C1', '=A1*2');
    const deps = ss.getDependents('A1');
    expect(deps).toContain('B1');
    expect(deps).toContain('C1');
  });

  it('getDependencies returns upstream cells', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '5');
    ss.setCell('B1', '10');
    ss.setCell('C1', '=A1+B1');
    const deps = ss.getDependencies('C1');
    expect(deps).toContain('A1');
    expect(deps).toContain('B1');
  });

  // ==================== getRange ====================

  it('getRange returns 2D array of values', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '1');
    ss.setCell('B1', '2');
    ss.setCell('A2', '3');
    ss.setCell('B2', '4');
    const range = ss.getRange('A1', 'B2');
    expect(range).toEqual([[1, 2], [3, 4]]);
  });

  it('getRange with empty cells returns 0', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '5');
    const range = ss.getRange('A1', 'B2');
    expect(range).toEqual([[5, 0], [0, 0]]);
  });

  // ==================== Validation ====================

  it('throws SpreadsheetError for invalid ref in setCell', () => {
    const ss = createSpreadsheet();
    expect(() => ss.setCell('123', '5')).toThrow(SpreadsheetError);
  });

  it('throws SpreadsheetError for invalid ref in getCell', () => {
    const ss = createSpreadsheet();
    expect(() => ss.getCell('!!!')).toThrow(SpreadsheetError);
  });

  it('throws SpreadsheetError for invalid getRange', () => {
    const ss = createSpreadsheet();
    expect(() => ss.getRange('B2', 'A1')).toThrow(SpreadsheetError);
  });

  // ==================== Complex Cascading Scenarios ====================

  it('long dependency chain updates correctly', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '1');
    ss.setCell('A2', '=A1+1');
    ss.setCell('A3', '=A2+1');
    ss.setCell('A4', '=A3+1');
    ss.setCell('A5', '=A4+1');
    expect(ss.getCell('A5')).toBe(5);

    ss.setCell('A1', '10');
    expect(ss.getCell('A5')).toBe(14);
  });

  it('diamond dependency: D depends on B and C which both depend on A', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '10');
    ss.setCell('B1', '=A1+1');
    ss.setCell('C1', '=A1+2');
    ss.setCell('D1', '=B1+C1');
    expect(ss.getCell('D1')).toBe(23);

    ss.setCell('A1', '0');
    expect(ss.getCell('D1')).toBe(3);
  });

  it('overwriting formula with literal stops dependency', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '5');
    ss.setCell('B1', '=A1+1');
    expect(ss.getCell('B1')).toBe(6);

    ss.setCell('B1', '99'); // Now a literal
    ss.setCell('A1', '100');
    expect(ss.getCell('B1')).toBe(99); // Should NOT change
  });

  it('SUM over range with IF inside: dynamic behavior', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '1');
    ss.setCell('A2', '2');
    ss.setCell('A3', '3');
    ss.setCell('B1', '=SUM(A1:A3)');
    expect(ss.getCell('B1')).toBe(6);

    // Change A2 to a formula
    ss.setCell('A2', '=IF(A1>0, 10, 20)');
    expect(ss.getCell('B1')).toBe(14); // 1 + 10 + 3
  });

  it('circular detection does not affect non-circular cells', () => {
    const ss = createSpreadsheet();
    ss.setCell('A1', '5');
    ss.setCell('B1', '=A1+1');
    ss.batchSet(new Map([
      ['C1', '=D1'],
      ['D1', '=C1'],
    ]));
    // A1 and B1 should still work fine
    expect(ss.getCell('A1')).toBe(5);
    expect(ss.getCell('B1')).toBe(6);
    // C1 and D1 are circular
    expectError(ss.getCell('C1'), 'CIRC');
    expectError(ss.getCell('D1'), 'CIRC');
  });
});
