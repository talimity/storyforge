import { Card, Code, Heading, HStack, Separator, Stack, Text } from "@chakra-ui/react";
import { useStore } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { InfoTip } from "@/components/ui";
import { useImageField } from "@/hooks/use-image-field";
import { useAppForm } from "@/lib/app-form";
import { showErrorToast, showSuccessToast } from "@/lib/error-handling";
import { getApiUrl } from "@/lib/get-api-url";
import { useTRPC } from "@/lib/trpc";
import { AvatarCropDialog } from "./avatar-crop-dialog";
import { CharacterImageField } from "./character-image-field";
import { CharacterStartersEditor } from "./character-starters-editor";
import {
  type CharacterFormValues,
  characterFormDefaultValues,
  characterFormSchema,
} from "./form-schemas";

export type CharacterFormData = CharacterFormValues;

interface CharacterFormProps {
  initialData?: Partial<CharacterFormValues>;
  onSubmit: (data: CharacterFormValues) => Promise<unknown>;
  onCancel: () => void;
  submitLabel?: string;
  /** Full-size portrait URL for cropping dialog (original card image) */
  portraitSrc?: string;
  /** Character id for previewing server-side temporary avatar crops */
  characterId?: string;
}

const cardTypeOptions: Array<{
  label: string;
  value: CharacterFormValues["cardType"];
}> = [
  { label: "Character", value: "character" },
  { label: "Persona", value: "persona" },
  { label: "Narrator (not yet implemented)", value: "scenario" },
  { label: "Group (not yet implemented)", value: "group" },
];

const DEFAULT_FOCAL = { x: 0.5, y: 0.3, w: 0.5, h: 0.5, c: 0 } as const;
const EPSILON = 1e-6;

function nearlyEqual(a: number, b: number, eps = EPSILON) {
  return Math.abs(a - b) <= eps;
}

export function CharacterForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = "Save Character",
  portraitSrc,
  characterId,
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
  };

  const form = useAppForm({
    defaultValues: initialValues,
    validators: { onChange: characterFormSchema },
    onSubmit: ({ value }) => onSubmit(value),
  });

  const trpc = useTRPC();
  const resetCropMutation = useMutation(
    trpc.characters.resetPortraitCrop.mutationOptions({
      onSuccess: (focalPoint) => {
        form.setFieldValue("portraitFocalPoint", focalPoint);
        showSuccessToast({
          title: "Avatar crop reset",
          description: "Default crop reapplied. Save to keep this change.",
        });
      },
      onError: (error) => {
        showErrorToast({ title: "Failed to reset avatar crop", error });
      },
    })
  );

  const imageField = useImageField({
    initialUrl: initialData?.imageDataUri ?? undefined,
    initialDisplayName: "Current Portrait",
  });

  const [showCropDialog, setShowCropDialog] = useState(false);
  const openCrop = () => setShowCropDialog(true);
  const closeCrop = () => setShowCropDialog(false);

  const portraitFocalPoint = useStore(form.store, (state) => state.values.portraitFocalPoint);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    await imageField.handleFiles(files);
    form.setFieldValue("imageDataUri", imageField.getSubmissionValue());
    form.setFieldValue("portraitFocalPoint", undefined);
  };

  const handleRemoveImage = () => {
    imageField.handleRemove();
    const fileInput = document.getElementById("image-input") as HTMLInputElement | null;
    if (fileInput) {
      fileInput.value = "";
    }
    form.setFieldValue("imageDataUri", imageField.getSubmissionValue());
  };

  const handleResetCrop = () => {
    if (!characterId || imageField.state.type !== "existing") {
      return;
    }
    resetCropMutation.mutate({ id: characterId });
  };

  useEffect(() => {
    const next = imageField.getSubmissionValue();
    const current = form.getFieldValue("imageDataUri");
    if (next !== current) {
      form.setFieldValue("imageDataUri", next);
    }
  }, [form, imageField]);

  const baselineFocal = initialData?.portraitFocalPoint;
  const overridePreviewUrl = useMemo(() => {
    const fp = portraitFocalPoint;
    if (!characterId || !portraitSrc || !fp || imageField.state.type !== "existing") {
      return undefined;
    }

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
      cb: `${fp.x.toFixed(3)}-${fp.y.toFixed(3)}-${fp.w.toFixed(3)}-${fp.h.toFixed(3)}`,
    });
    const path = `/assets/characters/${characterId}/avatar?${params.toString()}`;
    return getApiUrl(path) ?? path;
  }, [baselineFocal, characterId, portraitFocalPoint, imageField.state, portraitSrc]);

  return (
    <>
      <Card.Root layerStyle="surface" maxW="900px" mx="auto">
        <form
          id="character-form"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <Stack gap={6} p={6}>
            <CharacterImageField
              imageField={imageField}
              onFileChange={handleFileChange}
              onRemove={handleRemoveImage}
              onAdjustCrop={portraitSrc ? openCrop : undefined}
              overridePreviewUrl={overridePreviewUrl}
              onResetCrop={characterId && portraitSrc ? handleResetCrop : undefined}
              isResettingCrop={resetCropMutation.isPending}
            />

            <Separator />

            <Stack gap={4}>
              <Heading size="md">Basic Information</Heading>

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
                            character's turn, prompt templates can include these instructions at the
                            bottom of the prompt to heavily influence the style of the generated
                            text.
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
                            Changes some aspects of turn generation and character selection. Prompt
                            templates can access an actor's type to use different messages or
                            wording depending on the type.
                          </Text>
                          <Separator />
                          <Text>
                            <strong>Character:</strong> A standard character. No special behavior.
                          </Text>
                          <Text>
                            <strong>Persona:</strong> An actor primarily used as a stand-in for the
                            player, similar to SillyTavern personas. Persona character descriptions
                            always appear after those of other actor types. Personas are used when a
                            prompt template calls for the <Code>{`{{user}}`}</Code> variable.
                          </Text>
                          <Text>
                            <strong>Narrator:</strong> An actor that does not participate in the
                            story directly. Ideal for RPG cards that introduce random characters and
                            events. This actor is removed from the round-robin turn order. When a
                            generation request calls for a narrator, this actor is used instead of
                            the generic one.
                          </Text>
                          <Text>
                            <strong>Group:</strong> A card that represents more than one actor. No
                            inherent special behavior, but prompt templates might use this to avoid
                            using singular pronouns when referring to this card.
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

            <Separator />

            <CharacterStartersEditor form={form} fields={{ items: "starters" }} />

            <Separator />

            <HStack justify="space-between" width="full">
              <form.AppForm>
                <form.CancelButton variant="ghost" onCancel={onCancel}>
                  Cancel
                </form.CancelButton>
                <form.SubmitButton form="character-form" colorPalette="primary">
                  {submitLabel}
                </form.SubmitButton>
                <form.SubscribedUnsavedChangesDialog
                  title="Unsaved Changes"
                  message="You have unsaved changes to this character. Are you sure you want to leave?"
                />
              </form.AppForm>
            </HStack>
          </Stack>
        </form>
      </Card.Root>

      {portraitSrc && (
        <AvatarCropDialog
          isOpen={showCropDialog}
          onOpenChange={({ open }) => (open ? openCrop() : closeCrop())}
          src={portraitSrc}
          initialFocal={form.getFieldValue("portraitFocalPoint") ?? DEFAULT_FOCAL}
          onSave={(fp) => {
            form.setFieldValue("portraitFocalPoint", fp);
          }}
        />
      )}
    </>
  );
}
