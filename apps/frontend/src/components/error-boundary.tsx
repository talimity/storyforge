import { Box, Heading, Text, VStack } from "@chakra-ui/react";
import type React from "react";
import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/index";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <Box p={8} maxW="800px" mx="auto" colorPalette="neutral">
          <VStack gap={4} align="start">
            <Heading size="lg" color="red.500">
              {this.props.fallbackTitle || "Something went wrong"}
            </Heading>

            <Text>
              An unexpected error occurred. Please try refreshing the page, or create an issue on
              the Github repository if the problem persists.
            </Text>

            <Button onClick={() => window.location.reload()}>Refresh Page</Button>

            <Box layerStyle="surface" p={4} w="full" overflowX="auto">
              <Text fontFamily="mono" fontSize="sm" whiteSpace="pre-wrap">
                <Text fontWeight="bold" mb={2}>
                  Error Details:
                </Text>
                {this.state.error?.name}: {this.state.error?.message}
                {"\n\n"}
                {this.state.error?.stack}
                {this.state.errorInfo?.componentStack && (
                  <>
                    {"\n\nComponent Stack:"}
                    {this.state.errorInfo.componentStack}
                  </>
                )}
              </Text>
            </Box>
          </VStack>
        </Box>
      );
    }

    return this.props.children;
  }
}
