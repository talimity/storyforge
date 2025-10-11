import type { ReactNode } from "react";
import { Field as UiField, type FieldProps as UiFieldProps } from "@/components/ui/index";
import { useFieldContext } from "@/lib/form-context";

export type FieldPresentationProps = Pick<
  UiFieldProps,
  "label" | "helperText" | "optionalText" | "required" | "errorText" | "invalid"
> & {
  fieldProps?: UiFieldProps;
};

type FieldControlProps = Omit<UiFieldProps, "children"> & {
  children: ReactNode;
};

export function FieldControl(props: FieldControlProps) {
  const { children, errorText: errorTextProp, invalid: invalidProp, ...rest } = props;
  const field = useFieldContext<unknown>();
  const meta = field.state.meta;
  const formattedErrors = meta.errors.map(formatFormError).filter((value) => value.length > 0);

  const hasUserInteraction =
    Boolean(meta.isTouched) || Boolean(meta.isDirty) || Boolean(meta.isBlurred);

  const showError = formattedErrors.length > 0 && hasUserInteraction;

  const errorText = errorTextProp ?? (showError ? formattedErrors.join(", ") : undefined);
  const invalid = invalidProp ?? showError;

  return (
    <UiField errorText={errorText} invalid={invalid} {...rest}>
      {children}
    </UiField>
  );
}

export function formatFormError(error: unknown): string {
  if (error === undefined || error === null) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "number" || typeof error === "boolean") {
    return String(error);
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
