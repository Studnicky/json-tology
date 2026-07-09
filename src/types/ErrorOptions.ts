/**
 * Error constructor option bags.
 *
 * `code` is now a required field on every options type. This satisfies the
 * standard JavaScript `Error(message, options)` shape and the
 * `unicorn/custom-error-definition` ESLint rule.
 *
 * Object-type aliases live here per the repo convention. Each subclass options
 * type composes from {@link BaseErrorOptionsType} via `&` intersection and
 * narrows `code` to that class's own code-union.
 */

import type {
  CoercionErrorCodeType,
  GraphErrorCodeType,
  InstantiationErrorCodeType,
  MaterializationErrorCodeType,
  OwlImportErrorCodeType,
  SchemaErrorCodeType,
  SchemaLoadErrorCodeType,
  TransformErrorCodeType
} from './ErrorCodes.js';
import type { SchemaLoadReasonType } from './Loader.js';
import type { TransformDirectionType } from './TransformDirectionType.js';

export type BaseErrorOptionsType = {
  'cause'?: Error;
  'code': string;
  /**
   * Set `true` only for transient failures whose cause is external and may clear
   * on retry (e.g. HTTP 5xx). Omit (defaults to `false`) for deterministic
   * failures that recur on identical input. See {@link BaseError.retryable}.
   */
  'retryable'?: boolean;
};

export type CoercionErrorOptionsType
  = Omit<BaseErrorOptionsType, 'code'> & {
    'code': CoercionErrorCodeType;
  };

export type GraphErrorOptionsType
  = Omit<BaseErrorOptionsType, 'code'> & {
    'code': GraphErrorCodeType;
    'pointer'?: string;
  };

export type InstantiationErrorOptionsType
  = Omit<BaseErrorOptionsType, 'code'> & {
    'code': InstantiationErrorCodeType;
    'message'?: string;
  };

export type MaterializationErrorOptionsType
  = Omit<BaseErrorOptionsType, 'code'> & {
    'code': MaterializationErrorCodeType;
    'message'?: string;
    'validationErrors': string[];
  };

export type OwlImportErrorOptionsType
  = Omit<BaseErrorOptionsType, 'code'> & {
    'axiomIri': string;
    'code': OwlImportErrorCodeType;
    'subjectIri': null | string;
  };

export type SchemaErrorOptionsType
  = Omit<BaseErrorOptionsType, 'code'> & {
    'code': SchemaErrorCodeType;
    'schemaId'?: string;
  };

export type TransformErrorOptionsType
  = Omit<BaseErrorOptionsType, 'code'> & {
    'code': TransformErrorCodeType;
    'direction': TransformDirectionType;
    'path'?: string;
    'schemaId'?: string;
  };

export type SchemaLoadErrorOptionsType
  = Omit<BaseErrorOptionsType, 'code'> & {
    'code': SchemaLoadErrorCodeType;
    'file': string;
    'reason': SchemaLoadReasonType;
    'status'?: number;
  };
