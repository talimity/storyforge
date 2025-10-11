import { Container, SimpleGrid, Tabs } from "@chakra-ui/react";
import { createId } from "@storyforge/utils";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LuPlugZap, LuPlus } from "react-icons/lu";
import { TbCube } from "react-icons/tb";
import { Button, EmptyState, ErrorEmptyState, PageHeader } from "@/components/ui";
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

function ModelsPage() {
  const trpc = useTRPC();
  const [isCreateModelDialogOpen, setIsCreateModelDialogOpen] = useState(false);
  const [isCreateProviderDialogOpen, setIsCreateProviderDialogOpen] = useState(false);
  const modelProfilesQuery = useQuery(trpc.providers.listModelProfiles.queryOptions());
  const providersQuery = useQuery(trpc.providers.list.queryOptions());

  const modelList = modelProfilesQuery.data?.modelProfiles || [];
  const providerList = providersQuery.data?.providers || [];

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
              badge: modelList.length || undefined,
            },
            {
              value: "providers",
              label: "Providers",
              icon: <LuPlugZap />,
              badge: providerList.length || undefined,
            },
          ]}
          defaultValue="models"
          lazyMount
          unmountOnExit
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
            {modelProfilesQuery.error ? (
              <ErrorEmptyState
                title="Failed to load model profiles"
                description={modelProfilesQuery.error.message}
                onActionClick={modelProfilesQuery.refetch}
              />
            ) : modelList.length === 0 && !modelProfilesQuery.isLoading ? (
              <EmptyState
                icon={<TbCube />}
                title="No model profiles yet"
                description="Create a model profile to use for generating content."
                actionLabel="Add Model"
                onActionClick={() => setIsCreateModelDialogOpen(true)}
              />
            ) : (
              <SimpleGrid minChildWidth="xs" gap={6}>
                {modelProfilesQuery.isLoading
                  ? [...Array(15)].map(() => <ModelProfileCardSkeleton key={createId()} />)
                  : modelList.map((mp) => <ModelProfileCard key={mp.id} modelProfile={mp} />)}
              </SimpleGrid>
            )}
          </Tabs.Content>

          <Tabs.Content value="providers">
            {providersQuery.error ? (
              <ErrorEmptyState
                title="Failed to load providers"
                description={providersQuery.error.message}
                onActionClick={providersQuery.refetch}
              />
            ) : providerList.length === 0 && !providersQuery.isLoading ? (
              <EmptyState
                icon={<LuPlugZap />}
                title="No providers yet"
                description="Set up a provider to connect to AI models."
                actionLabel="Add Provider"
                onActionClick={() => setIsCreateProviderDialogOpen(true)}
              />
            ) : (
              <SimpleGrid minChildWidth="xs" gap={6}>
                {providersQuery.isLoading
                  ? [...Array(15)].map(() => <ProviderCardSkeleton key={createId()} />)
                  : providerList.map((p) => <ProviderCard key={p.id} provider={p} />)}
              </SimpleGrid>
            )}
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

export default ModelsPage;
