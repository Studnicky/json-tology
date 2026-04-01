declare const TRANSFORM_OUT: unique symbol;

export interface TransformBrandInterface<TOut> { readonly [TRANSFORM_OUT]: TOut }
