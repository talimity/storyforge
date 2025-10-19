import { Container, type ContainerProps } from "@chakra-ui/react";

export function PageContainer(props: ContainerProps) {
  return <Container p={{ base: 1.5, md: 6 }} {...props} />;
}
