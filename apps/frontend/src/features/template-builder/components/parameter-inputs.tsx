import {
  createListCollection,
  HStack,
  NumberInput,
  Text,
} from "@chakra-ui/react";
import {
  Field,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  Switch,
} from "@/components/ui/index";
import type { TemplateVariable } from "@/features/template-builder/components/template-string-editor";
import { TemplateStringEditor } from "@/features/template-builder/components/template-string-editor";
import type { RecipeParamSpec } from "@/features/template-builder/types";

interface BaseParameterInputProps {
  param: RecipeParamSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  isInvalid?: boolean;
  errorText?: string;
}

/**
 * Number parameter input with optional min/max constraints
 */
export function NumberParameterInput({
  param,
  value,
  onChange,
  isInvalid = false,
  errorText,
}: BaseParameterInputProps) {
  const numericValue =
    typeof value === "number" ? value : Number(param.defaultValue) || 0;

  const formatDisplay = (val: number): string => {
    // Special formatting for common parameter types
    if (
      param.key.toLowerCase().includes("token") ||
      param.key.toLowerCase().includes("budget")
    ) {
      return `${val} tokens`;
    }
    if (
      param.key.toLowerCase().includes("max") ||
      param.key.toLowerCase().includes("limit")
    ) {
      return `${val} items`;
    }
    return val.toString();
  };

  return (
    <Field
      label={param.label}
      helperText={param.help}
      errorText={errorText}
      invalid={isInvalid}
      required
    >
      <HStack gap={3}>
        <NumberInput.Root
          value={String(numericValue)}
          onValueChange={({ valueAsNumber }) => {
            const n = Number.isFinite(valueAsNumber)
              ? valueAsNumber
              : (param.min ?? 0);
            onChange(n);
          }}
          min={param.min}
          max={param.max}
          step={getStepForParam(param)}
          allowMouseWheel
          flex={1}
          invalid={isInvalid}
        >
          <NumberInput.Input />
          <NumberInput.Control>
            <NumberInput.IncrementTrigger />
            <NumberInput.DecrementTrigger />
          </NumberInput.Control>
        </NumberInput.Root>

        {/* Display formatted value for context */}
        <Text fontSize="sm" color="content.muted" minW="fit-content">
          {formatDisplay(numericValue)}
        </Text>
      </HStack>
    </Field>
  );
}

/**
 * Select parameter input with predefined options
 */
export function SelectParameterInput({
  param,
  value,
  onChange,
  isInvalid = false,
  errorText,
}: BaseParameterInputProps) {
  const stringValue = value?.toString() || param.defaultValue?.toString() || "";

  return (
    <Field
      label={param.label}
      helperText={param.help}
      errorText={errorText}
      invalid={isInvalid}
      required
    >
      <SelectRoot
        value={[stringValue]}
        onValueChange={(details) => {
          const selected = details.value[0];
          const typed = param.options?.find(
            (o) => o.value.toString() === selected
          )?.value;
          onChange(typed ?? selected);
        }}
        invalid={isInvalid}
        collection={createListCollection({
          items:
            param.options?.map((option) => ({
              label: option.label,
              value: option.value.toString(),
            })) || [],
        })}
      >
        <SelectTrigger>
          <SelectValueText placeholder="Select an option..." />
        </SelectTrigger>
        <SelectContent>
          {param.options?.map((option) => (
            <SelectItem
              key={option.value.toString()}
              item={option.value.toString()}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    </Field>
  );
}

/**
 * Toggle/boolean parameter input
 */
export function ToggleParameterInput({
  param,
  value,
  onChange,
  isInvalid = false,
  errorText,
}: BaseParameterInputProps) {
  const booleanValue =
    typeof value === "boolean" ? value : !!param.defaultValue || false;

  return (
    <Field
      label={param.label}
      helperText={param.help}
      errorText={errorText}
      invalid={isInvalid}
    >
      <Switch
        checked={booleanValue}
        onCheckedChange={(details) => onChange(details.checked)}
        invalid={isInvalid}
      >
        {booleanValue ? "Enabled" : "Disabled"}
      </Switch>
    </Field>
  );
}

/**
 * Template string parameter input with variable support
 */
interface TemplateStringParameterInputProps extends BaseParameterInputProps {
  availableVariables?: TemplateVariable[];
}

export function TemplateStringParameterInput({
  param,
  value,
  onChange,
  availableVariables = [],
  isInvalid = false,
  errorText,
}: TemplateStringParameterInputProps) {
  const stringValue =
    typeof value === "string" ? value : String(param.defaultValue) || "";

  return (
    <TemplateStringEditor
      label={param.label}
      help={param.help}
      value={stringValue}
      onChange={(newValue) => onChange(newValue)}
      availableVariables={availableVariables}
      placeholder="Enter template string..."
      isInvalid={isInvalid}
      errorText={errorText}
    />
  );
}

/**
 * Generic parameter input component that renders the appropriate input type
 */
interface ParameterInputProps {
  param: RecipeParamSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  availableVariables?: TemplateVariable[];
  isInvalid?: boolean;
  errorText?: string;
}

export function ParameterInput({
  param,
  value,
  onChange,
  availableVariables = [],
  isInvalid = false,
  errorText,
}: ParameterInputProps) {
  const commonProps = {
    param,
    value,
    onChange,
    isInvalid,
    errorText,
  };

  switch (param.type) {
    case "number":
      return <NumberParameterInput {...commonProps} />;

    case "select":
      return <SelectParameterInput {...commonProps} />;

    case "toggle":
      return <ToggleParameterInput {...commonProps} />;

    case "template_string":
      return (
        <TemplateStringParameterInput
          {...commonProps}
          availableVariables={availableVariables}
        />
      );

    default:
      return (
        <Field
          label={param.label}
          helperText={`Unsupported parameter type: ${param.type}`}
          invalid={true}
        >
          <Text color="red.600" fontSize="sm">
            Unknown parameter type: {param.type}
          </Text>
        </Field>
      );
  }
}

/**
 * Get appropriate step value for numeric parameters
 */
function getStepForParam(param: RecipeParamSpec): number {
  // For token/budget related parameters, use larger steps
  if (
    param.key.toLowerCase().includes("token") ||
    param.key.toLowerCase().includes("budget")
  ) {
    if (param.max && param.max > 1000) return 50;
    if (param.max && param.max > 100) return 10;
    return 5;
  }

  // For count/limit parameters, use step of 1
  if (
    param.key.toLowerCase().includes("max") ||
    param.key.toLowerCase().includes("limit")
  ) {
    return 1;
  }

  // For priority or small ranges, use step of 1
  if (param.max && param.max <= 20) {
    return 1;
  }

  // Default step
  return 1;
}
