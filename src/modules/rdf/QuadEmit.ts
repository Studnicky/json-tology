/**
 * QuadEmit — projection-layer literal emission helpers.
 *
 * Contains the two methods extracted from QuadFactory that depend on
 * ProjectionIndex (a projection-layer module). Moving them here keeps
 * QuadFactory free of projection-layer dependencies.
 */

import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type { RelationIndexType } from '../../types/RelationIndexType.js';
import type { QuadFactoryEmitOptionsType } from '../../types/QuadFactoryOpts.js';
import { XSD } from '../../constants/IRI.js';
import { QuadFactory } from '../quads/QuadFactory.js';
import { ProjectionIndex } from './ProjectionIndex.js';

export const QuadEmit = {
  /**
   * Emit a single numeric constraint literal for the first relation matching a predicate.
   */
  emitConstraintLiteral(
    subject: string,
    entry: RelationIndexType,
    predicate: string,
    datatype: string,
    quads: QuadInterface[],
    options?: QuadFactoryEmitOptionsType
  ): void {
    const rels = entry.byPredicate.get(predicate) ?? [];

    const firstRel = rels.at(0);

    if (firstRel !== undefined) {
      const curie = options?.curie;
      const numberLiteral = QuadFactory.literal(Number(ProjectionIndex.relationTargetId(firstRel)), datatype, { curie });

      quads.push(QuadFactory.quad(subject, predicate, numberLiteral, { curie }));
    }
  },

  /**
   * Emit string literal quads for all relations matching a predicate.
   */
  emitLiterals(
    subject: string,
    entry: RelationIndexType,
    predicate: string,
    outputPredicate: string,
    quads: QuadInterface[],
    options?: QuadFactoryEmitOptionsType
  ): void {
    const rels = entry.byPredicate.get(predicate);

    if (rels !== undefined) {
      const curie = options?.curie;

      for (const rel of rels) {
        const literalValue = QuadFactory.literal(ProjectionIndex.relationTargetId(rel), XSD.string, { curie });

        quads.push(QuadFactory.quad(subject, outputPredicate, literalValue, { curie }));
      }
    }
  }
} as const;
