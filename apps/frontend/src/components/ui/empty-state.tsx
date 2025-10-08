import { Button, EmptyState as ChakraEmptyState, Text, VStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuTriangleAlert } from "react-icons/lu";

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
          <ChakraEmptyState.Description>{description}</ChakraEmptyState.Description>
        </VStack>
        {actionLabel && onActionClick && (
          <Button colorPalette="accent" onClick={onActionClick}>
            {actionLabel}
          </Button>
        )}
      </ChakraEmptyState.Content>
    </ChakraEmptyState.Root>
  );
}

type ErrorEmptyStateProps = Omit<EmptyStateProps, "icon">;

export function ErrorEmptyState(props: ErrorEmptyStateProps) {
  const { title, description, actionLabel = "Try again", onActionClick } = props;
  return (
    <ChakraEmptyState.Root>
      <ChakraEmptyState.Content>
        <ChakraEmptyState.Indicator color="fg.error">
          <LuTriangleAlert />
        </ChakraEmptyState.Indicator>
        <VStack textAlign="center">
          <ChakraEmptyState.Title color="fg.error">
            <Text>{title}</Text>
          </ChakraEmptyState.Title>
          <ChakraEmptyState.Description color="fg.error/70">
            {description}
          </ChakraEmptyState.Description>
        </VStack>
        {actionLabel && onActionClick && (
          <Button colorPalette="red" variant="outline" onClick={onActionClick}>
            {actionLabel}
          </Button>
        )}
      </ChakraEmptyState.Content>
    </ChakraEmptyState.Root>
  );
}
