import { AsyncLocalStorage } from 'node:async_hooks';

interface CorrelationStore {
  correlationId: string;
}

const storage = new AsyncLocalStorage<CorrelationStore>();

export class CorrelationContext {
  static run<T>(correlationId: string, callback: () => T): T {
    return storage.run({ correlationId }, callback);
  }

  static getId(): string | undefined {
    return storage.getStore()?.correlationId;
  }
}
