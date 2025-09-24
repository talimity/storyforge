import {
  Card,
  Code,
  createListCollection,
  Heading,
  HStack,
  Input,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCharacterSchema, focalPointSchema } from "@storyforge/contracts";
import { useEffect, useState } from "react";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { UnsavedChangesDialog } from "@/components/dialogs/unsaved-changes-dialog";
import {
  AutosizeTextarea,
  Button,
  Field,
  InfoTip,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui/index";
import { useImageField } from "@/hooks/use-image-field";
import { useUnsavedChangesProtection } from "@/hooks/use-unsaved-changes-protection";
import { getApiUrl } from "@/lib/get-api-url";
import { AvatarCropDialog } from "./avatar-crop-dialog";
import { CharacterImageField } from "./character-image-field";
import { CharacterStartersEditor } from "./character-starters-editor";

const characterFormSchema = createCharacterSchema
  .pick({
    name: true,
    description: true,
    cardType: true,
    starters: true,
    styleInstructions: true,
    imageDataUri: true,
  })
  .extend({
    cardType: createCharacterSchema.shape.cardType.unwrap(),
    starters: createCharacterSchema.shape.starters.unwrap(),
    // store an optional focal override in the form state (edit only)
    portraitFocalPoint: focalPointSchema.optional(),
  });

export type CharacterFormData = z.infer<typeof characterFormSchema>;

interface CharacterFormProps {
  initialData?: Partial<CharacterFormData>;
  onSubmit: (data: CharacterFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  /** Full-size portrait URL for cropping dialog (original card image) */
  portraitSrc?: string;
  /** Character id for previewing server-side temporary avatar crops */
  characterId?: string;
}

const cardTypeOptions = [
  { label: "Character", value: "character" },
  { label: "Persona", value: "persona" },
  { label: "Narrator (not yet implemented)", value: "scenario" },
  { label: "Group (not yet implemented)", value: "group" },
];

export function CharacterForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "Save Character",
  portraitSrc,
  characterId,
}: CharacterFormProps) {
  const methods = useForm<CharacterFormData>({
    resolver: zodResolver(characterFormSchema),
    mode: "onBlur",
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      cardType: initialData?.cardType || "character",
      starters: initialData?.starters || [],
      styleInstructions: initialData?.styleInstructions || "",
      imageDataUri: undefined, // keep existing image by default
      portraitFocalPoint: initialData?.portraitFocalPoint,
    },
  });
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors, isDirty },
  } = methods;

  const imageField = useImageField({
    initialUrl: initialData?.imageDataUri || undefined,
    initialDisplayName: "Current Portrait",
  });

  const [showCropDialog, setShowCropDialog] = useState(false);
  const openCrop = () => setShowCropDialog(true);
  const closeCrop = () => setShowCropDialog(false);

  // Build a temporary avatar URL from server with focal override for immediate preview
  const watchedFocal = useWatch({ control, name: "portraitFocalPoint" });
  const baselineFocal = initialData?.portraitFocalPoint;
  const nearlyEqual = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
  const isDifferentFocal = () => {
    if (!watchedFocal) return false;
    if (!baselineFocal) return true;
    return !(
      nearlyEqual(watchedFocal.x, baselineFocal.x) &&
      nearlyEqual(watchedFocal.y, baselineFocal.y) &&
      nearlyEqual(watchedFocal.w, baselineFocal.w) &&
      nearlyEqual(watchedFocal.h, baselineFocal.h)
    );
  };

  const buildOverrideAvatarUrl = () => {
    const fp = watchedFocal;
    if (!characterId || !portraitSrc || !fp || imageField.state.type !== "existing")
      return undefined;
    if (!isDifferentFocal()) return undefined;
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
    const url = getApiUrl(path);
    return url ?? path;
  };

  const overridePreviewUrl = buildOverrideAvatarUrl();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      await imageField.handleFiles(files);
      // Sync RHF value (string data URI)
      setValue("imageDataUri", imageField.getSubmissionValue(), { shouldDirty: true });
      // Clear any manual focal override when selecting a new image; server will re-detect
      setValue("portraitFocalPoint", undefined, { shouldDirty: true });
    }
  };

  const handleRemoveImage = () => {
    imageField.handleRemove();

    // Clear the file input
    const fileInput = document.getElementById("image-input") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }

    // Sync RHF value (null to explicitly remove)
    setValue("imageDataUri", imageField.getSubmissionValue(), { shouldDirty: true });
  };

  const onFormSubmit = (data: CharacterFormData) => {
    onSubmit({
      ...data,
    });
  };

  // Keep RHF value in sync with image hook on drag-and-drop or other state changes
  useEffect(() => {
    const next = imageField.getSubmissionValue();
    const current = getValues("imageDataUri");
    if (next !== current) {
      setValue("imageDataUri", next, { shouldDirty: true });
    }
  }, [getValues, imageField.getSubmissionValue, setValue]);

  const hasUnsavedChanges = isDirty && !isSubmitting;
  const { showDialog, handleConfirmNavigation, handleCancelNavigation, confirmNavigation } =
    useUnsavedChangesProtection({
      hasUnsavedChanges,
      message: "You have unsaved changes to this character. Are you sure you want to leave?",
    });

  return (
    <>
      <Card.Root layerStyle="surface" maxW="900px" mx="auto">
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onFormSubmit)}>
            <Stack gap={6} p={6}>
              {/* Portrait Image Section */}
              <CharacterImageField
                imageField={imageField}
                isDisabled={isSubmitting}
                onFileChange={handleFileChange}
                onRemove={handleRemoveImage}
                onAdjustCrop={portraitSrc ? openCrop : undefined}
                overridePreviewUrl={overridePreviewUrl}
              />

              <Separator />

              {/* Basic Information Section */}
              <Stack gap={4}>
                <Heading size="md">Basic Information</Heading>

                <Field
                  label="Character Name"
                  required
                  errorText="Please enter a name for the character"
                  invalid={!!errors.name}
                >
                  <Input
                    {...register("name")}
                    placeholder="Enter character name"
                    disabled={isSubmitting}
                    autoComplete="off"
                  />
                </Field>

                <Field
                  label="Description"
                  helperText="Provide a detailed description of the character"
                >
                  <AutosizeTextarea
                    {...register("description")}
                    placeholder="Enter character description..."
                    minRows={4}
                    maxRows={99}
                    disabled={isSubmitting}
                  />
                </Field>

                <Field
                  label={
                    <>
                      Style Instructions
                      <InfoTip>
                        <Text>
                          Similar to SillyTavern post-history instructions. When it is this
                          character's turn, prompt templates can include these instructions at the
                          bottom of the prompt to heavily influence the style of the generated text.
                        </Text>
                      </InfoTip>
                    </>
                  }
                  helperText="Guidance to influence this character's writing style (tone, special formatting, etc.)"
                >
                  <AutosizeTextarea
                    {...register("styleInstructions")}
                    placeholder="e.g., Speak in clipped sentences, use dry humor"
                    minRows={4}
                    disabled={isSubmitting}
                  />
                </Field>

                <Field
                  label={
                    <>
                      Actor Type
                      <InfoTip>
                        <Text>
                          Changes some aspects of turn generation and character selection. Prompt
                          templates can access an actor's type to use different messages or wording
                          depending on the type.
                        </Text>
                        <Separator />
                        <Text>
                          <strong>Character:</strong> A standard character. No special behavior.
                        </Text>
                        <Text>
                          <strong>Persona:</strong> An actor primarily used as a stand-in for the
                          player, similar to SillyTavern personas. Persona character descriptions
                          always appear after those of other actor types (you may also choose to
                          omit them entirely). This actor is used when a prompt template calls for
                          the <Code>{`{{user}}`}</Code> variable.
                        </Text>
                        <Text>
                          <strong>Narrator:</strong> An actor that does not participate in the story
                          directly. Ideal for RPG cards that introduce random characters and events.
                          This actor is removed from the round-robin turn order. When a generation
                          request calls for a narrator, this actor is used instead of the generic
                          one.
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
                >
                  <Controller
                    name="cardType"
                    control={control}
                    render={({ field }) => (
                      <SelectRoot
                        collection={createListCollection({
                          items: cardTypeOptions,
                        })}
                        value={[field.value]}
                        onValueChange={(details) => {
                          field.onChange(details.value[0]);
                        }}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValueText placeholder="Select card type" />
                        </SelectTrigger>
                        <SelectContent>
                          {cardTypeOptions.map((option) => (
                            <SelectItem key={option.value} item={option}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </SelectRoot>
                    )}
                  />
                </Field>
              </Stack>

              <Separator />

              {/* Starters Section */}
              <CharacterStartersEditor disabled={isSubmitting} />

              <Separator />

              {/* Form Actions */}
              <HStack justify="space-between" width="full">
                <Button
                  variant="ghost"
                  onClick={() => confirmNavigation(onCancel)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="solid"
                  colorPalette="primary"
                  disabled={isSubmitting}
                  loading={isSubmitting}
                >
                  {submitLabel}
                </Button>
              </HStack>
            </Stack>
          </form>
        </FormProvider>
      </Card.Root>

      {/* Adjust Avatar Crop Dialog (edit only) */}
      {portraitSrc && (
        <AvatarCropDialog
          isOpen={showCropDialog}
          onOpenChange={({ open }) => (open ? openCrop() : closeCrop())}
          src={portraitSrc}
          initialFocal={getValues("portraitFocalPoint") ?? { x: 0.5, y: 0.3, w: 0.5, h: 0.5, c: 0 }}
          onSave={(fp) => {
            setValue("portraitFocalPoint", fp, { shouldDirty: true, shouldTouch: true });
          }}
        />
      )}

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showDialog}
        onConfirm={handleConfirmNavigation}
        onCancel={handleCancelNavigation}
        title="Unsaved Changes"
        message="You have unsaved changes to this character. Are you sure you want to leave?"
      />
    </>
  );
}
