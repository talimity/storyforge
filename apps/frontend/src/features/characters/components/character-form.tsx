import {
  Card,
  createListCollection,
  Heading,
  HStack,
  Input,
  Separator,
  Stack,
  Textarea,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCharacterSchema } from "@storyforge/contracts";
import type * as React from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import type { z } from "zod";
import { UnsavedChangesDialog } from "@/components/dialogs/unsaved-changes-dialog";
import {
  Button,
  Field,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui/index";
import { useImageField } from "@/hooks/use-image-field";
import { useUnsavedChangesProtection } from "@/hooks/use-unsaved-changes-protection";
import { CharacterImageField } from "./character-image-field";
import { CharacterStartersEditor } from "./character-starters-editor";

const characterFormSchema = createCharacterSchema
  .pick({
    name: true,
    description: true,
    cardType: true,
    starters: true,
    styleInstructions: true,
  })
  .extend({
    cardType: createCharacterSchema.shape.cardType.unwrap(), // remove default
    starters: createCharacterSchema.shape.starters.unwrap(),
  });

type CharacterFormData = z.infer<typeof characterFormSchema>;

interface CharacterFormProps {
  initialData?: Partial<CharacterFormData> & { imageDataUri?: string };
  onSubmit: (data: CharacterFormData & { imageDataUri?: string | null | undefined }) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

const cardTypeOptions = [
  { label: "Character", value: "character" },
  { label: "Group", value: "group" },
  { label: "Persona", value: "persona" },
  { label: "Narrator", value: "scenario" },
];

export function CharacterForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "Save Character",
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
    },
  });
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = methods;

  const imageField = useImageField({
    initialUrl: initialData?.imageDataUri,
    initialDisplayName: "Current Portrait",
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      await imageField.handleFiles(files);
    }
  };

  const handleRemoveImage = () => {
    imageField.handleRemove();

    // Clear the file input
    const fileInput = document.getElementById("image-input") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const onFormSubmit = (data: CharacterFormData) => {
    onSubmit({
      ...data,
      imageDataUri: imageField.getSubmissionValue(),
    });
  };

  const hasUnsavedChanges = (isDirty || imageField.isDirty()) && !isSubmitting;

  // Add unsaved changes protection
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
              />

              <Separator />

              {/* Basic Information Section */}
              <Stack gap={4}>
                <Heading size="md" textStyle="heading">
                  Basic Information
                </Heading>

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
                  <Textarea
                    {...register("description")}
                    placeholder="Enter character description..."
                    rows={4}
                    autoresize
                    disabled={isSubmitting}
                    autoComplete="off"
                  />
                </Field>

                <Field
                  label="Style Instructions"
                  helperText="Optional: guidance to influence this character's writing style (tone, formatting, POV, etc.)"
                >
                  <Textarea
                    {...register("styleInstructions")}
                    placeholder="e.g., Speak in clipped sentences, use dry humor; avoid emojis."
                    rows={4}
                    autoresize
                    disabled={isSubmitting}
                    autoComplete="off"
                  />
                </Field>

                <Field label="Card Type" helperText="Select the type of character card">
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
