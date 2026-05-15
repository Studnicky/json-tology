export const RESTRICTIONS_KEY = 'jt:restrictions';

export const CLASS_AXIOM_BODY_SKIP_KEYS = new Set<string>(['$id']);

export const EXTEND_SKIP_KEYS = new Set<string>([
  '$id',
  'jt:config',
  'properties',
  'required',
  'type'
]);
