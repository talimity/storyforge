// apps/frontend/src/lib/form/json-editor.tsx
import { chakra } from "@chakra-ui/react";
import { inputRecipe as chakraInputRecipe } from "@chakra-ui/react/theme";
import { deepmerge } from "@fastify/deepmerge";
import Editor, { type OnMount, useMonaco } from "@monaco-editor/react";
import type { JSONSchema7 } from "json-schema";
import { editor } from "monaco-editor";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import { useColorMode } from "@/components/ui";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { FieldControl, type FieldPresentationProps } from "@/lib/form/field-control";
import { useFieldContext } from "@/lib/form-context";
import { inputRecipe } from "@/theme";

import IStandaloneCodeEditor = editor.IStandaloneCodeEditor;

type JsonEditorFieldProps = FieldPresentationProps & {
  label?: string;
  schema: typeof z.core.JSONSchema | JSONSchema7;
  /**
   * Optional: force a stable schema URI. If omitted, we'll use schema.$id
   * when present, otherwise a per-instance in-memory URI.
   */
  schemaUri?: string;
  /**
   * Optional: when your JSON references other schemas with $ref, you can
   * pass them here so Monaco can resolve completion/validation across files.
   */
  extraSchemas?: Array<{ uri: string; schema: JSONSchema7 }>;
  /** Minimum editor height */
  minHeight?: string | number;
  /** Fixed editor height */
  height?: string | number;
  readOnly?: boolean;
  /** Pretty‑print on blur (uses Monaco formatter, falling back to JSON.stringify). */
  formatOnBlur?: boolean;
};

const fmtStringify = (v: unknown) =>
  typeof v === "string" ? (v ?? "{}") : JSON.stringify(v ?? {}, null, 2);

const ChakraMonacoWrapper = chakra("div", deepmerge()(chakraInputRecipe, inputRecipe));

function JsonEditorField(props: JsonEditorFieldProps) {
  const { colorMode } = useColorMode();
  const id = useId();
  const [focused, setFocused] = useState(false);
  const monaco = useMonaco();

  const {
    label,
    helperText,
    optionalText,
    required,
    errorText,
    invalid,
    schema,
    schemaUri: schemaUriProp,
    extraSchemas,
    minHeight = "200px",
    height = "30dvh",
    readOnly,
    formatOnBlur,
    fieldProps,
    ...rest
  } = props;

  // --- TanStack form field hookup
  const field = useFieldContext<string | null | undefined>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-time for mount
  const initial = useMemo(() => fmtStringify(field.state.value), []);
  const editorRef = useRef<IStandaloneCodeEditor>(null);

  // If the form is externally reset, sync the editor.
  useEffect(() => {
    const text = fmtStringify(field.state.value);
    const model = editorRef.current?.getModel();
    if (text !== model?.getValue()) {
      editorRef.current?.setValue(text);
    }
  }, [field.state.value]);

  // Debounced commit while typing
  const commit = useDebouncedCallback(() => {
    const model = editorRef.current?.getModel();
    if (!model || !editorRef.current) return; // unmounting

    const v = editorRef.current.getValue();
    field.handleChange(v);
    field.validate("blur");
  }, 500);

  // --- Monaco schema wiring ---
  // Each editor instance gets its own model path so fileMatch can be precise.
  const modelUriStr = useMemo(() => `inmemory://model/json-field-${id}.json`, [id]);
  // Choose a stable schema URI (prefer $id if present).
  const computedSchemaUri = useMemo(() => {
    const s = schema as JSONSchema7;
    return schemaUriProp ?? s.$id ?? `inmemory://schema/json-field-${id}.schema.json`;
  }, [schema, schemaUriProp, id]);

  // Register/attach schema to *this* editor's model; clean up on unmount/changes.
  useEffect(() => {
    if (!monaco) return;

    console.debug("JSON Editor registering schema:", computedSchemaUri, "for model:", modelUriStr);

    const json = monaco.languages.json;
    const existing = json.jsonDefaults.diagnosticsOptions?.schemas ?? [];
    const stripCurrent = existing.filter((s) => s.uri !== computedSchemaUri);

    const ourSchemas = [
      { uri: computedSchemaUri, fileMatch: [modelUriStr], schema: schema },
      ...(extraSchemas?.map((x) => ({ uri: x.uri, fileMatch: [modelUriStr], schema: x.schema })) ??
        []),
    ];

    json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      enableSchemaRequest: false,
      schemas: [...stripCurrent, ...ourSchemas],
    });

    return () => {
      const after = (json.jsonDefaults.diagnosticsOptions?.schemas ?? []).filter(
        (s) => s.uri !== computedSchemaUri && !extraSchemas?.find((ex) => ex.uri === s.uri)
      );

      json.jsonDefaults.setDiagnosticsOptions({
        ...(json.jsonDefaults.diagnosticsOptions || {}),
        schemas: after,
      });
    };
  }, [monaco, schema, computedSchemaUri, modelUriStr, extraSchemas]);

  // --- Editor setup ---
  const onMount: OnMount = (editor) => {
    editorRef.current = editor;

    // Keep local ref in sync while typing
    editor.onDidChangeModelContent(commit);

    editor.onDidFocusEditorWidget(() => setFocused(true));

    // On blur, format (if enabled) and commit final value
    editor.onDidBlurEditorWidget(async () => {
      setFocused(false);

      const model = editor.getModel();
      if (!model) return; // unmounting, model is gone

      let text = model.getValue();
      if (formatOnBlur) {
        try {
          await editor.getAction("editor.action.formatDocument")?.run();
          text = model.getValue();
        } catch {
          try {
            text = JSON.stringify(JSON.parse(text), null, 2);
            model.setValue(text);
          } catch {
            // Keep the user's text if it's invalid JSON; Zod will surface a form error.
          }
        }
      }

      field.handleChange(text);
      field.handleBlur();
    });
  };

  return (
    <FieldControl
      label={label}
      helperText={helperText}
      optionalText={optionalText}
      required={required}
      errorText={errorText}
      invalid={invalid}
      {...fieldProps}
    >
      <ChakraMonacoWrapper
        data-test-id="json-editor-field"
        p="0"
        h={height}
        minH={minHeight}
        data-invalid={invalid || !field.state.meta.isValid ? "" : undefined}
        data-focus-visible={focused ? "" : undefined}
      >
        {monaco && (
          <Editor
            // give the model a path so our schema fileMatch targets only this editor
            path={modelUriStr}
            defaultLanguage="json"
            defaultValue={initial}
            onMount={onMount}
            theme={colorMode === "light" ? "vs-light" : "vs-dark"}
            options={{
              tabSize: 2,
              insertSpaces: true,
              readOnly: !!readOnly,
              automaticLayout: true,
              wordWrap: "on",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              formatOnPaste: true,
              formatOnType: true,
              quickSuggestions: true,
              tabCompletion: "on",
              folding: false,
            }}
            height="100%"
            aria-label={label || "JSON Editor"}
            {...rest}
          />
        )}
      </ChakraMonacoWrapper>
    </FieldControl>
  );
}

export default JsonEditorField;
