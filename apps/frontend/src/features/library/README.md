# Library Filter Persistence

This package contains shared utilities for persisting library page filters across URL search params and local storage.

## `usePersistedLibraryFilters`

1. Define a Zod schema describing the page filters along with a default value that passes the schema.
2. Create a `FilterParamConfigMap` describing how each field should be reflected in the URL (encode/decode functions are optional; default implementations handle primitive types).
3. Call `usePersistedLibraryFilters` with the schema, defaults, params, and a stable `{storageKey, version}` pair.

The hook returns:

- `filters`: the parsed filter object, always validated against the schema.
- `setFilter(key, value)`: update a single field and sync URL/local storage.
- `updateFilters(updater)`: functional update for multi-field changes.
- `clearFilters()`: reset back to defaults.
- `isDirty`: true when the current filters differ from defaults.
- `source`: indicates whether the current state hydrates from the URL, storage, or defaults.

### Param helpers

`filter-param-helpers.ts` includes utilities for common patterns:

- `stringParam` handles trimmed strings and optional omission rules.
- `enumParam` validates against a fixed set and skips default values automatically.
- `booleanParam` writes a single flag only when `true`.
- `delimitedArrayParam` serializes arrays (e.g., comma-separated lists) and supplies equality checks.

Compose these helpers when declaring a page's `FilterParamConfigMap` so each library page can stay minimal.

### Tips

- Use `schema.shape.<field>.safeParse()` inside change handlers when the upstream component emits `string` values.
- Encode `array` filters as comma-separated strings or provide a custom `encode`/`decode` pair that suits your data.
- Bump `version` when the stored shape changes to avoid parsing stale data.
