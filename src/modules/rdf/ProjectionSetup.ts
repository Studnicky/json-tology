/**
 * ProjectionSetup — shared graph-traversal and emit-context construction for
 * `OwlProjection` and `ShaclProjection`.
 *
 * Both projections index the same `graph.allRelations()` output and thread
 * the same `ProjectionEmitContextInterface` through their emit helpers; only
 * the vocabulary-specific emission logic differs and stays in each projection.
 */

import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { ProjectionEmitContextInterface } from '../../interfaces/ProjectionEmitContextInterface.js';
import type { RelationIndexInterface } from '../../interfaces/RelationIndexInterface.js';
import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type { ProjectionGraphOptionsInterface } from '../../interfaces/ProjectionGraphOptionsInterface.js';
import { IdentifierIssuer } from '../quads/IdentifierIssuer.js';
import { ProjectionIndex } from './ProjectionIndex.js';

export const ProjectionSetup = {
  /**
   * Build the shared emit context and relation index for a `graph()` entry point.
   * Defaults `issuer` to a fresh `IdentifierIssuer` when the caller does not
   * supply one.
   */
  build(
    graph: SchemaGraphInterface,
    options?: ProjectionGraphOptionsInterface
  ): { 'context': ProjectionEmitContextInterface;
    'index': Map<string, RelationIndexInterface> } {
    const { curie } = options ?? {};
    const { predicateResolver } = options ?? {};
    const issuer = options?.issuer ?? new IdentifierIssuer();
    const quads: QuadInterface[] = [];
    const allRelations = graph.allRelations();
    const index = ProjectionIndex.build(allRelations);
    const context: ProjectionEmitContextInterface = {
      curie,
      graph,
      index,
      issuer,
      predicateResolver,
      quads
    };

    return {
      context,
      index
    };
  }
} as const;
