import { Container, Stack, Text } from "@chakra-ui/react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui";
import { SimplePageHeader } from "@/components/ui/page-header";

export function TemplateEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const template = null;

  const handleDelete = () => {
    if (!id) return;

    navigate("/templates");
  };

  if (!template) {
    return (
      <Container>
        <Stack gap={8} align="center">
          <SimplePageHeader
            title="Template Not Found"
            tagline="The requested prompt template could not be found."
          />
          <Text color="content.muted">
            The template you're looking for doesn't exist or has been deleted.
          </Text>
          <Button onClick={() => navigate("/templates")}>
            Back to Prompt Templates
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container>
      <SimplePageHeader
        title="Edit Template"
        actions={
          <Button colorPalette="red" variant="outline" onClick={handleDelete}>
            Delete Template
          </Button>
        }
      />
    </Container>
  );
}
