import {
  Accordion,
  Badge,
  Box,
  Card,
  Code,
  DataList,
  Heading,
  HStack,
  Spinner,
  Stack,
  Tabs,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";
import type { ChatCompletionMessage } from "@storyforge/inference";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useMemo } from "react";
import { Button, Dialog, StreamingMarkdown } from "@/components/ui";
import { useTRPC } from "@/lib/trpc";

interface GenerationInfoDialogProps {
  turnId: string;
  isOpen: boolean;
  onOpenChange: (details: { open: boolean }) => void;
}

interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

const STATUS_LABEL: Record<string, string> = {
  running: "Running",
  finished: "Finished",
  error: "Error",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  running: "yellow",
  finished: "green",
  error: "red",
  cancelled: "gray",
};

export function GenerationInfoDialog({ turnId, isOpen, onOpenChange }: GenerationInfoDialogProps) {
  const trpc = useTRPC();
  const query = useQuery(
    trpc.timeline.generationInfo.queryOptions(
      { turnId },
      { enabled: isOpen, refetchOnMount: "always" }
    )
  );

  const content = useMemo(() => {
    if (query.isLoading) {
      return (
        <Stack align="center" gap={3} py={6}>
          <Spinner size="lg" />
          <Text color="content.muted">Loading generation data…</Text>
        </Stack>
      );
    }

    if (query.isError) {
      return (
        <Box
          color="fg.error"
          bg="bg.error"
          borderRadius="md"
          border="1px solid"
          borderColor="border.error"
          px={4}
          py={3}
        >
          <Text>{query.error?.message ?? "Unable to load generation details."}</Text>
          <Text fontSize="sm" color="fg.error">
            Generation data for old turns is periodically purged to avoid database bloat.
          </Text>
        </Box>
      );
    }

    const data = query.data;
    if (!data) return null;

    const status = data.meta.status;
    const statusLabel = STATUS_LABEL[status] ?? status;
    const statusColor = STATUS_COLOR[status] ?? "gray";

    return (
      <Accordion.Root collapsible width="full" defaultValue={["metadata"]}>
        <Accordion.Item value="metadata">
          <Accordion.ItemTrigger>
            Generation Run Metadata
            <Accordion.ItemIndicator />
          </Accordion.ItemTrigger>
          <Accordion.ItemContent>
            <Accordion.ItemBody>
              <DataList.Root size="sm">
                <DataList.Item>
                  <DataList.ItemLabel>Status</DataList.ItemLabel>
                  <DataList.ItemValue>
                    <Badge colorPalette={statusColor}>{statusLabel}</Badge>
                  </DataList.ItemValue>
                </DataList.Item>
                <DataList.Item>
                  <DataList.ItemLabel>Started</DataList.ItemLabel>
                  <DataList.ItemValue>{data.meta.startedAt.toLocaleString()}</DataList.ItemValue>
                </DataList.Item>
                <DataList.Item>
                  <DataList.ItemLabel>Finished</DataList.ItemLabel>
                  <DataList.ItemValue>
                    {data.meta.finishedAt ? data.meta.finishedAt.toLocaleString() : "—"}
                  </DataList.ItemValue>
                </DataList.Item>
                <DataList.Item>
                  <DataList.ItemLabel>Player Intent</DataList.ItemLabel>
                  <DataList.ItemValue>
                    {data.meta.intentKind || data.meta.intentId || "Unknown"}
                  </DataList.ItemValue>
                </DataList.Item>
                {data.meta.intentConstraint && (
                  <DataList.Item>
                    <DataList.ItemLabel>Guidance Text</DataList.ItemLabel>
                    <DataList.ItemValue>
                      <Text whiteSpace="pre-wrap">{data.meta.intentConstraint}</Text>
                    </DataList.ItemValue>
                  </DataList.Item>
                )}
                <DataList.Item>
                  <DataList.ItemLabel>Target Participant</DataList.ItemLabel>
                  <DataList.ItemValue>
                    {data.meta.participantName || data.meta.participantId || "Unknown"}
                  </DataList.ItemValue>
                </DataList.Item>
                <DataList.Item>
                  <DataList.ItemLabel>Turn Generation Workflow</DataList.ItemLabel>
                  <DataList.ItemValue>{data.workflowName || data.workflowId}</DataList.ItemValue>
                </DataList.Item>
                <DataList.Item>
                  <DataList.ItemLabel>Effect Sequence Number</DataList.ItemLabel>
                  <DataList.ItemValue>{String(data.meta.effectSequence ?? "?")}</DataList.ItemValue>
                </DataList.Item>
              </DataList.Root>
            </Accordion.ItemBody>
          </Accordion.ItemContent>
        </Accordion.Item>

        <Accordion.Item value="steps">
          <Accordion.ItemTrigger>
            Workflow Steps
            <Accordion.ItemIndicator />
          </Accordion.ItemTrigger>
          <Accordion.ItemContent>
            <Accordion.ItemBody>
              <Accordion.Root collapsible width="full" defaultValue={[]}>
                {data.stepOrder.map((stepId, stepIndex) => {
                  const meta = data.stepMetadata[stepId];
                  const prompts = data.prompts[stepId];
                  const response = data.stepResponses[stepId];
                  const apiPayload = data.apiPayloads[stepId];
                  const captured = data.capturedOutputs[stepId];
                  const hints = meta?.hints;

                  const hasRenderedPrompts = Boolean(prompts?.rendered?.length);
                  const hasTransformedPrompts = Boolean(
                    prompts?.transformed && prompts.transformed.length > 0
                  );
                  const hasAnyPrompts = hasRenderedPrompts || hasTransformedPrompts;
                  const hasCapturedOutputs = Boolean(captured && Object.keys(captured).length > 0);
                  const hasHints = hints !== null && hints !== undefined;

                  const tabItems: TabItem[] = [];
                  const templateLabel = meta?.promptTemplateName || `ID: ${meta?.promptTemplateId}`;

                  if (hasRenderedPrompts) {
                    tabItems.push({
                      value: "prompts-rendered",
                      label: "Rendered Prompt",
                      content: (
                        <Stack gap={3} maxH="45vh" overflow="auto">
                          <MessageList messages={prompts?.rendered ?? []} label="Messages List" />
                        </Stack>
                      ),
                    });
                  }

                  if (hasTransformedPrompts) {
                    tabItems.push({
                      value: "prompts-transformed",
                      label: "Transformed Prompt",
                      content: (
                        <Stack gap={3} maxH="45vh" overflow="auto">
                          <MessageList
                            messages={prompts?.transformed ?? []}
                            label="Messages List (After Transforms)"
                          />
                        </Stack>
                      ),
                    });
                  }

                  if (!hasAnyPrompts) {
                    tabItems.push({
                      value: "prompts",
                      label: "Prompts",
                      content: (
                        <Text fontSize="sm" color="content.muted">
                          No prompts recorded.
                        </Text>
                      ),
                    });
                  }

                  tabItems.push({
                    value: "response",
                    label: "Response",
                    content: response ? (
                      <Box maxH="45vh" overflow="auto">
                        <JsonBlock value={response} />
                      </Box>
                    ) : (
                      <Text fontSize="sm" color="content.muted">
                        No response captured.
                      </Text>
                    ),
                  });

                  tabItems.push({
                    value: "api",
                    label: "Raw API Request",
                    content: apiPayload ? (
                      <Box maxH="45vh" overflow="auto">
                        <JsonBlock value={apiPayload} />
                      </Box>
                    ) : (
                      <Text fontSize="sm" color="content.muted">
                        Not available.
                      </Text>
                    ),
                  });

                  if (hasCapturedOutputs) {
                    tabItems.push({
                      value: "captured",
                      label: "Captured Outputs",
                      content: (
                        <Box maxH="45vh" overflow="auto">
                          <JsonBlock value={captured} />
                        </Box>
                      ),
                    });
                  }

                  if (hasHints) {
                    tabItems.push({
                      value: "hints",
                      label: "Hints",
                      content: (
                        <Box maxH="45vh" overflow="auto">
                          <JsonBlock value={hints} />
                        </Box>
                      ),
                    });
                  }

                  const defaultTab = tabItems[0]?.value ?? "prompts";

                  return (
                    <Accordion.Item key={stepId} value={stepId}>
                      <Accordion.ItemTrigger>
                        <Stack gap={1} align="flex-start" width="full">
                          <Heading size="sm">
                            {`Step #${stepIndex + 1} - ${meta?.name || `ID: ${stepId}`}`}
                          </Heading>
                          {meta?.modelProfileName || meta?.modelId ? (
                            <Text fontSize="sm" color="content.muted">
                              {`Model: ${meta?.modelProfileName || "Unknown"} (${meta?.modelId ?? "unknown"})`}
                            </Text>
                          ) : null}
                          {templateLabel ? (
                            <Text fontSize="sm" color="content.muted">
                              {`Template: ${templateLabel}`}
                            </Text>
                          ) : null}
                        </Stack>
                        <Accordion.ItemIndicator />
                      </Accordion.ItemTrigger>
                      <Accordion.ItemContent>
                        <Accordion.ItemBody>
                          <Card.Root layerStyle="surface" width="full">
                            <Tabs.Root defaultValue={defaultTab}>
                              <Tabs.List>
                                {tabItems.map((tab) => (
                                  <Tabs.Trigger key={tab.value} value={tab.value}>
                                    {tab.label}
                                  </Tabs.Trigger>
                                ))}
                              </Tabs.List>

                              {tabItems.map((tab) => (
                                <Tabs.Content key={tab.value} value={tab.value} p={4}>
                                  {tab.content}
                                </Tabs.Content>
                              ))}
                            </Tabs.Root>
                          </Card.Root>
                        </Accordion.ItemBody>
                      </Accordion.ItemContent>
                    </Accordion.Item>
                  );
                })}
              </Accordion.Root>
            </Accordion.ItemBody>
          </Accordion.ItemContent>
        </Accordion.Item>

        <Accordion.Item value="final-outputs">
          <Accordion.ItemTrigger>
            Workflow Outputs
            <Accordion.ItemIndicator />
          </Accordion.ItemTrigger>
          <Accordion.ItemContent>
            <Accordion.ItemBody>
              <Box>
                <OutputsBlock outputs={data.finalOutputs} />
              </Box>
            </Accordion.ItemBody>
          </Accordion.ItemContent>
        </Accordion.Item>
      </Accordion.Root>
    );
  }, [query.isLoading, query.isError, query.data, query.error]);

  const isMobile = useBreakpointValue({ base: true, md: false });

  return (
    <Dialog.Root
      lazyMount
      open={isOpen}
      onOpenChange={onOpenChange}
      scrollBehavior="inside"
      size={isMobile ? "full" : "cover"}
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Generation Info</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>{content}</Dialog.Body>
        <Dialog.Footer>
          <Dialog.ActionTrigger asChild>
            <Button variant="outline">Close</Button>
          </Dialog.ActionTrigger>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function MessageList({ messages, label }: { messages: ChatCompletionMessage[]; label: string }) {
  if (!messages.length) return null;
  return (
    <Stack gap={2}>
      <Text fontWeight="medium" fontSize="sm">
        {label}
      </Text>
      {messages.map((message) => {
        const key = `${message.role ?? "?"}-${message.content ?? ""}`;
        return (
          <Box key={key} layerStyle="subtle" borderRadius="md" p={2}>
            <HStack gap={2} mb={1}>
              <Badge variant="subtle">{String(message.role ?? "?")}</Badge>
            </HStack>
            <Code as="pre" display="block" whiteSpace="pre-wrap" width="full">
              {String(message.content ?? "")}
            </Code>
          </Box>
        );
      })}
    </Stack>
  );
}

function OutputsBlock({ outputs }: { outputs: Record<string, unknown> }) {
  const keys = Object.keys(outputs);
  if (!keys.length) {
    return (
      <Text fontSize="sm" color="content.muted">
        No outputs captured.
      </Text>
    );
  }

  return (
    <Stack gap={4}>
      {keys.map((key) => (
        <Box key={key} bg="bg.muted" p={3} borderRadius="md">
          <Text fontWeight="medium" mb={1}>
            {key}
          </Text>
          <StreamingMarkdown text={String(outputs[key])} />
        </Box>
      ))}
    </Stack>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <Code as="pre" display="block" whiteSpace="pre-wrap" width="full" p={3}>
      {JSON.stringify(value, null, 2)}
    </Code>
  );
}
