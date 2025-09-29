import { Badge, HStack } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

export function StepHeaderLabels(props: { modelProfileId?: string; templateId?: string }) {
  const { modelProfileId, templateId } = props;
  const trpc = useTRPC();

  const modelQuery = useQuery(
    trpc.providers.getModelProfileById.queryOptions(
      { id: String(modelProfileId) },
      { enabled: Boolean(modelProfileId) }
    )
  );

  const templateQuery = useQuery(
    trpc.templates.getById.queryOptions(
      { id: String(templateId) },
      { enabled: Boolean(templateId) }
    )
  );

  const profileLabel = modelProfileId
    ? modelQuery.isLoading
      ? "Loading model…"
      : modelQuery.data?.displayName || "Unknown model"
    : null;

  const templateLabel = templateId
    ? templateQuery.isLoading
      ? "Loading template…"
      : templateQuery.data?.name || "Unknown template"
    : null;

  return (
    <HStack gap={2} wrap="wrap">
      {profileLabel && (
        <Badge colorPalette={modelProfileId ? "purple" : "gray"}>{profileLabel}</Badge>
      )}
      {templateLabel && <Badge colorPalette={templateId ? "blue" : "gray"}>{templateLabel}</Badge>}
    </HStack>
  );
}
