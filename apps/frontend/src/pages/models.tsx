import { Container, Heading, Text } from "@chakra-ui/react";

export function ModelsPage() {
  return (
    <Container>
      <Heading size="xl" mb={4}>
        Models
      </Heading>
      <Text color="fg.muted">
        Configure LLM models and providers for your scenarios.
      </Text>
    </Container>
  );
}
