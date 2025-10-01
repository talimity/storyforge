import { Heading, Separator, Stack } from "@chakra-ui/react";

export function ChapterSeparator({ label }: { label?: string }) {
  return (
    <Stack p={8} textAlign="center">
      <Heading color="content.muted" fontWeight="medium">
        {label ?? "No chapters"}
      </Heading>
      <Separator />
    </Stack>
  );
}
