import { Heading, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import type { IconType } from "react-icons";

export function TabHeader({
  title,
  description,
  icon,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon: IconType;
  actions?: React.ReactNode;
}) {
  const IconComponent = icon;
  return (
    <Stack direction="row" justify="space-between">
      <HStack gap={3}>
        <IconComponent size={20} />
        <VStack align="start" gap={0}>
          <Heading size="md">{title}</Heading>
          <Text color="content.muted" fontSize="sm">
            {description}
          </Text>
        </VStack>
      </HStack>
      {actions}
    </Stack>
  );
}
