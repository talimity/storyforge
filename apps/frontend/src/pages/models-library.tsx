import { Box, Container, Grid, Tabs, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LuPlugZap, LuPlus } from "react-icons/lu";
import { TbCube } from "react-icons/tb";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { CreateModelProfileDialog } from "@/features/inference-config/components/create-model-profile-dialog";
import { CreateProviderDialog } from "@/features/inference-config/components/create-provider-dialog";
import {
  ModelProfileCard,
  ModelProfileCardSkeleton,
} from "@/features/inference-config/components/model-profile-card";
import {
  ProviderCard,
  ProviderCardSkeleton,
} from "@/features/inference-config/components/provider-card";
import { useTRPC } from "@/lib/trpc";

export function ModelsPage() {
  const trpc = useTRPC();
  const [isCreateModelDialogOpen, setIsCreateModelDialogOpen] = useState(false);
  const [isCreateProviderDialogOpen, setIsCreateProviderDialogOpen] = useState(false);
  const modelProfilesQuery = useQuery(trpc.providers.listModelProfiles.queryOptions());
  const providersQuery = useQuery(trpc.providers.listProviders.queryOptions());

  const { data: modelProfiles, isLoading: modelsLoading } = modelProfilesQuery;
  const { data: providers, isLoading: providersLoading } = providersQuery;

  const modelProfileList = modelProfiles?.modelProfiles || [];
  const providerList = providers?.providers || [];

  return (
    <Container>
      <PageHeader.Root>
        <PageHeader.Title>Models</PageHeader.Title>
        <PageHeader.Tagline>Manage AI models and provider configurations</PageHeader.Tagline>
        <PageHeader.Tabs
          tabs={[
            {
              value: "models",
              label: "Models",
              icon: <TbCube />,
              badge: modelProfileList.length || undefined,
            },
            {
              value: "providers",
              label: "Providers",
              icon: <LuPlugZap />,
              badge: providerList.length || undefined,
            },
          ]}
          defaultValue="models"
        >
          <PageHeader.Controls>
            <Tabs.Context>
              {(context) =>
                context.value === "models" ? (
                  <Button
                    variant="solid"
                    colorPalette="primary"
                    onClick={() => setIsCreateModelDialogOpen(true)}
                  >
                    <LuPlus />
                    Add Model
                  </Button>
                ) : (
                  <Button
                    variant="solid"
                    colorPalette="primary"
                    onClick={() => setIsCreateProviderDialogOpen(true)}
                  >
                    <LuPlus />
                    Add Provider
                  </Button>
                )
              }
            </Tabs.Context>
          </PageHeader.Controls>

          <Tabs.Content value="models">
            <Box pt={6}>
              {modelsLoading ? (
                <Grid templateColumns="repeat(auto-fit, 320px)" gap={4}>
                  {Array.from({ length: 8 }, (_, i) => `model-skeleton-${i}`).map((key) => (
                    <ModelProfileCardSkeleton key={key} />
                  ))}
                </Grid>
              ) : modelProfilesQuery.error ? (
                <Text color="red.500">
                  Failed to load model profiles: {modelProfilesQuery.error.message}
                </Text>
              ) : modelProfileList.length === 0 ? (
                <EmptyState
                  icon={<TbCube />}
                  title="No model profiles configured"
                  description="Create a model profile to use for generating content."
                  actionLabel="Add Model"
                  onActionClick={() => setIsCreateModelDialogOpen(true)}
                />
              ) : (
                <Grid templateColumns="repeat(auto-fit, 320px)" gap={4}>
                  {modelProfileList.map((modelProfile) => (
                    <ModelProfileCard key={modelProfile.id} modelProfile={modelProfile} />
                  ))}
                </Grid>
              )}
            </Box>
          </Tabs.Content>

          <Tabs.Content value="providers">
            <Box pt={6}>
              {providersLoading ? (
                <Grid templateColumns="repeat(auto-fit, 320px)" gap={4}>
                  {Array.from({ length: 8 }, (_, i) => `provider-skeleton-${i}`).map((key) => (
                    <ProviderCardSkeleton key={key} />
                  ))}
                </Grid>
              ) : providersQuery.error ? (
                <Text color="red.500">
                  Failed to load providers: {providersQuery.error.message}
                </Text>
              ) : providerList.length === 0 ? (
                <EmptyState
                  icon={<LuPlugZap />}
                  title="No providers yet"
                  description="Set up a provider to connect to AI models."
                  actionLabel="Add Provider"
                  onActionClick={() => setIsCreateProviderDialogOpen(true)}
                />
              ) : (
                <Grid templateColumns="repeat(auto-fit, 320px)" gap={4}>
                  {providerList.map((provider) => (
                    <ProviderCard key={provider.id} provider={provider} />
                  ))}
                </Grid>
              )}
            </Box>
          </Tabs.Content>
        </PageHeader.Tabs>
      </PageHeader.Root>

      <CreateModelProfileDialog
        isOpen={isCreateModelDialogOpen}
        onOpenChange={setIsCreateModelDialogOpen}
      />

      <CreateProviderDialog
        isOpen={isCreateProviderDialogOpen}
        onOpenChange={setIsCreateProviderDialogOpen}
      />
    </Container>
  );
}
