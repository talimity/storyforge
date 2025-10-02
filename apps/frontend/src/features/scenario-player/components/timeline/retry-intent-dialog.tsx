import { Box, HStack, SegmentGroup, Stack, Text, VStack } from "@chakra-ui/react";
import type { IntentInput, IntentKind, TimelineTurn } from "@storyforge/contracts";
import { useStore } from "@tanstack/react-form";
import { useEffect } from "react";
import { AutosizeTextarea, Button, Dialog } from "@/components/ui/index";
import { CharacterMiniSelect } from "@/features/scenario-player/components/intent-panel/character-mini-select";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import {
  createIntentInputPayload,
  getInitialIntentFormValues,
  INTENT_KIND_CONFIG,
  type IntentFormValues,
  intentFormSchema,
} from "@/features/scenario-player/utils/intent-form";
import { useAppForm } from "@/lib/app-form";

interface RetryIntentDialogProps {
  isOpen: boolean;
  turn: TimelineTurn | null;
  onSubmit: (input: IntentInput) => Promise<void> | void;
  onClose: () => void;
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
      "Provide a specific goal or tone; the narrator will provide an in-universe justification, and then another character will respond",
  },
  {
    value: "continue_story",
    label: "Continue Story",
    description: "Let the model respond to the previous turn without any guidance",
  },
];

export function RetryIntentDialog(props: RetryIntentDialogProps) {
  const { isOpen, turn, onSubmit, onClose } = props;
  const { participants, participantsById, characters, charactersById } = useScenarioContext();

  const form = useAppForm({
    defaultValues: getInitialIntentFormValues(turn, participants),
    validators: { onChange: intentFormSchema },
    onSubmit: async ({ value }) => {
      const intentInput = createIntentInputPayload(value, participants);
      await onSubmit(intentInput);
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    const nextValues = getInitialIntentFormValues(turn, participants);
    form.reset(nextValues);
  }, [form, isOpen, participants, turn]);

  const kind = useStore(form.store, (state) => getSelectedIntentKind(state.values.kind));
  const config = INTENT_KIND_CONFIG[kind];
  const turnLabel = getTurnLabel({ turn, participantsById, charactersById });

  const handleKindChange = (nextKind: IntentKind) => {
    form.setFieldValue("kind", nextKind);
    const nextConfig = INTENT_KIND_CONFIG[nextKind];
    if (!nextConfig.requiresTarget) {
      form.setFieldValue("characterId", null);
    }
    if (!nextConfig.requiresText) {
      form.setFieldValue("text", "");
    }
  };

  return (
    <Dialog.Root
      open={isOpen}
      lazyMount
      onOpenChange={(details) => !details.open && onClose()}
      placement="center"
      size="lg"
    >
      <Dialog.Content>
        <form
          id="retry-intent-form"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <Dialog.Header>
            <Dialog.Title>{turnLabel}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap={4}>
              <Box>
                <Text color="content.muted">Choose how you want to regenerate this turn.</Text>
              </Box>

              <Box overflowX="auto" maxW="100%" pb={1}>
                <SegmentGroup.Root
                  value={kind}
                  onValueChange={(detail) => {
                    if (isIntentKind(detail.value)) {
                      handleKindChange(detail.value);
                    }
                  }}
                  size="xs"
                >
                  <SegmentGroup.Indicator />
                  <SegmentGroup.Items
                    items={INTENT_KIND_SEGMENTS.map((item) => ({
                      value: item.value,
                      label: item.label,
                    }))}
                  />
                </SegmentGroup.Root>
                <VStack align="start" gap={1} pt={2}>
                  {INTENT_KIND_SEGMENTS.map((item) =>
                    item.value === kind ? (
                      <Text key={item.value} fontSize="xs" color="content.muted">
                        {item.description}
                      </Text>
                    ) : null
                  )}
                </VStack>
              </Box>

              {config.requiresTarget && (
                <form.AppField name="characterId">
                  {(field) => {
                    const currentId = field.state.value ?? null;
                    const selectedName = currentId ? (charactersById[currentId]?.name ?? "") : "";
                    return (
                      <field.Field label="Target Character" required>
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
                            />
                            <Text fontSize="sm">{selectedName}</Text>
                          </HStack>
                        </Stack>
                      </field.Field>
                    );
                  }}
                </form.AppField>
              )}

              {config.requiresText && (
                <form.AppField name="text">
                  {(field) => (
                    <field.Field label="Intent Guidance" required>
                      <AutosizeTextarea
                        minRows={3}
                        maxRows={12}
                        value={field.state.value ?? ""}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onBlur={() => field.handleBlur()}
                      />
                    </field.Field>
                  )}
                </form.AppField>
              )}

              {!config.requiresText && (
                <Box>
                  <Text fontSize="xs" color="content.muted">
                    This intent does not require additional guidance. Click retry to continue the
                    story from this point.
                  </Text>
                </Box>
              )}
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <HStack gap={2} justify="flex-end">
                  <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    colorPalette="primary"
                    disabled={!canSubmit || isSubmitting}
                    loading={isSubmitting}
                  >
                    Regenerate
                  </Button>
                </HStack>
              )}
            </form.Subscribe>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function getSelectedIntentKind(kind: IntentFormValues["kind"] | undefined): IntentKind {
  if (kind) {
    return kind;
  }
  return "continue_story";
}

type ScenarioContextValue = ReturnType<typeof useScenarioContext>;

function getTurnLabel({
  turn,
  participantsById,
  charactersById,
}: {
  turn: TimelineTurn | null;
  participantsById: ScenarioContextValue["participantsById"];
  charactersById: ScenarioContextValue["charactersById"];
}): string {
  if (!turn) return "Retry Turn";
  const author = participantsById[turn.authorParticipantId];
  const characterName = author?.characterId ? charactersById[author.characterId]?.name : null;
  const speaker = characterName ?? "Narrator";
  return `Retry Turn #${turn.turnNo} (${speaker})`;
}

function isIntentKind(value: string | null | undefined): value is IntentKind {
  if (!value) {
    return false;
  }
  return INTENT_KIND_SEGMENTS.some((segment) => segment.value === value);
}
