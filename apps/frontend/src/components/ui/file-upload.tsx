import { Box, FileUpload, Float, Icon, Text, useFileUploadContext, VStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuFile, LuUpload } from "react-icons/lu";

export function ConditionalDropzone(props: {
  header: ReactNode;
  hint?: ReactNode;
  maxFiles: number;
}) {
  const fileUpload = useFileUploadContext();
  const acceptedFiles = fileUpload.acceptedFiles;

  if (acceptedFiles.length >= props.maxFiles) {
    return null;
  }

  return (
    <FileUpload.Dropzone>
      <Icon size="md" color="fg.muted">
        <LuUpload />
      </Icon>
      <FileUpload.DropzoneContent>
        <VStack gap={1}>
          <Text fontWeight="medium" textAlign="center">
            {props.header}
          </Text>
          {props.hint && (
            <Text fontSize="xs" color="fg.muted" textAlign="center">
              {props.hint}
            </Text>
          )}
        </VStack>
      </FileUpload.DropzoneContent>
    </FileUpload.Dropzone>
  );
}

export function ThumbnailFileList() {
  const fileUpload = useFileUploadContext();
  const files = fileUpload.acceptedFiles;
  if (files.length === 0) return null;
  return (
    <FileUpload.ItemGroup>
      {files.map((file) => (
        <FileUpload.Item h="auto" boxSize="48" p="2" file={file} key={file.name}>
          <VStack h="full" w="full" justify="center" gap={0.5}>
            {file.type.startsWith("image/") ? (
              <FileUpload.ItemPreviewImage
                h="100%"
                w="100%"
                justifySelf="center"
                css={{ objectFit: "contain" }}
              />
            ) : (
              <Box h="full" w="full" display="flex" alignItems="center" justifyContent="center">
                <Icon size="2xl" color="fg.muted">
                  <LuFile />
                </Icon>
              </Box>
            )}
            <Text fontSize="xs" w="full" textAlign="center" lineHeight="short" lineClamp={3}>
              {file.name}
            </Text>
            <FileUpload.ItemSizeText />
          </VStack>
          <Float placement="top-end">
            <FileUpload.ItemDeleteTrigger />
          </Float>
        </FileUpload.Item>
      ))}
    </FileUpload.ItemGroup>
  );
}
