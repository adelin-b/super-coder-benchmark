import { describe, it, expect, beforeEach } from 'vitest';
import { Forth } from './forth.js';

describe('Forth', () => {
  let forth: any;

  beforeEach(() => {
    forth = new Forth();
  });

  describe('parsing and numbers', () => {
    it('numbers just get pushed onto the stack', () => {
      forth.evaluate('1 2 3 4 5');
      expect(forth.stack).toEqual([1, 2, 3, 4, 5]);
    });

    it('pushes negative numbers onto the stack', () => {
      forth.evaluate('-1 -2 -3 -4 -5');
      expect(forth.stack).toEqual([-1, -2, -3, -4, -5]);
    });
  });

  describe('addition', () => {
    it('can add two numbers', () => {
      forth.evaluate('1 2 +');
      expect(forth.stack).toEqual([3]);
    });

    it('errors if there is nothing on the stack', () => {
      expect(() => {
        forth.evaluate('+');
      }).toThrow(new Error('Stack empty'));
    });

    it('errors if there is only one value on the stack', () => {
      expect(() => {
        forth.evaluate('1 +');
      }).toThrow(new Error('Only one value on the stack'));
    });

    it('more than two values on the stack', () => {
      forth.evaluate('1 2 3 +');
      expect(forth.stack).toEqual([1, 5]);
    });
  });

  describe('subtraction', () => {
    it('can subtract two numbers', () => {
      forth.evaluate('3 4 -');
      expect(forth.stack).toEqual([-1]);
    });

    it('errors if there is nothing on the stack', () => {
      expect(() => {
        forth.evaluate('-');
      }).toThrow(new Error('Stack empty'));
    });

    it('errors if there is only one value on the stack', () => {
      expect(() => {
        forth.evaluate('1 -');
      }).toThrow(new Error('Only one value on the stack'));
    });

    it('more than two values on the stack', () => {
      forth.evaluate('1 12 3 -');
      expect(forth.stack).toEqual([1, 9]);
    });
  });

  describe('multiplication', () => {
    it('can multiply two numbers', () => {
      forth.evaluate('2 4 *');
      expect(forth.stack).toEqual([8]);
    });

    it('errors if there is nothing on the stack', () => {
      expect(() => {
        forth.evaluate('*');
      }).toThrow(new Error('Stack empty'));
    });

    it('errors if there is only one value on the stack', () => {
      expect(() => {
        forth.evaluate('1 *');
      }).toThrow(new Error('Only one value on the stack'));
    });

    it('more than two values on the stack', () => {
      forth.evaluate('1 2 3 *');
      expect(forth.stack).toEqual([1, 6]);
    });
  });

  describe('division', () => {
    it('can divide two numbers', () => {
      forth.evaluate('12 3 /');
      expect(forth.stack).toEqual([4]);
    });

    it('performs integer division', () => {
      forth.evaluate('8 3 /');
      expect(forth.stack).toEqual([2]);
    });

    it('errors if dividing by zero', () => {
      expect(() => {
        forth.evaluate('4 0 /');
      }).toThrow(new Error('Division by zero'));
    });

    it('errors if there is nothing on the stack', () => {
      expect(() => {
        forth.evaluate('/');
      }).toThrow(new Error('Stack empty'));
    });

    it('errors if there is only one value on the stack', () => {
      expect(() => {
        forth.evaluate('1 /');
      }).toThrow(new Error('Only one value on the stack'));
    });

    it('more than two values on the stack', () => {
      forth.evaluate('1 12 3 /');
      expect(forth.stack).toEqual([1, 4]);
    });
  });

  describe('combined arithmetic', () => {
    it('addition and subtraction', () => {
      forth.evaluate('1 2 + 4 -');
      expect(forth.stack).toEqual([-1]);
    });

    it('multiplication and division', () => {
      forth.evaluate('2 4 * 3 /');
      expect(forth.stack).toEqual([2]);
    });

    it('multiplication and addition', () => {
      forth.evaluate('1 3 4 * +');
      expect(forth.stack).toEqual([13]);
    });

    it('addition and multiplication', () => {
      forth.evaluate('1 3 4 + *');
      expect(forth.stack).toEqual([7]);
    });
  });

  describe('dup', () => {
    it('copies a value on the stack', () => {
      forth.evaluate('1 dup');
      expect(forth.stack).toEqual([1, 1]);
    });

    it('copies the top value on the stack', () => {
      forth.evaluate('1 2 dup');
      expect(forth.stack).toEqual([1, 2, 2]);
    });

    it('errors if there is nothing on the stack', () => {
      expect(() => {
        forth.evaluate('dup');
      }).toThrow(new Error('Stack empty'));
    });
  });

  describe('drop', () => {
    it('removes the top value on the stack if it is the only one', () => {
      forth.evaluate('1 drop');
      expect(forth.stack).toEqual([]);
    });

    it('removes the top value on the stack if it is not the only one', () => {
      forth.evaluate('1 2 drop');
      expect(forth.stack).toEqual([1]);
    });

    it('errors if there is nothing on the stack', () => {
      expect(() => {
        forth.evaluate('drop');
      }).toThrow(new Error('Stack empty'));
    });
  });

  describe('swap', () => {
    it('swaps the top two values on the stack if they are the only ones', () => {
      forth.evaluate('1 2 swap');
      expect(forth.stack).toEqual([2, 1]);
    });

    it('swaps the top two values on the stack if they are not the only ones', () => {
      forth.evaluate('1 2 3 swap');
      expect(forth.stack).toEqual([1, 3, 2]);
    });

    it('errors if there is nothing on the stack', () => {
      expect(() => {
        forth.evaluate('swap');
      }).toThrow(new Error('Stack empty'));
    });

    it('errors if there is only one value on the stack', () => {
      expect(() => {
        forth.evaluate('1 swap');
      }).toThrow(new Error('Only one value on the stack'));
    });
  });

  describe('over', () => {
    it('copies the second element if there are only two', () => {
      forth.evaluate('1 2 over');
      expect(forth.stack).toEqual([1, 2, 1]);
    });

    it('copies the second element if there are more than two', () => {
      forth.evaluate('1 2 3 over');
      expect(forth.stack).toEqual([1, 2, 3, 2]);
    });

    it('errors if there is nothing on the stack', () => {
      expect(() => {
        forth.evaluate('over');
      }).toThrow(new Error('Stack empty'));
    });

    it('errors if there is only one value on the stack', () => {
      expect(() => {
        forth.evaluate('1 over');
      }).toThrow(new Error('Only one value on the stack'));
    });
  });

  describe('user-defined words', () => {
    it('can consist of built-in words', () => {
      forth.evaluate(': dup-twice dup dup ;');
      forth.evaluate('1 dup-twice');
      expect(forth.stack).toEqual([1, 1, 1]);
    });

    it('execute in the right order', () => {
      forth.evaluate(': countup 1 2 3 ;');
      forth.evaluate('countup');
      expect(forth.stack).toEqual([1, 2, 3]);
    });

    it('can override other user-defined words', () => {
      forth.evaluate(': foo dup ;');
      forth.evaluate(': foo dup dup ;');
      forth.evaluate('1 foo');
      expect(forth.stack).toEqual([1, 1, 1]);
    });

    it('can override built-in words', () => {
      forth.evaluate(': swap dup ;');
      forth.evaluate('1 swap');
      expect(forth.stack).toEqual([1, 1]);
    });

    it('can override built-in operators', () => {
      forth.evaluate(': + * ;');
      forth.evaluate('3 4 +');
      expect(forth.stack).toEqual([12]);
    });

    it('can use different words with the same name', () => {
      forth.evaluate(': foo 5 ;');
      forth.evaluate(': bar foo ;');
      forth.evaluate(': foo 6 ;');
      forth.evaluate('bar foo');
      expect(forth.stack).toEqual([5, 6]);
    });

    it('can define word that uses word with the same name', () => {
      forth.evaluate(': foo 10 ;');
      forth.evaluate(': foo foo 1 + ;');
      forth.evaluate('foo');
      expect(forth.stack).toEqual([11]);
    });

    it('cannot redefine non-negative numbers', () => {
      expect(() => {
        forth.evaluate(': 1 2 ;');
      }).toThrow(new Error('Invalid definition'));
    });

    it('cannot redefine negative numbers', () => {
      expect(() => {
        forth.evaluate(': -1 2 ;');
      }).toThrow(new Error('Invalid definition'));
    });

    it('errors if executing a non-existent word', () => {
      expect(() => {
        forth.evaluate('foo');
      }).toThrow(new Error('Unknown command'));
    });

    it('only defines locally', () => {
      const first = new Forth();
      const second = new Forth();
      first.evaluate(': + - ;');
      first.evaluate('1 1 +');
      second.evaluate('1 1 +');
      expect(first.stack).toEqual([0]);
      expect(second.stack).toEqual([2]);
    });
  });

  describe('case-insensitivity', () => {
    it('DUP is case-insensitive', () => {
      forth.evaluate('1 DUP Dup dup');
      expect(forth.stack).toEqual([1, 1, 1, 1]);
    });

    it('DROP is case-insensitive', () => {
      forth.evaluate('1 2 3 4 DROP Drop drop');
      expect(forth.stack).toEqual([1]);
    });

    it('SWAP is case-insensitive', () => {
      forth.evaluate('1 2 SWAP 3 Swap 4 swap');
      expect(forth.stack).toEqual([2, 3, 4, 1]);
    });

    it('OVER is case-insensitive', () => {
      forth.evaluate('1 2 OVER Over over');
      expect(forth.stack).toEqual([1, 2, 1, 2, 1]);
    });

    it('user-defined words are case-insensitive', () => {
      forth.evaluate(': foo dup ;');
      forth.evaluate('1 FOO Foo foo');
      expect(forth.stack).toEqual([1, 1, 1, 1]);
    });

    it('definitions are case-insensitive', () => {
      forth.evaluate(': SWAP DUP Dup dup ;');
      forth.evaluate('1 swap');
      expect(forth.stack).toEqual([1, 1, 1, 1]);
    });
  });
});
