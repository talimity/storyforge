import { ChakraProvider } from "@chakra-ui/react";
import { system } from "@chakra-ui/react/preset";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { TemplateStringPreview } from "./template-string-preview";

function renderWithProvider(ui: ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

describe("TemplateStringPreview", () => {
  it("highlights variables and block directives", () => {
    renderWithProvider(
      <TemplateStringPreview value="Greeting {{name}} {{#if show}}Hi{{#endif}}" />
    );

    const variableMark = screen.getByText("{{name}}");
    const blockOpen = screen.getByText("{{#if show}}");
    const blockClose = screen.getByText("{{#endif}}");

    expect(variableMark.tagName).toBe("MARK");
    expect(blockOpen.tagName).toBe("MARK");
    expect(blockClose.tagName).toBe("MARK");
  });

  it("shows parser errors when present", () => {
    renderWithProvider(<TemplateStringPreview value="{{#if true}} missing" />);

    expect(screen.getByText(/Missing \{\{#endif\}\}/i)).toBeInTheDocument();
  });

  it("renders fallback when value is empty", () => {
    renderWithProvider(
      <TemplateStringPreview value="" fallback="Data from: source" showErrors={false} />
    );

    expect(screen.getByText("Data from: source")).toBeInTheDocument();
  });
});
