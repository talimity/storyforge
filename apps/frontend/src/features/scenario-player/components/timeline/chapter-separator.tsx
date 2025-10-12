import { Heading, Separator, Stack } from "@chakra-ui/react";

export function ChapterSeparator({ label }: { label?: string }) {
  if (!label) {
    return <Separator />;
  }
  return (
    <Stack p={8} textAlign="center">
      <Heading color="content.muted" fontWeight="medium">
        {label}
      </Heading>
      <Separator />
    </Stack>
  );
}
