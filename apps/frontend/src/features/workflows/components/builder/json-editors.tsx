import { Textarea } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useFieldContext } from "@/lib/app-form";

export function GenParamsTextarea() {
  const field = useFieldContext<Record<string, unknown> | undefined>();
  const [text, setText] = useState(() =>
    field.state.value ? JSON.stringify(field.state.value, null, 2) : ""
  );

  useEffect(() => {
    const value = field.state.value;
    const next = value ? JSON.stringify(value, null, 2) : "";
    setText(next);
  }, [field.state.value]);

  const applyChange = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      field.handleChange(undefined);
      field.setErrorMap({ onBlur: undefined });
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid genParams JSON");
      }
      field.handleChange(parsed as Record<string, unknown>);
      field.setErrorMap({ onBlur: undefined });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid genParams JSON";
      field.setErrorMap({ onBlur: message });
    }
  };

  return (
    <Textarea
      rows={4}
      fontFamily="mono"
      placeholder='JSON object, e.g. {"temperature":0.7}'
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        applyChange();
        field.handleBlur();
      }}
    />
  );
}

export function StopSequencesTextarea() {
  const field = useFieldContext<Array<string>>();
  const [text, setText] = useState(() =>
    field.state.value.length ? JSON.stringify(field.state.value, null, 2) : "[]"
  );

  useEffect(() => {
    const value = field.state.value;
    const next = value.length ? JSON.stringify(value, null, 2) : "[]";
    setText(next);
  }, [field.state.value]);

  const applyChange = () => {
    const trimmed = text.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
        throw new Error("Invalid stop sequences JSON array");
      }
      field.handleChange(parsed);
      field.setErrorMap({ onBlur: undefined });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid stop sequences JSON array";
      field.setErrorMap({ onBlur: message });
    }
  };

  return (
    <Textarea
      rows={2}
      fontFamily="mono"
      placeholder='["###", "<END>"]'
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        applyChange();
        field.handleBlur();
      }}
    />
  );
}
