import { Box, Container } from "@chakra-ui/react";
import { SimplePageHeader } from "@/components/ui/page-header";

export function DashboardPage() {
  return (
    <Container>
      <SimplePageHeader title="Dashboard" tagline="Welcome back!" />
      <Box>TODO</Box>
    </Container>
  );
}
