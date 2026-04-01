/**
 * CPU profiling harness — generates .cpuprofile files for analysis.
 *
 * Usage:
 *   npx tsx bench/profile.ts [scenario]
 *
 * Scenarios: validate-valid, validate-invalid, coerce, convert, clean
 * Default: runs all scenarios.
 */

import { Session } from 'node:inspector/promises';
import { writeFileSync } from 'node:fs';
import { SchemaRegistry } from '../src/modules/registry/schemaRegistry.js';
import {
  AddressSchema, CustomerSchema, defaultsInput,
  DefaultsSchema, NestedSchema, nestedValid, OrderItemSchema,
  SimpleSchema, simpleValid
} from './fixtures.js';

const session = new Session();

session.connect();

interface Scenario {
  'iterations': number;
  'name': string;
  'setup': () => () => void;
}

const registry = new SchemaRegistry({ 'castTypes': true });

registry.register(SimpleSchema);
registry.register(AddressSchema);
registry.register(CustomerSchema);
registry.register(OrderItemSchema);
registry.register(NestedSchema);
registry.register(DefaultsSchema);

// Warm up all paths
registry.validate(SimpleSchema.$id, simpleValid);
registry.validate(NestedSchema.$id, nestedValid);
registry.coerce(SimpleSchema, simpleValid);
registry.coerce(DefaultsSchema, defaultsInput);

const invalidData = {
  'age': 'not-a-number',
  'email': 'bad',
  'name': 42
};

const dirtySimple = {
  ...simpleValid,
  'extra1': 'junk',
  'extra2': 42,
  'extra3': true
};

function validateValidFn(): void {
  registry.validate(SimpleSchema.$id, simpleValid);
}

function validateInvalidFn(): void {
  registry.validate(SimpleSchema.$id, invalidData);
}

function coerceFn(): void {
  registry.coerce(SimpleSchema, simpleValid);
}

function convertFn(): void {
  registry.convert(SimpleSchema.$id, simpleValid);
}

function cleanFn(): void {
  registry.clean(SimpleSchema.$id, dirtySimple);
}

const scenarios: Scenario[] = [
  {
    'iterations': 500_000,
    'name': 'validate-valid',
    setup() {
      return validateValidFn;
    }
  },
  {
    'iterations': 50_000,
    'name': 'validate-invalid',
    setup() {
      return validateInvalidFn;
    }
  },
  {
    'iterations': 200_000,
    'name': 'coerce',
    setup() {
      return coerceFn;
    }
  },
  {
    'iterations': 200_000,
    'name': 'convert',
    setup() {
      return convertFn;
    }
  },
  {
    'iterations': 200_000,
    'name': 'clean',
    setup() {
      return cleanFn;
    }
  }
];

async function profileScenario(scenario: Scenario): Promise<void> {
  const fn = scenario.setup();

  // Warm up
  for (let warmup = 0; warmup < 1000; warmup++) {
    fn();
  }

  await session.post('Profiler.enable');
  await session.post('Profiler.start');

  for (let iteration = 0; iteration < scenario.iterations; iteration++) {
    fn();
  }

  const { profile } = await session.post('Profiler.stop') as { 'profile': object };

  writeFileSync(`bench/${scenario.name}.cpuprofile`, JSON.stringify(profile));
  console.log(`  ${scenario.name}: ${String(scenario.iterations)} iterations -> bench/${scenario.name}.cpuprofile`);
}

async function main(): Promise<void> {
  const filter = process.argv[2];
  const toRun = filter
    ? scenarios.filter((scenario) => {
      return scenario.name === filter;
    })
    : scenarios;

  console.log('Profiling...');
  for (const scenario of toRun) {
    await profileScenario(scenario);
  }

  session.disconnect();
  console.log('Done. Open .cpuprofile files in Chrome DevTools or VS Code.');
}

await main();
