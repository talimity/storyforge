import { Container, Grid, HStack, Text } from "@chakra-ui/react";
import { createId } from "@storyforge/utils";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LuImport, LuPlus } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { LorebookCard, LorebookCardSkeleton } from "@/features/lorebooks/components/lorebook-card";
import { LorebookImportDialog } from "@/features/lorebooks/components/lorebook-import-dialog";
import { useTRPC } from "@/lib/trpc";

export function LorebooksPage() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const [importOpen, setImportOpen] = useState(false);

  const lorebooksQuery = useQuery(trpc.lorebooks.list.queryOptions({}));
  const lorebooks = lorebooksQuery.data?.lorebooks ?? [];
  const isLoading = lorebooksQuery.isLoading;
  const error = lorebooksQuery.error;

  return (
    <Container>
      <PageHeader.Root>
        <PageHeader.Title>Lorebooks</PageHeader.Title>
        <PageHeader.Tagline>
          Manage reusable lore and world information imported from character cards or files.
        </PageHeader.Tagline>
        <PageHeader.Controls>
          <HStack gap={3}>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <LuImport /> Import Lorebook
            </Button>
            <Button colorPalette="primary" onClick={() => navigate("/lorebooks/create")}>
              <LuPlus /> Create Lorebook
            </Button>
          </HStack>
        </PageHeader.Controls>
      </PageHeader.Root>

      {isLoading ? (
        <Grid templateColumns="repeat(auto-fit, minmax(320px, 1fr))" gap={4} py={6}>
          {[...Array(6)].map(() => (
            <LorebookCardSkeleton key={createId()} />
          ))}
        </Grid>
      ) : error ? (
        <Text color="fg.error">Failed to load lorebooks: {error.message}</Text>
      ) : lorebooks.length === 0 ? (
        <EmptyState
          icon={<LuImport />}
          title="No lorebooks yet"
          description="Import a lorebook from a SillyTavern export or create one from scratch."
          actionLabel="Import Lorebook"
          onActionClick={() => setImportOpen(true)}
        />
      ) : (
        <Grid templateColumns="repeat(auto-fit, minmax(320px, 1fr))" gap={4} py={6}>
          {lorebooks.map((lorebook) => (
            <LorebookCard key={lorebook.id} lorebook={lorebook} />
          ))}
        </Grid>
      )}

      <LorebookImportDialog isOpen={importOpen} onOpenChange={({ open }) => setImportOpen(open)} />
    </Container>
  );
}
