import type { QuadInterface } from './QuadInterface.js';

/**
 * Map from subject IRI / blank-node ID to all quads with that subject.
 * Shared by the OwlImporter dispatcher modules to avoid re-building the index
 * per dispatcher call.
 *
 * @remarks
 * Built once by the orchestrator from the full quad set and passed into every
 * dispatcher via `OwlImportContextInterface`. Keys are full subject IRIs or
 * blank-node identifiers; values are all quads sharing that subject.
 *
 * A real `Map` instance (hot-path lookup during import), so it is authored as
 * an interface extending `Map` rather than a type alias — `Map` is a runtime
 * class-instance type, not schema-derived data.
 *
 * @example
 * ```ts
 * const index: SubjectIndexInterface = new Map();
 * for (const quad of quads) {
 *   const key = quad.subject.value;
 *   (index.get(key) ?? (index.set(key, []), index.get(key)!)).push(quad);
 * }
 * ```
 *
 * @category OWL Import
 * @since 0.15.0
 * @see {@link DispatcherInterface}
 * @group Import
 */
export interface SubjectIndexInterface extends Map<string, QuadInterface[]> {}
