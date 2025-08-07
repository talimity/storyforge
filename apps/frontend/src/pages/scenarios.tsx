import { Box, Button, Heading, Text, VStack } from "@chakra-ui/react";

export function ScenariosPage() {
  return (
    <Box>
      <Heading size="lg" mb={4}>
        Scenario Library
      </Heading>
      <VStack align="start" gap={4}>
        <Text>Create and manage your roleplay scenarios.</Text>
        <Button variant="solid" colorPalette="green">
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
    </Box>
  );
}
