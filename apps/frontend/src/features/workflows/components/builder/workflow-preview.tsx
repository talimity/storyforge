import {
  Accordion,
  Badge,
  Box,
  Card,
  Code,
  createListCollection,
  Heading,
  HStack,
  Input,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { WorkflowTestRunInput } from "@storyforge/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { LuEye, LuPlay } from "react-icons/lu";
import {
  Button,
  Field,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui";
import { TabHeader } from "@/components/ui/tab-header";
import { CharacterSingleSelect } from "@/features/characters/components/character-selector";
import { ScenarioSingleSelect } from "@/features/scenarios/components/scenario-selector";
import { useTRPC } from "@/lib/trpc";
import type { WorkflowFormValues } from "./form-schemas";

type Props = {
  values: WorkflowFormValues;
};

type ChapterOption = {
  value: string;
  label: string;
  state: string;
};

export function WorkflowPreviewTab({ values }: Props) {
  const trpc = useTRPC();
  const [scenarioId, setScenarioId] = useState<string | undefined>(undefined);
  const [characterId, setCharacterId] = useState<string | undefined>(undefined);
  const [closingEventId, setClosingEventId] = useState<string | undefined>(undefined);
  const [guidance, setGuidance] = useState("");
  const [mockByStep, setMockByStep] = useState<Record<string, string>>({});

  const isTurnGeneration = values.task === "turn_generation";
  const isChapterSummarization = values.task === "chapter_summarization";

  useEffect(() => {
    setGuidance("");
    setCharacterId(undefined);
    setClosingEventId(undefined);
  }, []);

  useEffect(() => {
    setCharacterId(undefined);
    setClosingEventId(undefined);
  }, []);

  const chapterStatuses = useQuery({
    ...trpc.chapterSummaries.listForPath.queryOptions({ scenarioId: scenarioId ?? "" }),
    enabled: isChapterSummarization && Boolean(scenarioId),
  });

  const chapterOptions: ChapterOption[] = useMemo(() => {
    const summaries = chapterStatuses.data?.summaries ?? [];
    return summaries
      .filter((summary) => summary.closingEventId)
      .map((summary) => ({
        value: summary.closingEventId || "",
        label: `Chapter ${summary.chapterNumber}${summary.title ? ` - ${summary.title}` : ""}`,
        state: summary.state,
      }));
  }, [chapterStatuses.data]);

  useEffect(() => {
    if (!isChapterSummarization) {
      return;
    }
    if (chapterOptions.length === 0) {
      setClosingEventId(undefined);
      return;
    }
    if (!closingEventId || !chapterOptions.some((option) => option.value === closingEventId)) {
      setClosingEventId(chapterOptions[0].value);
    }
  }, [isChapterSummarization, chapterOptions, closingEventId]);

  const mockConfig = useMemo(() => {
    const entries = Object.entries(mockByStep)
      .map(([stepId, text]) => [stepId, text.trim()])
      .filter(([, text]) => text.length > 0);
    if (entries.length === 0) return undefined;
    return { stepResponses: Object.fromEntries(entries) };
  }, [mockByStep]);

  const payload = useMemo<WorkflowTestRunInput | null>(() => {
    if (!scenarioId || !values.steps || values.steps.length === 0) {
      return null;
    }

    if (isTurnGeneration) {
      if (!characterId) return null;
      const payload: WorkflowTestRunInput = {
        scenarioId,
        task: "turn_generation",
        characterId,
        workflow: {
          task: "turn_generation",
          name: values.name,
          description: values.description || undefined,
          steps: values.steps,
        },
        intent: { kind: "guided_control", text: guidance || undefined },
        mock: mockConfig,
        options: { captureTransformedPrompts: true },
      };
      return payload;
    }

    if (isChapterSummarization) {
      if (!closingEventId) return null;
      const payload: WorkflowTestRunInput = {
        scenarioId,
        task: "chapter_summarization",
        closingEventId,
        workflow: {
          task: "chapter_summarization",
          name: values.name,
          description: values.description || undefined,
          steps: values.steps,
        },
        mock: mockConfig,
        options: { captureTransformedPrompts: true },
      };
      return payload;
    }

    return null;
  }, [
    scenarioId,
    characterId,
    closingEventId,
    values.name,
    values.description,
    values.steps,
    guidance,
    mockConfig,
    isTurnGeneration,
    isChapterSummarization,
  ]);

  const isRunnable =
    Boolean(scenarioId && values.steps?.length) &&
    ((isTurnGeneration && characterId) || (isChapterSummarization && closingEventId));

  const runHint = isTurnGeneration
    ? "Select a scenario and active character first"
    : "Select a scenario and chapter closing event first";

  const run = useMutation(trpc.workflows.testRun.mutationOptions());

  const onRun = () => {
    if (!payload) return;
    run.mutate(payload);
  };

  return (
    <Stack gap={6}>
      <TabHeader
        title="Preview"
        description="Check prompts and outputs without real API calls"
        icon={LuEye}
      />

      <Card.Root p={4} layerStyle="surface">
        <Stack gap={4}>
          <HStack gap={4} align="flex-start">
            <Field label="Scenario" helperText="Choose a scenario to test">
              <ScenarioSingleSelect value={scenarioId} onChange={setScenarioId} />
            </Field>

            {isTurnGeneration && (
              <Field label="Active Character" helperText="Choose target character">
                <CharacterSingleSelect
                  disabled={!scenarioId}
                  value={characterId}
                  onChange={setCharacterId}
                  filterMode={scenarioId ? "inScenario" : "all"}
                  scenarioId={scenarioId ?? undefined}
                />
              </Field>
            )}

            {isChapterSummarization && (
              <Field
                label="Target Chapter"
                helperText="Choose the chapter closing event to summarize"
              >
                <Stack gap={1} minW="240px">
                  <SelectRoot
                    collection={createListCollection({ items: chapterOptions })}
                    value={closingEventId ? [closingEventId] : []}
                    onValueChange={(details: { value: string[] }) =>
                      setClosingEventId(details.value[0] ?? undefined)
                    }
                    disabled={chapterStatuses.isLoading || chapterOptions.length === 0}
                    size="md"
                  >
                    <SelectTrigger>
                      <SelectValueText
                        placeholder={
                          chapterStatuses.isLoading ? "Loading chapters..." : "Select chapter"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {chapterOptions.map((option) => (
                        <SelectItem key={option.value} item={option}>
                          {option.label}
                          {option.state !== "ready" ? ` (${option.state})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectRoot>
                  {!chapterStatuses.isLoading && chapterOptions.length === 0 && (
                    <Text color="content.muted" fontSize="sm">
                      No chapters found on the active timeline.
                    </Text>
                  )}
                </Stack>
              </Field>
            )}
          </HStack>

          {isTurnGeneration && (
            <Field
              label="Guidance (optional)"
              helperText="Simulates a player's input to guide the model"
            >
              <Input
                value={guidance}
                onChange={(e) => setGuidance(e.target.value)}
                placeholder="e.g. Keep it witty"
              />
            </Field>
          )}

          <Separator />

          <Heading size="sm">Mock Responses (optional)</Heading>
          <Text color="content.muted" fontSize="sm">
            Override the fake model responses for each step. Useful for testing multi-step workflows
            that pass outputs to the next step.
          </Text>

          <Stack gap={3}>
            {values.steps.map((s, i) => (
              <Field key={s.id} label={`Step #${i + 1}${s.name ? ` - ${s.name}` : ""}`}>
                <Input
                  value={mockByStep[s.id] ?? ""}
                  onChange={(e) => setMockByStep((m) => ({ ...m, [s.id]: e.target.value }))}
                  placeholder="Optional fake response for this step"
                />
              </Field>
            ))}
          </Stack>

          <HStack>
            <Button
              onClick={onRun}
              colorPalette="primary"
              disabled={!isRunnable}
              loading={run.isPending}
            >
              <LuPlay /> Run Test
            </Button>
            {!isRunnable && (
              <Text color="content.muted" fontSize="sm">
                {runHint}
              </Text>
            )}
          </HStack>
        </Stack>
      </Card.Root>

      {run.error && (
        <Box
          color="fg.error"
          bg="red.50"
          border="1px solid"
          borderColor="red.200"
          px={3}
          py={2}
          borderRadius="md"
        >
          Failed: {run.error.message}
        </Box>
      )}

      {run.data && (
        <Stack gap={6}>
          <Heading size="sm">Results</Heading>

          <Accordion.Root collapsible width="full" defaultValue={["prompts", "outputs"]}>
            <Accordion.Item value="prompts">
              <Accordion.ItemTrigger>
                <Heading size="sm">Prompts by Step</Heading>
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                <Accordion.ItemBody>
                  <Stack gap={4}>
                    {run.data.stepOrder.map((stepId) => {
                      const p = run.data?.prompts[stepId];
                      return (
                        <Card.Root
                          key={stepId}
                          p={4}
                          layerStyle="subtle"
                          overflow="auto"
                          maxH="50vh"
                        >
                          <HStack justify="space-between" mb={2}>
                            <Heading size="sm">{stepId}</Heading>
                            <Badge>{p ? "captured" : "missing"}</Badge>
                          </HStack>
                          {p?.rendered && (
                            <Box>
                              <Text fontWeight="medium" mb={1}>
                                Rendered
                              </Text>
                              <MessageList messages={p.rendered} />
                            </Box>
                          )}
                          {p?.transformed && p.transformed.length > 0 && (
                            <Box mt={3}>
                              <Text fontWeight="medium" mb={1}>
                                After Transforms
                              </Text>
                              <MessageList messages={p.transformed} />
                            </Box>
                          )}
                        </Card.Root>
                      );
                    })}
                  </Stack>
                </Accordion.ItemBody>
              </Accordion.ItemContent>
            </Accordion.Item>

            <Accordion.Item value="responses">
              <Accordion.ItemTrigger>
                <Heading size="sm">Step Responses</Heading>
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                <Accordion.ItemBody>
                  <Stack gap={4}>
                    {run.data.stepOrder.map((stepId) => {
                      const r = run.data?.stepResponses[stepId];
                      return (
                        <Card.Root key={stepId} p={4} layerStyle="subtle">
                          <Heading size="sm" mb={2}>
                            {stepId}
                          </Heading>
                          {r?.message?.content ? (
                            <Box>
                              <Text fontWeight="medium" mb={1}>
                                Assistant
                              </Text>
                              <Code as="pre" display="block" whiteSpace="pre-wrap" p={3}>
                                {r.message.content}
                              </Code>
                            </Box>
                          ) : (
                            <Text color="content.muted">No content</Text>
                          )}
                        </Card.Root>
                      );
                    })}
                  </Stack>
                </Accordion.ItemBody>
              </Accordion.ItemContent>
            </Accordion.Item>

            <Accordion.Item value="outputs">
              <Accordion.ItemTrigger>
                <Heading size="sm">Final Outputs</Heading>
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                <Accordion.ItemBody>
                  <JsonBlock value={run.data.finalOutputs} />
                </Accordion.ItemBody>
              </Accordion.ItemContent>
            </Accordion.Item>

            <Accordion.Item value="events">
              <Accordion.ItemTrigger>
                <Heading size="sm">Event Log</Heading>
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                <Accordion.ItemBody>
                  <JsonBlock value={run.data.events} />
                </Accordion.ItemBody>
              </Accordion.ItemContent>
            </Accordion.Item>
          </Accordion.Root>
        </Stack>
      )}
    </Stack>
  );
}

function MessageList({
  messages,
}: {
  messages: Array<{ role?: string; content?: string; prefix?: boolean }>;
}) {
  return (
    <Stack gap={2}>
      {messages.map((m, i) => (
        <Box key={String(`msg${i}`)}>
          <HStack gap={2}>
            <Badge variant="subtle">{m.role || "?"}</Badge>
            {m.prefix && <Badge colorPalette="yellow">prefill</Badge>}
          </HStack>
          <Code as="pre" display="block" whiteSpace="pre-wrap" p={2} mt={1}>
            {m.content || ""}
          </Code>
        </Box>
      ))}
    </Stack>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <Code as="pre" display="block" whiteSpace="pre-wrap" p={3} width="full">
      {JSON.stringify(value, null, 2)}
    </Code>
  );
}
