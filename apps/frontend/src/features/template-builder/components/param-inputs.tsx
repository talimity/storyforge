import { Text } from "@chakra-ui/react";
import {
  TemplateStringEditor,
  type TemplateVariable,
} from "@/features/template-builder/components/template-string-editor";
import type { RecipeParamSpec } from "@/features/template-builder/types";
import { withFieldGroup } from "@/lib/app-form";

type ParamInputsProps = {
  specs: readonly RecipeParamSpec[];
};

export const ParamInputGroup = withFieldGroup({
  defaultValues: { items: {} as Record<string, unknown> },
  props: { specs: [] } satisfies ParamInputsProps as ParamInputsProps,
  render: function Render({ group, specs }) {
    return (
      <>
        {specs.map((param) => (
          <group.AppField key={param.key} name={`items.${param.key}`}>
            {(field) => {
              switch (param.type) {
                case "number":
                  return (
                    <field.NumberInput
                      label={param.label}
                      helperText={param.help}
                      min={param.min}
                      max={param.max}
                      step={getNumberStep(param)}
                    />
                  );
                case "toggle":
                  return <field.Switch helperText={param.help}>{param.label}</field.Switch>;
                case "select":
                  return (
                    <field.Select
                      label={param.label}
                      helperText={param.help}
                      options={(param.options ?? []).map((o) => ({
                        label: o.label,
                        value: String(o.value),
                      }))}
                    />
                  );
                case "template_string":
                  return (
                    <field.TextareaInput
                      label={param.label}
                      helperText={param.help}
                      placeholder="Enter template string"
                      autosize
                      minRows={3}
                    />
                  );
                default:
                  return (
                    <Text color="fg.error" fontSize="sm">
                      Unknown parameter type: {param.type}
                    </Text>
                  );
              }
            }}
          </group.AppField>
        ))}
      </>
    );
  },
});

function getNumberStep(param: RecipeParamSpec): number {
  if (param.key.toLowerCase().includes("token") || param.key.toLowerCase().includes("budget")) {
    if (param.max && param.max > 1000) return 50;
    if (param.max && param.max > 100) return 10;
    return 5;
  }

  if (param.key.toLowerCase().includes("max") || param.key.toLowerCase().includes("limit")) {
    return 1;
  }

  if (param.max && param.max <= 20) {
    return 1;
  }

  return 1;
}

// TODO: do something with this
/**
 * Template string parameter input with variable support
 */
interface TemplateStringParameterInputProps {
  param: RecipeParamSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  isInvalid?: boolean;
  errorText?: string;
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
  const stringValue = typeof value === "string" ? value : String(param.defaultValue) || "";

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
