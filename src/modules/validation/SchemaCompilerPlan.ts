/**
 * SchemaCompilerPlan — plan-time graph helpers and node validation plan builder.
 *
 * Merged from SchemaCompilerGraph.ts (check-time graph traversal) and
 * SchemaCompilerValidatePlan.ts (validate-time plan construction).
 *
 * Exports:
 *   buildNodePlan     — single keyword traversal → CompiledNodeValidationPlanType
 *   graph helpers     — compileArrayCheck, compileConstCheck, compileEnumCheck,
 *                       compileObjectCheck, compileRefCheck,
 *                       nodeSupportsCompilation, tryCompileFlatObjectCheck
 */

import type { CheckFnType } from '../../types/Validation.js';
import type { FormatRegistryInterface } from '../../interfaces/FormatRegistry.js';
import type { PropCheckType } from '../../types/PropCheck.js';
import type { SchemaCompilerGraphContextType } from '../../types/SchemaCompilerGraphContext.js';
import type {
  SchemaGraphNodeType, SchemaGraphSemanticsType
} from '../../types/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { KeywordDefinitionType } from '../../types/GraphEngine.js';
import type { ValidateWithErrorsFnType } from '../../types/Validation.js';
import type { CustomKeywordEntryType } from '../../types/CustomKeywordEntry.js';
import type { CompiledNodeValidationPlanType } from '../../types/CompiledNodeValidationPlan.js';
import type { SchemaCompilerValidatePlanContextType } from '../../types/SchemaCompilerValidatePlanContext.js';
import type {
  AllowedKeysResultType,
  BranchRefResultType,
  CompositionValidatorsResultType,
  ConditionalPropertyKeySetType,
  ConditionalValidatorsResultType,
  CustomKeywordEntriesResultType,
  DependentSchemaValidatorEntryType,
  DependentSchemaValidatorsResultType,
  DepRequiredEntriesType,
  EnumPrimitiveSetType,
  InheritedPropertyKeySetType,
  JtStrictPerFieldMapType,
  KeyPatternCheckResultType,
  ObjectPropValidatorsMapType,
  OptionalCheckFnType,
  OptionalValidateWithErrorsFnType,
  PatternPropCheckEntryType,
  PatternPropChecksResultType,
  PatternPropValidatorEntryType,
  PatternPropValidatorsResultType,
  PlanArrayValidatorsType,
  PropertyDefaultsMapType,
  PropValidatorsMapType,
  ValidateWithErrorsResultType
} from '../../types/Validation.js';
import type { LookupSchemaFnType } from '../../types/LookupSchema.js';
import type {
  GraphCompileOptionsType, GraphCompileWithSemanticsType
} from '../../types/GraphCompileOptions.js';
import type { PlanCompileWithSemanticsType } from '../../types/PlanCompileOptions.js';
import type { ArrayChecksType } from '../../types/ArrayChecks.js';
import type { CheckObjectKeysOptionsType } from '../../types/CheckObjectKeysOptions.js';
import type { CollectBranchOptionsType } from '../../types/CollectBranchOptions.js';
import type { ContainsCheckOptionsType } from '../../types/ContainsCheckOptions.js';
import type { FlatObjectCheckContextType } from '../../types/FlatObjectCheckContext.js';
import type { NodeSupportContextType } from '../../types/NodeSupportContext.js';
import type { ObjectChecksType } from '../../types/ObjectChecks.js';
import type { PlanAllowedKeysOptionsType } from '../../types/PlanAllowedKeysOptions.js';
import type { PlanPreludeType } from '../../types/PlanPrelude.js';
import type { PropertyDefaultsOptionsType } from '../../types/PropertyDefaultsOptions.js';
import type { PropertyValidatorsOptionsType } from '../../types/PropertyValidatorsOptions.js';
import type { RefNodeSupportOptionsType } from '../../types/RefNodeSupportOptions.js';
import type { RefValidatorOptionsType } from '../../types/RefValidatorOptions.js';
import type { ResolveScanRefOptionsType } from '../../types/ResolveScanRefOptions.js';
import type { ScanConditionalOptionsType } from '../../types/ScanConditionalOptions.js';
import type { WalkInheritedRefOptionsType } from '../../types/WalkInheritedRefOptions.js';
import type { ConstraintValidatorsResult } from '../../types/ConstraintValidatorsResult.js';
import {
  deepEqual, isRecord
} from '../data/DataTypes.js';
import { SchemaGraph } from '../graph/SchemaGraph.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { Predicates } from './Predicates.js';
import { RefResolver } from './RefResolver.js';
import { BaseError } from '../../errors/BaseError.js';
import { SchemaCompilerSupport } from './SchemaCompilerSupport.js';
import { VALIDATION_MESSAGES } from '../../constants/VALIDATION_MESSAGES.js';

// ---------------------------------------------------------------------------
// Module-scope singletons — boolean schema fast paths (A.1)
// ---------------------------------------------------------------------------

const ALWAYS_TRUE_CHECK: CheckFnType = (_: unknown): boolean => {
  return true;
};

const ALWAYS_FALSE_CHECK: CheckFnType = (_: unknown): boolean => {
  return false;
};

const TRUE_VALIDATOR: ValidateWithErrorsFnType = (value: unknown): ValidateWithErrorsResultType => {
  return {
    'valid': true,
    value
  };
};

const FALSE_VALIDATOR: ValidateWithErrorsFnType = (
  value: unknown,
  path: string,
  errors: Array<ReturnType<typeof BaseError.validationError>>,
  collectErrors: boolean
): ValidateWithErrorsResultType => {
  if (collectErrors) {
    errors.push(BaseError.validationError(path, 'falseSchema', VALIDATION_MESSAGES.falseSchema));
  }

  return {
    'valid': false,
    value
  };
};

// ---------------------------------------------------------------------------
// Internal helpers (graph context)
// ---------------------------------------------------------------------------

/**
 * Resolve a `$ref` string to its target graph and node within the `walk` traversal,
 * then continue collecting property names.
 */
function walkInheritedRef(opts: WalkInheritedRefOptionsType): void {
  const {
    currentGraph, lookupGraph, ref, walkFn
  } = opts;

  if (ref.startsWith('#')) {
    walkFn(currentGraph, currentGraph.resolveFragment(ref.slice(1)));

    return;
  }

  if (lookupGraph === undefined) {
    return;
  }

  const {
    fragment, id
  } = SchemaIri.parseRef(ref);
  const targetGraph = lookupGraph(id);

  if (targetGraph !== undefined) {
    walkFn(targetGraph, targetGraph.resolveFragment(fragment));
  }
}

/**
 * Walk `allOf` parents (recursively, resolving `$ref` into the parent's
 * graph) and collect every property name the schema effectively
 * declares. Without this, `allowedKeys` only contains the body's own
 * properties and `removeAdditionalProperties: true` strips parent
 * fields supplied at the wire level — values that the rest of the
 * validator already accepts through the allOf member chain.
 */
function collectInheritedAllOfPropertyKeys(
  sem: SchemaGraphSemanticsType,
  graph: SchemaGraphInterface,
  lookupGraph?: (schemaId: string) => SchemaGraphInterface | undefined
): InheritedPropertyKeySetType {
  const inherited = new Set<string>();
  const visited = new Set<SchemaGraphNodeType>();

  const walk = (currentGraph: SchemaGraphInterface, node: SchemaGraphNodeType): void => {
    if (visited.has(node)) {
      return;
    }
    visited.add(node);

    const nodeSem = currentGraph.semantics(node);

    if (nodeSem.ref !== undefined) {
      walkInheritedRef({
        currentGraph,
        lookupGraph,
        'ref': nodeSem.ref,
        'walkFn': walk
      });

      return;
    }

    for (const name of nodeSem.properties.keys()) {
      inherited.add(name);
    }
    for (const member of nodeSem.allOf) {
      walk(currentGraph, member);
    }
  };

  for (const member of sem.allOf) {
    walk(graph, member);
  }

  return inherited;
}

/** Resolve a `$ref` to the target graph and fragment node during branch collection. */
function resolveBranchRef(
  ref: string,
  currentGraph: SchemaGraphInterface,
  lookupGraph: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined
): BranchRefResultType {
  if (ref.startsWith('#')) {
    return {
      'graph': currentGraph,
      'node': currentGraph.resolveFragment(ref.slice(1))
    };
  }

  if (lookupGraph === undefined) {
    return undefined;
  }

  const {
    fragment, id
  } = SchemaIri.parseRef(ref);
  const targetGraph = lookupGraph(id);

  return targetGraph === undefined
    ? undefined
    : {
      'graph': targetGraph,
      'node': targetGraph.resolveFragment(fragment)
    };
}

/**
 * Collect every property name reachable from a conditional branch node
 * (its own properties plus those behind `allOf`, `$ref`, and nested `then`/`else`).
 */
function collectBranchPropertyNames(opts: CollectBranchOptionsType): void {
  const {
    branchNode, scanState, startGraph
  } = opts;
  const {
    collectVisited, lookupGraph, target
  } = scanState;

  const collectFn = (currentGraph: SchemaGraphInterface, node: SchemaGraphNodeType): void => {
    if (collectVisited.has(node)) {
      return;
    }
    collectVisited.add(node);

    const nodeSem = currentGraph.semantics(node);

    if (nodeSem.ref !== undefined) {
      const resolved = resolveBranchRef(nodeSem.ref, currentGraph, lookupGraph);

      if (resolved !== undefined) {
        collectFn(resolved.graph, resolved.node);
      }

      return;
    }

    for (const name of nodeSem.properties.keys()) {
      target.add(name);
    }
    for (const member of nodeSem.allOf) {
      collectFn(currentGraph, member);
    }
    if (nodeSem.thenNode !== undefined) {
      collectFn(currentGraph, nodeSem.thenNode);
    }
    if (nodeSem.elseNode !== undefined) {
      collectFn(currentGraph, nodeSem.elseNode);
    }
  };

  collectFn(startGraph, branchNode);
}

/**
 * Scan a semantics node and its `allOf` members for `if`/`then`/`else` branches,
 * collecting all reachable property names into `target`.
 */
function scanForConditionalBranches(opts: ScanConditionalOptionsType): void {
  const {
    currentGraph, scanSem, scanState
  } = opts;
  const { scanVisited } = scanState;

  if (scanSem.thenNode !== undefined) {
    collectBranchPropertyNames({
      'branchNode': scanSem.thenNode,
      scanState,
      'startGraph': currentGraph
    });
  }
  if (scanSem.elseNode !== undefined) {
    collectBranchPropertyNames({
      'branchNode': scanSem.elseNode,
      scanState,
      'startGraph': currentGraph
    });
  }

  for (const member of scanSem.allOf) {
    if (scanVisited.has(member)) {
      continue;
    }
    scanVisited.add(member);

    const memberSem = currentGraph.semantics(member);

    if (memberSem.ref !== undefined) {
      resolveScanRef({
        currentGraph,
        'ref': memberSem.ref,
        scanState
      });
      continue;
    }

    scanForConditionalBranches({
      currentGraph,
      'scanSem': memberSem,
      scanState
    });
  }
}

/**
 * Resolve a `$ref` encountered during conditional-branch scanning.
 */
function resolveScanRef(opts: ResolveScanRefOptionsType): void {
  const {
    currentGraph, ref, scanState
  } = opts;
  const { lookupGraph } = scanState;

  if (ref.startsWith('#')) {
    const refSem = currentGraph.semantics(currentGraph.resolveFragment(ref.slice(1)));

    scanForConditionalBranches({
      currentGraph,
      'scanSem': refSem,
      scanState
    });

    return;
  }

  if (lookupGraph === undefined) {
    return;
  }

  const {
    fragment, id
  } = SchemaIri.parseRef(ref);
  const targetGraph = lookupGraph(id);

  if (targetGraph !== undefined) {
    const refSem = targetGraph.semantics(targetGraph.resolveFragment(fragment));

    scanForConditionalBranches({
      'currentGraph': targetGraph,
      'scanSem': refSem,
      scanState
    });
  }
}

/**
 * Collect property names declared in the `then` / `else` branches of an
 * if/then/else conditional (recursively, including any `allOf` or `$ref`
 * inside those branches). A property that exists ONLY inside an active
 * conditional branch (e.g. `EBook` requires `epubVersion` when
 * `fileFormat === 'epub'`) is a legitimately-evaluated property; without
 * including it here, `removeAdditionalProperties: true` strips it before the
 * branch validator runs, and the subsequent branch re-check then fails on the
 * now-missing required property. Used solely to widen `allowedKeysForStrip`
 * (strip-protection); the strict `additionalProperties: false` check still
 * uses the own-only `allowedKeys` set per JSON Schema semantics.
 */
function collectConditionalPropertyKeys(
  sem: SchemaGraphSemanticsType,
  graph: SchemaGraphInterface,
  lookupGraph?: (schemaId: string) => SchemaGraphInterface | undefined
): ConditionalPropertyKeySetType {
  const conditional = new Set<string>();
  const collectVisited = new Set<SchemaGraphNodeType>();
  const scanVisited = new Set<SchemaGraphNodeType>();

  scanForConditionalBranches({
    'currentGraph': graph,
    'scanSem': sem,
    'scanState': {
      collectVisited,
      lookupGraph,
      scanVisited,
      'target': conditional
    }
  });

  return conditional;
}

/** Check whether composition keywords block the flat-object fast path. */
function hasBlockingCompositionKeywords(sem: SchemaGraphSemanticsType): boolean {
  return sem.allOf.length > 0
    || sem.anyOf.length > 0
    || sem.oneOf.length > 0
    || sem.complementNode !== undefined
    || sem.ifNode !== undefined;
}

/** Check whether structural keywords (ref, pattern, size) block the fast path. */
function hasBlockingStructuralKeywords(sem: SchemaGraphSemanticsType): boolean {
  if (sem.ref !== undefined) {
    return true;
  }
  if (sem.patternPropertyEntries.length > 0) {
    return true;
  }
  if (sem.minProperties !== undefined || sem.maxProperties !== undefined) {
    return true;
  }
  if (sem.additionalPropertiesNode !== undefined
    && sem.additionalPropertiesNode !== false
    && sem.additionalPropertiesNode !== true) {
    return true;
  }

  return false;
}

/** Check whether dependency or custom-keyword constraints block the fast path. */
function hasBlockingDependencyKeywords(
  sem: SchemaGraphSemanticsType,
  context: SchemaCompilerGraphContextType
): boolean {
  if (sem.containsNode !== undefined) {
    return true;
  }
  if (Object.keys(sem.dependentRequired).length > 0) {
    return true;
  }
  if (sem.dependentSchemaEntries.length > 0) {
    return true;
  }
  if (context.activeCustomKeywords.length > 0 && Object.keys(sem.extensions).length > 0) {
    return true;
  }

  return false;
}

/** Check whether constraint keywords block the flat-object fast path. */
function hasBlockingConstraintKeywords(
  sem: SchemaGraphSemanticsType,
  context: SchemaCompilerGraphContextType
): boolean {
  return hasBlockingStructuralKeywords(sem) || hasBlockingDependencyKeywords(sem, context);
}

function canUseFlatObjectFastPath(
  context: SchemaCompilerGraphContextType,
  sem: SchemaGraphSemanticsType
): boolean {
  if (!sem.schemaTypes.includes('object')) {
    return false;
  }
  if (hasBlockingCompositionKeywords(sem)) {
    return false;
  }
  if (hasBlockingConstraintKeywords(sem, context)) {
    return false;
  }

  return sem.properties.size > 0;
}

function buildFlatObjectPropertyChecks(
  opts: GraphCompileOptionsType,
  sem: SchemaGraphSemanticsType
): PropCheckType[] {
  const {
    properties, required
  } = sem;
  const {
    context, formatRegistry, graph, lookupSchema
  } = opts;
  const propChecks: PropCheckType[] = [];

  for (const [
    name,
    propNode
  ] of properties) {
    propChecks.push({
      'check': context.compileNodeOrBooleanCheck(propNode, formatRegistry, graph, lookupSchema),
      name,
      'required': required.includes(name)
    });
  }

  return propChecks;
}

// ---------------------------------------------------------------------------
// Graph helpers (check-time)
// ---------------------------------------------------------------------------

/** Run prefix-item checks over the appropriate index range. */
function runPrefixItemChecks(
  value: unknown[],
  prefixChecks: CheckFnType[]
): boolean {
  for (let i = 0; i < prefixChecks.length && i < value.length; i++) {
    if (!prefixChecks[i](value[i])) {
      return false;
    }
  }

  return true;
}

/** Run item-level checks from a start index. */
function runItemChecks(
  value: unknown[],
  itemCheck: CheckFnType,
  startIndex: number
): boolean {
  for (let i = startIndex; i < value.length; i++) {
    if (!itemCheck(value[i])) {
      return false;
    }
  }

  return true;
}

/** Validate array size and uniqueness constraints. */
function runArraySizeChecks(value: unknown[], checks: ArrayChecksType): boolean {
  if (checks.minItems !== undefined && value.length < checks.minItems) {
    return false;
  }
  if (checks.maxItems !== undefined && value.length > checks.maxItems) {
    return false;
  }
  if (checks.uniqueItems && !Predicates.satisfiesUniqueItems(value)) {
    return false;
  }

  return true;
}

/** Validate array item-level constraints (prefix items, items, contains). */
function runArrayItemChecks(value: unknown[], checks: ArrayChecksType): boolean {
  const {
    containsCheck, itemCheck, maxContains, minContains, prefixChecks
  } = checks;

  if (prefixChecks !== undefined && !runPrefixItemChecks(value, prefixChecks)) {
    return false;
  }
  if (itemCheck !== undefined) {
    const startIndex = prefixChecks === undefined ? 0 : prefixChecks.length;

    if (!runItemChecks(value, itemCheck, startIndex)) {
      return false;
    }
  }
  if (containsCheck !== undefined && !runContainsCheck({
    containsCheck,
    maxContains,
    minContains,
    value
  })) {
    return false;
  }

  return true;
}

/** Execute all compiled array checks against a known-array value. */
function runArrayChecks(value: unknown[], checks: ArrayChecksType): boolean {
  if (!runArraySizeChecks(value, checks)) {
    return false;
  }

  return runArrayItemChecks(value, checks);
}

/** Evaluate a `contains` check against an array, returning whether the count satisfies min/max. */
function runContainsCheck(opts: ContainsCheckOptionsType): boolean {
  const {
    containsCheck, maxContains, minContains, value
  } = opts;
  let count = 0;

  for (const item of value) {
    if (containsCheck(item)) {
      count++;
    }
  }
  if (minContains !== undefined && count < minContains) {
    return false;
  }
  if (maxContains !== undefined && count > maxContains) {
    return false;
  }
  if (minContains === undefined && maxContains === undefined && count === 0) {
    return false;
  }

  return true;
}

/** Build the item-level check from a node (or return a boolean fast-path). */
function buildItemCheck(
  opts: GraphCompileOptionsType,
  itemsNode: SchemaGraphNodeType
): OptionalCheckFnType {
  if (typeof itemsNode.schema === 'boolean') {
    return itemsNode.schema ? undefined : ALWAYS_FALSE_CHECK;
  }

  const {
    context, formatRegistry, graph, lookupSchema
  } = opts;

  return context.compileNodeCheck(itemsNode, formatRegistry, graph, lookupSchema);
}

/**
 * Compile a check function for array-typed values from the given graph node.
 *
 * @param context - Graph compilation context providing node-check helpers.
 * @param graphNode - The graph node representing the array schema.
 * @param formatRegistry - Registry for format validators.
 * @param graph - The schema graph containing `graphNode`.
 * @param lookupSchema - Optional cross-schema lookup by `$id`.
 * @returns A `CheckFnType` for arrays, or `undefined` when no array constraints apply.
 *
 * @remarks
 * Returns `undefined` when no array-specific keywords are present; callers
 * should treat `undefined` as an always-pass check.
 *
 * @example
 * ```ts
 * const check = compileArrayCheck(context, node, fmtReg, graph);
 * // check(value) returns true when value satisfies all array constraints
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link compileObjectCheck}
 * @group SchemaCompiler
 */
export function compileArrayCheck(
  context: SchemaCompilerGraphContextType,
  graphNode: SchemaGraphNodeType,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  lookupSchema?: LookupSchemaFnType
): OptionalCheckFnType {
  const sem = graph.semantics(graphNode);
  const minItems = sem.minItems;
  const maxItems = sem.maxItems;
  const uniqueItems = sem.uniqueItems;
  const prefixItemNodes = sem.prefixItems;
  const containsNode = sem.containsNode;
  const minContains = sem.minContains;
  const maxContains = sem.maxContains;

  const graphOpts: GraphCompileOptionsType = lookupSchema === undefined
    ? {
      context,
      formatRegistry,
      graph
    }
    : {
      context,
      formatRegistry,
      graph,
      'lookupSchema': lookupSchema
    };
  const itemCheck = sem.itemsNode === undefined
    ? undefined
    : buildItemCheck(graphOpts, sem.itemsNode);

  let prefixChecks: CheckFnType[] | undefined;

  if (prefixItemNodes.length > 0) {
    prefixChecks = [];
    for (const node of prefixItemNodes) {
      prefixChecks.push(context.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema));
    }
  }

  const containsCheck = containsNode === undefined
    ? undefined
    : context.compileNodeOrBooleanCheck(containsNode, formatRegistry, graph, lookupSchema);

  const arrayChecks: ArrayChecksType = {
    containsCheck,
    itemCheck,
    maxContains,
    maxItems,
    minContains,
    minItems,
    prefixChecks,
    uniqueItems
  };

  return (value: unknown): boolean => {
    if (!Array.isArray(value)) {
      return true;
    }

    return runArrayChecks(value, arrayChecks);
  };
}

/**
 * Compile a check function for a `const` schema value.
 *
 * @param constValue - The constant value from the schema.
 * @returns A `CheckFnType` that performs a fast equality or deep-equality check.
 *
 * @remarks
 * Primitive `const` values use strict equality (`===`). Object and array
 * values use deep structural equality via `deepEqual`.
 *
 * @example
 * ```ts
 * const check = compileConstCheck('active');
 * check('active'); // true
 * check('inactive'); // false
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link compileEnumCheck}
 * @group SchemaCompiler
 */
export function compileConstCheck(constValue: unknown): CheckFnType {
  if (constValue === null || typeof constValue === 'string' || typeof constValue === 'number' || typeof constValue === 'boolean') {
    return (value: unknown): boolean => {
      return value === constValue;
    };
  }

  return (value: unknown): boolean => {
    return deepEqual(value, constValue);
  };
}

/**
 * Compile a check function for an `enum` schema value list.
 *
 * @param enumValues - The list of allowed values from the schema.
 * @returns A `CheckFnType` using a `Set` for primitive-only enums, or deep equality otherwise.
 *
 * @remarks
 * When all enum entries are primitives (`null`, `string`, `number`, `boolean`),
 * uses a `Set.has` lookup for O(1) performance. Falls back to deep equality
 * comparison for mixed or complex enum values.
 *
 * @example
 * ```ts
 * const check = compileEnumCheck(['red', 'green', 'blue']);
 * check('red');    // true
 * check('purple'); // false
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link compileConstCheck}
 * @group SchemaCompiler
 */
export function compileEnumCheck(enumValues: unknown[]): CheckFnType {
  const allPrimitive = enumValues.every((entry: unknown): boolean => {
    return entry === null || typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean';
  });

  if (allPrimitive) {
    const enumSet = new Set(enumValues);

    return (value: unknown): boolean => {
      return enumSet.has(value);
    };
  }

  return (value: unknown): boolean => {
    return enumValues.some((entry: unknown): boolean => {
      return deepEqual(entry, value);
    });
  };
}

/** Build object property validators from semantics. */
function buildObjectPropValidators(opts: GraphCompileWithSemanticsType): ObjectPropValidatorsMapType {
  const {
    context, formatRegistry, graph, lookupSchema, sem
  } = opts;
  const propValidators = new Map<string, CheckFnType>();

  for (const [
    key,
    propNode
  ] of sem.properties) {
    if (typeof propNode.schema === 'boolean') {
      if (!propNode.schema) {
        propValidators.set(key, ALWAYS_FALSE_CHECK);
      }
    } else {
      propValidators.set(key, context.compileNodeCheck(propNode, formatRegistry, graph, lookupSchema));
    }
  }

  return propValidators;
}

/** Build pattern-property validators from semantics. */
function buildPatternPropChecks(opts: GraphCompileWithSemanticsType): PatternPropChecksResultType {
  const {
    context, formatRegistry, graph, lookupSchema, sem
  } = opts;

  if (sem.patternPropertyEntries.length === 0) {
    return undefined;
  }

  const patternChecks: PatternPropCheckEntryType[] = [];

  for (const [
    pat,
    patNode
  ] of sem.patternPropertyEntries) {
    patternChecks.push({
      'check': context.compileNodeOrBooleanCheck(patNode, formatRegistry, graph, lookupSchema),
      'regex': new RegExp(pat, 'u')
    });
  }

  return patternChecks;
}

/**
 * Check a single key against pattern-property validators.
 * Returns `{ matched: true, valid: false }` when a pattern matches but fails validation.
 * Returns `{ matched: true, valid: true }` when a pattern matches and passes.
 * Returns `{ matched: false, valid: true }` when no pattern matches.
 */
function checkKeyAgainstPatterns(
  key: string,
  value: unknown,
  patternChecks: PatternPropChecksResultType
): KeyPatternCheckResultType {
  if (patternChecks === undefined) {
    return {
      'matched': false,
      'valid': true
    };
  }

  let matched = false;

  for (const pc of patternChecks) {
    if (pc.regex.test(key)) {
      matched = true;
      if (!pc.check(value)) {
        return {
          'matched': true,
          'valid': false
        };
      }
    }
  }

  return {
    'matched': matched,
    'valid': true
  };
}

/** Execute all compiled object checks against a known-record value. */
function runObjectCheck(value: Record<string, unknown>, checks: ObjectChecksType): boolean {
  const {
    additionalCheck, additionalIsFalse, maxProperties, minProperties,
    patternChecks, properties, propValidators, required
  } = checks;

  if (required !== undefined) {
    for (const key of required) {
      if (!(key in value)) {
        return false;
      }
    }
  }

  if (minProperties !== undefined || maxProperties !== undefined) {
    const count = Object.keys(value).length;

    if (minProperties !== undefined && count < minProperties) {
      return false;
    }
    if (maxProperties !== undefined && count > maxProperties) {
      return false;
    }
  }

  return checkObjectKeys({
    additionalCheck,
    additionalIsFalse,
    'obj': value,
    patternChecks,
    properties,
    propValidators
  });
}

/** Evaluate all object keys against property, pattern, and additional validators. */
function checkObjectKeys(opts: CheckObjectKeysOptionsType): boolean {
  const {
    additionalCheck, additionalIsFalse, obj, patternChecks, properties, propValidators
  } = opts;

  for (const key of Object.keys(obj)) {
    const propCheck = propValidators.get(key);

    if (propCheck !== undefined) {
      if (!propCheck(obj[key])) {
        return false;
      }
      continue;
    }

    const patternResult = checkKeyAgainstPatterns(key, obj[key], patternChecks);

    if (!patternResult.valid) {
      return false;
    }
    if (patternResult.matched) {
      continue;
    }

    if (additionalIsFalse) {
      if (!properties.has(key)) {
        return false;
      }
    } else if (additionalCheck !== undefined && !additionalCheck(obj[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Compile a check function for object-typed values from the given graph node.
 *
 * @param context - Graph compilation context providing node-check helpers.
 * @param graphNode - The graph node representing the object schema.
 * @param formatRegistry - Registry for format validators.
 * @param graph - The schema graph containing `graphNode`.
 * @param lookupSchema - Optional cross-schema lookup by `$id`.
 * @returns A `CheckFnType` for object values, or `undefined` when no object constraints apply.
 *
 * @remarks
 * Evaluates required properties, min/max property counts, per-property validators,
 * pattern-property validators, and additional-properties constraints.
 *
 * @example
 * ```ts
 * const check = compileObjectCheck(context, node, fmtReg, graph);
 * // check({ id: '1' }) returns true when the object satisfies all object constraints
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link compileArrayCheck}
 * @group SchemaCompiler
 */
export function compileObjectCheck(
  context: SchemaCompilerGraphContextType,
  graphNode: SchemaGraphNodeType,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  lookupSchema?: LookupSchemaFnType
): OptionalCheckFnType {
  const sem = graph.semantics(graphNode);
  const semOpts: GraphCompileWithSemanticsType = {
    context,
    formatRegistry,
    graph,
    'lookupSchema': lookupSchema,
    sem
  };
  const propValidators = buildObjectPropValidators(semOpts);
  const properties = sem.properties;
  const required = sem.required.length > 0 ? sem.required : undefined;
  const additionalPropertiesNode = sem.additionalPropertiesNode;
  const minProperties = sem.minProperties;
  const maxProperties = sem.maxProperties;
  const patternChecks = buildPatternPropChecks(semOpts);

  const hasAdditionalSchemaNode = additionalPropertiesNode !== undefined
    && additionalPropertiesNode !== true
    && additionalPropertiesNode !== false;

  const additionalCheck = hasAdditionalSchemaNode
    ? context.compileNodeOrBooleanCheck(
      additionalPropertiesNode,
      formatRegistry,
      graph,
      lookupSchema
    )
    : undefined;

  const objectChecks: ObjectChecksType = {
    additionalCheck,
    'additionalIsFalse': additionalPropertiesNode === false,
    maxProperties,
    minProperties,
    patternChecks,
    properties,
    propValidators,
    required
  };

  return (value: unknown): boolean => {
    if (!isRecord(value)) {
      return true;
    }

    return runObjectCheck(value, objectChecks);
  };
}

/** Resolve a cross-schema root ref using the pre-compiled lookup when available. */
function compileCrossSchemaRootRef(
  context: SchemaCompilerGraphContextType,
  schemaId: string,
  fragment: string
): OptionalCheckFnType {
  if ((fragment === '' || fragment === '/') && context.lookupCompiled !== undefined) {
    const { lookupCompiled } = context;

    return (value: unknown): boolean => {
      const compiled = lookupCompiled(schemaId);

      return compiled === undefined ? true : compiled.check(value);
    };
  }

  return undefined;
}

/**
 * Compile a check function for a `$ref` reference from the given graph node.
 *
 * @param context - Graph compilation context providing node-check helpers.
 * @param ref - The `$ref` string to resolve.
 * @param formatRegistry - Registry for format validators.
 * @param graph - The schema graph containing the referencing node.
 * @param lookupSchema - Optional cross-schema lookup by `$id`.
 * @param lookupGraph - Optional cross-graph lookup by `$id`.
 * @returns A `CheckFnType` for the referenced schema, or `undefined` when the ref cannot be resolved.
 *
 * @remarks
 * Uses a pre-compiled root-ref fast path when the referenced schema has been
 * compiled and the ref targets the root. Falls back to recursive compilation
 * for intra-graph and fragment refs.
 *
 * @example
 * ```ts
 * const check = compileRefCheck(context, '#/definitions/Address', fmtReg, graph);
 * // check(value) validates value against the referenced schema
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link compileArrayCheck}
 * @group SchemaCompiler
 */
export function compileRefCheck(
  context: SchemaCompilerGraphContextType,
  ref: string,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  lookupSchema?: LookupSchemaFnType,
  lookupGraph?: (schemaId: string) => SchemaGraphInterface | undefined
): OptionalCheckFnType {
  // Fast path: cross-schema root ref with a pre-compiled entry
  if (!ref.startsWith('#')) {
    const {
      fragment, 'id': schemaId
    } = SchemaIri.parseRef(ref);
    const fastPath = compileCrossSchemaRootRef(context, schemaId, fragment);

    if (fastPath !== undefined) {
      return fastPath;
    }
  }

  const resolved = RefResolver.resolve(ref, graph, lookupSchema, lookupGraph);

  if (resolved === undefined) {
    return undefined;
  }

  const {
    'graph': targetGraph, 'node': targetNode
  } = resolved;

  if (typeof targetNode.schema === 'boolean') {
    return targetNode.schema ? ALWAYS_TRUE_CHECK : ALWAYS_FALSE_CHECK;
  }

  if (targetGraph === graph && context.compilingNodes.has(targetNode)) {
    let cachedCheck: OptionalCheckFnType;

    return (value: unknown): boolean => {
      cachedCheck ??= context.compileNodeCheck(targetNode, formatRegistry, targetGraph, lookupSchema);

      return cachedCheck(value);
    };
  }

  return context.compileNodeCheck(targetNode, formatRegistry, targetGraph, lookupSchema);
}

/** Check whether a `$ref` target supports compilation, updating `visited` to prevent re-entry. */
function checkRefNodeSupport(opts: RefNodeSupportOptionsType): boolean {
  const {
    graph, lookupGraph, lookupSchema, ref, refTargetNode, visited
  } = opts;

  if (refTargetNode !== undefined) {
    return nodeSupportsCompilation(refTargetNode, graph, lookupSchema, visited, lookupGraph);
  }

  const { 'id': schemaId } = SchemaIri.parseRef(ref);

  if (visited.has(schemaId)) {
    return true;
  }
  visited.add(schemaId);

  const refSchema = lookupGraph === undefined ? lookupSchema?.(schemaId) : undefined;
  const refGraph = lookupGraph?.(schemaId) ?? (refSchema === undefined ? undefined : new SchemaGraph(refSchema));

  if (refGraph !== undefined) {
    return nodeSupportsCompilation(refGraph.rootNode, refGraph, lookupSchema, visited, lookupGraph);
  }

  return true;
}

/** Check that every branch in an array supports compilation. */
function checkBranchArraySupport(
  branches: readonly SchemaGraphNodeType[],
  ctx: NodeSupportContextType
): boolean {
  for (const branch of branches) {
    if (!nodeSupportsCompilation(branch, ctx.graph, ctx.lookupSchema, ctx.visited, ctx.lookupGraph)) {
      return false;
    }
  }

  return true;
}

/** Check that every optional child node supports compilation. */
function checkOptionalChildrenSupport(
  children: ReadonlyArray<SchemaGraphNodeType | undefined>,
  ctx: NodeSupportContextType
): boolean {
  const {
    graph, lookupGraph, lookupSchema, visited
  } = ctx;

  for (const child of children) {
    if (child !== undefined && !nodeSupportsCompilation(child, graph, lookupSchema, visited, lookupGraph)) {
      return false;
    }
  }

  return true;
}

/** Check that every property node supports compilation. */
function checkPropertyNodesSupport(
  properties: ReadonlyMap<string, SchemaGraphNodeType>,
  ctx: NodeSupportContextType
): boolean {
  for (const [
    , propNode
  ] of properties) {
    if (!nodeSupportsCompilation(propNode, ctx.graph, ctx.lookupSchema, ctx.visited, ctx.lookupGraph)) {
      return false;
    }
  }

  return true;
}

/** Return `true` when the semantics include unsupported compilation-blocking keywords. */
function hasUnsupportedKeywords(sem: SchemaGraphSemanticsType): boolean {
  return sem.dynamicRef !== undefined
    || sem.dynamicAnchor !== undefined
    || sem.unevaluatedPropertiesNode !== undefined
    || sem.unevaluatedItemsNode !== undefined
    || sem.rdfsRange !== undefined
    || sem.rdfsDomain !== undefined;
}

/** Check whether `allOf`, `anyOf`, `oneOf`, conditional, and property nodes are all compilable. */
function checkCompositionSupport(
  sem: SchemaGraphSemanticsType,
  ctx: NodeSupportContextType
): boolean {
  if (!checkBranchArraySupport(sem.allOf, ctx)) {
    return false;
  }
  if (!checkBranchArraySupport(sem.anyOf, ctx)) {
    return false;
  }
  if (!checkBranchArraySupport(sem.oneOf, ctx)) {
    return false;
  }
  if (!checkOptionalChildrenSupport(
    [
      sem.complementNode,
      sem.ifNode,
      sem.thenNode,
      sem.elseNode
    ],
    ctx
  )) {
    return false;
  }

  return checkPropertyNodesSupport(sem.properties, ctx);
}

/**
 * Return whether the schema node and all nodes reachable from it can be
 * compiled into check/validate functions.
 *
 * @param node - The graph node to evaluate.
 * @param graph - The schema graph containing `node`.
 * @param lookupSchema - Optional cross-schema lookup by `$id`.
 * @param visited - Mutable set of already-visited nodes, preventing re-entry.
 * @param lookupGraph - Optional cross-graph lookup by `$id`.
 * @returns `true` when the node and all reachable nodes are compilable.
 *
 * @remarks
 * Returns `false` immediately for nodes using `$dynamicRef`, `$dynamicAnchor`,
 * `unevaluatedProperties`, `unevaluatedItems`, or RDF domain/range constraints.
 *
 * @example
 * ```ts
 * const visited = new Set<SchemaGraphNodeType | string>();
 * const supported = nodeSupportsCompilation(graph.rootNode, graph, undefined, visited);
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link compileArrayCheck}
 * @group SchemaCompiler
 */
export function nodeSupportsCompilation(
  node: SchemaGraphNodeType,
  graph: SchemaGraphInterface,
  lookupSchema: LookupSchemaFnType | undefined,
  visited: Set<SchemaGraphNodeType | string>,
  lookupGraph?: (schemaId: string) => SchemaGraphInterface | undefined
): boolean {
  if (visited.has(node)) {
    return true;
  }
  visited.add(node);

  const sem = graph.semantics(node);

  if (hasUnsupportedKeywords(sem)) {
    return false;
  }

  if (sem.ref !== undefined
    && !checkRefNodeSupport({
      graph,
      lookupGraph,
      lookupSchema,
      'ref': sem.ref,
      'refTargetNode': sem.refTargetNode,
      visited
    })) {
    return false;
  }

  const ctx: NodeSupportContextType = {
    graph,
    lookupGraph,
    lookupSchema,
    visited
  };

  if (!checkCompositionSupport(sem, ctx)) {
    return false;
  }

  if (
    sem.itemsNode !== undefined
    && !nodeSupportsCompilation(sem.itemsNode, graph, lookupSchema, visited, lookupGraph)
  ) {
    return false;
  }

  if (sem.additionalPropertiesNode !== undefined && typeof sem.additionalPropertiesNode !== 'boolean') {
    return nodeSupportsCompilation(sem.additionalPropertiesNode, graph, lookupSchema, visited, lookupGraph);
  }

  return true;
}

/**
 * Attempt to compile a flat-object fast-path check for the given graph node.
 *
 * @param context - Graph compilation context providing node-check helpers.
 * @param graphNode - The graph node representing the object schema.
 * @param formatRegistry - Registry for format validators.
 * @param graph - The schema graph containing `graphNode`.
 * @param lookupSchema - Optional cross-schema lookup by `$id`.
 * @returns A `CheckFnType` when the fast path is applicable, `undefined` otherwise.
 *
 * @remarks
 * The flat-object fast path applies when the schema is a plain object type
 * with properties but no composition, conditional, pattern-property, or
 * size-constraint keywords. It skips the full `compileObjectCheck` overhead.
 *
 * @example
 * ```ts
 * const check = tryCompileFlatObjectCheck(context, node, fmtReg, graph);
 * // undefined when the schema is too complex for the fast path
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link compileObjectCheck}
 * @group SchemaCompiler
 */
export function tryCompileFlatObjectCheck(
  context: SchemaCompilerGraphContextType,
  graphNode: SchemaGraphNodeType,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  lookupSchema?: LookupSchemaFnType
): OptionalCheckFnType {
  const sem = graph.semantics(graphNode);

  if (!canUseFlatObjectFastPath(context, sem)) {
    return undefined;
  }

  const propChecks = buildFlatObjectPropertyChecks(
    {
      context,
      formatRegistry,
      graph,
      ...(!(lookupSchema === undefined) && { lookupSchema })
    },
    sem
  );
  const rejectsAdditional = sem.additionalPropertiesNode === false;
  const semProperties = sem.properties;

  const flatCtx: FlatObjectCheckContextType = {
    propChecks,
    rejectsAdditional,
    'semProperties': semProperties
  };

  return (value: unknown): boolean => {
    if (!isRecord(value)) {
      return false;
    }

    return runFlatObjectCheck(value, flatCtx);
  };
}

/** Execute flat-object property and additional-property checks against a known-record value. */
function runFlatObjectCheck(obj: Record<string, unknown>, ctx: FlatObjectCheckContextType): boolean {
  const {
    propChecks, rejectsAdditional, semProperties
  } = ctx;

  for (const pc of propChecks) {
    const val = obj[pc.name];

    if (val === undefined && !(pc.name in obj)) {
      if (pc.required) {
        return false;
      }
      continue;
    }
    if (!pc.check(val)) {
      return false;
    }
  }

  if (rejectsAdditional) {
    for (const key of Object.keys(obj)) {
      if (!semProperties.has(key)) {
        return false;
      }
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Plan-time helpers (validate context)
// ---------------------------------------------------------------------------

function booleanValidateWithErrors(schema: boolean): ValidateWithErrorsFnType {
  return schema ? TRUE_VALIDATOR : FALSE_VALIDATOR;
}

function wrapStrictValidator(inner: ValidateWithErrorsFnType): ValidateWithErrorsFnType {
  return (
    value: unknown,
    path: string,
    errors: Array<ReturnType<typeof BaseError.validationError>>,
    collectErrors: boolean,
    applyDefaults: boolean,
    _doCoerce: boolean,
    stripUnknown: boolean
  ): ValidateWithErrorsResultType => {
    return inner(value, path, errors, collectErrors, applyDefaults, false, stripUnknown);
  };
}

function compilePropertyValidators(opts: PropertyValidatorsOptionsType): PropValidatorsMapType {
  const {
    configStrict, context, formatRegistry, graph, lookupSchema, propertyEntries
  } = opts;
  const propValidators = new Map<string, ValidateWithErrorsFnType>();

  for (const [
    key,
    propNode
  ] of propertyEntries) {
    const compiled = typeof propNode.schema === 'boolean'
      ? booleanValidateWithErrors(propNode.schema)
      : context.compileNodeValidateWithErrors(propNode, formatRegistry, graph, lookupSchema);

    const propSem = typeof propNode.schema === 'boolean' ? undefined : graph.semantics(propNode);
    const fieldStrict = propSem?.jtStrict ?? configStrict;

    propValidators.set(
      key,
      fieldStrict === true ? wrapStrictValidator(compiled) : compiled
    );
  }

  return propValidators;
}

function compileRefValidator(opts: RefValidatorOptionsType): OptionalValidateWithErrorsFnType {
  const {
    context, formatRegistry, graph, lookupGraph, lookupSchema, ref
  } = opts;

  if (typeof ref !== 'string') {
    return undefined;
  }

  const resolved = RefResolver.resolve(ref, graph, lookupSchema, lookupGraph);

  if (resolved === undefined) {
    return undefined;
  }

  const {
    'graph': targetGraph, 'node': targetNode
  } = resolved;

  if (typeof targetNode.schema === 'boolean') {
    return booleanValidateWithErrors(targetNode.schema);
  }

  let cached: OptionalValidateWithErrorsFnType;

  return (
    value: unknown,
    path: string,
    errors: Array<ReturnType<typeof BaseError.validationError>>,
    collectErrors: boolean,
    applyDef: boolean,
    doCoerce: boolean,
    stripUnk: boolean
  ): ValidateWithErrorsResultType => {
    cached ??= context.compileNodeValidateWithErrors(targetNode, formatRegistry, targetGraph, lookupSchema);

    return cached(value, path, errors, collectErrors, applyDef, doCoerce, stripUnk);
  };
}

function buildPropertyDefaults(opts: PropertyDefaultsOptionsType): PropertyDefaultsMapType {
  const {
    context, graph, lookupSchema, propertyEntries
  } = opts;
  const propertyDefaults = new Map<string, { 'defaultValue': unknown;
    'hasDefault': boolean; }>();

  for (const [
    key,
    propNode
  ] of propertyEntries) {
    if (!isRecord(propNode.schema)) {
      continue;
    }
    const propSem = graph.semantics(propNode);

    if (propSem.hasDefault) {
      propertyDefaults.set(key, {
        'defaultValue': propSem.defaultValue,
        'hasDefault': true
      });
      continue;
    }

    const implicit = context.resolveImplicitDefault(propNode, graph, lookupSchema, new Set());

    if (implicit !== undefined) {
      propertyDefaults.set(key, {
        'defaultValue': implicit,
        'hasDefault': true
      });
    }
  }

  return propertyDefaults;
}

function buildCustomKeywordEntries(
  activeCustomKeywords: KeywordDefinitionType[],
  sem: SchemaGraphSemanticsType
): CustomKeywordEntriesResultType {
  if (activeCustomKeywords.length === 0) {
    return undefined;
  }

  const entries: CustomKeywordEntryType[] = [];

  for (const kw of activeCustomKeywords) {
    if (kw.keyword in sem.extensions) {
      entries.push({
        'allowedTypes': SchemaCompilerSupport.normalizeKeywordTypes(kw.type),
        'keyword': kw.keyword,
        'schemaValue': sem.extensions[kw.keyword],
        'validate': kw.validate
      });
    }
  }

  return entries.length > 0 ? entries : undefined;
}

function buildJtStrictPerField(
  propertyEntries: ReadonlyMap<string, SchemaGraphNodeType>,
  graph: SchemaGraphInterface
): JtStrictPerFieldMapType {
  const result = new Map<string, boolean>();

  for (const [
    key,
    propNode
  ] of propertyEntries) {
    const propSem = graph.semantics(propNode);

    if (propSem.jtStrict !== undefined) {
      result.set(key, propSem.jtStrict);
    }
  }

  return result.size > 0 ? result : undefined;
}

// ---------------------------------------------------------------------------
// buildNodePlan helpers — decompose the 200-line function
// ---------------------------------------------------------------------------

/** Build the enum fast-path `Set` when all values are primitives. */
function buildEnumSet(enumValues: undefined | unknown[]): EnumPrimitiveSetType {
  if (enumValues === undefined) {
    return undefined;
  }

  const primitiveValues: Array<boolean | null | number | string> = [];

  for (const ev of enumValues) {
    if (ev === null || typeof ev === 'string' || typeof ev === 'number' || typeof ev === 'boolean') {
      primitiveValues.push(ev);
    } else {
      return undefined;
    }
  }

  return new Set<boolean | null | number | string>(primitiveValues);
}

/** Compile pattern-property validators from the semantics node. */
function buildPlanPatternPropValidators(opts: PlanCompileWithSemanticsType): PatternPropValidatorsResultType {
  const {
    context, formatRegistry, graph, lookupSchema, sem
  } = opts;

  if (sem.patternPropertyEntries.length === 0) {
    return undefined;
  }

  const patternValidators: PatternPropValidatorEntryType[] = [];

  for (const [
    pat,
    patNode
  ] of sem.patternPropertyEntries) {
    patternValidators.push({
      'regex': new RegExp(pat, 'u'),
      'validator': context.compileNodeOrBooleanValidateWithErrors(patNode, formatRegistry, graph, lookupSchema)
    });
  }

  return patternValidators;
}

/** Compile `allOf` / `anyOf` / `oneOf` validators and checks from the semantics node. */
function buildPlanCompositionValidators(opts: PlanCompileWithSemanticsType): CompositionValidatorsResultType {
  const {
    context, formatRegistry, graph, lookupSchema, sem
  } = opts;
  let allOfValidators: undefined | ValidateWithErrorsFnType[];

  if (sem.allOf.length > 0) {
    allOfValidators = [];
    for (const node of sem.allOf) {
      allOfValidators.push(context.compileNodeOrBooleanValidateWithErrors(node, formatRegistry, graph, lookupSchema));
    }
  }

  let anyOfChecks: CheckFnType[] | undefined;

  if (sem.anyOf.length > 0) {
    anyOfChecks = [];
    for (const node of sem.anyOf) {
      anyOfChecks.push(context.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema));
    }
  }

  let oneOfChecks: CheckFnType[] | undefined;

  if (sem.oneOf.length > 0) {
    oneOfChecks = [];
    for (const node of sem.oneOf) {
      oneOfChecks.push(context.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema));
    }
  }

  return {
    allOfValidators,
    anyOfChecks,
    oneOfChecks
  };
}

/** Compile `if` / `then` / `else` checks and validators from the semantics node. */
function buildPlanConditionalValidators(opts: PlanCompileWithSemanticsType): ConditionalValidatorsResultType {
  const {
    context, formatRegistry, graph, lookupSchema, sem
  } = opts;
  const ifCheck = sem.ifNode === undefined
    ? undefined
    : context.compileNodeOrBooleanCheck(sem.ifNode, formatRegistry, graph, lookupSchema);
  const thenValidator = sem.ifNode !== undefined && sem.thenNode !== undefined
    ? context.compileNodeOrBooleanValidateWithErrors(sem.thenNode, formatRegistry, graph, lookupSchema)
    : undefined;
  const elseValidator = sem.ifNode !== undefined && sem.elseNode !== undefined
    ? context.compileNodeOrBooleanValidateWithErrors(sem.elseNode, formatRegistry, graph, lookupSchema)
    : undefined;

  return {
    elseValidator,
    ifCheck,
    thenValidator
  };
}

/** Compile `dependentSchemas` validators from the semantics node. */
function buildPlanDependentSchemaValidators(opts: PlanCompileWithSemanticsType): DependentSchemaValidatorsResultType {
  const {
    context, formatRegistry, graph, lookupSchema, sem
  } = opts;

  if (sem.dependentSchemaEntries.length === 0) {
    return undefined;
  }

  const depValidators: DependentSchemaValidatorEntryType[] = [];

  for (const [
    trigger,
    node
  ] of sem.dependentSchemaEntries) {
    depValidators.push({
      trigger,
      'validator': context.compileNodeOrBooleanValidateWithErrors(node, formatRegistry, graph, lookupSchema)
    });
  }

  return depValidators;
}

/** Build the property-alias map and allowed-keys sets for the plan. */
function buildPlanAllowedKeys(opts: PlanAllowedKeysOptionsType): AllowedKeysResultType {
  const {
    graph, lookupGraph, propertyEntries, sem
  } = opts;
  const propertyAliases = new Map<string, string>();

  for (const [
    canonicalKey,
    propNode
  ] of propertyEntries) {
    const propSem = graph.semantics(propNode);

    for (const alias of propSem.aliases) {
      propertyAliases.set(alias, canonicalKey);
    }
  }

  const allowedKeys = propertyEntries.size > 0 ? new Set(propertyEntries.keys()) : undefined;

  if (allowedKeys !== undefined) {
    for (const alias of propertyAliases.keys()) {
      allowedKeys.add(alias);
    }
  }

  const inheritedKeys = collectInheritedAllOfPropertyKeys(sem, graph, lookupGraph);
  const conditionalKeys = collectConditionalPropertyKeys(sem, graph, lookupGraph);

  const allowedKeysForStrip = inheritedKeys.size > 0 || conditionalKeys.size > 0
    ? new Set<string>([
      ...allowedKeys ?? [],
      ...inheritedKeys,
      ...conditionalKeys
    ])
    : allowedKeys;

  return {
    allowedKeys,
    allowedKeysForStrip,
    propertyAliases
  };
}

// ---------------------------------------------------------------------------
// buildNodePlan helpers — reduce complexity of the main plan builder
// ---------------------------------------------------------------------------

/** Collect `dependentRequired` entries with non-empty arrays from semantics. */
function buildPlanDepRequired(dependentRequired: Readonly<Record<string, unknown>>): DepRequiredEntriesType {
  const entries: DepRequiredEntriesType = [];

  for (const entry of Object.entries(dependentRequired)) {
    const key = entry[0];
    const val = entry[1];

    if (Array.isArray(val) && val.length > 0) {
      entries.push([
        key,
        val as string[]
      ]);
    }
  }

  return entries;
}

function buildPlanConstraintValidators(opts: PlanCompileWithSemanticsType): ConstraintValidatorsResult {
  const {
    context, formatRegistry, graph, lookupSchema, sem
  } = opts;
  const additionalPropertiesNode = sem.additionalPropertiesNode;
  const additionalValidator = additionalPropertiesNode !== undefined
    && additionalPropertiesNode !== true
    && additionalPropertiesNode !== false
    ? context.compileNodeOrBooleanValidateWithErrors(additionalPropertiesNode, formatRegistry, graph, lookupSchema)
    : undefined;
  const complementCheck = sem.complementNode === undefined
    ? undefined
    : context.compileNodeOrBooleanCheck(sem.complementNode, formatRegistry, graph, lookupSchema);
  const propertyNamesValidator = sem.propertyNamesNode === undefined
    ? undefined
    : context.compileNodeOrBooleanValidateWithErrors(sem.propertyNamesNode, formatRegistry, graph, lookupSchema);

  return {
    additionalValidator,
    complementCheck,
    propertyNamesValidator
  };
}

/** Compute scalar validators that have no mutual dependencies. */
function buildPlanPrelude(opts: PlanCompileWithSemanticsType): PlanPreludeType {
  const {
    context, formatRegistry, sem
  } = opts;
  const patternRegex = sem.pattern === undefined ? undefined : new RegExp(sem.pattern, 'u');
  const formatValidator = (sem.format !== undefined && context.appliesFormatAssertions(sem))
    ? formatRegistry.get(sem.format)
    : undefined;
  const {
    additionalValidator, complementCheck, propertyNamesValidator
  } = buildPlanConstraintValidators(opts);

  return {
    additionalValidator,
    complementCheck,
    'depRequiredEntries': buildPlanDepRequired(sem.dependentRequired),
    formatValidator,
    patternRegex,
    propertyNamesValidator
  };
}

// ---------------------------------------------------------------------------
// buildNodePlan — single keyword traversal → CompiledNodeValidationPlanType
// ---------------------------------------------------------------------------

/** Build the array-related validators for a node plan. */
function buildPlanArrayValidators(opts: PlanCompileWithSemanticsType): PlanArrayValidatorsType {
  const {
    context, formatRegistry, graph, lookupSchema, sem
  } = opts;
  let prefixValidators: undefined | ValidateWithErrorsFnType[];

  if (sem.prefixItems.length > 0) {
    prefixValidators = [];
    for (const node of sem.prefixItems) {
      prefixValidators.push(context.compileNodeOrBooleanValidateWithErrors(node, formatRegistry, graph, lookupSchema));
    }
  }

  const containsCheck = sem.containsNode === undefined
    ? undefined
    : context.compileNodeOrBooleanCheck(sem.containsNode, formatRegistry, graph, lookupSchema);

  const itemValidator = sem.itemsNode === undefined
    ? undefined
    : context.compileNodeOrBooleanValidateWithErrors(sem.itemsNode, formatRegistry, graph, lookupSchema);

  return {
    containsCheck,
    itemValidator,
    prefixValidators
  };
}


/**
 * Build a compiled validation plan from a single graph node.
 *
 * @param context - Plan compilation context providing validator-builder helpers.
 * @param graphNode - The graph node to compile.
 * @param formatRegistry - Registry for format validators.
 * @param graph - The schema graph containing `graphNode`.
 * @param lookupSchema - Optional cross-schema lookup by `$id`.
 * @param lookupGraph - Optional cross-graph lookup by `$id`.
 * @returns A `CompiledNodeValidationPlanType` ready for use by the execute layer.
 *
 * @remarks
 * Performs a single traversal of the node's keywords, compiling each into
 * a typed field on the plan. The plan is consumed by the validation executor
 * (`SchemaCompilerExec`) which interprets each field in sequence.
 *
 * @example
 * ```ts
 * const plan = buildNodePlan(context, graphNode, formatRegistry, graph);
 * // plan.propValidators, plan.allOfValidators, etc. are ready for execution
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link CompiledNodeValidationPlanType}
 * @group SchemaCompiler
 */
export function buildNodePlan(
  context: SchemaCompilerValidatePlanContextType,
  graphNode: SchemaGraphNodeType,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  lookupSchema?: LookupSchemaFnType,
  lookupGraph?: (schemaId: string) => SchemaGraphInterface | undefined
): CompiledNodeValidationPlanType {
  const sem = graph.semantics(graphNode);
  const propertyEntries = sem.properties;

  const planSemOpts: PlanCompileWithSemanticsType = {
    context,
    formatRegistry,
    graph,
    'lookupSchema': lookupSchema,
    sem
  };

  const {
    additionalValidator,
    complementCheck,
    depRequiredEntries,
    formatValidator,
    patternRegex,
    propertyNamesValidator
  } = buildPlanPrelude(planSemOpts);

  const patternPropValidators = buildPlanPatternPropValidators(planSemOpts);

  const {
    containsCheck,
    itemValidator,
    prefixValidators
  } = buildPlanArrayValidators(planSemOpts);

  const {
    allOfValidators,
    anyOfChecks,
    oneOfChecks
  } = buildPlanCompositionValidators(planSemOpts);

  const {
    elseValidator,
    ifCheck,
    thenValidator
  } = buildPlanConditionalValidators(planSemOpts);

  const depSchemaValidators = buildPlanDependentSchemaValidators(planSemOpts);
  const enumSet = buildEnumSet(sem.enumValues);

  const {
    allowedKeys,
    allowedKeysForStrip,
    propertyAliases
  } = buildPlanAllowedKeys({
    graph,
    lookupGraph,
    'propertyEntries': propertyEntries,
    sem
  });

  const jtExtra = sem.jtConfig?.extra;
  const jtStrictPerField = buildJtStrictPerField(propertyEntries, graph);

  return {
    'additionalIsFalse': sem.additionalPropertiesNode === false,
    additionalValidator,
    allOfValidators,
    allowedKeys,
    allowedKeysForStrip,
    anyOfChecks,
    complementCheck,
    'constVal': sem.constValue,
    containsCheck,
    'customKeywordEntries': buildCustomKeywordEntries(context.activeCustomKeywords, sem),
    'defaultValue': sem.defaultValue,
    depRequiredEntries,
    depSchemaValidators,
    elseValidator,
    enumSet,
    'enumValues': sem.enumValues,
    'exclusiveMaximum': sem.exclusiveMaximum,
    'exclusiveMinimum': sem.exclusiveMinimum,
    'format': sem.format,
    formatValidator,
    'hasConst': sem.hasConst,
    'hasDefault': sem.hasDefault,
    ifCheck,
    itemValidator,
    'jtExtra': jtExtra,
    'jtStrictPerField': jtStrictPerField,
    'maxContains': sem.maxContains,
    'maximum': sem.maximum,
    'maxItems': sem.maxItems,
    'maxLength': sem.maxLength,
    'maxProperties': sem.maxProperties,
    'minContains': sem.minContains,
    'minimum': sem.minimum,
    'minItems': sem.minItems,
    'minLength': sem.minLength,
    'minProperties': sem.minProperties,
    'multipleOf': sem.multipleOf,
    oneOfChecks,
    'pattern': sem.pattern,
    patternPropValidators,
    patternRegex,
    prefixValidators,
    propertyAliases,
    'propertyDefaults': buildPropertyDefaults({
      context,
      graph,
      'lookupSchema': lookupSchema,
      'propertyEntries': propertyEntries
    }),
    propertyNamesValidator,
    'propValidators': compilePropertyValidators({
      'configStrict': sem.jtConfig?.strict,
      context,
      formatRegistry,
      graph,
      'lookupSchema': lookupSchema,
      'propertyEntries': propertyEntries
    }),
    'refValidator': compileRefValidator({
      context,
      formatRegistry,
      graph,
      lookupGraph,
      'lookupSchema': lookupSchema,
      'ref': sem.ref
    }),
    'required': sem.required.length > 0 ? sem.required : undefined,
    thenValidator,
    'types': sem.schemaTypes,
    'uniqueItems': sem.uniqueItems
  };
}
