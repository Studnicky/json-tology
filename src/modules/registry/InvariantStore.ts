import type { InvariantInterface } from '../../interfaces/Invariant.js';
import type { ValidationErrorType } from '../../types/Validation.js';

export class InvariantStore {
  private readonly store = new Map<string, InvariantInterface[]>();

  public constructor(initial?: Record<string, readonly InvariantInterface[]>) {
    if (initial !== undefined) {
      for (const [
        schemaId,
        invariants
      ] of Object.entries(initial)) {
        this.store.set(schemaId, [...invariants]);
      }
    }
  }

  public add(schemaId: string, invariant: InvariantInterface): void {
    const existing = this.store.get(schemaId);

    if (existing === undefined) {
      this.store.set(schemaId, [invariant]);
    } else {
      existing.push(invariant);
    }
  }

  public list(schemaId: string): readonly InvariantInterface[] {
    return this.store.get(schemaId) ?? [];
  }

  public remove(schemaId: string, name: string): void {
    const existing = this.store.get(schemaId);

    if (existing === undefined) {
      return;
    }

    const next = existing.filter((inv) => {
      return inv.name !== name;
    });

    if (next.length === 0) {
      this.store.delete(schemaId);
    } else {
      this.store.set(schemaId, next);
    }
  }

  public runAll(schemaId: string, value: unknown): readonly ValidationErrorType[] {
    const invariants = this.store.get(schemaId);

    if (invariants === undefined || invariants.length === 0) {
      return [];
    }

    const errors: ValidationErrorType[] = [];

    for (const invariant of invariants) {
      const result = invariant.fn(value);

      if (result !== null && result !== undefined) {
        errors.push({
          'keyword': 'jt:invariant',
          'message': result,
          'params': { 'invariant': invariant.name },
          'path': invariant.pointer ?? ''
        });
      }
    }

    return errors;
  }
}
