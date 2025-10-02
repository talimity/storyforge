import { Box, HStack, SegmentGroup, Stack, Text, VStack } from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { IntentInput, IntentKind, TimelineTurn } from "@storyforge/contracts";
import { memo, useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
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

interface RetryIntentDialogProps {
  isOpen: boolean;
  turn: TimelineTurn | null;
  isSubmitting?: boolean;
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

export const RetryIntentDialog = memo(function RetryIntentDialog(props: RetryIntentDialogProps) {
  "use no memo"; // something about this does not work well with react compiler
  const { isOpen, turn, isSubmitting = false, onSubmit, onClose } = props;
  const { participants, participantsById, characters, charactersById } = useScenarioContext();

  const initialValues = useMemo<IntentFormValues>(
    () => getInitialIntentFormValues(turn, participants),
    [turn, participants]
  );

  const {
    control,
    register,
    watch,
    handleSubmit,
    reset,
    setValue,

    formState: { errors, isValid },
  } = useForm<IntentFormValues>({
    resolver: zodResolver(intentFormSchema),
    defaultValues: initialValues,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    if (!isOpen) return;
    reset(initialValues, { keepDirty: false, keepTouched: false });
  }, [isOpen, initialValues, reset]);

  const kind = watch("kind") ?? "continue_story";
  const config = INTENT_KIND_CONFIG[kind];

  const turnLabel = useMemo(() => {
    if (!turn) return "";
    const author = participantsById[turn.authorParticipantId];
    const characterName = author?.characterId ? charactersById[author.characterId]?.name : null;
    const speaker = characterName ?? "Narrator";
    return `Retry Turn #${turn.turnNo} (${speaker})`;
  }, [turn, participantsById, charactersById]);

  const handleKindChange = (nextKind: IntentKind) => {
    setValue("kind", nextKind, { shouldValidate: true, shouldDirty: true });
    const nextConfig = INTENT_KIND_CONFIG[nextKind];
    if (!nextConfig.requiresTarget) {
      setValue("characterId", null, { shouldValidate: true, shouldDirty: true });
    }
    if (!nextConfig.requiresText) {
      setValue("text", "", { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleFormSubmit = handleSubmit(async (values) => {
    const intentInput = createIntentInputPayload(values, participants);
    await onSubmit(intentInput);
  });

  return (
    <Dialog.Root
      open={isOpen}
      lazyMount
      onOpenChange={(details) => !details.open && onClose()}
      placement="center"
    >
      <Dialog.Content maxW="lg">
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
                onValueChange={(detail) => handleKindChange(detail.value as IntentKind)}
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
              <Stack gap={2}>
                <Text fontSize="xs" color="content.muted">
                  Target Character
                </Text>
                <Controller
                  name="characterId"
                  control={control}
                  render={({ field }) => (
                    <HStack gap={2}>
                      <CharacterMiniSelect
                        characters={characters}
                        value={field.value ?? null}
                        onChange={(value) => field.onChange(value ?? "")}
                        disabled={isSubmitting}
                        portalled={false}
                      />
                      {field.value ? charactersById[field.value]?.name : ""}
                    </HStack>
                  )}
                />
                {errors.characterId?.message && (
                  <Text fontSize="xs" color="fg.error">
                    {errors.characterId.message}
                  </Text>
                )}
              </Stack>
            )}

            {config.requiresText && (
              <Stack gap={2}>
                <Text fontSize="xs" color="content.muted">
                  Intent Guidance
                </Text>
                <AutosizeTextarea
                  minRows={3}
                  maxRows={12}
                  disabled={isSubmitting}
                  {...register("text")}
                />
                {errors.text?.message && (
                  <Text fontSize="xs" color="fg.error">
                    {errors.text.message}
                  </Text>
                )}
              </Stack>
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
          <HStack gap={2} justify="flex-end">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              colorPalette="primary"
              onClick={() => void handleFormSubmit()}
              disabled={isSubmitting || !isValid}
              loading={isSubmitting}
            >
              Regenerate
            </Button>
          </HStack>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
});
