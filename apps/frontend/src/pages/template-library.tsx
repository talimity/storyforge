import {
  Container,
  createListCollection,
  HStack,
  Input,
  SegmentGroup,
  SimpleGrid,
  Skeleton,
  Stack,
  VStack,
} from "@chakra-ui/react";
import type { TaskKind } from "@storyforge/prompt-renderer";
import { useState } from "react";
import {
  LuFileText,
  LuGrid3X3,
  LuList,
  LuPlus,
  LuSearch,
  LuUpload,
} from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { TemplateImportDialog } from "@/components/dialogs/template-import";
import { TemplateCard } from "@/components/features/templates/template-card";
import { TemplateListItem } from "@/components/features/templates/template-list-item";
import {
  Button,
  EmptyState,
  Field,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  SimplePageHeader,
} from "@/components/ui";
import { trpc } from "@/lib/trpc";

type ViewMode = "grid" | "list";

const taskTypeOptions = [
  { value: "", label: "All Types" },
  { value: "turn_generation", label: "Turn Generation" },
  { value: "chapter_summarization", label: "Chapter Summary" },
  { value: "writing_assistant", label: "Writing Assistant" },
];

const viewModeOptions = [
  { value: "grid", label: <LuGrid3X3 /> },
  { value: "list", label: <LuList /> },
];

export function TemplatesPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("template-view-mode") as ViewMode) || "grid";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState<TaskKind | "">("");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const {
    data: templatesData,
    isLoading,
    error,
  } = trpc.templates.list.useQuery({
    task: taskFilter || undefined,
    search: searchQuery || undefined,
  });

  const templates = templatesData?.templates || [];

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("template-view-mode", mode);
  };

  const handleCreateTemplate = () => {
    navigate("/templates/select-task");
  };

  const handleImportTemplate = () => {
    setIsImportDialogOpen(true);
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTask = !taskFilter || template.task === taskFilter;
    return matchesSearch && matchesTask;
  });

  return (
    <Container maxW="1400px">
      <SimplePageHeader
        title="Prompt Templates"
        tagline="Manage prompt templates for generating content."
      />

      {/* Action Bar */}
      <Stack gap={4} mb={6}>
        <Stack
          direction={{ base: "column", lg: "row" }}
          justify="space-between"
          gap={4}
        >
          {/* Search and Filters */}
          <HStack
            flex="1"
            maxW={{ base: "100%", lg: "600px" }}
            gap={3}
            wrap={{ base: "wrap", sm: "nowrap" }}
          >
            <Field flex="1" minW="200px">
              <HStack position="relative">
                <LuSearch
                  style={{
                    position: "absolute",
                    left: "12px",
                    zIndex: 1,
                    opacity: 0.6,
                  }}
                />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  pl="40px"
                />
              </HStack>
            </Field>

            <Field minW="180px">
              <SelectRoot
                collection={createListCollection({ items: taskTypeOptions })}
                value={[taskFilter]}
                onValueChange={(details) =>
                  setTaskFilter(details.value[0] as TaskKind | "")
                }
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

          {/* View Controls and Actions */}
          <HStack gap={2} flexShrink={0}>
            {/* View Mode Toggle */}
            <SegmentGroup.Root
              hideBelow="md"
              defaultValue={viewMode}
              onValueChange={(details) =>
                details.value && handleViewModeChange(details.value as ViewMode)
              }
            >
              <SegmentGroup.Indicator />
              <SegmentGroup.Items items={viewModeOptions} />
            </SegmentGroup.Root>

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
      {error ? (
        <EmptyState
          icon={<LuFileText />}
          title="Error Loading Templates"
          description="There was an error loading your templates. Please try again."
        />
      ) : isLoading ? (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} gap={6}>
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton
              key={`skeleton-${String(index)}`}
              height="300px"
              borderRadius="md"
            />
          ))}
        </SimpleGrid>
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          icon={<LuFileText />}
          title={
            searchQuery || taskFilter
              ? "No Templates Found"
              : "No Templates Yet"
          }
          description={
            searchQuery || taskFilter
              ? "Try adjusting your search or filter criteria."
              : "Create your first prompt template to get started."
          }
          actionLabel={
            !searchQuery && !taskFilter ? "Create Template" : undefined
          }
          onActionClick={
            !searchQuery && !taskFilter ? handleCreateTemplate : undefined
          }
        />
      ) : viewMode === "grid" ? (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} gap={6}>
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={{
                id: template.id,
                name: template.name,
                task: template.task as TaskKind,
                version: template.version,
                layoutNodeCount: template.layoutNodeCount,
                updatedAt: new Date(template.updatedAt),
              }}
            />
          ))}
        </SimpleGrid>
      ) : (
        <VStack align="stretch" gap={3}>
          {filteredTemplates.map((template) => (
            <TemplateListItem
              key={template.id}
              template={{
                id: template.id,
                name: template.name,
                task: template.task as TaskKind,
                version: template.version,
                layoutNodeCount: template.layoutNodeCount,
                updatedAt: new Date(template.updatedAt),
              }}
            />
          ))}
        </VStack>
      )}

      {/* Import Dialog */}
      <TemplateImportDialog
        isOpen={isImportDialogOpen}
        onOpenChange={({ open }) => setIsImportDialogOpen(open)}
        onImportSuccess={() => {
          // Templates list will be invalidated automatically by the mutation
        }}
      />
    </Container>
  );
}
