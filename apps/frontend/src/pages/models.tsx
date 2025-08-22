import { Box, Container, Grid, Text } from "@chakra-ui/react";
import { useState } from "react";
import { FaPlus } from "react-icons/fa6";
import { CreateModelProfileDialog } from "@/components/features/inference/create-model-profile-dialog";
import { ModelProfileCard } from "@/components/features/inference/model-profile-card";
import { Button, EmptyState, SimplePageHeader } from "@/components/ui";
import { trpc } from "@/lib/trpc";

export function ModelsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const modelProfilesQuery = trpc.providers.listModelProfiles.useQuery();

  const { data: modelProfiles, isLoading, error } = modelProfilesQuery;

  if (isLoading) {
    return (
      <Container>
        <SimplePageHeader
          title="Models"
          tagline="Manage your AI models and configurations."
        />
        <Box p={6}>
          <Text>Loading model profiles...</Text>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <SimplePageHeader
          title="Models"
          tagline="Manage your AI models and configurations."
        />
        <Box p={6}>
          <Text color="red.500">
            Failed to load model profiles: {error.message}
          </Text>
        </Box>
      </Container>
    );
  }

  const modelProfileList = modelProfiles?.modelProfiles || [];

  return (
    <Container>
      <SimplePageHeader
        title="Models"
        tagline="Manage your AI models and configurations."
        actions={[
          <Button
            key="add-model"
            variant="solid"
            colorPalette="primary"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <FaPlus />
            Add Model
          </Button>,
        ]}
      />

      {modelProfileList.length === 0 ? (
        <EmptyState
          icon="🤖"
          title="No model profiles configured"
          description="Create a model profile to define which models to use for different tasks."
          actionLabel="Add Model"
          onActionClick={() => setIsCreateDialogOpen(true)}
        />
      ) : (
        <Grid templateColumns="repeat(auto-fit, 320px)" gap={4}>
          {modelProfileList.map((modelProfile) => (
            <ModelProfileCard
              key={modelProfile.id}
              modelProfile={modelProfile}
            />
          ))}
        </Grid>
      )}

      <CreateModelProfileDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </Container>
  );
}
