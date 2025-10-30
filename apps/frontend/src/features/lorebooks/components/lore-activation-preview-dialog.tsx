import { Box, Card, HStack, Separator, Spinner, Stack, Tabs, Text } from "@chakra-ui/react";
import type {
  ActivatedLoreEntryContract,
  LorebookEvaluationTraceContract,
} from "@storyforge/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button, Switch } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { ScenarioSingleSelect } from "@/features/scenarios/components/scenario-selector";
import { useTRPC } from "@/lib/trpc";

interface LoreActivationPreviewDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioId?: string;
  leafTurnId?: string;
  allowScenarioSelect?: boolean;
  title?: string;
}

export function LoreActivationPreviewDialog({
  isOpen,
  onOpenChange,
  scenarioId,
  leafTurnId,
  allowScenarioSelect = false,
  title = "Lore Activation Preview",
}: LoreActivationPreviewDialogProps) {
  const trpc = useTRPC();
  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarioId);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    if (scenarioId) {
      setSelectedScenarioId(scenarioId);
    }
  }, [scenarioId]);

  const canPreview = Boolean(selectedScenarioId);

  const activationQueryOptions = trpc.scenarioLorebooks.activated.queryOptions(
    {
      scenarioId: selectedScenarioId ?? "",
      leafTurnId,
      debug: debugMode,
    },
    { enabled: isOpen && canPreview, staleTime: 1 }
  );

  const activationQuery = useQuery(activationQueryOptions);

  const lorebooksQueryOptions = trpc.scenarioLorebooks.list.queryOptions(
    { id: selectedScenarioId ?? "" },
    { enabled: isOpen && canPreview }
  );

  const lorebooksQuery = useQuery(lorebooksQueryOptions);

  const lorebookNames = useMemo(() => {
    const entries = lorebooksQuery.data?.lorebooks ?? [];
    const map = new Map<string, string>();
    for (const lorebook of entries) {
      map.set(lorebook.lorebookId, lorebook.name);
    }
    return map;
  }, [lorebooksQuery.data?.lorebooks]);

  const result = activationQuery.data?.result ?? { before_char: [], after_char: [] };
  const trace: LorebookEvaluationTraceContract[] = activationQuery.data?.trace ?? [];

  return (
    <Dialog.Root open={isOpen} onOpenChange={(details) => onOpenChange(details.open)} size="xl">
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>{title}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Stack gap={4}>
            {(allowScenarioSelect || !scenarioId) && (
              <ScenarioSingleSelect
                value={selectedScenarioId}
                onChange={(id) => setSelectedScenarioId(id)}
                placeholder="Select a scenario"
                inDialog
              />
            )}

            <HStack justify="space-between" align="center">
              <Text fontSize="sm" color="content.muted">
                Preview shows lore entries that would activate when generating a turn.
              </Text>
              <HStack gap={2}>
                <Switch
                  size="sm"
                  checked={debugMode}
                  onCheckedChange={(value) => setDebugMode(value.checked)}
                  disabled={!canPreview}
                />
                <Text fontSize="sm">Include debug trace</Text>
              </HStack>
            </HStack>

            {!canPreview ? (
              <Text color="content.muted">Select a scenario to preview activations.</Text>
            ) : activationQuery.isLoading ? (
              <Spinner size="sm" />
            ) : (
              <Tabs.Root defaultValue="before" lazyMount>
                <Tabs.List>
                  <Tabs.Trigger value="before">
                    Before Character ({result.before_char.length})
                  </Tabs.Trigger>
                  <Tabs.Trigger value="after">
                    After Character ({result.after_char.length})
                  </Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content value="before">
                  <LoreActivationList entries={result.before_char} lorebookNames={lorebookNames} />
                </Tabs.Content>
                <Tabs.Content value="after">
                  <LoreActivationList entries={result.after_char} lorebookNames={lorebookNames} />
                </Tabs.Content>
              </Tabs.Root>
            )}

            {debugMode && trace.length > 0 && (
              <Stack gap={2}>
                <Separator />
                <Text fontWeight="medium">Evaluation Trace</Text>
                <Stack gap={2} maxH="220px" overflowY="auto">
                  {trace.map((item: LorebookEvaluationTraceContract) => (
                    <Card.Root key={item.lorebookId} layerStyle="subtle">
                      <Card.Body>
                        <Text fontWeight="medium">
                          {lorebookNames.get(item.lorebookId) ?? item.lorebookId}
                        </Text>
                        <Text fontSize="sm" color="content.muted">
                          {item.entries.filter((entry) => entry.activated).length} entries activated
                        </Text>
                      </Card.Body>
                    </Card.Root>
                  ))}
                </Stack>
              </Stack>
            )}
          </Stack>
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            colorPalette="primary"
            onClick={() => activationQuery.refetch()}
            disabled={!canPreview}
            loading={activationQuery.isRefetching}
          >
            Refresh
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function LoreActivationList({
  entries,
  lorebookNames,
}: {
  entries: ActivatedLoreEntryContract[];
  lorebookNames: Map<string, string>;
}) {
  if (entries.length === 0) {
    return (
      <Box py={6}>
        <Text color="content.muted" fontSize="sm">
          No lore entries would activate.
        </Text>
      </Box>
    );
  }

  return (
    <Stack gap={3} py={2}>
      {entries.map((entry) => (
        <Card.Root key={`${entry.lorebookId}-${entry.entryId}`} layerStyle="surface">
          <Card.Body>
            <Stack gap={2}>
              <HStack justify="space-between">
                <Text fontWeight="medium">{entry.name ?? `Entry ${entry.entryId}`}</Text>
                <Text fontSize="xs" color="content.muted">
                  {lorebookNames.get(entry.lorebookId) ?? entry.lorebookId}
                </Text>
              </HStack>
              {entry.comment && (
                <Text fontSize="sm" color="content.muted">
                  {entry.comment}
                </Text>
              )}
              <Box
                borderRadius="md"
                bg="surface.muted"
                px={3}
                py={2}
                fontSize="sm"
                whiteSpace="pre-wrap"
              >
                {entry.content}
              </Box>
            </Stack>
          </Card.Body>
        </Card.Root>
      ))}
    </Stack>
  );
}
