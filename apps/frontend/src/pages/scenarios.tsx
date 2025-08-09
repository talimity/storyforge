import { Box, Container, Heading, Text, VStack } from "@chakra-ui/react";
import { Button } from "@/components/ui";

export function ScenariosPage() {
  return (
    <Container>
      <Heading size="xl" mb={4}>
        Scenario Library
      </Heading>
      <Text color="fg.muted" mb={4}>
        Create and manage your roleplay scenarios.
      </Text>
      <VStack align="start" gap={4}>
        <Button variant="solid" colorPalette="primary">
          Create Scenario
        </Button>
        <Box
          p={6}
          borderWidth="1px"
          borderStyle="dashed"
          borderRadius="md"
          width="100%"
          textAlign="center"
          color="gray.500"
        >
          No scenarios yet. Create your first scenario to begin.
        </Box>
      </VStack>
    </Container>
  );
}
