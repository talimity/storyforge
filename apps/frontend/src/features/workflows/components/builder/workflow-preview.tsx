import {
  Accordion,
  Badge,
  Box,
  Card,
  Code,
  Heading,
  HStack,
  Input,
  Separator,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LuEye, LuPlay } from "react-icons/lu";
import { Button, Field } from "@/components/ui";
import { CharacterSingleSelect } from "@/features/characters/components/character-selector";
import { ScenarioSingleSelect } from "@/features/scenarios/components/scenario-selector";
import { useTRPC } from "@/lib/trpc";
import type { WorkflowFormValues } from "./schemas";

type Props = {
  values: WorkflowFormValues;
};

export function WorkflowPreviewTab({ values }: Props) {
  const trpc = useTRPC();
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [guidance, setGuidance] = useState("");
  const [mockByStep, setMockByStep] = useState<Record<string, string>>({});

  const isRunnable = Boolean(scenarioId && characterId && values?.steps?.length);

  const payload = useMemo(() => {
    if (!scenarioId || !characterId) return null;
    return {
      scenarioId,
      characterId,
      task: values.task,
      workflow: {
        task: values.task,
        name: values.name,
        description: values.description || undefined,
        steps: values.steps,
      },
      intent: { kind: "guided_control" as const, text: guidance || undefined },
      mock: Object.keys(mockByStep).length
        ? {
            stepResponses: Object.fromEntries(
              Object.entries(mockByStep).filter(([, t]) => t?.trim())
            ),
          }
        : undefined,
      options: { captureTransformedPrompts: true },
    };
  }, [scenarioId, characterId, values, guidance, mockByStep]);

  const run = useMutation(trpc.workflows.testRun.mutationOptions());

  const onRun = () => {
    if (!payload) return;
    run.mutate(payload);
  };

  return (
    <Stack gap={6}>
      <HStack gap={3}>
        <LuEye size={20} />
        <VStack align="start" gap={0}>
          <Heading size="md">Preview</Heading>
          <Text color="content.muted" fontSize="sm">
            Check workflow outputs and events with a fake model
          </Text>
        </VStack>
      </HStack>

      <Card.Root p={4} layerStyle="surface">
        <Stack gap={4}>
          <HStack gap={4} align="flex-start">
            <Field label="Scenario" helperText="Choose a scenario to test">
              <ScenarioSingleSelect value={scenarioId} onChange={setScenarioId} />
            </Field>
            <Field label="Active Character" helperText="Choose target character">
              <CharacterSingleSelect
                disabled={!scenarioId}
                value={characterId}
                onChange={setCharacterId}
                filterMode={scenarioId ? "inScenario" : "all"}
                scenarioId={scenarioId ?? undefined}
              />
            </Field>
          </HStack>

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
                Select a scenario and active character first
              </Text>
            )}
          </HStack>
        </Stack>
      </Card.Root>

      {run.error && (
        <Box
          color="red.600"
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
                        <Card.Root key={stepId} p={4} layerStyle="subtle">
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
