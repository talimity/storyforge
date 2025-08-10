import { Box } from "@chakra-ui/react";
import { Button, SimplePageHeader } from "@/components/ui";

export function ModelsPage() {
  return (
    <>
      <SimplePageHeader
        title="Models"
        tagline="Manage your AI models and configurations."
        actions={[
          <Button
            key="add-model"
            variant="solid"
            colorPalette="primary"
            onClick={() => {}}
          >
            Add Model
          </Button>,
        ]}
      />
      <Box>TODO</Box>
    </>
  );
}
