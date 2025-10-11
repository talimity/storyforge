import {
  createListCollection,
  Input,
  type InputProps,
  NumberInput,
  type NumberInputInputProps,
  type NumberInputRootProps,
  Textarea,
  type TextareaProps,
} from "@chakra-ui/react";
import { createFormHook, useStore } from "@tanstack/react-form";
import { lazy, type ReactNode } from "react";
import {
  UnsavedChangesDialog,
  type UnsavedChangesDialogProps,
} from "@/components/dialogs/unsaved-changes-dialog";
import {
  AutosizeTextarea,
  type AutosizeTextareaProps,
  Button,
  type ButtonProps,
  Checkbox,
  type CheckboxProps,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  Switch,
  type SwitchProps,
} from "@/components/ui";
import { useUnsavedChangesProtection } from "@/hooks/use-unsaved-changes-protection";
import { FieldControl, type FieldPresentationProps } from "@/lib/form/field-control";
// import JsonEditorField from "@/lib/form/json-editor";
import { fieldContext, formContext, useFieldContext, useFormContext } from "./form-context";

type TextInputFieldProps = FieldPresentationProps &
  Omit<InputProps, "value" | "defaultValue" | "onChange" | "onBlur"> & {
    transform?: (next: string) => string | null | undefined;
    onChange?: InputProps["onChange"];
    onBlur?: InputProps["onBlur"];
  };

function TextInputField(props: TextInputFieldProps) {
  const {
    label,
    helperText,
    optionalText,
    required,
    errorText,
    invalid,
    transform,
    autoComplete = "off", // disable autocomplete by default
    onChange,
    onBlur,
    fieldProps,
    ...inputProps
  } = props;

  const field = useFieldContext<string | null | undefined>();
  const value = field.state.value ?? "";

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
      <Input
        {...inputProps}
        id={field.name}
        name={field.name}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => {
          const next = event.target.value;
          const transformed = transform ? transform(next) : next;
          field.handleChange(transformed);
          onChange?.(event);
        }}
        onBlur={(event) => {
          field.handleBlur();
          onBlur?.(event);
        }}
      />
    </FieldControl>
  );
}

type TextareaFieldProps = FieldPresentationProps &
  Omit<AutosizeTextareaProps, "value" | "defaultValue" | "onChange" | "onBlur"> & {
    toDisplayValue?: (value: unknown) => string;
    transform?: (next: string) => string | null | undefined;
    onChange?: TextareaProps["onChange"];
    onBlur?: TextareaProps["onBlur"];
    autosize?: boolean;
  };

function TextareaField(props: TextareaFieldProps) {
  const {
    label,
    helperText,
    optionalText,
    required,
    errorText,
    invalid,
    toDisplayValue,
    transform,
    autoComplete = "off", // disable autocomplete by default
    onChange,
    onBlur,
    autosize = true,
    fieldProps,
    ...inputProps
  } = props;

  const TextareaComponent = autosize ? AutosizeTextarea : Textarea;
  const field = useFieldContext<string | null | undefined>();
  const value = field.state.value ?? "";

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
      <TextareaComponent
        {...inputProps}
        id={field.name}
        name={field.name}
        value={toDisplayValue ? toDisplayValue(value) : value}
        autoComplete={autoComplete}
        onChange={(event) => {
          const next = event.target.value;
          const transformed = transform ? transform(next) : next;
          field.handleChange(transformed);
          onChange?.(event);
        }}
        onBlur={(event) => {
          field.handleBlur();
          onBlur?.(event);
        }}
      />
    </FieldControl>
  );
}

type NumberInputFieldProps = FieldPresentationProps &
  Omit<NumberInputRootProps, "value" | "defaultValue" | "onValueChange" | "onBlur" | "type"> & {
    placeholder?: NumberInputInputProps["placeholder"];
    allowEmpty?: boolean;
    onValueChange?: NumberInputRootProps["onValueChange"];
    onBlur?: NumberInputRootProps["onBlur"];
  };

function NumberInputField(props: NumberInputFieldProps) {
  const {
    label,
    helperText,
    optionalText,
    required,
    errorText,
    placeholder,
    invalid,
    allowEmpty = true,
    onValueChange,
    onBlur,
    flex,
    fieldProps,
    ...inputProps
  } = props;

  const field = useFieldContext<number | null | undefined>();
  const value = field.state.value;
  const displayValue = value === undefined || value === null ? "" : String(value);

  return (
    <FieldControl
      label={label}
      helperText={helperText}
      optionalText={optionalText}
      required={required}
      errorText={errorText}
      invalid={invalid}
      flex={flex}
      {...fieldProps}
    >
      <NumberInput.Root
        width="100%"
        clampValueOnBlur={!allowEmpty}
        {...inputProps}
        // Weird zag.js behavior -- regardless of field/form state, it will set
        // invalid styles on its own if `min` is provided and value is empty.
        // This is not desirable and doesn't match the actual form invalid state
        // if the input allows empty values, so we conditionally omit `min`.
        min={allowEmpty && !value ? undefined : inputProps.min}
        id={field.name}
        name={field.name}
        value={displayValue}
        onValueChange={(event) => {
          const nextValue = event.value;
          if (nextValue.length === 0 && allowEmpty) {
            field.handleChange(null);
            onValueChange?.(event);
            return;
          }

          const parsed = Number(nextValue);
          if (Number.isNaN(parsed)) {
            onValueChange?.(event);
            return;
          }

          field.handleChange(parsed);
          onValueChange?.(event);
        }}
        onBlur={(event) => {
          field.handleBlur();
          onBlur?.(event);
        }}
      >
        <NumberInput.Control />
        <NumberInput.Input placeholder={placeholder} />
      </NumberInput.Root>
    </FieldControl>
  );
}

type SelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

type SelectFieldProps = FieldPresentationProps & {
  options: Array<SelectOption>;
  allowEmpty?: boolean;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  portalled?: boolean;
  onChange?: (value: string | undefined) => void;
};

function SelectField(props: SelectFieldProps) {
  const {
    label,
    helperText,
    optionalText,
    required,
    errorText,
    invalid,
    options,
    allowEmpty = true,
    placeholder,
    clearable = false,
    disabled = false,
    portalled = false,
    onChange,
    fieldProps,
  } = props;

  const field = useFieldContext<string | undefined>();
  const value = field.state.value ?? undefined;
  const collection = createListCollection({ items: options });

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
      <SelectRoot
        collection={collection}
        value={value ? [value] : []}
        disabled={disabled}
        onValueChange={(details) => {
          const next = details.value[0];
          if (!next && allowEmpty) {
            field.handleChange(undefined);
            onChange?.(undefined);
          } else if (next) {
            field.handleChange(next);
            onChange?.(next);
          }
          field.handleBlur();
        }}
      >
        <SelectTrigger clearable={clearable}>
          <SelectValueText placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent portalled={portalled}>
          {options.map((option) => (
            <SelectItem key={option.value} item={option}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    </FieldControl>
  );
}

type CheckboxFieldProps = FieldPresentationProps &
  Omit<CheckboxProps, "checked" | "defaultChecked" | "onCheckedChange"> & {
    onCheckedChange?: CheckboxProps["onCheckedChange"];
  };

function CheckboxField(props: CheckboxFieldProps) {
  const {
    label,
    helperText,
    optionalText,
    required,
    errorText,
    invalid,
    children,
    onCheckedChange,
    fieldProps,
    ...checkboxProps
  } = props;

  const field = useFieldContext<boolean | undefined>();
  const checked = Boolean(field.state.value);

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
      <Checkbox
        {...checkboxProps}
        checked={checked}
        name={field.name}
        onCheckedChange={(event) => {
          field.handleChange(Boolean(event.checked));
          onCheckedChange?.(event);
        }}
        onBlur={(event) => {
          field.handleBlur();
          checkboxProps.onBlur?.(event);
        }}
      >
        {children}
      </Checkbox>
    </FieldControl>
  );
}

type SwitchFieldProps = Omit<FieldPresentationProps, "label"> &
  Omit<SwitchProps, "label" | "checked" | "defaultChecked" | "onCheckedChange"> & {
    onCheckedChange?: (checked: boolean) => void;
  };

function SwitchField(props: SwitchFieldProps) {
  const {
    helperText,
    optionalText,
    required,
    errorText,
    invalid,
    children,
    onCheckedChange,
    fieldProps,
    ...switchProps
  } = props;

  const field = useFieldContext<boolean | undefined>();
  const checked = Boolean(field.state.value);

  return (
    <FieldControl
      // switch uses children as label
      helperText={helperText}
      optionalText={optionalText}
      required={required}
      errorText={errorText}
      invalid={invalid}
      {...fieldProps}
    >
      <Switch
        {...switchProps}
        checked={checked}
        name={field.name}
        onCheckedChange={(event) => {
          const nextChecked = Boolean(event.checked);
          field.handleChange(nextChecked);
          onCheckedChange?.(nextChecked);
        }}
        onBlur={(event) => {
          field.handleBlur();
          switchProps.onBlur?.(event);
        }}
      >
        {children}
      </Switch>
    </FieldControl>
  );
}

type SubmitButtonProps = ButtonProps;
function SubmitButton(props: SubmitButtonProps) {
  const { children, ...rest } = props;
  const form = useFormContext();
  const canSubmit = useStore(form.store, (state) => state.canSubmit);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <Button
      type="submit"
      colorPalette="primary"
      loading={isSubmitting}
      disabled={!canSubmit}
      {...rest}
    >
      {children}
    </Button>
  );
}

type CancelButtonProps = ButtonProps & { onCancel: () => unknown };
function CancelButton(props: CancelButtonProps) {
  const { children, variant = "ghost", onCancel, ...rest } = props;
  const form = useFormContext();
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <Button
      variant={variant}
      disabled={isSubmitting}
      onClick={() => {
        form.reset();
        // hack to let form state update and clear dirty flag so dialog doesn't show
        setTimeout(() => onCancel(), 0);
      }}
      {...rest}
    >
      {children}
    </Button>
  );
}

type SubscribedUnsavedChangesDialogProps = Partial<UnsavedChangesDialogProps>;
function SubscribedUnsavedChangesDialog(props: SubscribedUnsavedChangesDialogProps) {
  const form = useFormContext();
  const isDirty = useStore(form.store, (state) => state.isDirty);
  const hasSubmitted = useStore(form.store, (state) => state.isSubmitSuccessful);
  const hasUnsavedChanges = isDirty && !hasSubmitted;
  const { message, ...dialogProps } = props;
  const effectiveMessage = message ?? "You have unsaved changes. Are you sure you want to leave?";
  const { showDialog, handleConfirmNavigation, handleCancelNavigation } =
    useUnsavedChangesProtection({
      hasUnsavedChanges,
      message: effectiveMessage,
    });

  return (
    <UnsavedChangesDialog
      {...dialogProps}
      message={effectiveMessage}
      isOpen={showDialog}
      onConfirm={handleConfirmNavigation}
      onCancel={handleCancelNavigation}
    />
  );
}

export function createAppForm() {
  return createFormHook({
    fieldContext,
    formContext,
    fieldComponents: {
      Field: FieldControl,
      TextInput: TextInputField,
      TextareaInput: TextareaField,
      JsonEditor: lazy(() => import("./form/json-editor")),
      NumberInput: NumberInputField,
      Select: SelectField,
      Checkbox: CheckboxField,
      Switch: SwitchField,
    },
    formComponents: {
      SubmitButton,
      CancelButton,
      SubscribedUnsavedChangesDialog,
    },
  });
}

const appForm = createAppForm();

export const useAppForm = appForm.useAppForm;
export const withForm = appForm.withForm;
export const withFieldGroup = appForm.withFieldGroup;
