import { Box, Code, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { type ChatCompletionMessage, renderTextTemplate } from "@storyforge/inference";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AutosizeTextarea, Button, Dialog, Field, Switch } from "@/components/ui/index";

const EXAMPLE_MESSAGES: ChatCompletionMessage[] = [
  { role: "system", content: "You are StoryForge, a narrative assistant." },
  { role: "user", content: "Summarize the last adventure." },
  { role: "assistant", content: "Certainly! The heroes reclaimed the relic." },
  { role: "tool", content: 'lookup_relic → {"status":"secured"}' },
  {
    role: "assistant",
    content: "Continuing with additional details...",
  },
];

const DEFAULT_TEMPLATE = `{{ messages[0]['content'] }}\n\n{% for message in messages[1:] %}{{ message['role'] | upper }}: {{ message['content'] }}\n{% endfor %}`;

const DEFAULT_PREFIX = EXAMPLE_MESSAGES.at(-1)?.role === "assistant";

export interface JinjaTemplateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialTemplate?: string | null;
  onSave?: (template: string) => void;
}

export function JinjaTemplateDialog({
  isOpen,
  onOpenChange,
  initialTemplate,
  onSave,
}: JinjaTemplateDialogProps) {
  const [template, setTemplate] = useState(initialTemplate ?? DEFAULT_TEMPLATE);
  const [prefix, setPrefix] = useState<boolean>(DEFAULT_PREFIX ?? false);
  const [preview, setPreview] = useState<string>("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  const exampleMessages = useMemo(() => EXAMPLE_MESSAGES, []);

  useEffect(() => {
    if (!isOpen) return;
    setTemplate(initialTemplate ?? DEFAULT_TEMPLATE);
    setPrefix(DEFAULT_PREFIX ?? false);
  }, [initialTemplate, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function updatePreview() {
      setIsRendering(true);
      try {
        const output = await renderTextTemplate(template, {
          messages: exampleMessages,
          prefix,
        });
        if (cancelled) return;
        setPreview(output);
        setRenderError(null);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setRenderError(message);
        setPreview("");
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    }

    updatePreview();
    return () => {
      cancelled = true;
    };
  }, [exampleMessages, isOpen, prefix, template]);

  const handleClose = () => onOpenChange(false);

  const handleSave = () => {
    onSave?.(template);
    handleClose();
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={({ open }) => onOpenChange(open)}
      scrollBehavior="inside"
      size="cover"
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Jinja Template Preview</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <VStack align="stretch" gap={6}>
            <Box>
              <Text fontWeight="medium" mb={1}>
                Available Variables
              </Text>
              <Text fontSize="sm" color="content.muted">
                <Code>messages</Code>: chat history array of <Code>{"{ role, content }"}</Code>;{" "}
                <Code>add_generation_prompt</Code>: <Code>false</Code> while continuing an assistant
                message,
                <Code>true</Code> to start a new one.
              </Text>
            </Box>

            <Field label="Template" required>
              <AutosizeTextarea
                value={template}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  setTemplate(event.target.value)
                }
                minRows={6}
                maxRows={20}
                fontFamily="mono"
                placeholder="Enter Jinja template..."
              />
            </Field>

            <Field
              label="Assistant Prefill"
              helperText="Toggle to preview whether the template continues the last assistant message."
            >
              <Switch
                colorPalette="primary"
                checked={prefix}
                onCheckedChange={({ checked }) => setPrefix(Boolean(checked))}
              >
                {prefix ? "Prefill enabled" : "Prefill disabled"}
              </Switch>
            </Field>

            <Stack direction={{ base: "column", md: "row" }} gap={4} align="stretch">
              <Field label="Example Messages" flex="1">
                <Box borderWidth="1px" borderRadius="md" p={3} bg="surface.muted" height="100%">
                  <pre
                    style={{
                      margin: 0,
                      fontFamily: "var(--chakra-fonts-mono)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {JSON.stringify(exampleMessages, null, 2)}
                  </pre>
                </Box>
              </Field>

              <Field label="Rendered Output" flex="1">
                <Box borderWidth="1px" borderRadius="md" p={3} bg="surface.muted" height="100%">
                  {isRendering ? (
                    <Text fontSize="sm" color="content.muted">
                      Rendering preview...
                    </Text>
                  ) : renderError ? (
                    <Text fontSize="sm" color="danger.fg">
                      {renderError}
                    </Text>
                  ) : (
                    <pre
                      style={{
                        margin: 0,
                        fontFamily: "var(--chakra-fonts-mono)",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {preview}
                    </pre>
                  )}
                </Box>
              </Field>
            </Stack>
          </VStack>
        </Dialog.Body>
        <Dialog.Footer>
          <HStack justify="flex-end" gap={3}>
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </HStack>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
