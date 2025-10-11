import { Accordion, Badge, HStack, Skeleton, Stack, Text } from "@chakra-ui/react";
import { Suspense } from "react";

/**
 * Wraps lorebook extension content in an accordion section with a Suspense.
 */
export const LorebookExtensionsSection = ({ children }: { children?: React.ReactNode }) => (
  <Accordion.Root lazyMount collapsible defaultValue={[]}>
    <Accordion.Item value="metadata">
      <Accordion.ItemTrigger direction="row">
        <Stack width="100%">
          <HStack gap={2}>
            <Text fontWeight="medium">Extensions</Text>
            <Badge colorPalette="purple" variant="surface">
              Advanced
            </Badge>
          </HStack>
          <Text fontSize="sm" color="content.muted">
            Store custom metadata consumed by other tools. Leave empty if unused.
          </Text>
        </Stack>
        <Accordion.ItemIndicator />
      </Accordion.ItemTrigger>
      <Accordion.ItemContent>
        <Accordion.ItemBody>
          <Suspense fallback={<Skeleton height="200px" borderRadius="md" />}>{children}</Suspense>
        </Accordion.ItemBody>
      </Accordion.ItemContent>
    </Accordion.Item>
  </Accordion.Root>
);
