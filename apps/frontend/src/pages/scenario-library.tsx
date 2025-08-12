import { Box, Container, VStack } from "@chakra-ui/react";
import { Button } from "@/components/ui";
import { SimplePageHeader } from "@/components/ui/page-header";

export function ScenarioLibraryPage() {
  return (
    <Container>
      <SimplePageHeader
        title="Scenario Library"
        actions={[
          <Button
            key="create-scenario"
            variant="solid"
            colorPalette="primary"
            onClick={() => {}}
          >
            Create Scenario
          </Button>,
        ]}
      />
      <VStack align="start" gap={4}>
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
