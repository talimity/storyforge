import {
  Box,
  CloseButton,
  FileUpload,
  Flex,
  HStack,
  Image,
  Stack,
  useBreakpointValue,
  useDisclosure,
} from "@chakra-ui/react";
import type { CharacterWithRelations } from "@storyforge/contracts";
import { useStore } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { ConditionalDropzone, ThumbnailFileList } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/index";
import { AvatarCropDialog } from "@/features/characters/components/form/avatar-crop-dialog";
import { characterFormDefaultValues } from "@/features/characters/components/form/form-schemas";
import { withForm } from "@/lib/app-form";
import { showErrorToast, showSuccessToast } from "@/lib/error-handling";
import { convertFileToDataUri } from "@/lib/file-to-data-uri";
import { getApiUrl } from "@/lib/get-api-url";
import { useTRPC } from "@/lib/trpc";

const DEFAULT_FOCAL = { x: 0.5, y: 0.3, w: 0.5, h: 0.5, c: 0 } as const;

type CharacterPortraitFieldProps = {
  character?: CharacterWithRelations;
  tempAvatarUrl?: string;
};

export const CharacterPortraitField = withForm({
  defaultValues: characterFormDefaultValues,
  props: {
    character: undefined,
  } satisfies CharacterPortraitFieldProps as CharacterPortraitFieldProps,
  render: function Render({ form, character, tempAvatarUrl }) {
    const imageDataUri = useStore(form.store, (s) => s.values.imageDataUri);

    const needsUpload = !character?.imagePath || !character?.avatarPath || imageDataUri === null;

    return (
      <>
        {needsUpload ? (
          <PortraitUploader form={form} />
        ) : (
          <PortraitManager
            form={form}
            charaId={character?.id || ""}
            portraitPath={getApiUrl(character.imagePath) || ""}
            avatarPath={tempAvatarUrl || getApiUrl(character.avatarPath) || ""}
          />
        )}
      </>
    );
  },
});

const PortraitUploader = withForm({
  defaultValues: characterFormDefaultValues,
  render: function Render({ form }) {
    return (
      <Stack gap={4}>
        <form.AppField name="imageDataUri">
          {(field) => {
            return (
              <field.Field
                label="Portrait Image"
                helperText="Choose an image to represent this character."
              >
                <FileUpload.Root
                  accept="image/*"
                  maxFileSize={10 * 1024 * 1024}
                  maxWidth="full"
                  alignItems="stretch"
                  maxFiles={1}
                  onFileChange={async (change) => {
                    const f = change.acceptedFiles.at(0);
                    if (!f) return field.handleChange(null);

                    const asDataUri = await convertFileToDataUri(f);
                    field.handleChange(asDataUri);
                    field.handleBlur();
                  }}
                >
                  <FileUpload.HiddenInput />
                  <ConditionalDropzone
                    header="Drop portrait image here or click to browse"
                    hint="Supports PNG and JPEG files up to 10MB. A 2:3 aspect ratio is recommended."
                    maxFiles={1}
                  />
                  <ThumbnailFileList />
                </FileUpload.Root>
              </field.Field>
            );
          }}
        </form.AppField>
      </Stack>
    );
  },
});

const PortraitManager = withForm({
  props: {
    portraitPath: "",
    avatarPath: "",
    charaId: "",
  },
  defaultValues: characterFormDefaultValues,
  render: function Render({ form, portraitPath, avatarPath, charaId }) {
    const trpc = useTRPC();
    const isMobile = useBreakpointValue({ base: true, md: false });
    const {
      open: isCropDialogOpen,
      onOpen: openCropDialog,
      onClose: closeCropDialog,
    } = useDisclosure();

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

    return (
      <HStack align="start" gap={6} justify="center">
        <form.AppField name="imageDataUri">
          {(field) => {
            return (
              <field.Field label="Portrait" width="auto">
                <Box
                  w={isMobile ? "3xs" : "2xs"}
                  position="relative"
                  layerStyle="surface"
                  overflow="hidden"
                  borderRadius="md"
                >
                  <CloseButton
                    position="absolute"
                    top={2}
                    right={2}
                    aria-label="Clear portrait"
                    variant="solid"
                    zIndex={1}
                    size={isMobile ? "xs" : "2xs"}
                    mb={2}
                    onClick={() => form.setFieldValue("imageDataUri", null)}
                  />
                  <Image
                    src={portraitPath}
                    alt="Character portrait image"
                    aspectRatio={2 / 3}
                    fit="cover"
                  />
                </Box>
              </field.Field>
            );
          }}
        </form.AppField>

        <form.AppField name="portraitFocalPoint">
          {(field) => {
            return (
              <>
                <field.Field label="Avatar" width="auto">
                  <Flex flexDirection="column" gap={2} align="start" flexWrap="nowrap">
                    <Image
                      src={avatarPath}
                      alt="Character avatar image"
                      aspectRatio={1}
                      boxSize={isMobile ? "64px" : "120px"}
                      borderRadius="md"
                      border="1px solid"
                      layerStyle="surface"
                    />
                    <Button
                      size={isMobile ? "sm" : "md"}
                      width="full"
                      variant="outline"
                      onClick={openCropDialog}
                    >
                      Adjust Crop
                    </Button>
                    <Button
                      size={isMobile ? "sm" : "md"}
                      width="full"
                      variant="outline"
                      onClick={() => resetCropMutation.mutate({ id: charaId })}
                      loading={resetCropMutation.isPending}
                    >
                      Auto Crop
                    </Button>
                  </Flex>
                </field.Field>
                <AvatarCropDialog
                  isOpen={isCropDialogOpen}
                  onOpenChange={({ open }) => (open ? openCropDialog() : closeCropDialog())}
                  src={portraitPath}
                  initialFocal={field.getValue() ?? DEFAULT_FOCAL}
                  onSave={(fp) => {
                    field.setValue(fp);
                  }}
                />
              </>
            );
          }}
        </form.AppField>
      </HStack>
    );
  },
});
