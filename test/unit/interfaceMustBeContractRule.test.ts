/**
 * Unit tests for the `interface-must-be-contract` custom ESLint rule.
 *
 * The type-substrate rule: `interface` is reserved for behavioral/class contracts
 * (declarations with at least one method, call, or construct signature). Data
 * shapes belong in `src/types/` as `type` aliases.
 *
 * TSPropertySignature with TSFunctionType is a function-valued FIELD (data), not
 * behavioral — it must NOT satisfy the rule.
 */

import { createRequire } from 'node:module';
import type {
  Linter,
  Rule,
  RuleTester
} from 'eslint';
import {
  describe, it
} from 'node:test';

const require = createRequire(import.meta.url);

// eslint v10 ships as CommonJS; load via createRequire so this ESM file can consume it.
const RuleTesterImpl = (require('eslint') as { 'RuleTester': typeof RuleTester }).RuleTester;

// @typescript-eslint/parser ships as CommonJS; load via the package root (exports map).
const tsParser = require('@typescript-eslint/parser') as Linter.Parser;

// ---------------------------------------------------------------------------
// Rule definition (identical logic to eslint.config.mjs interfaceMustBeContractRule)
// ---------------------------------------------------------------------------

const ALLOW = new Set([
  'JsonTologyReferencesInterface',
  'JsonTologyTypeConfigInterface'
]);

// AST visitor key: a computed property avoids the naming-convention `method` selector
// (which would require camelCase), since `TSInterfaceDeclaration` is a TS AST node
// name (vocabulary-mandated) rather than a user-chosen identifier.
const TS_INTERFACE_DECLARATION = 'TSInterfaceDeclaration' as const;

const rule = {
  create(context: Rule.RuleContext) {
    const visitInterface = (node: {
      'body': { 'body': Array<{ 'type': string }> };
      'id': {
        'name': string;
        'type': string;
      };
    }) => {
      if (ALLOW.has(node.id.name)) {
        return;
      }

      const hasBehavioralMember = node.body.body.some((member) => {
        return member.type === 'TSMethodSignature'
          || member.type === 'TSCallSignatureDeclaration'
          || member.type === 'TSConstructSignatureDeclaration';
      });

      if (!hasBehavioralMember) {
        context.report({
          'data': { 'name': node.id.name },
          'messageId': 'dataShapeMustBeType',
          'node': node.id
        });
      }
    };

    return { [TS_INTERFACE_DECLARATION]: visitInterface };
  },
  'meta': {
    'messages': {
      'dataShapeMustBeType':
        "Interface '{{name}}' has no method/call/construct signatures. Per the type-substrate rule, data shapes must be declared as `type` in src/types/; `interface` is reserved for behavioral/class contracts and the allowlisted augmentation points."
    },
    'schema': [] as const,
    'type': 'problem' as const
  }
};

// ---------------------------------------------------------------------------
// RuleTester setup
// ---------------------------------------------------------------------------

// Wire ESLint v10 RuleTester into node:test so that rule.run() registers
// test cases through the node:test runner instead of its own internal runner.
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
(RuleTesterImpl as any).describe = describe;
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
(RuleTesterImpl as any).it = it;

const ruleTester = new RuleTesterImpl({ 'languageOptions': { 'parser': tsParser } });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

ruleTester.run('interface-must-be-contract', rule, {
  'invalid': [
    {
      'code': 'interface Foo { a: string }',
      'errors': [{ 'messageId': 'dataShapeMustBeType' }]
    },
    {
      // TSPropertySignature with TSFunctionType is a function-valued FIELD, NOT behavioral.
      'code': 'interface Foo { fn: (x: number) => void }',
      'errors': [{ 'messageId': 'dataShapeMustBeType' }]
    },
    {
      'code': 'interface Foo extends Bar { a: string }',
      'errors': [{ 'messageId': 'dataShapeMustBeType' }]
    },
    {
      'code': 'interface Foo {}',
      'errors': [{ 'messageId': 'dataShapeMustBeType' }]
    }
  ],
  'valid': [
    // Method signature → behavioral contract
    { 'code': 'interface Foo { bar(): void }' },
    // Method + property mix → behavioral (has at least one method)
    { 'code': 'interface Foo { bar(): void; baz: string }' },
    // Call signature → behavioral
    { 'code': 'interface Foo { (x: string): number }' },
    // Construct signature → behavioral
    { 'code': 'interface Foo { new(): Foo }' },
    // Allowlisted: declaration-merge augmentation points
    { 'code': 'interface JsonTologyReferencesInterface {}' },
    { 'code': 'interface JsonTologyTypeConfigInterface { [k: string]: boolean }' }
  ]
});
