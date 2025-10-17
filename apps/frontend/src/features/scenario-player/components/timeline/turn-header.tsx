import { Heading, HStack, Stack } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface TurnHeaderProps {
  avatar?: ReactNode;
  title: string;
  metadata?: readonly ReactNode[];
  rightSlot?: ReactNode;
}

export function TurnHeader({ avatar, title, metadata, rightSlot }: TurnHeaderProps) {
  const items = metadata ?? [];
  const renderedItems: ReactNode[] = [];

  for (const item of items) {
    if (item === null || item === undefined || item === false) {
      continue;
    }
    renderedItems.push(item);
  }

  const hasMetadata = renderedItems.length > 0;

  return (
    <HStack justify="space-between" pb={1} align="flex-start">
      <HStack alignItems="center" gap={3}>
        {avatar ?? null}
        <Stack gap={0}>
          <Heading size="md" fontWeight="bold" layerStyle="tinted.normal">
            {title}
          </Heading>
          {hasMetadata ? <HStack gap={2}>{renderedItems.map((item) => item)}</HStack> : null}
        </Stack>
      </HStack>
      {rightSlot ?? null}
    </HStack>
  );
}
