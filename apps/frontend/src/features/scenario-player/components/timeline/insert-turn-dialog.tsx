import { Box, createListCollection, HStack, Stack, Text } from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { TimelineTurn } from "@storyforge/contracts";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { AutosizeTextarea, Avatar, Button, Dialog } from "@/components/ui/index";
import {
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui/select";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { getApiUrl } from "@/lib/get-api-url";

interface InsertTurnDialogProps {
  isOpen: boolean;
  turn: TimelineTurn | null;
  isSubmitting?: boolean;
  onSubmit: (input: { authorParticipantId: string; text: string }) => Promise<void> | void;
  onClose: () => void;
}

type InsertTurnFormValues = {
  authorParticipantId: string;
  text: string;
};

const TEXT_LIMIT = 50_000;

const insertTurnSchema = z.object({
  authorParticipantId: z.string().min(1, "Select a speaker"),
  text: z.string().max(TEXT_LIMIT, "Content is too long"),
});

type AuthorOption = {
  value: string;
  label: string;
  kind: "character" | "narrator";
  avatarUrl: string | null;
};

export function InsertTurnDialog(props: InsertTurnDialogProps) {
  const { isOpen, turn, isSubmitting = false, onSubmit, onClose } = props;
  const { participants, participantsById, charactersById } = useScenarioContext();

  const authorOptions = useMemo(() => {
    const options: AuthorOption[] = [];
    for (const participant of participants) {
      if (participant.status !== "active") continue;

      if (participant.type === "character" && participant.characterId) {
        const character = charactersById[participant.characterId];
        if (!character) continue;
        options.push({
          value: participant.id,
          label: character.name,
          kind: "character",
          avatarUrl: getApiUrl(character.avatarPath ?? undefined),
        });
        continue;
      }

      if (participant.type === "narrator") {
        options.push({
          value: participant.id,
          label: "Narrator",
          kind: "narrator",
          avatarUrl: null,
        });
      }
    }
    return options;
  }, [charactersById, participants]);

  const collection = useMemo(() => createListCollection({ items: authorOptions }), [authorOptions]);

  const initialAuthorId = useMemo(() => {
    if (turn && authorOptions.some((option) => option.value === turn.authorParticipantId)) {
      return turn.authorParticipantId;
    }
    return authorOptions.at(0)?.value ?? "";
  }, [authorOptions, turn]);

  const initialValues = useMemo<InsertTurnFormValues>(
    () => ({ authorParticipantId: initialAuthorId, text: "" }),
    [initialAuthorId]
  );

  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<InsertTurnFormValues>({
    resolver: zodResolver(insertTurnSchema),
    defaultValues: initialValues,
    mode: "onChange",
  });

  useEffect(() => {
    if (!isOpen) return;
    reset(initialValues, { keepDirty: false, keepTouched: false });
  }, [initialValues, isOpen, reset]);

  const turnLabel = useMemo(() => {
    if (!turn) return "";
    const participant = participantsById[turn.authorParticipantId];
    const characterName = participant?.characterId
      ? (charactersById[participant.characterId]?.name ?? null)
      : null;
    const speaker = characterName ?? "Narrator";
    return `Insert after turn #${turn.turnNo} (${speaker})`;
  }, [charactersById, participantsById, turn]);

  const handleFormSubmit = handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(details) => {
        if (!details.open) {
          onClose();
        }
      }}
      placement="center"
    >
      <Dialog.Content maxW="lg">
        <Dialog.Header>
          <Dialog.Title>{turnLabel || "Insert manual turn"}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Stack gap={4}>
            <Text color="content.muted" fontSize="sm">
              Choose who speaks and optionally pre-fill the turn. The story anchor will switch to
              this new branch without triggering generation.
            </Text>

            <Stack gap={2}>
              <Text fontSize="xs" color="content.muted">
                Speaker
              </Text>
              <Controller
                name="authorParticipantId"
                control={control}
                render={({ field }) => (
                  <SelectRoot
                    collection={collection}
                    value={field.value ? [field.value] : []}
                    onValueChange={(details) => {
                      const next = details.value[0] ?? "";
                      field.onChange(next);
                    }}
                    disabled={isSubmitting || authorOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValueText placeholder="Select a speaker">
                        {(items) => items.map((item) => item.label).join(", ")}
                      </SelectValueText>
                    </SelectTrigger>
                    <SelectContent>
                      {authorOptions.map((option) => (
                        <SelectItem key={option.value} item={option}>
                          <HStack gap={3} align="center">
                            {option.kind === "character" ? (
                              <Avatar
                                shape="rounded"
                                layerStyle="surface"
                                size="xs"
                                name={option.label}
                                src={option.avatarUrl}
                              />
                            ) : (
                              <Box
                                width="8"
                                height="8"
                                borderRadius="md"
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                layerStyle="surface"
                              >
                                <Text fontSize="xs">Narrator</Text>
                              </Box>
                            )}
                            <SelectItemText>{option.label}</SelectItemText>
                          </HStack>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectRoot>
                )}
              />
              {errors.authorParticipantId?.message ? (
                <Text fontSize="xs" color="fg.error">
                  {errors.authorParticipantId.message}
                </Text>
              ) : null}
            </Stack>

            <Stack gap={2}>
              <Text fontSize="xs" color="content.muted">
                Turn Content
              </Text>
              <AutosizeTextarea
                minRows={3}
                maxRows={12}
                disabled={isSubmitting}
                placeholder="Leave blank to add text later"
                {...register("text")}
              />
              {errors.text?.message ? (
                <Text fontSize="xs" color="fg.error">
                  {errors.text.message}
                </Text>
              ) : null}
            </Stack>
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
              disabled={isSubmitting || !isValid || authorOptions.length === 0}
              loading={isSubmitting}
            >
              Insert Turn
            </Button>
          </HStack>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
