# 06 — UI: Provider Capabilities and Model Profile Template Editor

Goal: update the frontend configuration screens to expose the new text completions capability on providers and add a Jinja template editor (with preview) on model profiles when text completions are effectively available.

## Provider Config (Capabilities)

Files:
- `apps/frontend/src/features/inference-config/components/provider-form.tsx`
- `apps/frontend/src/features/inference-config/components/capabilities-selector.tsx`

Changes:
1) Extend `CapabilitiesSelector` to include a toggle for `textCompletions`.

Snippet (CapabilitiesSelector):

```tsx
// Import type already includes TextInferenceCapabilities
// Add a new Field section similar to `tools`/`fim`:

{!hide?.textCompletions && (
  <Field
    label="Text Completions"
    helperText={
      baseline?.textCompletions !== undefined
        ? `Effective: ${String(value.textCompletions ?? baseline.textCompletions)} ${
            allowInherit && value.textCompletions === undefined ? `(inherited)` : ``
          }`
        : undefined
    }
  >
    {allowInherit ? (
      <RadioGroup
        value={value.textCompletions === undefined ? "inherit" : value.textCompletions ? "on" : "off"}
        onValueChange={(e) => {
          if (e.value === "inherit") return clear("textCompletions");
          set("textCompletions", e.value === "on");
        }}
      >
        <HStack gap={4} wrap="wrap">
          <Radio value="inherit">Inherit{baseline?.textCompletions !== undefined ? ` (${String(baseline.textCompletions)})` : ""}</Radio>
          <Radio value="on">On</Radio>
          <Radio value="off">Off</Radio>
        </HStack>
      </RadioGroup>
    ) : (
      <Checkbox
        checked={!!value.textCompletions}
        onCheckedChange={({ checked }) => set("textCompletions", !!checked)}
      >
        Supports text completion endpoint
      </Checkbox>
    )}
  </Field>
)}
```

2) `provider-form.tsx`: no structural changes; the capabilities editor is already shown only when `kind === "openai-compatible"`. The baseline passed into `CapabilitiesSelector` (resolved provider defaults) will now include `textCompletions`.

## Model Profile Form — Template Editor Entry Point

Files:
- `apps/frontend/src/features/inference-config/components/model-profile-form.tsx`

Changes:
- Compute the effective capability for `textCompletions` to decide whether to show a Template Editor button. Effective =

```ts
const providerCaps = providers.find((p) => p.id === selectedProviderId)?.capabilities;
const overrides = watch("capabilityOverrides");
const effectiveTextCompletions = (overrides?.textCompletions ?? providerCaps?.textCompletions) === true;
```

- Add a secondary button (next to Capability Overrides) to open a modal dialog for editing the per‑profile Jinja text template. Keep the main form compact; the dialog hosts the editor + preview.

Snippet (entry button):

```tsx
{effectiveTextCompletions && (
  <HStack justify="flex-end">
    <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
      Edit Text Template
    </Button>
  </HStack>
)}
```

Persist the template in the form state (extend `modelProfileFormSchema` on the frontend to include `textTemplate: z.string().nullable()` once contracts update). Include `textTemplate` in the `onSubmit` payload.

## Template Editor Dialog (New Component)

Files (new):
- `apps/frontend/src/features/inference-config/components/text-template-editor.tsx`

Responsibilities:
- Textarea/code editor for the Jinja template string.
- Preview panel that uses `renderTextTemplate` from `@storyforge/inference` to render `{ messages, prefix }`.
- Inputs shown to the user:
  - `messages` (read‑only sample; use a small canned example or allow pasting sample JSON).
  - `prefix` toggle checkbox to simulate assistant continuation.

Sketch:

```tsx
import { renderTextTemplate } from "@storyforge/inference";

export function TextTemplateEditor({ value, onChange, initialMessages }: Props) {
  const [tpl, setTpl] = useState(value ?? defaultTemplate);
  const [prefix, setPrefix] = useState(false);
  const [rendered, setRendered] = useState("");

  useEffect(() => {
    renderTextTemplate(tpl, { messages: initialMessages, prefix })
      .then(setRendered)
      .catch((e) => setRendered(String(e?.message ?? e)));
  }, [tpl, prefix, initialMessages]);

  return (
    <Dialog>
      {/* textarea for tpl, preview panel showing `rendered` */}
    </Dialog>
  );
}
```

Notes:
- Client‑side rendering is acceptable; if we see bundle size concerns, we can add an optional backend preview route later.

## Backend Wiring

Ensure the backend maps `textTemplate` through to DB:
- `packages/contracts/src/schemas/provider.ts`: extend model profile schemas with `textTemplate`.
- `apps/backend/src/api/routers/providers.ts`: include `textTemplate` in `mapModelProfile`.
- `apps/backend/src/services/provider/provider.service.ts`: `createModelProfile` and `updateModelProfile` should accept and persist `textTemplate` (handled automatically once contracts + DB schema include it; no JSON handling needed).

## Acceptance Checklist

- Provider form shows Text Completions toggle for OpenAI‑compatible providers.
- Model profile form shows an “Edit Text Template” action when effective text completions are enabled.
- Template editor dialog renders previews that match adapter behavior (same helper).
- Create/Update calls persist `textTemplate` to DB and it appears in subsequent loads.

