// ── Saga Orchestrator ───────────────────────────────────────────────────────

export type SagaStatus = 'pending' | 'running' | 'completed' | 'failed' | 'compensating';

export interface SagaStep {
  name: string;
  execute: () => void | Promise<void>;
  compensate: () => void | Promise<void>;
}

export interface SagaDefinition {
  name: string;
  steps: SagaStep[];
  timeout?: number; // ms, default 30000
}

export interface SagaInstance {
  id: string;
  definitionName: string;
  status: SagaStatus;
  currentStep: number;
  completedSteps: string[];
  failedStep: string | null;
  compensatedSteps: string[];
  error: string | null;
  startedAt: number;
  completedAt: number | null;
}

export class SagaError extends Error {
  constructor(message: string, public readonly sagaId: string) {
    super(message);
    this.name = 'SagaError';
  }
}

export function createSagaOrchestrator(): {
  register(definition: SagaDefinition): void;
  start(definitionName: string, sagaId: string): Promise<SagaInstance>;
  getInstance(sagaId: string): SagaInstance | null;
  getInstancesByDefinition(definitionName: string): SagaInstance[];
  getActiveSagaCount(): number;
} {
  const definitions = new Map<string, SagaDefinition>();
  const instances = new Map<string, SagaInstance>();

  async function compensate(instance: SagaInstance, definition: SagaDefinition): Promise<void> {
    instance.status = 'compensating';

    // Compensate in reverse order of completed steps
    const stepsToCompensate = [...instance.completedSteps].reverse();

    for (const stepName of stepsToCompensate) {
      const step = definition.steps.find(s => s.name === stepName);
      if (step) {
        try {
          await step.compensate();
          instance.compensatedSteps.push(stepName);
        } catch (compError: any) {
          // Record compensation error but continue compensating remaining steps
          instance.error = `Compensation failed for step '${stepName}': ${compError.message ?? String(compError)}; Original error: ${instance.error}`;
        }
      }
    }

    instance.status = 'failed';
    instance.completedAt = Date.now();
  }

  return {
    register(definition: SagaDefinition): void {
      if (definitions.has(definition.name)) {
        throw new SagaError(
          `Saga definition '${definition.name}' is already registered`,
          '',
        );
      }
      definitions.set(definition.name, definition);
    },

    async start(definitionName: string, sagaId: string): Promise<SagaInstance> {
      const definition = definitions.get(definitionName);
      if (!definition) {
        throw new SagaError(
          `Saga definition '${definitionName}' is not registered`,
          sagaId,
        );
      }

      if (instances.has(sagaId)) {
        throw new SagaError(
          `Saga instance '${sagaId}' already exists`,
          sagaId,
        );
      }

      const instance: SagaInstance = {
        id: sagaId,
        definitionName,
        status: 'running',
        currentStep: 0,
        completedSteps: [],
        failedStep: null,
        compensatedSteps: [],
        error: null,
        startedAt: Date.now(),
        completedAt: null,
      };

      instances.set(sagaId, instance);

      const timeout = definition.timeout ?? 30000;

      // Create a timeout race
      let timedOut = false;
      const timeoutPromise = new Promise<'timeout'>((resolve) => {
        setTimeout(() => {
          timedOut = true;
          resolve('timeout');
        }, timeout);
      });

      const executeSteps = async (): Promise<'done'> => {
        for (let i = 0; i < definition.steps.length; i++) {
          if (timedOut) break;

          const step = definition.steps[i];
          instance.currentStep = i;

          try {
            await step.execute();
            instance.completedSteps.push(step.name);
          } catch (err: any) {
            instance.failedStep = step.name;
            instance.error = err.message ?? String(err);
            await compensate(instance, definition);
            return 'done';
          }
        }
        return 'done';
      };

      const result = await Promise.race([executeSteps(), timeoutPromise]);

      if (result === 'timeout' && instance.status === 'running') {
        instance.failedStep = definition.steps[instance.currentStep]?.name ?? null;
        instance.error = `Saga timed out after ${timeout}ms`;
        await compensate(instance, definition);
        return instance;
      }

      // If we completed all steps without failure or timeout
      if (instance.status === 'running') {
        instance.status = 'completed';
        instance.completedAt = Date.now();
      }

      return instance;
    },

    getInstance(sagaId: string): SagaInstance | null {
      return instances.get(sagaId) ?? null;
    },

    getInstancesByDefinition(definitionName: string): SagaInstance[] {
      const result: SagaInstance[] = [];
      for (const inst of instances.values()) {
        if (inst.definitionName === definitionName) {
          result.push(inst);
        }
      }
      return result;
    },

    getActiveSagaCount(): number {
      let count = 0;
      for (const inst of instances.values()) {
        if (inst.status === 'running' || inst.status === 'compensating') {
          count++;
        }
      }
      return count;
    },
  };
}