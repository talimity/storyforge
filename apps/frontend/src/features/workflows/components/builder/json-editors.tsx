import { Textarea } from "@chakra-ui/react";
import { useState } from "react";
import { type Path, useFormContext } from "react-hook-form";
import type { WorkflowFormValues } from "./schemas";

export function GenParamsTextarea({
  name,
  value,
  onChangeObject,
  disabled,
}: {
  name: Path<WorkflowFormValues>;
  value: Record<string, unknown> | undefined;
  onChangeObject: (obj: Record<string, unknown> | undefined) => void;
  disabled: boolean;
}) {
  const { setError, clearErrors } = useFormContext<WorkflowFormValues>();
  const [text, setText] = useState(() => (value ? JSON.stringify(value, null, 2) : ""));

  return (
    <Textarea
      rows={4}
      fontFamily="mono"
      placeholder='JSON object, e.g. {"temperature":0.7}'
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const trimmed = text.trim();
        if (!trimmed) {
          onChangeObject(undefined);
          clearErrors(name);
          return;
        }
        try {
          const obj = JSON.parse(trimmed);
          if (obj && typeof obj === "object") {
            onChangeObject(obj);
            clearErrors(name);
          } else {
            throw new Error("Must be a JSON object");
          }
        } catch (_err) {
          setError(name, { type: "custom", message: "Invalid genParams JSON" });
        }
      }}
      disabled={disabled}
    />
  );
}

export function StopSequencesTextarea({
  name,
  value,
  onChangeArray,
  disabled,
}: {
  name: Path<WorkflowFormValues>;
  value: string[];
  onChangeArray: (arr: string[]) => void;
  disabled: boolean;
}) {
  const { setError, clearErrors } = useFormContext<WorkflowFormValues>();
  const [text, setText] = useState(() => (value.length ? JSON.stringify(value, null, 2) : "[]"));

  return (
    <Textarea
      rows={2}
      fontFamily="mono"
      placeholder='["###", "<END>"]'
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const trimmed = text.trim();
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
            onChangeArray(parsed);
            clearErrors(name);
          } else {
            throw new Error("Must be a JSON string array");
          }
        } catch (_err) {
          setError(name, { type: "custom", message: "Invalid stop sequences JSON array" });
        }
      }}
      disabled={disabled}
    />
  );
}
