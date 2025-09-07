import {
  Box,
  Container,
  createListCollection,
  Grid,
  HStack,
  Skeleton,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { taskKindSchema } from "@storyforge/gentasks";
import { useMemo, useState } from "react";
import { LuImport, LuListPlus, LuMapPin, LuPlus, LuWorkflow } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import {
  Button,
  EmptyState,
  PageHeader,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui";
import { AssignmentDialog } from "@/features/workflows/components/assignment-dialog";
import { AssignmentList } from "@/features/workflows/components/assignment-list";
import { WorkflowCard, WorkflowCardSkeleton } from "@/features/workflows/components/workflow-card";
import { WorkflowImportDialog } from "@/features/workflows/components/workflow-import-dialog";
import { trpc } from "@/lib/trpc";

const taskOptions = [
  { value: "", label: "All Tasks" },
  { value: "turn_generation", label: "Turn Generation" },
  { value: "chapter_summarization", label: "Chapter Summarization" },
  { value: "writing_assistant", label: "Writing Assistant" },
] as const;
type TaskFilter = (typeof taskOptions)[number]["value"];

export function WorkflowsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("workflows");
  const [assignOpen, setAssignOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("");
  const [importOpen, setImportOpen] = useState(false);

  const workflowsQuery = trpc.workflows.list.useQuery({
    task: taskFilter || undefined,
  });
  const selectedTask = taskKindSchema.parse(taskFilter || "turn_generation");
  const assignmentsQuery = trpc.workflows.listScopes.useQuery(
    { task: selectedTask },
    { enabled: tab === "assignments" }
  );

  const workflows = workflowsQuery.data?.workflows ?? [];
  const scopes = assignmentsQuery.data?.scopes ?? [];

  const workflowCount = workflows.length;
  const assignmentCount = scopes.length;

  const taskCollection = useMemo(() => createListCollection({ items: taskOptions }), []);

  return (
    <Container>
      <PageHeader.Root>
        <PageHeader.Title>Workflows</PageHeader.Title>
        <PageHeader.Tagline>
          Manage generative task workflows and their assignments
        </PageHeader.Tagline>
        <PageHeader.Tabs
          tabs={[
            {
              value: "workflows",
              label: "Workflows",
              icon: <LuWorkflow />,
              badge: workflowCount || undefined,
            },
            {
              value: "assignments",
              label: "Assignments",
              icon: <LuMapPin />,
              badge: assignmentCount || undefined,
            },
          ]}
          defaultValue="workflows"
          onChange={(value) => setTab(value)}
        >
          <PageHeader.Controls>
            <HStack gap={3}>
              <SelectRoot
                collection={taskCollection}
                value={[taskFilter]}
                onValueChange={(d) => setTaskFilter(d.value[0] as TaskFilter)}
              >
                <SelectTrigger>
                  <SelectValueText placeholder="Filter by task" />
                </SelectTrigger>
                <SelectContent>
                  {taskOptions.map((opt) => (
                    <SelectItem key={opt.value} item={opt}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>

              <Tabs.Context>
                {(ctx) =>
                  ctx.value === "workflows" ? (
                    <HStack>
                      <Button variant="outline" onClick={() => setImportOpen(true)}>
                        <LuImport /> Import Workflow
                      </Button>
                      <Button colorPalette="primary" onClick={() => navigate("/workflows/create")}>
                        <LuPlus /> Create Workflow
                      </Button>
                    </HStack>
                  ) : (
                    <Button variant="outline" onClick={() => setAssignOpen(true)}>
                      <LuListPlus /> New Assignment
                    </Button>
                  )
                }
              </Tabs.Context>
            </HStack>
          </PageHeader.Controls>

          <Tabs.Content value="workflows">
            <Box pt={6}>
              {workflowsQuery.isLoading ? (
                <Text>Loading...</Text>
              ) : workflowsQuery.error ? (
                <Text color="red.500">
                  Failed to load workflows: {workflowsQuery.error.message}
                </Text>
              ) : workflowCount === 0 ? (
                <EmptyState
                  icon={<LuWorkflow />}
                  title="No workflows yet"
                  description="Create a workflow to enable task-specific generation."
                  actionLabel="Create Workflow"
                  onActionClick={() => navigate("/workflows/create")}
                />
              ) : workflowsQuery.isLoading ? (
                <Grid templateColumns="repeat(auto-fit, 360px)" gap={4}>
                  {[...Array(8)].map(() => (
                    <WorkflowCardSkeleton key={crypto.randomUUID()} />
                  ))}
                </Grid>
              ) : (
                <Grid templateColumns="repeat(auto-fit, 360px)" gap={4}>
                  {workflows.map((wf) => (
                    <WorkflowCard key={wf.id} workflow={wf} />
                  ))}
                </Grid>
              )}
            </Box>
          </Tabs.Content>

          <Tabs.Content value="assignments">
            <Box pt={6}>
              {assignmentsQuery.isLoading ? (
                <Grid templateColumns="repeat(auto-fit, 360px)" gap={4}>
                  {[...Array(6)].map(() => (
                    <Box key={crypto.randomUUID()} layerStyle="surface" borderRadius="md" p={4}>
                      <Skeleton height="16px" mb={2} />
                      <Skeleton height="12px" width="60%" />
                    </Box>
                  ))}
                </Grid>
              ) : assignmentsQuery.error ? (
                <Text color="red.500">
                  Failed to load assignments: {assignmentsQuery.error.message}
                </Text>
              ) : assignmentCount === 0 ? (
                <EmptyState
                  icon={<LuMapPin />}
                  title="No assignments yet"
                  description="Assign workflows per task and scope (default, scenario, character, participant)."
                  actionLabel="New Assignment"
                  onActionClick={() => setAssignOpen(true)}
                />
              ) : (
                <AssignmentList items={scopes} />
              )}
            </Box>
          </Tabs.Content>
        </PageHeader.Tabs>
      </PageHeader.Root>
      <AssignmentDialog
        isOpen={assignOpen}
        onOpenChange={setAssignOpen}
        defaultTask={selectedTask}
      />
      <WorkflowImportDialog isOpen={importOpen} onOpenChange={({ open }) => setImportOpen(open)} />
    </Container>
  );
}
