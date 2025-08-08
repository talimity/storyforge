import {
  Button,
  EmptyState as ChakraEmptyState,
  VStack,
} from "@chakra-ui/react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onActionClick?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onActionClick,
}: EmptyStateProps) {
  return (
    <ChakraEmptyState.Root>
      <ChakraEmptyState.Content>
        <ChakraEmptyState.Indicator>{icon}</ChakraEmptyState.Indicator>
        <VStack textAlign="center">
          <ChakraEmptyState.Title>{title}</ChakraEmptyState.Title>
          <ChakraEmptyState.Description>
            {description}
          </ChakraEmptyState.Description>
        </VStack>
        {actionLabel && onActionClick && (
          <Button colorPalette="blue" onClick={onActionClick}>
            {actionLabel}
          </Button>
        )}
      </ChakraEmptyState.Content>
    </ChakraEmptyState.Root>
  );
}
