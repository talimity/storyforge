import { chakra } from "@chakra-ui/react";
import { inputRecipe as chakraInputRecipe } from "@chakra-ui/react/theme";
import { indentLess, insertTab } from "@codemirror/commands";
import { lintGutter } from "@codemirror/lint";
import { EditorView, keymap, type ViewUpdate } from "@codemirror/view";
import { deepmerge } from "@fastify/deepmerge";
import * as events from "@uiw/codemirror-extensions-events";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import CodeMirror from "@uiw/react-codemirror";
import { jsonSchema, updateSchema } from "codemirror-json-schema";
import type { JSONSchema7 } from "json-schema";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import { useColorMode } from "@/components/ui";
import { FieldControl, type FieldPresentationProps } from "@/lib/form/field-control";
import { useFieldContext } from "@/lib/form-context";
import { inputRecipe } from "@/theme";

type JsonEditorFieldProps = FieldPresentationProps & {
  label?: string;
  schema: typeof z.core.JSONSchema;
  maxHeight?: string | number;
  readOnly?: boolean;
  // optional pretty-print on blur
  formatOnBlur?: boolean;
};

const ChakraJsonEditorWrapper = chakra("div", deepmerge()(chakraInputRecipe, inputRecipe));

export function JsonEditorField(props: JsonEditorFieldProps) {
  const { colorMode } = useColorMode();
  const id = useId();
  const {
    label,
    helperText,
    optionalText,
    required,
    errorText,
    invalid,
    schema,
    maxHeight = "30dvh",
    readOnly,
    formatOnBlur,
    fieldProps,
    ...rest
  } = props;
  const field = useFieldContext<string | null | undefined>();
  const [focused, setFocused] = useState(false);

  // pseudo-controlled state to hold the editor value without rerendering on every change
  const valueRef = useRef(
    typeof field.state.value === "string"
      ? (field.state.value ?? "{}")
      : JSON.stringify(field.state.value ?? {}, null, 2)
  );
  const [value, setValue] = useState(valueRef.current);
  const onChange = useCallback((val: string) => {
    valueRef.current = val;
  }, []);

  // keep a ref to the EditorView so we can update the schema dynamically
  const viewRef = useRef<EditorView | null>(null);
  useEffect(() => {
    if (viewRef.current) {
      // updates schema StateField + refreshes schema lints
      updateSchema(viewRef.current, schema as JSONSchema7);
    }
  }, [schema]);

  // set up CodeMirror extensions
  const extensions = useMemo(
    () => [
      jsonSchema(schema as JSONSchema7),
      lintGutter(),
      // soft line wrapping
      EditorView.lineWrapping,
      // focus tracking for fake focus ring
      // for some reason handleUpdate's hasFocus is never true
      events.content({ focus: () => setFocused(true), blur: () => setFocused(false) }),
      // fix odd default tab behavior
      keymap.of([
        { key: "Tab", run: insertTab },
        { key: "Shift-Tab", run: indentLess },
      ]),
    ],
    [schema]
  );

  // trigger tanstack form updates on blur to avoid state thrashing
  const handleUpdate = (vu: ViewUpdate) => {
    if (vu.focusChanged) {
      const v = valueRef.current;
      field.handleChange(v);
      field.handleBlur();
      setValue(v);

      if (formatOnBlur) {
        try {
          const pretty = JSON.stringify(JSON.parse(vu.state.doc.toString()), null, 2);
          if (pretty !== v) {
            field.handleChange(pretty);
            setValue(pretty);
          }
        } catch {}
      }
    }
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
      <ChakraJsonEditorWrapper
        asChild
        h="max-content"
        p="0"
        data-focus-visible={focused ? "" : undefined}
        data-invalid={invalid || !field.state.meta.isValid ? "" : undefined}
      >
        <CodeMirror
          id={id}
          value={value}
          editable={!readOnly}
          maxHeight={typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight}
          theme={colorMode === "light" ? vscodeLight : vscodeDark}
          onChange={onChange}
          onUpdate={handleUpdate}
          onCreateEditor={(view) => (viewRef.current = view)}
          basicSetup={{ lineNumbers: true, foldGutter: false, tabSize: 2 }}
          indentWithTab={false}
          extensions={extensions}
          aria-label={label || "JSON Editor"}
          {...rest}
        />
      </ChakraJsonEditorWrapper>
    </FieldControl>
  );
}
