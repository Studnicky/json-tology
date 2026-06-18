/**
 * SchemaCompilerPlan — plan-time graph helpers and node validation plan builder.
 *
 * Exports:
 *   buildNodePlan — single keyword traversal → CompiledNodeValidationPlanType
 */

import type { FormatRegistryInterface } from '../../interfaces/FormatRegistryInterface.js';
import type {
  SchemaGraphNodeType, SchemaGraphSemanticsType
} from '../../types/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { KeywordDefinitionType } from '../../types/GraphEngine.js';
import type { ValidateWithErrorsFnType } from '../../types/Validation.js';
import type { ExecContextType } from '../../types/ExecContextType.js';
import type { DynamicScopeEntryType } from '../../types/DynamicScopeEntryType.js';
import type { CustomKeywordEntryType } from '../../types/CustomKeywordEntryType.js';
import type { CompiledNodeValidationPlanType } from '../../types/CompiledNodeValidationPlanType.js';
import type { SchemaCompilerValidatePlanContextType } from '../../types/SchemaCompilerValidatePlanContextType.js';
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
  OptionalValidateWithErrorsFnType,
  PatternPropValidatorEntryType,
  PatternPropValidatorsResultType,
  PlanArrayValidatorsType,
  PropertyDefaultsMapType,
  PropValidatorsMapType,
  ValidateWithErrorsResultType
} from '../../types/Validation.js';
import type { LookupSchemaFnType } from '../../types/LookupSchemaFnType.js';
import type { PlanCompileWithSemanticsType } from '../../types/PlanCompileWithSemanticsType.js';
import type { CollectBranchOptionsType } from '../../types/CollectBranchOptionsType.js';
import type { PlanAllowedKeysOptionsType } from '../../types/PlanAllowedKeysOptionsType.js';
import type { PlanPreludeType } from '../../types/PlanPreludeType.js';
import type { PropertyDefaultsOptionsType } from '../../types/PropertyDefaultsOptionsType.js';
import type { PropertyValidatorsOptionsType } from '../../types/PropertyValidatorsOptionsType.js';
import type { RefValidatorOptionsType } from '../../types/RefValidatorOptionsType.js';
import type { RefTargetType } from '../../types/RefTargetType.js';
import type { DynamicRefValidatorOptionsType } from '../../types/DynamicRefValidatorOptionsType.js';
import type { ResolveScanRefOptionsType } from '../../types/ResolveScanRefOptionsType.js';
import type { ScanConditionalOptionsType } from '../../types/ScanConditionalOptionsType.js';
import type { WalkInheritedRefOptionsType } from '../../types/WalkInheritedRefOptionsType.js';
import type { ConstraintValidatorsResultType } from '../../types/ConstraintValidatorsResultType.js';
import type { ArrayValidationOptionsType } from '../../types/ArrayValidationOptionsType.js';
import type { ObjectValidationOptionsType } from '../../types/ObjectValidationOptionsType.js';
import { isRecord } from '../data/DataTypes.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { GraphEngineSupport } from '../graph/GraphEngineSupport.js';
import { RefResolver } from '../graph/RefResolver.js';
import { BaseError } from '../../errors/BaseError.js';
import { GraphError } from '../../errors/GraphError.js';
import { GraphErrorCode } from '../../constants/ERROR_CODES.js';
import { SchemaCompilerSupport } from './SchemaCompilerSupport.js';
import { VALIDATION_MESSAGES } from '../../constants/VALIDATION_MESSAGES.js';

// ---------------------------------------------------------------------------
// Compile-time monomorphic type predicates (avoids per-value Map.get dispatch)
// ---------------------------------------------------------------------------

// Named predicates bound at module load — one allocation each, reused across all plans.
const typePredicateString = (value: unknown): boolean => {
  return typeof value === 'string';
};
const typePredicateNumber = (value: unknown): boolean => {
  return typeof value === 'number' && Number.isFinite(value);
};
const typePredicateInteger = (value: unknown): boolean => {
  return typeof value === 'number' && Number.isInteger(value);
};
const typePredicateBoolean = (value: unknown): boolean => {
  return typeof value === 'boolean';
};
const typePredicateNull = (value: unknown): boolean => {
  return value === null;
};
const typePredicateArray = (value: unknown): boolean => {
  return Array.isArray(value);
};
const singleTypePredicates = new Map<string, (v: unknown) => boolean>([
  [
    'array',
    typePredicateArray
  ],
  [
    'boolean',
    typePredicateBoolean
  ],
  [
    'integer',
    typePredicateInteger
  ],
  [
    'null',
    typePredicateNull
  ],
  [
    'number',
    typePredicateNumber
  ],
  [
    'object',
    isRecord
  ],
  [
    'string',
    typePredicateString
  ]
]);

function buildTypePredicate(types: string[]): ((v: unknown) => boolean) | undefined {
  if (types.length === 0) {
    return undefined;
  }

  if (types.length === 1) {
    const singleType = types[0];

    if (singleType === undefined) {
      return undefined;
    }

    const pred = singleTypePredicates.get(singleType);

    // Return the specialized predicate if known; fall back to Predicates.matchesType for exotic types.
    if (pred !== undefined) {
      return pred;
    }

    return (value: unknown): boolean => {
      // exotic single type — use the same string-comparison fallback as Predicates.inferValueType
      if (value === null) {
        return singleType === 'null';
      }
      if (Array.isArray(value)) {
        return singleType === 'array';
      }

      return typeof value === singleType;
    };
  }

  // Multi-type: collect per-type predicates into a small closure.
  const preds: Array<(value: unknown) => boolean> = [];

  for (const type of types) {
    const pred = singleTypePredicates.get(type);

    if (pred === undefined) {
      const capturedType = type;

      preds.push((value: unknown): boolean => {
        if (value === null) {
          return capturedType === 'null';
        }
        if (Array.isArray(value)) {
          return capturedType === 'array';
        }

        return typeof value === capturedType;
      });
    } else {
      preds.push(pred);
    }
  }

  return (value: unknown): boolean => {
    for (const pred of preds) {
      if (pred(value)) {
        return true;
      }
    }

    return false;
  };
}

// ---------------------------------------------------------------------------
// Module-scope singletons — boolean schema fast paths (A.1)
// ---------------------------------------------------------------------------

const TRUE_VALIDATOR: ValidateWithErrorsFnType = (value: unknown): ValidateWithErrorsResultType => {
  return {
    'valid': true,
    value
  };
};

const FALSE_VALIDATOR: ValidateWithErrorsFnType = (
  value: unknown,
  path: string,
  ctx: ExecContextType
): ValidateWithErrorsResultType => {
  if (ctx.collectErrors) {
    ctx.errors.push(BaseError.validationError(path, 'falseSchema', VALIDATION_MESSAGES.falseSchema));
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
    ctx: ExecContextType
  ): ValidateWithErrorsResultType => {
    // Direct construction avoids the spread overhead on the hot validation path.
    const strictCtx: ExecContextType = {
      ...ctx,
      'coerce': false
    };

    return inner(value, path, strictCtx);
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
    throw new GraphError(`Cannot resolve $ref '${ref}' — schema not found`, {
      'code': GraphErrorCode.REF_NOT_FOUND,
      'pointer': ref
    });
  }

  const {
    'graph': targetGraph, 'node': targetNode
  } = resolved;

  if (typeof targetNode.schema === 'boolean') {
    return booleanValidateWithErrors(targetNode.schema);
  }

  const refKey = `${GraphEngineSupport.schemaId(targetGraph.rootSchema) ?? '<anonymous>'}::${ref}`;

  let cached: OptionalValidateWithErrorsFnType;

  return (
    value: unknown,
    path: string,
    ctx: ExecContextType
  ): ValidateWithErrorsResultType => {
    if (ctx.refStack.has(refKey)) {
      return {
        'valid': true,
        value
      };
    }

    ctx.refStack.add(refKey);

    try {
      cached ??= context.compileNodeValidateWithErrors(targetNode, formatRegistry, targetGraph, lookupSchema);

      return cached(value, path, ctx);
    } finally {
      ctx.refStack.delete(refKey);
    }
  };
}

/**
 * Resolve a `$dynamicRef` at runtime against `ctx.dynamicScope`, mirroring
 * `GraphEngine.resolveDynamicRef` (GraphEngine.ts:474-509) exactly.
 *
 * Resolution order:
 *  1. If ref === '#': scan dynamicScope END-TO-START for anchor === '' (implicit root anchor).
 *  2. Otherwise: resolve statically, extract fragment, get resolved node's dynamicAnchor.
 *     - If no named fragment or anchor doesn't match fragment: use static target (not dynamic).
 *     - Else: scan dynamicScope START-TO-END for first matching anchor entry.
 *     - Fallback: static resolved target.
 */
function resolveDynamicRefTarget(
  dynamicRef: string,
  graph: SchemaGraphInterface,
  dynamicScope: DynamicScopeEntryType[],
  lookupSchema?: LookupSchemaFnType,
  lookupGraph?: (schemaId: string) => SchemaGraphInterface | undefined
): RefTargetType | undefined {
  if (dynamicRef === '#') {
    for (let index = dynamicScope.length - 1; index >= 0; index--) {
      const scopeEntry = dynamicScope[index];

      if (scopeEntry === undefined) {
        continue;
      }

      if (scopeEntry.anchor === '') {
        return {
          'graph': scopeEntry.graph,
          'node': scopeEntry.node
        };
      }
    }

    return undefined;
  }

  const resolved = RefResolver.resolve(dynamicRef, graph, lookupSchema, lookupGraph);

  if (resolved === undefined) {
    return undefined;
  }

  const fragment = GraphEngineSupport.extractNamedFragment(dynamicRef);
  const resolvedSem = resolved.graph.semantics(resolved.node);
  const resolvedAnchor = resolvedSem.dynamicAnchor;

  if (fragment === undefined || resolvedAnchor !== fragment) {
    return resolved;
  }

  for (const entry of dynamicScope) {
    if (entry.anchor === fragment) {
      return {
        'graph': entry.graph,
        'node': entry.node
      };
    }
  }

  return resolved;
}

/**
 * Compile a `$dynamicRef` validator.
 *
 * Resolution is deferred to runtime (depends on `ctx.dynamicScope`); per-target
 * validators are lazily compiled and cached via `context.compileNodeValidateWithErrors`.
 *
 * The `ctx.refStack` guard (refKey = `${schemaId}::dynamic::${dynamicRef}`) prevents
 * infinite recursion, mirroring `Refs.resolveDynamicRef` (Refs.ts:22).
 *
 * Compile-time invariant: for non-`#` refs the static target MUST resolve. If
 * `RefResolver.resolve` returns `undefined`, throw `GraphError(REF_NOT_FOUND)` now
 * rather than silently producing an accept-all validator at runtime.
 * A `dynamicRef === '#'` with no matching scope entry at runtime is a spec-legal
 * no-op (no dynamic anchor in scope), so that path may remain `{valid:true}`.
 */
function compileDynamicRefValidator(opts: DynamicRefValidatorOptionsType): ValidateWithErrorsFnType {
  const {
    context, dynamicRef, formatRegistry, graph, lookupGraph, lookupSchema
  } = opts;

  // Verify static resolution at compile time for all non-# refs.
  if (dynamicRef !== '#') {
    const staticCheck = RefResolver.resolve(dynamicRef, graph, lookupSchema, lookupGraph);

    if (staticCheck === undefined) {
      throw new GraphError(
        `Cannot resolve $dynamicRef '${dynamicRef}' — schema not found`,
        {
          'code': GraphErrorCode.REF_NOT_FOUND,
          'pointer': dynamicRef
        }
      );
    }
  }

  const schemaId = GraphEngineSupport.schemaId(graph.rootSchema) ?? '<anonymous>';
  const refKey = `${schemaId}::dynamic::${dynamicRef}`;

  // Per-node validator cache: resolved node → compiled validator.
  const validatorCache = new WeakMap<SchemaGraphNodeType, ValidateWithErrorsFnType>();

  return (
    value: unknown,
    path: string,
    ctx: ExecContextType
  ): ValidateWithErrorsResultType => {
    if (ctx.refStack.has(refKey)) {
      return {
        'valid': true,
        value
      };
    }

    const target = resolveDynamicRefTarget(dynamicRef, graph, ctx.dynamicScope, lookupSchema, lookupGraph);

    if (target === undefined) {
      // Spec-legal no-op: dynamicRef === '#' with no matching root anchor in scope.
      return {
        'valid': true,
        value
      };
    }

    ctx.refStack.add(refKey);

    try {
      let cached = validatorCache.get(target.node);

      if (cached === undefined) {
        cached = context.compileNodeValidateWithErrors(target.node, formatRegistry, target.graph, lookupSchema);
        validatorCache.set(target.node, cached);
      }

      return cached(value, path, ctx);
    } finally {
      ctx.refStack.delete(refKey);
    }
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

  let anyOfValidators: undefined | ValidateWithErrorsFnType[];

  if (sem.anyOf.length > 0) {
    anyOfValidators = [];
    for (const node of sem.anyOf) {
      anyOfValidators.push(context.compileNodeOrBooleanValidateWithErrors(node, formatRegistry, graph, lookupSchema));
    }
  }

  let oneOfValidators: undefined | ValidateWithErrorsFnType[];

  if (sem.oneOf.length > 0) {
    oneOfValidators = [];
    for (const node of sem.oneOf) {
      oneOfValidators.push(context.compileNodeOrBooleanValidateWithErrors(node, formatRegistry, graph, lookupSchema));
    }
  }

  return {
    allOfValidators,
    anyOfValidators,
    oneOfValidators
  };
}

/** Compile `if` / `then` / `else` validators from the semantics node. */
function buildPlanConditionalValidators(opts: PlanCompileWithSemanticsType): ConditionalValidatorsResultType {
  const {
    context, formatRegistry, graph, lookupSchema, sem
  } = opts;
  const ifValidator = sem.ifNode === undefined
    ? undefined
    : context.compileNodeOrBooleanValidateWithErrors(sem.ifNode, formatRegistry, graph, lookupSchema);
  const thenValidator = sem.ifNode !== undefined && sem.thenNode !== undefined
    ? context.compileNodeOrBooleanValidateWithErrors(sem.thenNode, formatRegistry, graph, lookupSchema)
    : undefined;
  const elseValidator = sem.ifNode !== undefined && sem.elseNode !== undefined
    ? context.compileNodeOrBooleanValidateWithErrors(sem.elseNode, formatRegistry, graph, lookupSchema)
    : undefined;

  return {
    elseValidator,
    ifValidator,
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

function buildPlanConstraintValidators(opts: PlanCompileWithSemanticsType): ConstraintValidatorsResultType {
  const {
    context, formatRegistry, graph, lookupSchema, sem
  } = opts;
  const additionalPropertiesNode = sem.additionalPropertiesNode;
  const additionalValidator = additionalPropertiesNode !== undefined
    && additionalPropertiesNode !== true
    && additionalPropertiesNode !== false
    ? context.compileNodeOrBooleanValidateWithErrors(additionalPropertiesNode, formatRegistry, graph, lookupSchema)
    : undefined;
  const complementValidator = sem.complementNode === undefined
    ? undefined
    : context.compileNodeOrBooleanValidateWithErrors(sem.complementNode, formatRegistry, graph, lookupSchema);
  const propertyNamesValidator = sem.propertyNamesNode === undefined
    ? undefined
    : context.compileNodeOrBooleanValidateWithErrors(sem.propertyNamesNode, formatRegistry, graph, lookupSchema);

  return {
    additionalValidator,
    complementValidator,
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
    additionalValidator, complementValidator, propertyNamesValidator
  } = buildPlanConstraintValidators(opts);

  return {
    additionalValidator,
    complementValidator,
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

  const containsValidator = sem.containsNode === undefined
    ? undefined
    : context.compileNodeOrBooleanValidateWithErrors(sem.containsNode, formatRegistry, graph, lookupSchema);

  const itemValidator = sem.itemsNode === undefined
    ? undefined
    : context.compileNodeOrBooleanValidateWithErrors(sem.itemsNode, formatRegistry, graph, lookupSchema);

  return {
    containsValidator,
    itemValidator,
    prefixValidators
  };
}


/**
 * Compile a `unevaluatedProperties` or `unevaluatedItems` node to a validator or
 * the sentinel `false` (meaning: reject all unevaluated items/properties).
 *
 * Returns `undefined` when no unevaluated node is present.
 */
function compileUnevaluatedNode(
  node: SchemaGraphNodeType | undefined,
  context: SchemaCompilerValidatePlanContextType,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  lookupSchema: LookupSchemaFnType | undefined
): false | undefined | ValidateWithErrorsFnType {
  if (node === undefined) {
    return undefined;
  }

  if (typeof node.schema === 'boolean') {
    return node.schema ? undefined : false;
  }

  return context.compileNodeValidateWithErrors(node, formatRegistry, graph, lookupSchema);
}

/**
 * Compile an `rdfs:range` validator that replicates the interpreter semantics from
 * `Unevaluated.rdfsRange` (Unevaluated.ts:125-169).
 *
 * At compile time the range schema IRI is resolved via `lookupSchema`. If found,
 * a compiled validator is built for it. If not found at compile time, the validator
 * returns valid immediately (matching interpreter behaviour where an unregistered
 * range IRI is a no-op).
 *
 * The runtime validator:
 * 1. Guards against recursive range validation via `ctx.refStack`.
 * 2. Validates record values and array-element records against the range schema.
 *
 * `rdfs:domain` has no runtime validation semantics in the interpreter — it is
 * ontology/TBox projection metadata only. No validator is compiled for it.
 */
function compileRdfsRangeValidator(
  rdfsRange: string | undefined,
  context: SchemaCompilerValidatePlanContextType,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  lookupSchema: LookupSchemaFnType | undefined,
  lookupGraph: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined
): undefined | ValidateWithErrorsFnType {
  if (rdfsRange === undefined) {
    return undefined;
  }

  // Resolve at compile time. If the range schema is not registered, the
  // validator is a no-op (matching the interpreter which also does nothing
  // when lookupSchema returns undefined).
  const rangeSchemaRecord = lookupSchema?.(rdfsRange);

  if (rangeSchemaRecord === undefined) {
    return undefined;
  }

  // Resolve the graph for the range schema, falling back to the current graph.
  const rangeGraph = lookupGraph?.(rdfsRange) ?? graph;
  const rangeNode = rangeGraph.node(rangeSchemaRecord) ?? rangeGraph.rootNode;
  const rangeValidator = context.compileNodeValidateWithErrors(
    rangeNode,
    formatRegistry,
    rangeGraph,
    lookupSchema
  );
  const rangeRefKey = `rdfs:range::${rdfsRange}`;

  return (
    value: unknown,
    path: string,
    ctx: ExecContextType
  ): ValidateWithErrorsResultType => {
    if (ctx.refStack.has(rangeRefKey)) {
      return {
        'valid': true,
        value
      };
    }

    ctx.refStack.add(rangeRefKey);

    try {
      if (isRecord(value)) {
        return rangeValidator(value, path, ctx);
      }

      if (Array.isArray(value)) {
        // `Array.isArray` narrows `unknown` to `any[]`; restore the honest element
        // type (instance data is arbitrary, not a schema).
        const items: unknown[] = value;
        let valid = true;

        for (const [
          i,
          item
        ] of items.entries()) {
          if (isRecord(item) || Array.isArray(item)) {
            const itemRes = rangeValidator(item, `${path}/${i}`, ctx);

            if (!itemRes.valid) {
              if (!ctx.collectErrors) {
                return {
                  'valid': false,
                  value
                };
              }
              valid = false;
            }
          }
        }

        return {
          valid,
          value
        };
      }

      return {
        'valid': true,
        value
      };
    } finally {
      ctx.refStack.delete(rangeRefKey);
    }
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
    complementValidator,
    depRequiredEntries,
    formatValidator,
    patternRegex,
    propertyNamesValidator
  } = buildPlanPrelude(planSemOpts);

  const patternPropValidators = buildPlanPatternPropValidators(planSemOpts);

  const {
    containsValidator,
    itemValidator,
    prefixValidators
  } = buildPlanArrayValidators(planSemOpts);

  const {
    allOfValidators,
    anyOfValidators,
    oneOfValidators
  } = buildPlanCompositionValidators(planSemOpts);

  const {
    elseValidator,
    ifValidator,
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

  const propertyZeroValueSynthesizers = new Map<string, () => unknown>();
  const semRequired = sem.required;

  if (semRequired.length > 0) {
    for (const key of semRequired) {
      const propNode = sem.properties.get(key);

      if (propNode === undefined) {
        propertyZeroValueSynthesizers.set(key, (): unknown => {
          return null;
        });
      } else {
        const capturedNode = propNode;
        const capturedGraph = graph;
        const capturedLookup = lookupSchema;
        const capturedLookupGraph = lookupGraph;

        propertyZeroValueSynthesizers.set(key, (): unknown => {
          return context.synthesizeZeroValue(capturedNode, capturedGraph, capturedLookup, capturedLookupGraph);
        });
      }
    }
  }

  const additionalIsFalse = sem.additionalPropertiesNode === false;
  const propValidators = compilePropertyValidators({
    'configStrict': sem.jtConfig?.strict,
    context,
    formatRegistry,
    graph,
    'lookupSchema': lookupSchema,
    'propertyEntries': propertyEntries
  });
  const propertyDefaults = buildPropertyDefaults({
    context,
    graph,
    'lookupSchema': lookupSchema,
    'propertyEntries': propertyEntries
  });
  const requiredArr = sem.required.length > 0 ? sem.required : undefined;

  // Precompute option bags once at compile time — avoids per-value object allocation.
  const arrOpts: ArrayValidationOptionsType = {
    containsValidator,
    itemValidator,
    'maxContains': sem.maxContains,
    'maxItems': sem.maxItems,
    'minContains': sem.minContains,
    'minItems': sem.minItems,
    prefixValidators,
    'uniqueItems': sem.uniqueItems
  };

  const objOpts: ObjectValidationOptionsType = {
    additionalIsFalse,
    additionalValidator,
    allowedKeys,
    allowedKeysForStrip,
    jtExtra,
    'maxProperties': sem.maxProperties,
    'minProperties': sem.minProperties,
    patternPropValidators,
    propertyAliases,
    propertyDefaults,
    propertyZeroValueSynthesizers,
    propValidators,
    'required': requiredArr
  };

  return {
    additionalIsFalse,
    additionalValidator,
    allOfValidators,
    allowedKeys,
    allowedKeysForStrip,
    anyOfValidators,
    arrOpts,
    complementValidator,
    'constVal': sem.constValue,
    containsValidator,
    'contentAssertionsEnabled': context.appliesFormatAssertions(sem),
    'contentEncoding': sem.contentEncoding,
    'contentMediaType': sem.contentMediaType,
    'customKeywordEntries': buildCustomKeywordEntries(context.activeCustomKeywords, sem),
    'defaultValue': sem.defaultValue,
    depRequiredEntries,
    depSchemaValidators,
    'dynamicRefValidator': typeof sem.dynamicRef === 'string'
      ? compileDynamicRefValidator({
        context,
        'dynamicRef': sem.dynamicRef,
        formatRegistry,
        graph,
        lookupGraph,
        'lookupSchema': lookupSchema
      })
      : undefined,
    'dynamicScopeEntry': typeof sem.dynamicAnchor === 'string'
      ? {
        'anchor': sem.dynamicAnchor,
        graph,
        'node': graphNode
      }
      : undefined,
    elseValidator,
    enumSet,
    'enumValues': sem.enumValues,
    'exclusiveMaximum': sem.exclusiveMaximum,
    'exclusiveMinimum': sem.exclusiveMinimum,
    'format': sem.format,
    formatValidator,
    'hasConst': sem.hasConst,
    'hasDefault': sem.hasDefault,
    ifValidator,
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
    objOpts,
    oneOfValidators,
    'pattern': sem.pattern,
    patternPropValidators,
    patternRegex,
    prefixValidators,
    propertyAliases,
    propertyDefaults,
    propertyNamesValidator,
    propertyZeroValueSynthesizers,
    propValidators,
    'rdfsRangeValidator': compileRdfsRangeValidator(
      sem.rdfsRange,
      context,
      formatRegistry,
      graph,
      lookupSchema,
      lookupGraph
    ),
    'refValidator': compileRefValidator({
      context,
      formatRegistry,
      graph,
      lookupGraph,
      'lookupSchema': lookupSchema,
      'ref': sem.ref
    }),
    'required': requiredArr,
    thenValidator,
    'typePredicate': buildTypePredicate(sem.schemaTypes),
    'types': sem.schemaTypes,
    'unevaluatedItemsValidator': compileUnevaluatedNode(
      sem.unevaluatedItemsNode,
      context,
      formatRegistry,
      graph,
      lookupSchema
    ),
    'unevaluatedPropertiesValidator': compileUnevaluatedNode(
      sem.unevaluatedPropertiesNode,
      context,
      formatRegistry,
      graph,
      lookupSchema
    ),
    'uniqueItems': sem.uniqueItems
  };
}
