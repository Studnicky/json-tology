import assert from 'node:assert/strict';
import type { SchemaRegistry } from '../../src/modules/registry/schemaRegistry.js';

interface ValidationScenario {
  'data': unknown;
  'name': string;
  'valid': boolean;
}

function assertValidationScenarios(
  registry: SchemaRegistry,
  schemaId: string,
  scenarios: ValidationScenario[]
): void {
  for (const {
    data, name, valid
  } of scenarios) {
    const errors = registry.validate(schemaId, data);

    assert.equal(errors.length === 0, valid, name);
  }
}

export {
  assertValidationScenarios,
  type ValidationScenario
};
