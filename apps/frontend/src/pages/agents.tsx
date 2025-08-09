import { Container, Heading, Text } from "@chakra-ui/react";

export function AgentsPage() {
  return (
    <Container>
      <Heading size="xl" mb={4}>
        Agents
      </Heading>
      <Text color="fg.muted">
        Create and manage agent workflows for narrative generation.
      </Text>
    </Container>
  );
}
