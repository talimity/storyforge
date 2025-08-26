import { Container } from "@chakra-ui/react";
import { SimplePageHeader } from "@/components/ui/index";

export function TemplatesPage() {
  return (
    <Container>
      <SimplePageHeader
        title="Prompt Templates"
        tagline="Manage prompt templates for generating content."
      />
    </Container>
  );
}
