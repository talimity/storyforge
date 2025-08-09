import { Container, Heading, Text } from "@chakra-ui/react";

export function SettingsPage() {
  return (
    <Container>
      <Heading size="xl" mb={4}>
        Settings
      </Heading>
      <Text color="fg.muted">
        Configure application preferences and API keys.
      </Text>
    </Container>
  );
}
