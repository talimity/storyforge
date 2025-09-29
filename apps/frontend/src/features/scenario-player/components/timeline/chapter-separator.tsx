import { Separator, Stack, Text } from "@chakra-ui/react";

export function ChapterSeparator({ label }: { label?: string }) {
  return (
    <Stack p={8} textAlign="center">
      <Text color="content.muted" fontWeight="medium">
        {label ?? "No chapters"}
      </Text>
      <Separator />
    </Stack>
  );
}
