/**
 * SchemaCompilerPlan — plan-time graph helpers and node validation plan builder.
 *
 * Exports:
 *   SchemaCompilerPlan.buildNodePlan — single keyword traversal → CompiledNodeValidationPlanInterface
 */

import type { SchemaGraphSemanticsInterface } from '../../interfaces/SchemaGraphSemanticsInterface.js';
import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraphNodeInterface.js';
import type { FormatRegistryInterface } from '../../interfaces/FormatRegistryInterface.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { KeywordDefinitionInterface } from '../../interfaces/KeywordDefinitionInterface.js';
import type { ValidateWithErrorsFunctionInterface } from '../../interfaces/ValidateWithErrorsFunctionInterface.js';
import type { ExecContextInterface } from '../../interfaces/ExecContextInterface.js';
import type { DynamicScopeEntryInterface } from '../../interfaces/DynamicScopeEntryInterface.js';
import type { CustomKeywordEntryInterface } from '../../interfaces/CustomKeywordEntryInterface.js';
import type { CompiledNodeValidationPlanInterface } from '../../interfaces/CompiledNodeValidationPlanInterface.js';
import type { SchemaCompilerValidatePlanContextInterface } from '../../interfaces/SchemaCompilerValidatePlanContextInterface.js';
import type { ConditionalPropertyKeySetInterface } from '../../interfaces/ConditionalPropertyKeySetInterface.js';
import type { InheritedPropertyKeySetInterface } from '../../interfaces/InheritedPropertyKeySetInterface.js';
import type { JtStrictPerFieldMapInterface } from '../../interfaces/JtStrictPerFieldMapInterface.js';
import type { EnumPrimitiveSetInterface } from '../../interfaces/EnumPrimitiveSetInterface.js';
import type { PropertyDefaultsMapInterface } from '../../interfaces/PropertyDefaultsMapInterface.js';
import type { PropValidatorsMapInterface } from '../../interfaces/PropValidatorsMapInterface.js';
import type { ValidateWithErrorsResultEntity } from '../../entities/ValidateWithErrorsResultEntity.js';
import type { AllowedKeysResultInterface } from '../../interfaces/AllowedKeysResultInterface.js';
import type { CompositionValidatorsResultInterface } from '../../interfaces/CompositionValidatorsResultInterface.js';
import type { ConditionalValidatorsResultInterface } from '../../interfaces/ConditionalValidatorsResultInterface.js';
import type { DependentSchemaValidatorEntryInterface } from '../../interfaces/DependentSchemaValidatorEntryInterface.js';
import type { PatternPropValidatorEntryInterface } from '../../interfaces/PatternPropValidatorEntryInterface.js';
import type { PlanArrayValidatorsInterface } from '../../interfaces/PlanArrayValidatorsInterface.js';
import type { LookupSchemaFunctionInterface } from '../../interfaces/LookupSchemaFunctionInterface.js';
import type { PlanCompileWithSemanticsInterface } from '../../interfaces/PlanCompileWithSemanticsInterface.js';
import type { CollectBranchOptionsInterface } from '../../interfaces/CollectBranchOptionsInterface.js';
import type { PlanAllowedKeysOptionsInterface } from '../../interfaces/PlanAllowedKeysOptionsInterface.js';
import type { PlanPreludeInterface } from '../../interfaces/PlanPreludeInterface.js';
import type { PropertyDefaultsOptionsInterface } from '../../interfaces/PropertyDefaultsOptionsInterface.js';
import type { PropertyValidatorsOptionsInterface } from '../../interfaces/PropertyValidatorsOptionsInterface.js';
import type { ReferenceValidatorOptionsInterface } from '../../interfaces/ReferenceValidatorOptionsInterface.js';
import type { ReferenceTargetInterface } from '../../interfaces/ReferenceTargetInterface.js';
import type { DynamicReferenceValidatorOptionsInterface } from '../../interfaces/DynamicReferenceValidatorOptionsInterface.js';
import type { ResolveScanReferenceOptionsInterface } from '../../interfaces/ResolveScanReferenceOptionsInterface.js';
import type { ScanConditionalOptionsInterface } from '../../interfaces/ScanConditionalOptionsInterface.js';
import type { WalkInheritedReferenceOptionsInterface } from '../../interfaces/WalkInheritedReferenceOptionsInterface.js';
import type { ConstraintValidatorsResultInterface } from '../../interfaces/ConstraintValidatorsResultInterface.js';
import type { ArrayValidationOptionsInterface } from '../../interfaces/ArrayValidationOptionsInterface.js';
import type { ObjectValidationOptionsInterface } from '../../interfaces/ObjectValidationOptionsInterface.js';
import type { ResolveDynamicReferenceTargetOptionsInterface } from '../../interfaces/ResolveDynamicReferenceTargetOptionsInterface.js';
import type { BuildNodePlanOptionsInterface } from '../../interfaces/BuildNodePlanOptionsInterface.js';
import { DataType } from '../data/DataType.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { GraphEngineSupport } from '../graph/GraphEngineSupport.js';
import { ReferenceResolver } from '../graph/ReferenceResolver.js';
import { BaseError } from '../../errors/BaseError.js';
import { GraphError } from '../../errors/GraphError.js';
import { GRAPH_ERROR_CODE } from '../../constants/ERROR_CODES.js';
import { SchemaCompilerSupport } from './SchemaCompilerSupport.js';
import { VALIDATION_MESSAGES } from '../../constants/VALIDATION_MESSAGES.js';

// ---------------------------------------------------------------------------
// Compile-time monomorphic type predicates (avoids per-value Map.get dispatch)
// ---------------------------------------------------------------------------

/** Compile-time construction of the monomorphic type-predicate closure for a schema's `type` keyword. */
class TypePredicate {
  // Lazily built and memoized on first use — methods it references are installed
  // as part of class definition, but a static-field initializer (evaluated in
  // source order) cannot forward-reference a method declared later in the class
  // body, so construction is deferred to first call instead of an eager field.
  private static singleTypePredicatesCache: Map<string, (v: unknown) => boolean> | undefined;

  static build(types: string[]): ((v: unknown) => boolean) | undefined {
    if (types.length === 0) {
      return undefined;
    }

    if (types.length === 1) {
      const singleType = types[0];

      if (singleType === undefined) {
        return undefined;
      }

      const pred = TypePredicate.getSingleTypePredicates().get(singleType);

      // Return the specialized predicate if known; fall back to the string-comparison fallback for exotic types.
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
      const pred = TypePredicate.getSingleTypePredicates().get(type);

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

  private static getSingleTypePredicates(): Map<string, (v: unknown) => boolean> {
    TypePredicate.singleTypePredicatesCache ??= new Map<string, (v: unknown) => boolean>([
      [
        'array',
        TypePredicate.typePredicateArray
      ],
      [
        'boolean',
        TypePredicate.typePredicateBoolean
      ],
      [
        'integer',
        TypePredicate.typePredicateInteger
      ],
      [
        'null',
        TypePredicate.typePredicateNull
      ],
      [
        'number',
        TypePredicate.typePredicateNumber
      ],
      [
        'object',
        DataType.isRecord
      ],
      [
        'string',
        TypePredicate.typePredicateString
      ]
    ]);

    return TypePredicate.singleTypePredicatesCache;
  }

  // Named predicates bound at module load — one allocation each, reused across all plans.
  private static typePredicateArray(value: unknown): boolean {
    const result = Array.isArray(value);

    return result;
  }

  private static typePredicateBoolean(value: unknown): boolean {
    return typeof value === 'boolean';
  }

  private static typePredicateInteger(value: unknown): boolean {
    return typeof value === 'number' && Number.isInteger(value);
  }

  private static typePredicateNull(value: unknown): boolean {
    return value === null;
  }

  private static typePredicateNumber(value: unknown): boolean {
    return typeof value === 'number' && Number.isFinite(value);
  }

  private static typePredicateString(value: unknown): boolean {
    return typeof value === 'string';
  }
}

/** Boolean-schema fast paths (A.1) — reused across all plans. */
class BooleanSchemaValidator {
  static booleanValidateWithErrors(schema: boolean): ValidateWithErrorsFunctionInterface {
    return schema ? BooleanSchemaValidator.trueValidator : BooleanSchemaValidator.falseValidator;
  }

  static falseValidator(
    value: unknown,
    path: string,
    context: ExecContextInterface
  ): ValidateWithErrorsResultEntity.Type {
    if (context.collectErrors) {
      context.errors.push(BaseError.validationError(path, 'falseSchema', VALIDATION_MESSAGES.falseSchema));
    }

    return {
      'valid': false,
      value
    };
  }

  static trueValidator(value: unknown): ValidateWithErrorsResultEntity.Type {
    return {
      'valid': true,
      value
    };
  }
}

/** Rejects every unevaluated item/property — used when `unevaluatedItems`/`unevaluatedProperties` is the boolean schema `false`. */
class UnevaluatedRejectValidator {
  static forKeyword(keyword: 'unevaluatedItems' | 'unevaluatedProperties'): ValidateWithErrorsFunctionInterface {
    return (value: unknown, path: string, context: ExecContextInterface): ValidateWithErrorsResultEntity.Type => {
      if (context.collectErrors) {
        context.errors.push(BaseError.validationError(path, keyword, VALIDATION_MESSAGES[keyword]));
      }

      return {
        'valid': false,
        value
      };
    };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers (graph context)
// ---------------------------------------------------------------------------

/** Traversal helpers for `allOf`-inherited property-key collection. */
class InheritedProperties {
  /**
   * Walk `allOf` parents (recursively, resolving `$ref` into the parent's
   * graph) and collect every property name the schema effectively
   * declares. Without this, `allowedKeys` only contains the body's own
   * properties and `removeAdditionalProperties: true` strips parent
   * fields supplied at the wire level — values that the rest of the
   * validator already accepts through the allOf member chain.
   */
  static collectAllOfPropertyKeys(
    sem: SchemaGraphSemanticsInterface,
    graph: SchemaGraphInterface,
    lookupGraph?: (schemaId: string) => SchemaGraphInterface | undefined
  ): InheritedPropertyKeySetInterface {
    const inherited = new Set<string>();
    const visited = new Set<SchemaGraphNodeInterface>();

    const walk = (currentGraph: SchemaGraphInterface, node: SchemaGraphNodeInterface): void => {
      if (visited.has(node)) {
        return;
      }
      visited.add(node);

      const nodeSem = currentGraph.semantics(node);

      if (nodeSem.ref !== undefined) {
        InheritedProperties.walkReference({
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

  /**
   * Resolve a `$ref` string to its target graph and node within the `walk` traversal,
   * then continue collecting property names.
   */
  static walkReference(options: WalkInheritedReferenceOptionsInterface): void {
    const {
      currentGraph, lookupGraph, 'ref': reference, 'walkFn': walkFunction
    } = options;

    if (reference.startsWith('#')) {
      walkFunction(currentGraph, currentGraph.resolveFragment(reference.slice(1)));

      return;
    }

    if (lookupGraph === undefined) {
      return;
    }

    // Literal full-ref lookup first: a `#`-bearing absolute IRI may itself be a
    // registered hash-namespace `$id` (e.g. `https://ns#Class`); only fall to
    // fragment-stripped resolution when no such registration matches exactly.
    const literalGraph = reference.includes('#') ? lookupGraph(reference) : undefined;

    if (literalGraph !== undefined) {
      walkFunction(literalGraph, literalGraph.resolveFragment(''));

      return;
    }

    const {
      fragment, id
    } = SchemaIri.parseReference(reference);
    const targetGraph = lookupGraph(id);

    if (targetGraph !== undefined) {
      walkFunction(targetGraph, targetGraph.resolveFragment(fragment));
    }
  }
}

/** Resolution of a `$ref` to its target graph and fragment node during branch collection. */
class BranchReference {
  /** Resolve a `$ref` to the target graph and fragment node during branch collection. */
  static resolve(
    reference: string,
    currentGraph: SchemaGraphInterface,
    lookupGraph: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined
  ): ReferenceTargetInterface | undefined {
    if (reference.startsWith('#')) {
      return {
        'graph': currentGraph,
        'node': currentGraph.resolveFragment(reference.slice(1))
      };
    }

    if (lookupGraph === undefined) {
      return undefined;
    }

    // Literal full-ref lookup first: a `#`-bearing absolute IRI may itself be a
    // registered hash-namespace `$id` (e.g. `https://ns#Class`); only fall to
    // fragment-stripped resolution when no such registration matches exactly.
    const literalGraph = reference.includes('#') ? lookupGraph(reference) : undefined;

    if (literalGraph !== undefined) {
      return {
        'graph': literalGraph,
        'node': literalGraph.resolveFragment('')
      };
    }

    const {
      fragment, id
    } = SchemaIri.parseReference(reference);
    const targetGraph = lookupGraph(id);

    return targetGraph === undefined
      ? undefined
      : {
        'graph': targetGraph,
        'node': targetGraph.resolveFragment(fragment)
      };
  }
}

/** Conditional (`if`/`then`/`else`) branch traversal for strip-protection key collection. */
class ConditionalProperties {
  /**
   * Collect every property name reachable from a conditional branch node
   * (its own properties plus those behind `allOf`, `$ref`, and nested `then`/`else`).
   */
  static collectBranchPropertyNames(options: CollectBranchOptionsInterface): void {
    const {
      branchNode, scanState, startGraph
    } = options;
    const {
      collectVisited, lookupGraph, target
    } = scanState;

    const collectFunction = (currentGraph: SchemaGraphInterface, node: SchemaGraphNodeInterface): void => {
      if (collectVisited.has(node)) {
        return;
      }
      collectVisited.add(node);

      const nodeSem = currentGraph.semantics(node);

      if (nodeSem.ref !== undefined) {
        const resolved = BranchReference.resolve(nodeSem.ref, currentGraph, lookupGraph);

        if (resolved !== undefined) {
          collectFunction(resolved.graph, resolved.node);
        }

        return;
      }

      for (const name of nodeSem.properties.keys()) {
        target.add(name);
      }
      for (const member of nodeSem.allOf) {
        collectFunction(currentGraph, member);
      }
      if (nodeSem.thenNode !== undefined) {
        collectFunction(currentGraph, nodeSem.thenNode);
      }
      if (nodeSem.elseNode !== undefined) {
        collectFunction(currentGraph, nodeSem.elseNode);
      }
    };

    collectFunction(startGraph, branchNode);
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
  static collectConditionalPropertyKeys(
    sem: SchemaGraphSemanticsInterface,
    graph: SchemaGraphInterface,
    lookupGraph?: (schemaId: string) => SchemaGraphInterface | undefined
  ): ConditionalPropertyKeySetInterface {
    const conditional = new Set<string>();
    const collectVisited = new Set<SchemaGraphNodeInterface>();
    const scanVisited = new Set<SchemaGraphNodeInterface>();

    ConditionalProperties.scanForConditionalBranches({
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

  /**
   * Resolve a `$ref` encountered during conditional-branch scanning.
   */
  static resolveReference(options: ResolveScanReferenceOptionsInterface): void {
    const {
      currentGraph, 'ref': reference, scanState
    } = options;
    const { lookupGraph } = scanState;

    if (reference.startsWith('#')) {
      const referenceSemantics = currentGraph.semantics(currentGraph.resolveFragment(reference.slice(1)));

      ConditionalProperties.scanForConditionalBranches({
        currentGraph,
        'scanSem': referenceSemantics,
        scanState
      });

      return;
    }

    if (lookupGraph === undefined) {
      return;
    }

    // Literal full-ref lookup first: a `#`-bearing absolute IRI may itself be a
    // registered hash-namespace `$id` (e.g. `https://ns#Class`); only fall to
    // fragment-stripped resolution when no such registration matches exactly.
    const literalGraph = reference.includes('#') ? lookupGraph(reference) : undefined;

    if (literalGraph !== undefined) {
      const literalSem = literalGraph.semantics(literalGraph.resolveFragment(''));

      ConditionalProperties.scanForConditionalBranches({
        'currentGraph': literalGraph,
        'scanSem': literalSem,
        scanState
      });

      return;
    }

    const {
      fragment, id
    } = SchemaIri.parseReference(reference);
    const targetGraph = lookupGraph(id);

    if (targetGraph !== undefined) {
      const referenceSemantics = targetGraph.semantics(targetGraph.resolveFragment(fragment));

      ConditionalProperties.scanForConditionalBranches({
        'currentGraph': targetGraph,
        'scanSem': referenceSemantics,
        scanState
      });
    }
  }

  /**
   * Scan a semantics node and its `allOf` members for `if`/`then`/`else` branches,
   * collecting all reachable property names into `target`.
   */
  static scanForConditionalBranches(options: ScanConditionalOptionsInterface): void {
    const {
      currentGraph, scanSem, scanState
    } = options;
    const { scanVisited } = scanState;

    if (scanSem.thenNode !== undefined) {
      ConditionalProperties.collectBranchPropertyNames({
        'branchNode': scanSem.thenNode,
        scanState,
        'startGraph': currentGraph
      });
    }
    if (scanSem.elseNode !== undefined) {
      ConditionalProperties.collectBranchPropertyNames({
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
        ConditionalProperties.resolveReference({
          currentGraph,
          'ref': memberSem.ref,
          scanState
        });
        continue;
      }

      ConditionalProperties.scanForConditionalBranches({
        currentGraph,
        'scanSem': memberSem,
        scanState
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Plan-time helpers (validate context)
// ---------------------------------------------------------------------------

/** Wrapping of an inner validator to force `coerce: false` for strict-per-field properties. */
class StrictValidator {
  static wrap(inner: ValidateWithErrorsFunctionInterface): ValidateWithErrorsFunctionInterface {
    return (
      value: unknown,
      path: string,
      context: ExecContextInterface
    ): ValidateWithErrorsResultEntity.Type => {
      // Direct construction avoids the spread overhead on the hot validation path.
      const strictContext: ExecContextInterface = {
        ...context,
        'coerce': false
      };

      return inner(value, path, strictContext);
    };
  }
}

/**
 * Resolution of a `$dynamicRef` target at runtime against `ctx.dynamicScope`, mirroring
 * `GraphEngine.resolveDynamicRef` (GraphEngine.ts:474-509) exactly.
 *
 * Resolution order:
 *  1. If ref === '#': scan dynamicScope END-TO-START for anchor === '' (implicit root anchor).
 *  2. Otherwise: resolve statically, extract fragment, get resolved node's dynamicAnchor.
 *     - If no named fragment or anchor doesn't match fragment: use static target (not dynamic).
 *     - Else: scan dynamicScope START-TO-END for first matching anchor entry.
 *     - Fallback: static resolved target.
 */
class DynamicReferenceTarget {
  static resolve(
    dynamicReference: string,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryInterface[],
    options?: ResolveDynamicReferenceTargetOptionsInterface
  ): ReferenceTargetInterface | undefined {
    const {
      lookupGraph, lookupSchema
    } = options ?? {};

    if (dynamicReference === '#') {
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

    const resolved = ReferenceResolver.resolve(dynamicReference, graph, {
      ...(lookupSchema !== undefined && { lookupSchema }),
      ...(lookupGraph !== undefined && { lookupGraph })
    });

    if (resolved === undefined) {
      return undefined;
    }

    const fragment = GraphEngineSupport.extractNamedFragment(dynamicReference);
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
}

/** Construction of the property-default map for a node's `properties` entries. */
class PropertyDefaults {
  static build(options: PropertyDefaultsOptionsInterface): PropertyDefaultsMapInterface {
    const {
      context, graph, lookupSchema, propertyEntries
    } = options;
    const propertyDefaults = new Map<string, { 'defaultValue': unknown;
      'hasDefault': boolean; }>();

    for (const [
      key,
      propNode
    ] of propertyEntries) {
      if (!DataType.isRecord(propNode.schema)) {
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
}

/** Construction of the compiled custom-keyword entry list for a node's active keywords. */
class CustomKeywordEntries {
  static build(
    activeCustomKeywords: KeywordDefinitionInterface[],
    sem: SchemaGraphSemanticsInterface
  ): CustomKeywordEntryInterface[] | undefined {
    if (activeCustomKeywords.length === 0) {
      return undefined;
    }

    const entries: CustomKeywordEntryInterface[] = [];

    for (const kw of activeCustomKeywords) {
      if (kw.keyword in sem.extensions) {
        const schemaValue = sem.extensions[kw.keyword];

        entries.push({
          'allowedTypes': SchemaCompilerSupport.normalizeKeywordTypes(kw.type),
          'keyword': kw.keyword,
          'schemaValue': schemaValue,
          'validate': kw.validate
        });
      }
    }

    return entries.length > 0 ? entries : undefined;
  }
}

/** Construction of the per-field `jtStrict` map for a node's `properties` entries. */
class JtStrictPerField {
  static build(
    propertyEntries: ReadonlyMap<string, SchemaGraphNodeInterface>,
    graph: SchemaGraphInterface
  ): JtStrictPerFieldMapInterface | undefined {
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
}

// ---------------------------------------------------------------------------
// buildNodePlan helpers — decompose the 200-line function
// ---------------------------------------------------------------------------

/** Construction of the enum fast-path `Set` when all values are primitives. */
class EnumSet {
  /** Build the enum fast-path `Set` when all values are primitives. */
  static build(enumValues: undefined | unknown[]): EnumPrimitiveSetInterface | undefined {
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
}

/**
 * `buildNodePlan` decomposition — one static method per plan fragment. Grouped
 * into a single class because every method is an internal helper used only
 * within {@link SchemaCompilerPlan.buildNodePlan} and several call each other
 * directly (`prelude` calls `constraintValidators` and `depRequired`).
 */
class PlanBuilders {
  /** Build the property-alias map and allowed-keys sets for the plan. */
  static allowedKeys(options: PlanAllowedKeysOptionsInterface): AllowedKeysResultInterface {
    const {
      graph, lookupGraph, propertyEntries, sem
    } = options;
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

    const inheritedKeys = InheritedProperties.collectAllOfPropertyKeys(sem, graph, lookupGraph);
    const conditionalKeys = ConditionalProperties.collectConditionalPropertyKeys(sem, graph, lookupGraph);

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

  /** Build the array-related validators for a node plan. */
  static arrayValidators(options: PlanCompileWithSemanticsInterface): PlanArrayValidatorsInterface {
    const {
      context, formatRegistry, graph, lookupSchema, sem
    } = options;
    let prefixValidators: undefined | ValidateWithErrorsFunctionInterface[];

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
   * Compile a `$dynamicRef` validator.
   *
   * Resolution is deferred to runtime (depends on `ctx.dynamicScope`); per-target
   * validators are lazily compiled and cached via `context.compileNodeValidateWithErrors`.
   *
   * The `ctx.refStack` guard (refKey = `${schemaId}::dynamic::${dynamicRef}`) prevents
   * infinite recursion, mirroring `Refs.resolveDynamicRef` (Refs.ts:22).
   *
   * Compile-time invariant: for non-`#` refs the static target MUST resolve. If
   * `ReferenceResolver.resolve` returns `undefined`, throw `GraphError(REF_NOT_FOUND)` now
   * rather than silently producing an accept-all validator at runtime.
   * A `dynamicRef === '#'` with no matching scope entry at runtime is a spec-legal
   * no-op (no dynamic anchor in scope), so that path may remain `{valid:true}`.
   */
  static compileDynamicReferenceValidator(options: DynamicReferenceValidatorOptionsInterface): ValidateWithErrorsFunctionInterface {
    const {
      context, 'dynamicRef': dynamicReference, formatRegistry, graph, lookupGraph, lookupSchema
    } = options;

    // Verify static resolution at compile time for all non-# refs.
    if (dynamicReference !== '#') {
      const staticCheck = ReferenceResolver.resolve(dynamicReference, graph, {
        ...(lookupSchema !== undefined && { lookupSchema }),
        ...(lookupGraph !== undefined && { lookupGraph })
      });

      if (staticCheck === undefined) {
        throw new GraphError(
          `Cannot resolve $dynamicRef '${dynamicReference}' — schema not found`,
          {
            'code': GRAPH_ERROR_CODE.REF_NOT_FOUND,
            'pointer': dynamicReference
          }
        );
      }
    }

    const schemaId = GraphEngineSupport.schemaId(graph.rootSchema) ?? '<anonymous>';
    const referenceKey = `${schemaId}::dynamic::${dynamicReference}`;

    // Per-node validator cache: resolved node → compiled validator.
    const validatorCache = new WeakMap<SchemaGraphNodeInterface, ValidateWithErrorsFunctionInterface>();

    return (
      value: unknown,
      path: string,
      execContext: ExecContextInterface
    ): ValidateWithErrorsResultEntity.Type => {
      if (execContext.refStack.has(referenceKey)) {
        return {
          'valid': true,
          value
        };
      }

      const target = DynamicReferenceTarget.resolve(dynamicReference, graph, execContext.dynamicScope, {
        ...(lookupGraph !== undefined && { lookupGraph }),
        ...(lookupSchema !== undefined && { lookupSchema })
      });

      if (target === undefined) {
        // Spec-legal no-op: dynamicRef === '#' with no matching root anchor in scope.
        return {
          'valid': true,
          value
        };
      }

      execContext.refStack.add(referenceKey);

      try {
        let cached = validatorCache.get(target.node);

        if (cached === undefined) {
          cached = context.compileNodeValidateWithErrors(target.node, formatRegistry, target.graph, lookupSchema);
          validatorCache.set(target.node, cached);
        }

        return cached(value, path, execContext);
      } finally {
        execContext.refStack.delete(referenceKey);
      }
    };
  }

  static compilePropertyValidators(options: PropertyValidatorsOptionsInterface): PropValidatorsMapInterface {
    const {
      configStrict, context, formatRegistry, graph, lookupSchema, propertyEntries
    } = options;
    const propValidators = new Map<string, ValidateWithErrorsFunctionInterface>();

    for (const [
      key,
      propNode
    ] of propertyEntries) {
      const compiled = typeof propNode.schema === 'boolean'
        ? BooleanSchemaValidator.booleanValidateWithErrors(propNode.schema)
        : context.compileNodeValidateWithErrors(propNode, formatRegistry, graph, lookupSchema);

      const propSem = typeof propNode.schema === 'boolean' ? undefined : graph.semantics(propNode);
      const fieldStrict = propSem?.jtStrict ?? configStrict;

      propValidators.set(
        key,
        fieldStrict === true ? StrictValidator.wrap(compiled) : compiled
      );
    }

    return propValidators;
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
  static compileRdfsRangeValidator(
    rdfsRange: string | undefined,
    context: SchemaCompilerValidatePlanContextInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema: LookupSchemaFunctionInterface | undefined,
    lookupGraph: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined
  ): undefined | ValidateWithErrorsFunctionInterface {
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
    const rangeReferenceKey = `rdfs:range::${rdfsRange}`;

    return (
      value: unknown,
      path: string,
      execContext: ExecContextInterface
    ): ValidateWithErrorsResultEntity.Type => {
      if (execContext.refStack.has(rangeReferenceKey)) {
        return {
          'valid': true,
          value
        };
      }

      execContext.refStack.add(rangeReferenceKey);

      try {
        if (DataType.isRecord(value)) {
          return rangeValidator(value, path, execContext);
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
            if (DataType.isRecord(item) || Array.isArray(item)) {
              const itemRes = rangeValidator(item, `${path}/${i}`, execContext);

              if (!itemRes.valid) {
                if (!execContext.collectErrors) {
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
        execContext.refStack.delete(rangeReferenceKey);
      }
    };
  }

  static compileReferenceValidator(options: ReferenceValidatorOptionsInterface): undefined | ValidateWithErrorsFunctionInterface {
    const {
      context, formatRegistry, graph, lookupGraph, lookupSchema, 'ref': reference
    } = options;

    if (typeof reference !== 'string') {
      return undefined;
    }

    const resolved = ReferenceResolver.resolve(reference, graph, {
      ...(lookupSchema !== undefined && { lookupSchema }),
      ...(lookupGraph !== undefined && { lookupGraph })
    });

    if (resolved === undefined) {
      throw new GraphError(`Cannot resolve $ref '${reference}' — schema not found`, {
        'code': GRAPH_ERROR_CODE.REF_NOT_FOUND,
        'pointer': reference
      });
    }

    const {
      'graph': targetGraph, 'node': targetNode
    } = resolved;

    if (typeof targetNode.schema === 'boolean') {
      return BooleanSchemaValidator.booleanValidateWithErrors(targetNode.schema);
    }

    const referenceKey = `${GraphEngineSupport.schemaId(targetGraph.rootSchema) ?? '<anonymous>'}::${reference}`;

    let cached: undefined | ValidateWithErrorsFunctionInterface;

    return (
      value: unknown,
      path: string,
      execContext: ExecContextInterface
    ): ValidateWithErrorsResultEntity.Type => {
      if (execContext.refStack.has(referenceKey)) {
        return {
          'valid': true,
          value
        };
      }

      execContext.refStack.add(referenceKey);

      try {
        cached ??= context.compileNodeValidateWithErrors(targetNode, formatRegistry, targetGraph, lookupSchema);

        return cached(value, path, execContext);
      } finally {
        execContext.refStack.delete(referenceKey);
      }
    };
  }

  /**
   * Compile a `unevaluatedProperties` or `unevaluatedItems` node to a validator that
   * rejects every unevaluated entry when the node is the boolean schema `false`.
   *
   * Returns `undefined` when no unevaluated node is present.
   */
  static compileUnevaluatedNode(
    node: SchemaGraphNodeInterface | undefined,
    keyword: 'unevaluatedItems' | 'unevaluatedProperties',
    context: SchemaCompilerValidatePlanContextInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema: LookupSchemaFunctionInterface | undefined
  ): undefined | ValidateWithErrorsFunctionInterface {
    if (node === undefined) {
      return undefined;
    }

    if (typeof node.schema === 'boolean') {
      return node.schema ? undefined : UnevaluatedRejectValidator.forKeyword(keyword);
    }

    return context.compileNodeValidateWithErrors(node, formatRegistry, graph, lookupSchema);
  }

  /** Compile `allOf` / `anyOf` / `oneOf` validators and checks from the semantics node. */
  static compositionValidators(options: PlanCompileWithSemanticsInterface): CompositionValidatorsResultInterface {
    const {
      context, formatRegistry, graph, lookupSchema, sem
    } = options;
    let allOfValidators: undefined | ValidateWithErrorsFunctionInterface[];

    if (sem.allOf.length > 0) {
      allOfValidators = [];
      for (const node of sem.allOf) {
        allOfValidators.push(context.compileNodeOrBooleanValidateWithErrors(node, formatRegistry, graph, lookupSchema));
      }
    }

    let anyOfValidators: undefined | ValidateWithErrorsFunctionInterface[];

    if (sem.anyOf.length > 0) {
      anyOfValidators = [];
      for (const node of sem.anyOf) {
        anyOfValidators.push(context.compileNodeOrBooleanValidateWithErrors(node, formatRegistry, graph, lookupSchema));
      }
    }

    let oneOfValidators: undefined | ValidateWithErrorsFunctionInterface[];

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
  static conditionalValidators(options: PlanCompileWithSemanticsInterface): ConditionalValidatorsResultInterface {
    const {
      context, formatRegistry, graph, lookupSchema, sem
    } = options;
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

  static constraintValidators(options: PlanCompileWithSemanticsInterface): ConstraintValidatorsResultInterface {
    const {
      context, formatRegistry, graph, lookupSchema, sem
    } = options;
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

  /** Compile `dependentSchemas` validators from the semantics node. */
  static dependentSchemaValidators(options: PlanCompileWithSemanticsInterface): DependentSchemaValidatorEntryInterface[] | undefined {
    const {
      context, formatRegistry, graph, lookupSchema, sem
    } = options;

    if (sem.dependentSchemaEntries.length === 0) {
      return undefined;
    }

    const depValidators: DependentSchemaValidatorEntryInterface[] = [];

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

  /** Collect `dependentRequired` entries with non-empty arrays from semantics. */
  static depRequired(dependentRequired: Readonly<Record<string, unknown>>): Array<[string, string[]]> {
    const entries: Array<[string, string[]]> = [];

    for (const entry of Object.entries(dependentRequired)) {
      const key = entry[0];
      const value = entry[1];

      if (Array.isArray(value) && value.length > 0) {
        entries.push([
          key,
          value as string[]
        ]);
      }
    }

    return entries;
  }

  /** Compile pattern-property validators from the semantics node. */
  static patternPropValidators(options: PlanCompileWithSemanticsInterface): PatternPropValidatorEntryInterface[] | undefined {
    const { sem } = options;

    if (sem.patternPropertyEntries.length === 0) {
      return undefined;
    }

    const patternValidators: PatternPropValidatorEntryInterface[] = [];

    for (const [
      pat,
      patNode
    ] of sem.patternPropertyEntries) {
      patternValidators.push(PlanBuilders.patternValidatorEntry(pat, patNode, options));
    }

    return patternValidators;
  }

  /**
   * Compile one pattern-property validator entry. Isolated in its own method
   * scope (rather than inline in the `patternPropValidators` loop) so the
   * `new RegExp` construction — which cannot be hoisted since the pattern
   * string varies per entry — sits outside the loop's lexical scope.
   */
  static patternValidatorEntry(
    pat: string,
    patNode: SchemaGraphNodeInterface,
    options: PlanCompileWithSemanticsInterface
  ): PatternPropValidatorEntryInterface {
    const {
      context, formatRegistry, graph, lookupSchema
    } = options;

    return {
      'regex': new RegExp(pat, 'u'),
      'validator': context.compileNodeOrBooleanValidateWithErrors(patNode, formatRegistry, graph, lookupSchema)
    };
  }

  /** Compute scalar validators that have no mutual dependencies. */
  static prelude(options: PlanCompileWithSemanticsInterface): PlanPreludeInterface {
    const {
      context, formatRegistry, sem
    } = options;
    const patternRegex = sem.pattern === undefined ? undefined : new RegExp(sem.pattern, 'u');
    const formatValidator = (sem.format !== undefined && context.appliesFormatAssertions(sem))
      ? formatRegistry.get(sem.format)
      : undefined;
    const {
      additionalValidator, complementValidator, propertyNamesValidator
    } = PlanBuilders.constraintValidators(options);

    return {
      additionalValidator,
      complementValidator,
      'depRequiredEntries': PlanBuilders.depRequired(sem.dependentRequired),
      formatValidator,
      patternRegex,
      propertyNamesValidator
    };
  }
}

// ---------------------------------------------------------------------------
// buildNodePlan — single keyword traversal → CompiledNodeValidationPlanInterface
// ---------------------------------------------------------------------------


/**
 * Build a compiled validation plan from a single graph node.
 *
 * @param context - Plan compilation context providing validator-builder helpers.
 * @param graphNode - The graph node to compile.
 * @param formatRegistry - Registry for format validators.
 * @param graph - The schema graph containing `graphNode`.
 * @param options - Optional cross-schema (`lookupSchema`) and cross-graph (`lookupGraph`) lookups.
 * @returns A `CompiledNodeValidationPlanInterface` ready for use by the execute layer.
 *
 * @remarks
 * Performs a single traversal of the node's keywords, compiling each into
 * a typed field on the plan. The plan is consumed by the validation executor
 * (`SchemaCompilerExec`) which interprets each field in sequence.
 *
 * @example
 * ```ts
 * const plan = SchemaCompilerPlan.buildNodePlan(context, graphNode, formatRegistry, graph);
 * // plan.propValidators, plan.allOfValidators, etc. are ready for execution
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link CompiledNodeValidationPlanInterface}
 * @group SchemaCompiler
 */
export class SchemaCompilerPlan {
  static buildNodePlan(
    context: SchemaCompilerValidatePlanContextInterface,
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    options?: BuildNodePlanOptionsInterface
  ): CompiledNodeValidationPlanInterface {
    const {
      lookupGraph, lookupSchema
    } = options ?? {};
    const sem = graph.semantics(graphNode);
    const propertyEntries = sem.properties;

    const planSemanticsOptions: PlanCompileWithSemanticsInterface = {
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
    } = PlanBuilders.prelude(planSemanticsOptions);

    const patternPropValidators = PlanBuilders.patternPropValidators(planSemanticsOptions);

    const {
      containsValidator,
      itemValidator,
      prefixValidators
    } = PlanBuilders.arrayValidators(planSemanticsOptions);

    const {
      allOfValidators,
      anyOfValidators,
      oneOfValidators
    } = PlanBuilders.compositionValidators(planSemanticsOptions);

    const {
      elseValidator,
      ifValidator,
      thenValidator
    } = PlanBuilders.conditionalValidators(planSemanticsOptions);

    const depSchemaValidators = PlanBuilders.dependentSchemaValidators(planSemanticsOptions);
    const enumSet = EnumSet.build(sem.enumValues);

    const {
      allowedKeys,
      allowedKeysForStrip,
      propertyAliases
    } = PlanBuilders.allowedKeys({
      graph,
      lookupGraph,
      'propertyEntries': propertyEntries,
      sem
    });

    const jtExtra = sem.jtConfig?.extra;
    const jtStrictPerField = JtStrictPerField.build(propertyEntries, graph);

    const propertyZeroValueSynthesizers = new Map<string, () => unknown>();
    const semRequired = sem.required;

    if (semRequired.length > 0) {
      for (const key of semRequired) {
        const propNode = sem.properties.get(key);

        if (propNode === undefined) {
          propertyZeroValueSynthesizers.set(key, (): unknown => {
            const result = null;

            return result;
          });
        } else {
          const capturedNode = propNode;
          const capturedGraph = graph;
          const capturedLookup = lookupSchema;
          const capturedLookupGraph = lookupGraph;

          propertyZeroValueSynthesizers.set(key, (): unknown => {
            const result = context.synthesizeZeroValue(capturedNode, capturedGraph, capturedLookup, capturedLookupGraph);

            return result;
          });
        }
      }
    }

    const additionalIsFalse = sem.additionalPropertiesNode === false;
    const propValidators = PlanBuilders.compilePropertyValidators({
      'configStrict': sem.jtConfig?.strict,
      context,
      formatRegistry,
      graph,
      'lookupSchema': lookupSchema,
      'propertyEntries': propertyEntries
    });
    const propertyDefaults = PropertyDefaults.build({
      context,
      graph,
      'lookupSchema': lookupSchema,
      'propertyEntries': propertyEntries
    });
    const requiredArray = sem.required.length > 0 ? sem.required : undefined;

    // Precompute option bags once at compile time — avoids per-value object allocation.
    const arrayOptions: ArrayValidationOptionsInterface = {
      containsValidator,
      itemValidator,
      'maxContains': sem.maxContains,
      'maxItems': sem.maxItems,
      'minContains': sem.minContains,
      'minItems': sem.minItems,
      prefixValidators,
      'uniqueItems': sem.uniqueItems
    };

    const objectOptions: ObjectValidationOptionsInterface = {
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
      'required': requiredArray
    };

    return {
      additionalIsFalse,
      additionalValidator,
      allOfValidators,
      allowedKeys,
      allowedKeysForStrip,
      anyOfValidators,
      'arrOpts': arrayOptions,
      complementValidator,
      'constVal': sem.constValue,
      containsValidator,
      'contentAssertionsEnabled': context.appliesFormatAssertions(sem),
      'contentEncoding': sem.contentEncoding,
      'contentMediaType': sem.contentMediaType,
      'customKeywordEntries': CustomKeywordEntries.build(context.activeCustomKeywords, sem),
      'defaultValue': sem.defaultValue,
      depRequiredEntries,
      depSchemaValidators,
      'dynamicRefValidator': typeof sem.dynamicRef === 'string'
        ? PlanBuilders.compileDynamicReferenceValidator({
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
      'objOpts': objectOptions,
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
      'rdfsRangeValidator': PlanBuilders.compileRdfsRangeValidator(
        sem.rdfsRange,
        context,
        formatRegistry,
        graph,
        lookupSchema,
        lookupGraph
      ),
      'refValidator': PlanBuilders.compileReferenceValidator({
        context,
        formatRegistry,
        graph,
        lookupGraph,
        'lookupSchema': lookupSchema,
        'ref': sem.ref
      }),
      'required': requiredArray,
      thenValidator,
      'typePredicate': TypePredicate.build(sem.schemaTypes),
      'types': sem.schemaTypes,
      'unevaluatedItemsValidator': PlanBuilders.compileUnevaluatedNode(
        sem.unevaluatedItemsNode,
        'unevaluatedItems',
        context,
        formatRegistry,
        graph,
        lookupSchema
      ),
      'unevaluatedPropertiesValidator': PlanBuilders.compileUnevaluatedNode(
        sem.unevaluatedPropertiesNode,
        'unevaluatedProperties',
        context,
        formatRegistry,
        graph,
        lookupSchema
      ),
      'uniqueItems': sem.uniqueItems
    };
  }
}
