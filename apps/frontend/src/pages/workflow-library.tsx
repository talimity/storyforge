import { Box, Container, HStack, SimpleGrid, Skeleton, Tabs } from "@chakra-ui/react";
import { type TaskKind, taskKindSchema } from "@storyforge/gentasks";
import { createId } from "@storyforge/utils";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LuImport, LuListPlus, LuMapPin, LuPlus, LuWorkflow } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { Button, EmptyState, ErrorEmptyState, PageHeader } from "@/components/ui";
import { TaskKindSelect } from "@/components/ui/task-kind-select";
import { AssignmentDialog } from "@/features/workflows/components/assignment-dialog";
import { AssignmentItem } from "@/features/workflows/components/assignment-list";
import { WorkflowCard, WorkflowCardSkeleton } from "@/features/workflows/components/workflow-card";
import { WorkflowImportDialog } from "@/features/workflows/components/workflow-import-dialog";
import { useTRPC } from "@/lib/trpc";

type TaskFilter = "" | TaskKind;

function WorkflowsPage() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const [tab, setTab] = useState("workflows");
  const [assignOpen, setAssignOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("");
  const [importOpen, setImportOpen] = useState(false);

  const workflowsQuery = useQuery(
    trpc.workflows.list.queryOptions({
      task: taskFilter || undefined,
    })
  );
  const selectedTask = taskKindSchema.parse(taskFilter || "turn_generation");
  const assignmentsQuery = useQuery(
    trpc.workflows.listScopes.queryOptions(
      { task: selectedTask },
      { enabled: tab === "assignments" }
    )
  );

  const workflows = workflowsQuery.data?.workflows ?? [];
  const scopes = assignmentsQuery.data?.scopes ?? [];

  return (
    <Container>
      <PageHeader.Root>
        <PageHeader.Title>Workflows</PageHeader.Title>
        <PageHeader.Tagline>
          Chain prompts together to create content for a specific task.
        </PageHeader.Tagline>
        <PageHeader.Tabs
          tabs={[
            {
              value: "workflows",
              label: "Workflows",
              icon: <LuWorkflow />,
              badge: workflows.length || undefined,
            },
            {
              value: "assignments",
              label: "Assignments",
              icon: <LuMapPin />,
              badge: scopes.length || undefined,
            },
          ]}
          defaultValue="workflows"
          onChange={(value) => setTab(value)}
        >
          <PageHeader.Controls>
            <HStack gap={3}>
              <TaskKindSelect
                includeAll
                value={taskFilter}
                onChange={(v) => setTaskFilter(v)}
                placeholder="Filter by task"
              />
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
            {workflowsQuery.error ? (
              <ErrorEmptyState
                title="Failed to load workflows"
                description={workflowsQuery.error.message}
                onActionClick={workflowsQuery.refetch}
              />
            ) : workflows.length === 0 && !workflowsQuery.isLoading ? (
              <EmptyState
                icon={<LuWorkflow />}
                title="No workflows yet"
                description="Create a workflow to enable task-specific generation."
                actionLabel="Create Workflow"
                onActionClick={() => navigate("/workflows/create")}
              />
            ) : (
              <SimpleGrid minChildWidth="sm" gap={6}>
                {workflowsQuery.isLoading
                  ? [...Array(15)].map(() => <WorkflowCardSkeleton key={createId()} />)
                  : workflows.map((wf) => <WorkflowCard key={wf.id} workflow={wf} />)}
              </SimpleGrid>
            )}
          </Tabs.Content>

          <Tabs.Content value="assignments">
            {assignmentsQuery.error ? (
              <ErrorEmptyState
                title="Failed to load assignments"
                description={assignmentsQuery.error.message}
                onActionClick={assignmentsQuery.refetch}
              />
            ) : scopes.length === 0 && !assignmentsQuery.isLoading ? (
              <EmptyState
                icon={<LuMapPin />}
                title="No assignments yet"
                description="Assign workflows per task and scope (default, scenario, character, participant)."
                actionLabel="New Assignment"
                onActionClick={() => setAssignOpen(true)}
              />
            ) : (
              <SimpleGrid minChildWidth="md" gap={6}>
                {assignmentsQuery.isLoading
                  ? [...Array(15)].map(() => (
                      <Box key={createId()} layerStyle="surface" borderRadius="md" p={4}>
                        <Skeleton height="16px" mb={2} />
                        <Skeleton height="12px" width="60%" />
                      </Box>
                    ))
                  : scopes.map((scope) => <AssignmentItem key={scope.id} item={scope} />)}
              </SimpleGrid>
            )}
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

export default WorkflowsPage;
