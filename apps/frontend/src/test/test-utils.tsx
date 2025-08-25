import { ChakraProvider } from "@chakra-ui/react";
import {
  type RenderOptions,
  type RenderResult,
  render,
} from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import type { ReactElement } from "react";
import { system } from "@/theme";

/**
 * Test wrapper that provides all necessary context providers for React components
 *
 * Includes:
 * - ChakraProvider with the app's custom theme system
 * - ThemeProvider forced to light mode for consistent test results
 */
function TestProviders({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={system}>
      <ThemeProvider attribute="class" forcedTheme="light">
        {children}
      </ThemeProvider>
    </ChakraProvider>
  );
}

/**
 * Custom render function that automatically wraps components with necessary providers
 *
 * Usage:
 * ```tsx
 * import { render, screen } from "@/test/test-utils";
 *
 * test("my component", () => {
 *   render(<MyComponent />);
 *   expect(screen.getByText("Hello")).toBeInTheDocument();
 * });
 * ```
 */
function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
): RenderResult {
  return render(ui, { wrapper: TestProviders, ...options });
}

// Re-export everything from React Testing Library
export * from "@testing-library/react";

// Export custom render function as the default render
export { renderWithProviders as render };
