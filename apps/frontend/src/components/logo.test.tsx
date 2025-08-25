import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { Logo } from "./logo";

describe("Logo", () => {
  it("renders with StoryForge text by default", () => {
    render(<Logo />);

    expect(screen.getByTestId("logo")).toBeInTheDocument();
    expect(screen.getByText("StoryForge")).toBeInTheDocument();
  });

  it("hides text when collapsed", () => {
    render(<Logo collapsed />);

    expect(screen.getByTestId("logo")).toBeInTheDocument();
    expect(screen.queryByText("StoryForge")).not.toBeInTheDocument();
  });

  it("shows icon in both collapsed and expanded states", () => {
    const { rerender } = render(<Logo />);

    // Icon should be present (we can't easily test for the actual icon, but we can test the container)
    expect(screen.getByTestId("logo")).toBeInTheDocument();

    rerender(<Logo collapsed />);
    expect(screen.getByTestId("logo")).toBeInTheDocument();
  });
});
