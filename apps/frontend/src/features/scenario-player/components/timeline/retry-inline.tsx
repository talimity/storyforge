import { Box, Heading, HStack, SegmentGroup, Stack, Text } from "@chakra-ui/react";
import type { IntentKind, TimelineTurn } from "@storyforge/contracts";
import { useStore } from "@tanstack/react-form";
import { useEffect, useMemo } from "react";
import { Avatar, Button } from "@/components/ui";
import { CharacterMiniSelect } from "@/features/scenario-player/components/intent-panel/character-mini-select";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";
import {
  createIntentInputPayload,
  getInitialIntentFormValues,
  INTENT_KIND_CONFIG,
  type IntentFormValues,
  intentFormSchema,
} from "@/features/scenario-player/utils/intent-form";
import { useAppForm } from "@/lib/app-form";
import { showErrorToast } from "@/lib/error-handling";
import { getApiUrl } from "@/lib/get-api-url";
import { useScenarioIntentActions } from "../../hooks/use-scenario-intent-actions";
import { selectIsGenerating, useIntentRunsStore } from "../../stores/intent-run-store";
import { useTurnUiStore } from "../../stores/turn-ui-store";

interface RetryInlineProps {
  turn: TimelineTurn;
}

const INTENT_KIND_SEGMENTS: Array<{ value: IntentKind; label: string; description: string }> = [
  {
    value: "manual_control",
    label: "Direct Control",
    description: "Write a character's turn directly; another character will respond",
  },
  {
    value: "guided_control",
    label: "Guided Control",
    description: "Give high-level guidance to a character",
  },
  {
    value: "narrative_constraint",
    label: "Story Constraint",
    description:
      "Provide a specific goal or tone; the narrator will justify it in-universe before another character responds",
  },
  {
    value: "continue_story",
    label: "Continue Story",
    description: "Let the model respond without additional guidance",
  },
];

export function RetryInline({ turn }: RetryInlineProps) {
  const { participants, participantsById, characters, charactersById, scenario } =
    useScenarioContext();
  const { createIntent } = useScenarioIntentActions();
  const startRun = useIntentRunsStore((state) => state.startRun);
  const isGenerating = useIntentRunsStore(selectIsGenerating);
  const setScrollTarget = useScenarioPlayerStore((s) => s.setPendingScrollTarget);
  const closeOverlay = useTurnUiStore((state) => state.closeOverlay);
  const clearUiCutoff = useTurnUiStore((state) => state.clearUiCutoff);

  const initialValues = useMemo(
    () => getInitialIntentFormValues(turn, participants),
    [participants, turn]
  );

  const form = useAppForm({
    defaultValues: initialValues,
    validators: { onChange: intentFormSchema },
    onSubmit: async ({ value }) => {
      try {
        const intentInput = createIntentInputPayload(value, participants);
        const { intentId } = await createIntent({
          scenarioId: scenario.id,
          parameters: intentInput,
          branchFrom: { kind: "turn_parent", targetId: turn.id },
        });
        startRun({ intentId, scenarioId: scenario.id, kind: value.kind });
        closeOverlay(turn.id);
        clearUiCutoff();
      } catch (error) {
        showErrorToast({ title: "Failed to start retry", error });
      }
    },
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues]);

  const kind = useStore(form.store, (state) => getKind(state.values.kind));
  const config = INTENT_KIND_CONFIG[kind];

  const formValues = useStore(form.store, (state) => state.values);

  const handleKindChange = (nextKind: IntentKind) => {
    form.setFieldValue("kind", nextKind);
    const nextConfig = INTENT_KIND_CONFIG[nextKind];
    if (!nextConfig.allowsTarget) {
      form.setFieldValue("characterId", null);
    }
    if (!nextConfig.requiresText) {
      form.setFieldValue("text", "");
    }
  };

  const author = participantsById[turn.authorParticipantId];
  const characterName = author?.characterId ? charactersById[author.characterId]?.name : null;
  const speakerLabel = characterName ?? "Narrator";
  const authorAvatar = author?.characterId ? charactersById[author.characterId]?.avatarPath : null;

  const selectedCharacterId = resolveCharacterId(formValues);
  const selectedCharacter = selectedCharacterId ? charactersById[selectedCharacterId] : null;
  const displayName = selectedCharacter?.name ?? speakerLabel;
  const displayAvatarPath = selectedCharacter?.avatarPath ?? authorAvatar ?? undefined;
  const displayAvatarSrc = getApiUrl(displayAvatarPath);

  return (
    <Box layerStyle="surface" borderRadius="md" p={4} data-testid="retry-inline">
      <Stack gap={3} align="stretch">
        <HStack justify="space-between" pb={1} align="flex-start">
          <HStack alignItems="center" gap={3}>
            {displayAvatarSrc ? (
              <Avatar
                shape="rounded"
                layerStyle="surface"
                size="md"
                name={displayName}
                src={displayAvatarSrc}
              />
            ) : null}
            <Stack gap={0}>
              <Heading size="md" fontWeight="bold">
                {displayName}
              </Heading>
              <Text fontSize="xs" color="content.muted">
                Retry turn #{turn.turnNo}
              </Text>
              {displayName !== speakerLabel ? (
                <Text fontSize="xs" color="content.muted">
                  Original speaker: {speakerLabel}
                </Text>
              ) : null}
            </Stack>
          </HStack>
        </HStack>

        <Stack gap={4} pt={1}>
          <Stack gap={1}>
            <Text fontSize="sm" color="content.muted">
              Configure how you want to replay this beat.
            </Text>
          </Stack>

          <Box overflowX="auto" maxW="100%" pb={1}>
            <SegmentGroup.Root
              value={kind}
              onValueChange={(detail) => {
                if (isIntentKind(detail.value)) {
                  handleKindChange(detail.value);
                }
              }}
              size="xs"
              disabled={isGenerating}
            >
              <SegmentGroup.Indicator />
              <SegmentGroup.Items
                items={INTENT_KIND_SEGMENTS.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
              />
            </SegmentGroup.Root>
            <Stack gap={1} pt={2}>
              {INTENT_KIND_SEGMENTS.map((item) =>
                item.value === kind ? (
                  <Text key={item.value} fontSize="xs" color="content.muted">
                    {item.description}
                  </Text>
                ) : null
              )}
            </Stack>
          </Box>

          {config.allowsTarget && (
            <form.AppField name="characterId">
              {(field) => {
                const currentId = field.state.value ?? null;
                const selectedName = currentId ? (charactersById[currentId]?.name ?? "") : "";
                return (
                  <field.Field label="Target Character" required={config.requiresTarget}>
                    <Stack gap={2}>
                      <HStack gap={2}>
                        <CharacterMiniSelect
                          characters={characters}
                          value={currentId}
                          onChange={(value) => {
                            field.handleChange(value ?? "");
                            field.handleBlur();
                          }}
                          portalled={false}
                          disabled={isGenerating}
                        />
                        <Text fontSize="sm">{selectedName}</Text>
                      </HStack>
                    </Stack>
                  </field.Field>
                );
              }}
            </form.AppField>
          )}

          {config.requiresText ? (
            <form.AppField name="text">
              {(field) => (
                <field.TextareaInput
                  label="Intent Guidance"
                  required
                  minRows={3}
                  maxRows={12}
                  disabled={isGenerating}
                />
              )}
            </form.AppField>
          ) : (
            <Box>
              <Text fontSize="xs" color="content.muted">
                No additional guidance needed. Select Retry to continue from this point.
              </Text>
            </Box>
          )}

          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <HStack gap={2} justify="flex-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    closeOverlay(turn.id);
                    // prevent slight judder by deferring the timeline height change and scroll adjustment
                    // allows the original turn to be re-measured before we make turns below it re-appear
                    setTimeout(() => {
                      clearUiCutoff();
                      // put the original turn back into view since it was likely longer than the retry UI
                      setScrollTarget({ kind: "turn", turnId: turn.id, edge: "end" });
                    }, 0);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  colorPalette="primary"
                  size="sm"
                  onClick={() => {
                    if (!isGenerating) {
                      void form.handleSubmit();
                    }
                  }}
                  loading={isSubmitting}
                  disabled={!canSubmit || isSubmitting || isGenerating}
                >
                  Retry Turn
                </Button>
              </HStack>
            )}
          </form.Subscribe>
        </Stack>
      </Stack>
    </Box>
  );
}

function getKind(kind: IntentFormValues["kind"] | undefined): IntentKind {
  return kind ?? "continue_story";
}

function isIntentKind(value: string | null | undefined): value is IntentKind {
  if (!value) return false;
  return INTENT_KIND_SEGMENTS.some((segment) => segment.value === value);
}

function resolveCharacterId(values: Partial<IntentFormValues>): string | null {
  if (!values.kind) return null;
  const raw = values.characterId;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return raw ?? null;
}
