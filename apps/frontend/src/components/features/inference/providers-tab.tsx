import { Box, Grid, HStack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { FaPlus } from "react-icons/fa6";
import { Button, EmptyState } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { CreateProviderDialog } from "./create-provider-dialog";
import { ProviderCard } from "./provider-card";

export function ProvidersTab() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const providersQuery = trpc.providers.listProviders.useQuery();

  const { data: providers, isLoading, error } = providersQuery;

  if (isLoading) {
    return (
      <Box p={6}>
        <Text>Loading providers...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={6}>
        <Text color="red.500">Failed to load providers: {error.message}</Text>
      </Box>
    );
  }

  const providerList = providers?.providers || [];

  return (
    <Box>
      <HStack justify="space-between" mb={6}>
        <Box>
          <Text fontSize="lg" fontWeight="semibold">
            Provider Configurations
          </Text>
          <Text color="content.muted" fontSize="sm">
            Configure API access for different LLM providers
          </Text>
        </Box>
        <Button
          colorPalette="primary"
          variant="solid"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <FaPlus />
          Add Provider
        </Button>
      </HStack>

      {providerList.length === 0 ? (
        <EmptyState
          icon="🔧"
          title="No providers configured"
          description="Add a provider configuration to get started with LLM inference."
          actionLabel="Add Provider"
          onActionClick={() => setIsCreateDialogOpen(true)}
        />
      ) : (
        <Grid templateColumns="repeat(auto-fit, 320px)" gap={4}>
          {providerList.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </Grid>
      )}

      <CreateProviderDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </Box>
  );
}
