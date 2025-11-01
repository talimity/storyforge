import { Heading, HStack, Stack } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface TurnHeaderProps {
  avatar?: ReactNode;
  title: string;
  metadata?: readonly ReactNode[];
  rightSlot?: ReactNode;
}

export function TurnHeader({ avatar, title, metadata, rightSlot }: TurnHeaderProps) {
  const filteredMetadata = metadata?.filter((item): item is ReactNode => !!item) ?? [];
  const hasMetadata = filteredMetadata.length > 0;

  return (
    <HStack justify="space-between" pb={1} align="flex-start">
      <HStack alignItems="center" gap={3}>
        {avatar}
        <Stack gap={0}>
          <Heading size="md" fontWeight="bold" layerStyle="tinted.normal">
            {title}
          </Heading>
          {hasMetadata ? <HStack gap={2}>{filteredMetadata}</HStack> : null}
        </Stack>
      </HStack>
      {rightSlot}
    </HStack>
  );
}
