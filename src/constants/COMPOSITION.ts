/**
 * Key used to store jt:restrictions metadata on a schema node.
 *
 * @remarks
 * Written into the graph during translation when a schema carries `jt:restrictions`
 * blocks. Consumers read this key to locate restriction side-data attached to a node.
 *
 * @example
 * ```ts
 * const hasRestrictions = RESTRICTIONS_KEY in schemaNode;
 * ```
 *
 * @category Composition
 * @since 0.1.0
 * @see {@link https://github.com/noocodex/json-tology json-tology}
 * @defaultValue `'jt:restrictions'`
 * @group Constants
 */
export const RESTRICTIONS_KEY = 'jt:restrictions';

/**
 * Keys that are skipped when writing class-axiom body quads.
 *
 * @remarks
 * During OWL class-axiom translation the `$id` key identifies the subject and must
 * not be emitted as a property of the body. All other keys are forwarded to the
 * class-axiom body emitter.
 *
 * @example
 * ```ts
 * for (const [key, value] of Object.entries(axiomBody)) {
 *   if (CLASS_AXIOM_BODY_SKIP_KEYS.has(key)) continue;
 *   emitAxiomTriple(key, value);
 * }
 * ```
 *
 * @category Composition
 * @since 0.1.0
 * @see {@link https://github.com/noocodex/json-tology json-tology}
 * @defaultValue `new Set(['$id'])`
 * @group Constants
 */
export const CLASS_AXIOM_BODY_SKIP_KEYS = new Set<string>(['$id']);

/**
 * Keys that are skipped when merging `allOf` / `extend` schemas.
 *
 * @remarks
 * During schema extension the listed keys carry identity or structural metadata
 * that must not be propagated from the parent into the child. Keys outside this
 * set are merged into the extending schema.
 *
 * @example
 * ```ts
 * for (const [key, value] of Object.entries(parentSchema)) {
 *   if (EXTEND_SKIP_KEYS.has(key)) continue;
 *   childSchema[key] = value;
 * }
 * ```
 *
 * @category Composition
 * @since 0.1.0
 * @see {@link https://github.com/noocodex/json-tology json-tology}
 * @defaultValue `new Set(['$id', 'jt:config', 'properties', 'required', 'type'])`
 * @group Constants
 */
export const EXTEND_SKIP_KEYS = new Set<string>([
  '$id',
  'jt:config',
  'properties',
  'required',
  'type'
]);
