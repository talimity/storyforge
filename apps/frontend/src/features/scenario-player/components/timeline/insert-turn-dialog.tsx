import { Box, createListCollection, HStack, Stack, Text } from "@chakra-ui/react";
import type { TimelineTurn } from "@storyforge/contracts";
import { useEffect, useId, useRef } from "react";
import { z } from "zod";
import { Avatar, Button, Dialog } from "@/components/ui";
import {
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui/select";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { useAppForm } from "@/lib/form/app-form";
import { getApiUrl } from "@/lib/get-api-url";

interface InsertTurnDialogProps {
  isOpen: boolean;
  turn: TimelineTurn | null;
  onSubmit: (input: { authorParticipantId: string; text: string }) => Promise<void> | void;
  onClose: () => void;
}

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
  const { isOpen, turn, onSubmit, onClose } = props;
  const { participants, participantsById, charactersById } = useScenarioContext();

  const authorOptions = buildAuthorOptions({ participants, charactersById });
  const authorOptionsRef = useRef(authorOptions);
  authorOptionsRef.current = authorOptions;
  const collection = createListCollection({ items: authorOptions });

  const form = useAppForm({
    formId: `insert-turn-form-${useId()}`,
    defaultValues: { authorParticipantId: "", text: "" },
    validators: { onChange: insertTurnSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    const defaultAuthor = getDefaultAuthorId({
      options: authorOptionsRef.current,
      turnAuthorParticipantId: turn?.authorParticipantId,
    });
    form.reset({ authorParticipantId: defaultAuthor, text: "" });
  }, [form, isOpen, turn?.authorParticipantId]);

  const turnLabel = getTurnLabel({ turn, participantsById, charactersById });

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(details) => {
        if (!details.open) {
          onClose();
        }
      }}
      size="lg"
      placement="center"
      lazyMount
      unmountOnExit
    >
      <Dialog.Content>
        <form
          id={form.formId}
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <Dialog.Header>
            <Dialog.Title>{turnLabel || "Insert turn"}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap={4}>
              <Text color="content.muted" fontSize="sm">
                Select an author and write the content of the new turn. No generation will be
                triggered for this new turn.
              </Text>

              <form.AppField name="authorParticipantId">
                {(field) => (
                  <field.Field label="Speaker" required>
                    <SelectRoot
                      collection={collection}
                      value={field.state.value ? [field.state.value] : []}
                      onValueChange={(details) => {
                        const next = details.value[0] ?? "";
                        field.handleChange(next);
                        field.handleBlur();
                      }}
                      disabled={authorOptions.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValueText placeholder="Select a speaker">
                          {(items) => items.map((item) => item.label).join(", ")}
                        </SelectValueText>
                      </SelectTrigger>
                      <SelectContent portalled={false}>
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
                  </field.Field>
                )}
              </form.AppField>

              <form.AppField name="text">
                {(field) => (
                  <field.TextareaInput
                    label="Turn Content"
                    placeholder="Leave blank to add text later"
                    minRows={3}
                    maxRows={12}
                  />
                )}
              </form.AppField>
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
                    disabled={!canSubmit || isSubmitting || authorOptions.length === 0}
                    loading={isSubmitting}
                  >
                    Insert Turn
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

type ScenarioContextValue = ReturnType<typeof useScenarioContext>;

function buildAuthorOptions({
  participants,
  charactersById,
}: Pick<ScenarioContextValue, "participants" | "charactersById">): AuthorOption[] {
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
}

function getDefaultAuthorId({
  options,
  turnAuthorParticipantId,
}: {
  options: AuthorOption[];
  turnAuthorParticipantId: string | null | undefined;
}): string {
  if (
    turnAuthorParticipantId &&
    options.some((option) => option.value === turnAuthorParticipantId)
  ) {
    return turnAuthorParticipantId;
  }
  return options.at(0)?.value ?? "";
}

function getTurnLabel({
  turn,
  participantsById,
  charactersById,
}: {
  turn: TimelineTurn | null;
  participantsById: ScenarioContextValue["participantsById"];
  charactersById: ScenarioContextValue["charactersById"];
}): string {
  if (!turn) return "Insert turn";
  const participant = participantsById[turn.authorParticipantId];
  const characterName = participant?.characterId
    ? (charactersById[participant.characterId]?.name ?? null)
    : null;
  const speaker = characterName ?? "Narrator";
  return `Insert after turn #${turn.turnNo} (${speaker})`;
}
