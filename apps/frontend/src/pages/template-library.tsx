import {
  createListCollection,
  HStack,
  Input,
  InputGroup,
  SimpleGrid,
  Stack,
} from "@chakra-ui/react";
import { createId } from "@storyforge/utils";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LuFileText, LuPlus, LuSearch, LuUpload } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import {
  Button,
  EmptyState,
  ErrorEmptyState,
  Field,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  SimplePageHeader,
} from "@/components/ui";
import { PageContainer } from "@/components/ui/page-container";
import { TemplateCard, TemplateCardSkeleton } from "@/features/templates/components/template-card";
import { TemplateImportDialog } from "@/features/templates/components/template-import-dialog";
import { useTRPC } from "@/lib/trpc";

const taskTypeOptions = [
  { value: "", label: "All Prompt Types" },
  { value: "turn_generation", label: "Turn Generation" },
  { value: "chapter_summarization", label: "Chapter Summarization" },
  { value: "writing_assistant", label: "Writing Assistant" },
] as const;
type TaskFilter = (typeof taskTypeOptions)[number]["value"];

function TemplatesPage() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const templatesQuery = useQuery(
    trpc.templates.list.queryOptions({
      task: taskFilter || undefined,
      search: searchQuery || undefined,
    })
  );

  const templates = templatesQuery.data?.templates || [];
  const handleCreateTemplate = () => navigate("/templates/select-task");
  const handleImportTemplate = () => setIsImportDialogOpen(true);

  return (
    <PageContainer>
      <SimplePageHeader
        title="Prompt Templates"
        tagline="Manage prompt templates for generating content."
      />

      {/* Action Bar */}
      <Stack gap={4} mb={6}>
        <Stack direction={{ base: "column", lg: "row" }} justify="space-between" gap={4}>
          {/* Search and Filters */}
          <HStack
            flex="1"
            maxW={{ base: "100%", lg: "600px" }}
            gap={3}
            wrap={{ base: "wrap", sm: "nowrap" }}
          >
            <Field flex="1" minW="200px">
              <HStack position="relative">
                <InputGroup startElement={<LuSearch />}>
                  <Input
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    pl="40px"
                  />
                </InputGroup>
              </HStack>
            </Field>

            <Field minW="180px">
              <SelectRoot
                collection={createListCollection({ items: taskTypeOptions })}
                value={[taskFilter]}
                onValueChange={(details) => setTaskFilter(details.value[0] as TaskFilter)}
                size="md"
              >
                <SelectTrigger>
                  <SelectValueText placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  {taskTypeOptions.map((option) => (
                    <SelectItem key={option.value} item={option}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
            </Field>
          </HStack>

          {/* Actions */}
          <HStack gap={2} flexShrink={0}>
            {/* Import Button */}
            <Button variant="outline" onClick={handleImportTemplate}>
              <LuUpload />
              Import
            </Button>

            {/* Create Button */}

            <Button colorPalette="primary" onClick={handleCreateTemplate}>
              <LuPlus />
              Create Template
            </Button>
          </HStack>
        </Stack>
      </Stack>

      {/* Content Area */}
      {templatesQuery.error ? (
        <ErrorEmptyState
          title="Failed to load templates"
          description="An error occurred while fetching templates."
          onActionClick={templatesQuery.refetch}
        />
      ) : templates.length === 0 && !templatesQuery.isLoading ? (
        <EmptyState
          icon={<LuFileText />}
          title={searchQuery || taskFilter ? "No Templates Found" : "No Templates Yet"}
          description={
            searchQuery || taskFilter
              ? "Try adjusting your search or filter criteria."
              : "Create your first prompt template to get started."
          }
          actionLabel={!searchQuery && !taskFilter ? "Create Template" : undefined}
          onActionClick={!searchQuery && !taskFilter ? handleCreateTemplate : undefined}
        />
      ) : (
        <SimpleGrid minChildWidth="xs" gap={6}>
          {templatesQuery.isLoading
            ? Array.from({ length: 15 }).map(() => <TemplateCardSkeleton key={createId()} />)
            : templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={{
                    id: template.id,
                    name: template.name,
                    task: template.kind,
                    version: template.version,
                    layoutNodeCount: template.layoutNodeCount,
                    updatedAt: new Date(template.updatedAt),
                  }}
                />
              ))}
        </SimpleGrid>
      )}

      {/* Import Dialog */}
      <TemplateImportDialog
        isOpen={isImportDialogOpen}
        onOpenChange={({ open }) => setIsImportDialogOpen(open)}
      />
    </PageContainer>
  );
}

export default TemplatesPage;
