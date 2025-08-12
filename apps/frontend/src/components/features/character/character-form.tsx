import {
  Box,
  Card,
  createListCollection,
  Heading,
  HStack,
  Icon,
  Image,
  Input,
  Separator,
  Stack,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCharacterSchema } from "@storyforge/api";
import { Controller, useForm } from "react-hook-form";
import { LuUpload, LuX } from "react-icons/lu";
import type { z } from "zod";
import { UnsavedChangesDialog } from "@/components/dialogs/unsaved-changes";
import {
  Button,
  Field,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui";
import { useImageField } from "@/lib/hooks/use-image-field";
import { useUnsavedChangesProtection } from "@/lib/hooks/use-unsaved-changes-protection";

const characterFormSchema = createCharacterSchema
  .pick({ name: true, description: true, cardType: true })
  .extend({
    cardType: createCharacterSchema.shape.cardType.removeDefault(),
  });

type CharacterFormData = z.infer<typeof characterFormSchema>;

interface CharacterFormProps {
  initialData?: Partial<CharacterFormData> & { imageDataUri?: string };
  onSubmit: (
    data: CharacterFormData & { imageDataUri?: string | null | undefined }
  ) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

const cardTypeOptions = [
  { label: "Character", value: "character" },
  { label: "Group", value: "group" },
  { label: "Persona", value: "persona" },
  { label: "Scenario", value: "scenario" },
];

export function CharacterForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "Save Character",
}: CharacterFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<CharacterFormData>({
    resolver: zodResolver(characterFormSchema),
    mode: "onBlur",
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      cardType: initialData?.cardType || "character",
    },
  });

  const imageField = useImageField({
    initialUrl: initialData?.imageDataUri,
    initialDisplayName: "Current Portrait",
  });

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      await imageField.handleFiles(files);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    await imageField.handleFiles(files);
  };

  const handleRemoveImage = () => {
    imageField.handleRemove();

    // Clear the file input
    const fileInput = document.getElementById(
      "image-input"
    ) as HTMLInputElement;
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
  const {
    showDialog,
    handleConfirmNavigation,
    handleCancelNavigation,
    confirmNavigation,
  } = useUnsavedChangesProtection({
    hasUnsavedChanges,
    message:
      "You have unsaved changes to this character. Are you sure you want to leave?",
  });

  return (
    <>
      <Card.Root layerStyle="surface" maxW="900px" mx="auto">
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <Stack gap={6} p={6}>
            {/* Portrait Image Section */}
            <Stack gap={4}>
              <Heading size="md" textStyle="heading">
                Portrait Image
              </Heading>

              {!imageField.hasImage && (
                <Box
                  border="2px dashed"
                  borderColor="border.muted"
                  borderRadius="md"
                  p={8}
                  textAlign="center"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  _hover={{ borderColor: "border.emphasized" }}
                  cursor="pointer"
                  onClick={() =>
                    document.getElementById("image-input")?.click()
                  }
                >
                  <VStack gap={3}>
                    <Icon fontSize="3xl" color="fg.muted">
                      <LuUpload />
                    </Icon>
                    <VStack gap={1}>
                      <Text fontWeight="medium">
                        Drop portrait image here or click to browse
                      </Text>
                      <Text fontSize="sm" color="fg.muted">
                        Supports PNG and JPEG files up to 10MB. A 2:3 aspect
                        ratio is recommended.
                      </Text>
                    </VStack>
                    <Button size="sm" variant="outline" disabled={isSubmitting}>
                      Browse Files
                    </Button>
                  </VStack>

                  <input
                    id="image-input"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                    disabled={isSubmitting}
                  />
                </Box>
              )}

              {imageField.hasImage && (
                <HStack
                  p={4}
                  layerStyle="surface"
                  justify="space-between"
                  align="center"
                >
                  <HStack gap={3}>
                    {imageField.getPreviewUrl() && (
                      <Image
                        src={imageField.getPreviewUrl() || undefined}
                        alt="Portrait preview"
                        boxSize="120px"
                        borderRadius="md"
                        fit="cover"
                      />
                    )}
                    <VStack gap={0} align="start">
                      <Text fontSize="sm" fontWeight="medium">
                        {imageField.getDisplayName()}
                      </Text>
                      {imageField.getFileSize() && (
                        <Text fontSize="xs" color="fg.muted">
                          {imageField.getFileSize()}
                        </Text>
                      )}
                    </VStack>
                  </HStack>
                  {!isSubmitting && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleRemoveImage}
                    >
                      <LuX />
                    </Button>
                  )}
                </HStack>
              )}
            </Stack>

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
                label="Card Type"
                helperText="Select the type of character card"
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
                colorPalette="primary"
                disabled={isSubmitting}
                loading={isSubmitting}
                loadingText="Saving..."
              >
                {submitLabel}
              </Button>
            </HStack>
          </Stack>
        </form>
      </Card.Root>

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showDialog}
        onConfirm={handleConfirmNavigation}
        onCancel={handleCancelNavigation}
      />
    </>
  );
}
