import { Box, Container, Grid, HStack, Skeleton, Tabs, Text } from "@chakra-ui/react";
import { type TaskKind, taskKindSchema } from "@storyforge/gentasks";
import { createId } from "@storyforge/utils";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LuImport, LuListPlus, LuMapPin, LuPlus, LuWorkflow } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { TaskKindSelect } from "@/components/ui/task-kind-select";
import { AssignmentDialog } from "@/features/workflows/components/assignment-dialog";
import { AssignmentList } from "@/features/workflows/components/assignment-list";
import { WorkflowCard, WorkflowCardSkeleton } from "@/features/workflows/components/workflow-card";
import { WorkflowImportDialog } from "@/features/workflows/components/workflow-import-dialog";
import { useTRPC } from "@/lib/trpc";

type TaskFilter = "" | TaskKind;

export function WorkflowsPage() {
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

  const workflowCount = workflows.length;
  const assignmentCount = scopes.length;

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
            <Box pt={6}>
              {workflowsQuery.isLoading ? (
                <Text>Loading...</Text>
              ) : workflowsQuery.error ? (
                <Text color="fg.error">
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
                    <WorkflowCardSkeleton key={createId()} />
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
                    <Box key={createId()} layerStyle="surface" borderRadius="md" p={4}>
                      <Skeleton height="16px" mb={2} />
                      <Skeleton height="12px" width="60%" />
                    </Box>
                  ))}
                </Grid>
              ) : assignmentsQuery.error ? (
                <Text color="fg.error">
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
