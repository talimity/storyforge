import { Badge, Box, HStack, Icon, Input, Text, Textarea, VStack } from "@chakra-ui/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { LuCheck, LuChevronDown, LuChevronUp, LuCode, LuCopy } from "react-icons/lu";
import { Button, Field, Tooltip } from "@/components/ui";

export interface TemplateVariable {
  name: string;
  description: string;
  example?: string;
  category?: string;
}

interface TemplateStringEditorProps {
  value: string;
  onChange: (value: string) => void;
  availableVariables?: TemplateVariable[];
  placeholder?: string;
  label?: string;
  help?: string;
  isInvalid?: boolean;
  errorText?: string;
  rows?: number;
  maxRows?: number;
}

export function TemplateStringEditor({
  value,
  onChange,
  availableVariables = [],
  placeholder = "Use {{variable}} for interpolation",
  label,
  help,
  isInvalid = false,
  errorText,
}: TemplateStringEditorProps) {
  const [showVariables, setShowVariables] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter variables based on search
  const filteredVariables = useMemo(() => {
    if (!searchQuery) return availableVariables;

    const query = searchQuery.toLowerCase();
    return availableVariables.filter(
      (variable) =>
        variable.name.toLowerCase().includes(query) ||
        variable.description.toLowerCase().includes(query) ||
        variable.category?.toLowerCase().includes(query)
    );
  }, [availableVariables, searchQuery]);

  // Group variables by category
  const groupedVariables = useMemo(() => {
    const groups: Record<string, TemplateVariable[]> = {};

    for (const variable of filteredVariables) {
      const category = variable.category || "Other";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(variable);
    }

    return groups;
  }, [filteredVariables]);

  // Copy variable name to clipboard
  const copyVariable = useCallback(async (varName: string) => {
    try {
      await navigator.clipboard.writeText(`{{${varName}}}`);
      setCopiedVariable(varName);
      setTimeout(() => setCopiedVariable(null), 2000);
    } catch (error) {
      console.error("Failed to copy variable:", error);
    }
  }, []);

  return (
    <Field label={label} helperText={help} errorText={errorText} invalid={isInvalid}>
      <VStack align="stretch" gap={3} width="full">
        {/* Main textarea */}
        <Box position="relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            fontFamily="mono"
            fontSize="sm"
            maxH={64}
            resize="vertical"
            autoresize
            borderColor={isInvalid ? "red.300" : "surface.border"}
            _focus={{
              borderColor: isInvalid ? "fg.error" : "accent.500",
              boxShadow: isInvalid ? "0 0 0 1px red.500" : "0 0 0 1px accent.500",
            }}
          />
        </Box>

        {/* Controls */}
        <HStack justify="space-between">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowVariables(!showVariables)}
            disabled={availableVariables.length === 0}
          >
            <Icon as={LuCode} />
            {showVariables ? "Hide" : "Show"} Variable Reference
            <Icon as={showVariables ? LuChevronUp : LuChevronDown} />
          </Button>
        </HStack>

        {/* Variable panel */}
        {showVariables && availableVariables.length > 0 && (
          <Box
            bg="surface.subtle"
            borderRadius="md"
            border="1px solid"
            borderColor="surface.border"
            p={4}
          >
            <VStack align="stretch" gap={3}>
              {/* Search */}
              <Input
                placeholder="Search variables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="sm"
              />

              {/* Variable groups */}
              {Object.keys(groupedVariables).length === 0 ? (
                <Text fontSize="sm" color="content.muted" textAlign="center" py={4}>
                  No variables found
                </Text>
              ) : (
                <VStack align="stretch" gap={4} maxH="300px" overflowY="auto">
                  {Object.entries(groupedVariables).map(([category, variables]) => (
                    <VStack key={category} align="stretch" gap={2}>
                      <Text fontSize="sm" fontWeight="medium" color="content.emphasized">
                        {category}
                      </Text>
                      <VStack align="stretch" gap={1}>
                        {variables.map((variable) => (
                          <VariableCard
                            key={variable.name}
                            variable={variable}
                            onCopy={() => copyVariable(variable.name)}
                            isCopied={copiedVariable === variable.name}
                          />
                        ))}
                      </VStack>
                    </VStack>
                  ))}
                </VStack>
              )}
            </VStack>
          </Box>
        )}
      </VStack>
    </Field>
  );
}

interface VariableCardProps {
  variable: TemplateVariable;
  onCopy: () => void;
  isCopied: boolean;
}

function VariableCard({ variable, onCopy, isCopied }: VariableCardProps) {
  return (
    <HStack
      bg="surface"
      borderRadius="md"
      p={3}
      justify="space-between"
      align="start"
      transition="all 0.2s"
      _hover={{ bg: "surface.muted" }}
    >
      <VStack align="start" gap={1} flex={1} minW={0}>
        <HStack gap={2}>
          <Badge size="sm" fontFamily="mono" colorPalette="neutral" variant="subtle">
            {variable.name}
          </Badge>
        </HStack>

        <Text fontSize="xs" color="content.muted" lineClamp={2}>
          {variable.description}
        </Text>

        {variable.example && (
          <Text fontSize="xs" color="content.subtle" fontStyle="italic">
            Example: {variable.example}
          </Text>
        )}
      </VStack>

      <HStack gap={1}>
        <Tooltip content={isCopied ? "Copied!" : "Copy to clipboard"}>
          <Button
            size="xs"
            variant="ghost"
            onClick={onCopy}
            colorPalette={isCopied ? "green" : "neutral"}
          >
            <Icon as={isCopied ? LuCheck : LuCopy} />
          </Button>
        </Tooltip>
      </HStack>
    </HStack>
  );
}
