interface Command {
  arity: number;
  execute: (...args: number[]) => number[] | void;
}

export class Forth {
  stack: number[];
  private commands: Record<string, Command>;

  constructor(stack: number[] = [], commands?: Record<string, Command>) {
    this.stack = stack;
    this.commands = commands ?? Forth.basicCommands();
  }

  evaluate(program: string): void {
    const words = program.toLowerCase().split(' ');

    for (let t = 0; t < words.length; t++) {
      const word = words[t];

      if (/^-?\d+$/.test(word)) {
        this.stack.push(Number(word));
      } else if (word === ':') {
        const semicolon = words.indexOf(';', t);
        if (semicolon === -1) {
          throw new Error('Unterminated definition');
        }
        this.defineCommand(
          words[t + 1],
          words.slice(t + 2, semicolon).join(' '),
        );
        t = semicolon;
      } else {
        const command = this.commands[word];
        if (!command) {
          throw new Error('Unknown command');
        }
        this.performCommand(command);
      }
    }
  }

  private defineCommand(word: string, subprogram: string): void {
    if (Forth.isKeyword(word)) {
      throw new Error('Invalid definition');
    }

    let execute: () => number[];

    try {
      const stackSize = this.stack.length;
      this.evaluate(subprogram);
      const result = this.stack.splice(stackSize);
      execute = () => result;
    } catch {
      execute = () => {
        this.evaluate(subprogram);
        return [];
      };
    }

    this.commands[word] = {
      arity: 0,
      execute,
    };
  }

  private performCommand(command: Command): void {
    if (command.arity > this.stack.length) {
      if (this.stack.length === 1) {
        throw new Error('Only one value on the stack');
      }
      throw new Error('Stack empty');
    }

    const args = this.stack.splice(this.stack.length - command.arity);
    const vals = command.execute.apply(this, args);
    if (vals && Array.isArray(vals)) {
      this.stack.push(...vals);
    }
  }

  private static isKeyword(word: string): boolean {
    return word === ':' || word === ';' || /^-?\d+$/.test(word);
  }

  private static basicCommands(): Record<string, Command> {
    return {
      '+': { arity: 2, execute: (a: number, b: number) => [a + b] },
      '-': { arity: 2, execute: (a: number, b: number) => [a - b] },
      '*': { arity: 2, execute: (a: number, b: number) => [a * b] },
      '/': {
        arity: 2,
        execute: (a: number, b: number) => {
          if (b === 0) {
            throw new Error('Division by zero');
          }
          return [Math.floor(a / b)];
        },
      },
      dup: { arity: 1, execute: (a: number) => [a, a] },
      drop: { arity: 1, execute: () => [] },
      swap: { arity: 2, execute: (a: number, b: number) => [b, a] },
      over: { arity: 2, execute: (a: number, b: number) => [a, b, a] },
    };
  }
}
