import {
  Card,
  Code,
  Flex,
  Heading,
  HStack,
  Separator,
  Stack,
  Tabs,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { CharacterWithRelations } from "@storyforge/contracts";
import { useStore } from "@tanstack/react-form";
import { useId, useMemo } from "react";
import { LuBookOpen, LuInfo, LuMessageCircle, LuUserRound } from "react-icons/lu";
import { Avatar, InfoTip } from "@/components/ui/index";
import { cardTypeLabels } from "@/features/characters/character-enums";
import { CharacterLorebookManager } from "@/features/characters/components/form/character-lorebook-manager";
import { CharacterPaletteEditor } from "@/features/characters/components/form/character-palette-editor";
import { CharacterPortraitField } from "@/features/characters/components/form/character-portrait-field";
import { useAppForm } from "@/lib/app-form";
import { getApiUrl } from "@/lib/get-api-url";
import { CharacterStartersEditor } from "./character-starters-editor";
import {
  type CharacterFormValues,
  characterFormDefaultValues,
  characterFormSchema,
} from "./form-schemas";

export type CharacterFormData = CharacterFormValues;

interface CharacterFormProps {
  initialData?: CharacterFormValues;
  onSubmit: (data: CharacterFormValues) => Promise<unknown>;
  onCancel: () => void;
  submitLabel?: string;
  currentCharacter?: CharacterWithRelations;
}

const cardTypeOptions: Array<{
  label: string;
  value: CharacterFormValues["cardType"];
}> = [
  { label: "Character", value: "character" },
  { label: "Persona", value: "persona" },
  { label: "Narrator", value: "narrator" },
  { label: "Group (not yet implemented)", value: "group" },
];

const EPSILON = 1e-6;
function nearlyEqual(a: number, b: number, eps = EPSILON) {
  return Math.abs(a - b) <= eps;
}

export function CharacterForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = "Save Character",
  currentCharacter,
}: CharacterFormProps) {
  const initialStartersSource = initialData?.starters ?? characterFormDefaultValues.starters ?? [];
  const initialStarters = initialStartersSource.map((starter) => ({ ...starter }));
  const initialValues: CharacterFormValues = {
    ...characterFormDefaultValues,
    name: initialData?.name ?? characterFormDefaultValues.name,
    description: initialData?.description ?? characterFormDefaultValues.description,
    cardType: initialData?.cardType ?? characterFormDefaultValues.cardType,
    starters: initialStarters,
    styleInstructions:
      initialData?.styleInstructions ?? characterFormDefaultValues.styleInstructions,
    imageDataUri: undefined,
    portraitFocalPoint: initialData?.portraitFocalPoint ?? undefined,
    defaultColor: initialData?.defaultColor ?? characterFormDefaultValues.defaultColor,
  };

  const form = useAppForm({
    defaultValues: initialValues,
    validators: { onChange: characterFormSchema },
    onSubmit: ({ value }) => onSubmit(value),
  });

  const formId = useId();

  const displayName = useStore(form.store, (s) => s.values.name) || "New Character";
  const charaType = useStore(form.store, (s) => s.values.cardType);
  const charaColor = useStore(form.store, (s) => s.values.defaultColor);
  const portraitFocalPoint = useStore(form.store, (s) => s.values.portraitFocalPoint);

  const baselineFocal = initialData?.portraitFocalPoint;
  const tempAvatarUrl = useMemo(() => {
    const fp = portraitFocalPoint;
    if (!currentCharacter) return undefined;
    if (!currentCharacter.id || !currentCharacter.imagePath || !fp) return undefined;

    if (
      baselineFocal &&
      nearlyEqual(fp.x, baselineFocal.x) &&
      nearlyEqual(fp.y, baselineFocal.y) &&
      nearlyEqual(fp.w, baselineFocal.w) &&
      nearlyEqual(fp.h, baselineFocal.h)
    ) {
      return undefined;
    }

    const params = new URLSearchParams({
      x: String(fp.x),
      y: String(fp.y),
      w: String(fp.w),
      h: String(fp.h),
      padding: "1.1",
      size: "200",
      cb: `${fp.x.toFixed(1)}-${fp.y.toFixed(1)}-${fp.w.toFixed(1)}-${fp.h.toFixed(1)}`,
    });
    const path = `/assets/characters/${currentCharacter.id}/avatar?${params.toString()}`;
    return getApiUrl(path) ?? path;
  }, [baselineFocal, currentCharacter, portraitFocalPoint]);

  return (
    <Card.Root layerStyle="surface" maxW="60rem" mx="auto">
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <Flex
          p={{ base: 2, md: 6 }}
          pb={4}
          justify="space-between"
          align="end"
          gap={6}
          css={{ "--input-color": charaColor }}
        >
          <HStack gap={3} height="full" justify=" ">
            <Avatar
              layerStyle="surface"
              shape="rounded"
              size="2xl"
              name={displayName}
              src={tempAvatarUrl || getApiUrl(currentCharacter?.avatarPath)}
              fallback={<LuUserRound />}
            />
            <VStack gap={0} align="start">
              <Heading size="2xl" truncate flex={1} minWidth={0} layerStyle="tinted.normal">
                {displayName}
              </Heading>
              <Text color="content.muted" textStyle="md">
                {cardTypeLabels[charaType] || "Unknown Type"}
              </Text>
            </VStack>
          </HStack>
          <Stack>
            <Text color="content.muted">0 scenarios</Text>
          </Stack>
        </Flex>

        <Separator />

        <Card.Body px={0} py={0}>
          <Tabs.Root defaultValue="basic" lazyMount unmountOnExit>
            <Tabs.List>
              <Tabs.Trigger value="basic">
                <LuInfo />
                Basic Info
              </Tabs.Trigger>
              <Tabs.Trigger value="starters">
                <LuMessageCircle />
                Starters
              </Tabs.Trigger>
              {currentCharacter && (
                <Tabs.Trigger value="lorebooks">
                  <LuBookOpen />
                  Lorebooks
                </Tabs.Trigger>
              )}
            </Tabs.List>

            <Tabs.Content value="basic" p={{ base: 2, md: 6 }} pt={6}>
              <Stack gap={4}>
                <form.AppField name="name">
                  {(field) => (
                    <field.TextInput
                      label="Character Name"
                      required
                      placeholder="Enter character name"
                      autoComplete="off"
                    />
                  )}
                </form.AppField>

                <CharacterPortraitField
                  character={currentCharacter}
                  tempAvatarUrl={tempAvatarUrl}
                  form={form}
                />

                <CharacterPaletteEditor
                  characterId={currentCharacter?.id}
                  form={form}
                  fields={{ selectedColor: "defaultColor" }}
                  label="Character Color"
                  helperText="Select the tint color used for this character's UI elements."
                />

                <form.AppField name="description">
                  {(field) => (
                    <field.TextareaInput
                      label="Description"
                      helperText="Provide a detailed description of the character"
                      placeholder="Enter character description..."
                      autosize
                      minRows={4}
                      maxRows={50}
                    />
                  )}
                </form.AppField>

                <form.AppField name="styleInstructions">
                  {(field) => (
                    <field.TextareaInput
                      label={
                        <>
                          Style Instructions
                          <InfoTip>
                            <Text>
                              Similar to SillyTavern post-history instructions. When it is this
                              character's turn, prompt templates can include these instructions at
                              the bottom of the prompt to heavily influence the style of the
                              generated text.
                            </Text>
                          </InfoTip>
                        </>
                      }
                      helperText="Guidance to influence this character's writing style (tone, special formatting, etc.)"
                      placeholder="e.g., Speak in clipped sentences, use dry humor"
                      autosize
                      minRows={4}
                      maxRows={15}
                    />
                  )}
                </form.AppField>

                <form.AppField name="cardType">
                  {(field) => (
                    <field.Select
                      label={
                        <>
                          Actor Type
                          <InfoTip>
                            <Text>
                              Changes some aspects of turn generation and character selection.
                              Prompt templates can access an actor's type to use different messages
                              or wording depending on the type.
                            </Text>
                            <Separator />
                            <Text>
                              <strong>Character:</strong> A standard character. No special behavior.
                            </Text>
                            <Text>
                              <strong>Persona:</strong> An actor primarily used as a stand-in for
                              the player, similar to SillyTavern personas. Persona character
                              descriptions always appear after those of other actor types. Personas
                              are used when a prompt template calls for the{" "}
                              <Code>{`{{user}}`}</Code> variable.
                            </Text>
                            <Text>
                              <strong>Narrator:</strong> An actor that does not participate in the
                              story directly. Ideal for RPG cards that introduce random characters
                              and events. This actor is removed from the round-robin turn order.
                              When a generation request calls for a narrator, this actor is used
                              instead of the generic one.
                            </Text>
                            <Text>
                              <strong>Group:</strong> A card that represents more than one actor. No
                              inherent special behavior, but prompt templates might use this to
                              avoid using singular pronouns when referring to this card.
                            </Text>
                          </InfoTip>
                        </>
                      }
                      helperText="Select the type of actor this character card represents."
                      options={cardTypeOptions}
                      placeholder="Select card type"
                    />
                  )}
                </form.AppField>
              </Stack>
            </Tabs.Content>

            <Tabs.Content value="starters" p={6}>
              <CharacterStartersEditor form={form} fields={{ items: "starters" }} />
            </Tabs.Content>

            {currentCharacter && (
              <Tabs.Content value="lorebooks" p={6}>
                <CharacterLorebookManager characterId={currentCharacter.id} />
              </Tabs.Content>
            )}
          </Tabs.Root>
        </Card.Body>

        <Card.Footer borderTopWidth={1} borderTopColor="border" pt={6}>
          <HStack justify="space-between" width="full">
            <form.AppForm>
              <form.CancelButton variant="ghost" onCancel={onCancel}>
                Cancel
              </form.CancelButton>
              <form.SubmitButton form={formId} colorPalette="primary">
                {submitLabel}
              </form.SubmitButton>
              <form.SubscribedUnsavedChangesDialog
                title="Unsaved Changes"
                message="You have unsaved changes to this character. Are you sure you want to leave?"
              />
            </form.AppForm>
          </HStack>
        </Card.Footer>
      </form>
    </Card.Root>
  );
}
