import type { InvariantType } from '../../types/Invariant.js';
import type { ValidationErrorEntity } from '../../entities/ValidationErrorEntity.js';

import { INSTANTIATION_ERROR_CODE } from '../../constants/ERROR_CODES.js';
import { BaseError } from '../../errors/BaseError.js';
import { InstantiationError } from '../../errors/InstantiationError.js';
import { ValidationErrors } from '../../errors/ValidationErrors.js';

export class InvariantStore {
  private readonly store = new Map<string, InvariantType[]>();

  public constructor(initial?: Record<string, readonly InvariantType[]>) {
    if (initial !== undefined) {
      for (const [
        schemaId,
        invariants
      ] of Object.entries(initial)) {
        this.store.set(schemaId, [...invariants]);
      }
    }
  }

  public add(schemaId: string, invariant: InvariantType): void {
    const existing = this.store.get(schemaId);

    if (existing === undefined) {
      this.store.set(schemaId, [invariant]);
    } else {
      existing.push(invariant);
    }
  }

  public list(schemaId: string): readonly InvariantType[] {
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

  public runAll(schemaId: string, value: unknown): readonly ValidationErrorEntity.Type[] {
    const invariants = this.store.get(schemaId);

    if (invariants === undefined || invariants.length === 0) {
      return [];
    }

    const errors: ValidationErrorEntity.Type[] = [];

    for (const invariant of invariants) {
      const result = this.runInvariant(invariant, value);

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

  private runInvariant(invariant: InvariantType, value: unknown): null | string | undefined {
    try {
      return invariant.fn(value);
    } catch (error) {
      const causeError = BaseError.toCause(error);

      throw new InstantiationError(
        new ValidationErrors([{
          'keyword': 'jt:invariant',
          'message': `Invariant "${invariant.name}" threw: ${causeError.message}`,
          'params': { 'invariant': invariant.name },
          'path': invariant.pointer ?? ''
        }]),
        {
          'cause': causeError,
          'code': INSTANTIATION_ERROR_CODE.INSTANTIATION_FAILED
        }
      );
    }
  }
}
