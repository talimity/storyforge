**Templates Builder: React/RHF/Zustand/DnD Review — Actionable Fixes**

- **Field invalid flags:** In `SlotReferenceEdit` add `invalid={!!errors.name}` to the Template ID `Field` (and other `Field`s that should render error styling). `TemplateMetadata` already follows this pattern.
- **Select item type mismatch:** In `RoleSelect` (slot editor), the select’s `SelectItem` passes `item={option.value}`. Pass the full item object `item={option}` to match the collection created by `createListCollection({ items: MESSAGE_ROLE_SELECT_OPTIONS })`.
- **Select value type restoration:** In `SelectParameterInput`, `details.value[0]` is always a string. Map back to the original option by string value and pass the option’s typed `value` (number/boolean/string) to `onChange` so Zod union validation for `select` works.
- **RHF submit handler idiom:** In `SlotReferenceEdit`, prefer `handleSubmit((values) => save(values))` over calling `getValues()` inside a no-arg callback. It avoids stale reads and makes intent clearer.
- **RHF shouldUnregister:** Enable `shouldUnregister: true` in `SlotReferenceEdit` so fields removed by recipe changes don’t linger in the form state (you already do this in `MessageNodeEdit`).
- **RHF criteriaMode:** Consider `criteriaMode: "all"` and showing the first error per field in UI to reduce flicker and improve clarity for complex schemas.
- **Focus first invalid field on save:** After a failed submit in `SlotReferenceEdit`, call `setFocus` to the first invalid field (e.g., `name`) so the user gets a clear cue.
- **Unify customSpec validation:** Move the custom JSON validation for `customSpec` into the Zod schema via `.superRefine` so that all validation flows through the resolver consistently (instead of `register`-level `validate`).

State/Store
- **Avoid broad store subscriptions:** In `LayoutNodeCard` and `TemplateForm`, don’t call `useTemplateBuilderStore()` without a selector. Subscribe only to the fields you need via a selector + `useShallow` to avoid global re-renders.
- **Structure errors dependency:** In `TemplateForm`, `useMemo(() => getValidationErrors(builderStore, metadata.task), [builderStore, metadata.task])` re-computes on any store change. Instead, select just `layoutDraft` and `slotsDraft` and memo on those + `metadata.task`.
- **Store-driven name uniqueness:** The `refine` for template ID (`name`) currently captures `slotsDraft` and `currentName`. That’s good; ensure you recreate the schema when `slotsDraft` changes (already done via deps). Confirm `slotsDraft` identity changes for slot edits (it should, given `immer`).

RHF Patterns
- **Field/Controller consistency:** You mix `register` and `Controller` appropriately. For Chakra select/switch/number inputs keep using `Controller`; for `Input`/`Textarea` stick with `register`.
- **Validation mode:** `mode: "onBlur"` is fine for the node editors. If users expect immediate feedback for the Template ID, consider `reValidateMode: "onChange"` for that specific field via `useController`.

DnD
- **Reorder handling:** `useLayoutDnd` computes the full `newLayout`, and `LayoutBuilder` then converts that into a single `reorderNodes(from, to)`. This is fine; just ensure no other layout mutations occur between drag start/end to keep indices stable.

Performance/Memos
- **Memoize cheap, subscribe narrow:** Prefer narrowing Zustand selectors over broad memoization. Use `useMemo` where derived data is non-trivial; avoid memoizing simple props.
- **JSON.stringify comparisons:** The deep `JSON.stringify` comparisons in `TemplateForm` work but can be expensive. If you see perf issues, prefer `useRef` snapshots of `layoutDraft`/`slotsDraft` lengths + IDs for change detection.

UX/Errors
- **Error surfacing:** Show a compact error summary at the top of `SlotReferenceEdit` when submit fails (e.g., “Fix these fields…”) while also annotating fields inline. You already do this at the Template level for structure errors; mirror that pattern locally.
- **Consistent required indicators:** Only mark `Field` as `required` if the Zod schema requires it; `NumberParameterInput` currently marks all numeric params as required.

Sanity Checks
- **Selects with boolean/number:** Validate that select params with boolean/number options now pass Zod validation once mapping back to typed values is in place.
- **Template ID uniqueness errors:** After adding `invalid` to `Field` and ensure schema resolves, confirm the red styling and error text show on Save and on Blur.

Nice-to-haves (later)
- **FormProvider for node editors:** Optional: wrap node editors in a `FormProvider` if you ever split fields into deeper child components; right now passing `control`/`register` is fine.
- **Optimistic save UI:** Disable the Save button during `handleSubmit` execution to avoid double clicks; you already set loading states at the page level.

