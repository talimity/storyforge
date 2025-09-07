/** Union equality check */
type UnionEq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type Diff<A, B> = Exclude<A, B>;
type TupleUnion<T extends readonly unknown[]> = T[number];

type HasDuplicates<T extends readonly PropertyKey[], Seen = never> = T extends readonly [
  infer F extends PropertyKey,
  ...infer R extends readonly PropertyKey[],
]
  ? F extends Seen
    ? true
    : HasDuplicates<R, Seen | F>
  : false;

type NoDupError<T extends readonly PropertyKey[]> = HasDuplicates<T> extends true
  ? { __error__: "Duplicate items are not allowed" }
  : unknown;

/**
 * Factory that returns an "exact keys" tuple builder for any map type.
 * - Errors if any key is missing or extra (vs keyof TMap).
 * - Optionally errors on duplicates (toggle by leaving NoDupError in).
 */
export const exactKeys =
  <TMap extends Record<PropertyKey, unknown>>() =>
  <TKeys extends readonly (keyof TMap)[]>(
    ...keys: TKeys &
      NoDupError<TKeys> &
      (UnionEq<TupleUnion<TKeys>, keyof TMap> extends true
        ? unknown
        : {
            __error__: "Array must match keyof<TMap> exactly";
            missing: Diff<keyof TMap, TupleUnion<TKeys>>;
            extra: Diff<TupleUnion<TKeys>, keyof TMap>;
          })
  ) =>
    keys;
