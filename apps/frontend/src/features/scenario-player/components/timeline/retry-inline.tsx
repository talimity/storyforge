import { Box, HStack, Stack, Tabs, Text } from "@chakra-ui/react";
import type { TimelineTurn } from "@storyforge/contracts";
import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { LuRefreshCcw, LuWorkflow } from "react-icons/lu";
import { Avatar, Button, Tooltip } from "@/components/ui";
import { GuidanceField } from "@/features/scenario-player/components/timeline/retry-form/guidance-field";
import { IntentKindControl } from "@/features/scenario-player/components/timeline/retry-form/intent-kind-control";
import { TargetCharacterField } from "@/features/scenario-player/components/timeline/retry-form/target-character-field";
import {
  type ScenarioCtxCharacter,
  type ScenarioCtxParticipant,
  useScenarioContext,
} from "@/features/scenario-player/providers/scenario-provider";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";
import {
  createIntentInputPayload,
  getInitialIntentFormValues,
  intentFormSchema,
} from "@/features/scenario-player/utils/intent-form";
import { showErrorToast } from "@/lib/error-handling";
import { useAppForm } from "@/lib/form/app-form";
import { getApiUrl } from "@/lib/get-api-url";
import { useTRPC } from "@/lib/trpc";
import { useScenarioIntentActions } from "../../hooks/use-scenario-intent-actions";
import { selectIsGenerating, useIntentRunsStore } from "../../stores/intent-run-store";
import { useTurnUiStore } from "../../stores/turn-ui-store";
import { RetryReplaySection } from "./retry-replay-section";
import { TurnHeader } from "./turn-header";

function selectTintColor(
  candidates: Array<ScenarioCtxParticipant | ScenarioCtxCharacter | null | undefined>
): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;

    if ("defaultColor" in candidate && candidate.defaultColor) {
      return candidate.defaultColor.toLowerCase();
    }

    if ("color" in candidate && candidate.color) {
      return candidate.color.toLowerCase();
    }
  }

  return null;
}

interface RetryInlineProps {
  turn: TimelineTurn;
}

export function RetryInline({ turn }: RetryInlineProps) {
  const trpc = useTRPC();
  const { participants, getCharacterById, getParticipantById, scenario } = useScenarioContext();
  const { createIntent } = useScenarioIntentActions();
  const startRun = useIntentRunsStore((state) => state.startRun);
  const isGenerating = useIntentRunsStore(selectIsGenerating);
  const setScrollTarget = useScenarioPlayerStore((s) => s.setPendingScrollTarget);
  const closeOverlay = useTurnUiStore((state) => state.closeOverlay);
  const clearUiCutoff = useTurnUiStore((state) => state.clearUiCutoff);

  const generationInfoQuery = useQuery({
    ...trpc.timeline.generationInfo.queryOptions({ turnId: turn.id }),
    retry: false,
  });

  const generationInfo = generationInfoQuery.data;
  const isGenerationInfoNotFound = generationInfoQuery.error?.data?.code === "NOT_FOUND";

  const form = useAppForm({
    formId: `retry-intent-form-${turn.id}`,
    defaultValues: getInitialIntentFormValues(turn, participants),
    validators: { onBlur: intentFormSchema },
    onSubmit: async ({ value }) => {
      // todo: this is not idiomatic tanstack form validation

      try {
        const intentInput = createIntentInputPayload(value, participants);

        let replayFrom:
          | {
              generationRunId: string;
              resumeFromStepId: string;
              expectedWorkflowId: string;
              stepOutputOverrides?: Record<string, string>;
            }
          | undefined;

        if (value.replayMode === "resume") {
          if (!generationInfo) {
            showErrorToast({
              title: "Unable to reuse previous outputs",
              error: "No generation history is available for this turn.",
            });
            return;
          }

          const resumeStepId = value.replayResumeStepId;
          if (!resumeStepId) {
            showErrorToast({
              title: "Select a workflow step",
              error: "Choose which workflow step to regenerate before retrying.",
            });
            return;
          }

          const stepOrder = generationInfo.stepOrder;
          const resumeIndex = stepOrder.indexOf(resumeStepId);
          if (resumeIndex <= 0) {
            showErrorToast({
              title: "Invalid replay step",
              error: "The selected step cannot be replayed. Please pick a later step.",
            });
            return;
          }

          const overridesByStep = value.replayOverrides ?? {};
          const flattened: Record<string, string> = {};
          for (const stepId of stepOrder.slice(0, resumeIndex)) {
            const stepOverrides = overridesByStep[stepId];
            if (!stepOverrides) continue;
            for (const [key, rawValue] of Object.entries(stepOverrides)) {
              if (typeof rawValue === "string") {
                flattened[key] = rawValue;
              }
            }
          }

          replayFrom = {
            generationRunId: generationInfo.generationRunId,
            resumeFromStepId: resumeStepId,
            expectedWorkflowId: generationInfo.workflowId,
            ...(Object.keys(flattened).length > 0 ? { stepOutputOverrides: flattened } : {}),
          };
        }

        const { intentId } = await createIntent({
          scenarioId: scenario.id,
          parameters: intentInput,
          branchFrom: { kind: "turn_parent", targetId: turn.id },
          ...(replayFrom ? { replayFrom } : {}),
        });
        startRun({ intentId, scenarioId: scenario.id, kind: value.kind });
        closeOverlay(turn.id);
        clearUiCutoff();
      } catch (error) {
        showErrorToast({ title: "Failed to start retry", error });
      }
    },
  });

  const author = getParticipantById(turn.authorParticipantId);
  const authorCharacter = getCharacterById(author?.characterId);
  const authorDisplayName = authorCharacter?.name ?? "Narrator";
  const authorAvatar = authorCharacter?.avatarPath;

  const selectedCharacterId = useStore(form.store, (state) => state.values.characterId);
  const selectedCharacter = getCharacterById(selectedCharacterId);
  const displayName = selectedCharacter?.name ?? authorDisplayName;
  const displayAvatarPath = selectedCharacter?.avatarPath ?? authorAvatar;
  const displayAvatarSrc = getApiUrl(displayAvatarPath);

  const tintColor = selectTintColor([selectedCharacter, author, authorCharacter]);
  const tintCss = { "--input-color": tintColor || "var(--chakra-colors-fg-emphasized)" };

  const headerMetadata = useMemo(
    () => [
      <Tooltip key="turn-no" content={turn.createdAt.toLocaleString() ?? "Unknown"}>
        <Text fontSize="xs" layerStyle="tinted.muted">
          #{turn.turnNo}
        </Text>
      </Tooltip>,
    ],
    [turn.createdAt, turn.turnNo]
  );

  // const newActor = displayName !== speakerLabel;

  return (
    <Box layerStyle="surface" borderRadius="md" p={4} data-testid="retry-inline" css={tintCss}>
      <Stack gap={3} align="stretch">
        <TurnHeader
          avatar={
            displayAvatarSrc && (
              <Avatar
                shape="rounded"
                layerStyle="surface"
                size="md"
                name={displayName}
                src={displayAvatarSrc}
              />
            )
          }
          title={displayName}
          metadata={headerMetadata}
        />

        <Stack gap={4} pt={1}>
          <Tabs.Root defaultValue="retry" lazyMount unmountOnExit>
            <Tabs.List>
              <Tabs.Trigger value="retry">
                <LuRefreshCcw />
                Regenerate
              </Tabs.Trigger>
              {generationInfo && !isGenerationInfoNotFound && (
                <Tabs.Trigger value="replay">
                  <LuWorkflow />
                  Workflow Replay
                </Tabs.Trigger>
              )}
            </Tabs.List>

            <Tabs.Content value="retry">
              <Text mb={2} color="content.muted">
                Generate a new turn from scratch with updated intent, character, or guidance.
              </Text>
              <IntentKindControl form={form} isGenerating={isGenerating} />

              <TargetCharacterField
                form={form}
                fields={{ characterId: "characterId", kind: "kind" }}
                isGenerating={isGenerating}
              />

              <GuidanceField
                form={form}
                fields={{ text: "text", kind: "kind", characterId: "characterId" }}
                isGenerating={isGenerating}
              />
            </Tabs.Content>

            <Tabs.Content value="replay">
              <Text mb={2} color="content.muted">
                Reuse parts of the previous turn generation to retry from a specific workflow step.
                You can't change the target character or guidance when replaying.
              </Text>
              <RetryReplaySection
                form={form}
                generationInfo={generationInfo}
                isLoading={generationInfoQuery.isLoading}
                isError={generationInfoQuery.isError}
                isNotFound={isGenerationInfoNotFound}
                isGenerating={isGenerating}
              />
            </Tabs.Content>
          </Tabs.Root>

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
                      setScrollTarget({
                        kind: "turn",
                        turnId: turn.id,
                        edge: "end",
                        skipIfVisible: true,
                      });
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
