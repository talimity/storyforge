"use client";

import { type BoxProps, chakra } from "@chakra-ui/react";
import { forwardRef } from "react";

export interface SurfaceProps extends BoxProps {
  variant?: "surface" | "contrast";
}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  ({ variant = "surface", layerStyle: layerStyleProp, css: cssProp, ...rest }, ref) => {
    const isContrast = variant === "contrast";
    const layerStyle = layerStyleProp ?? (isContrast ? "contrast" : "surface");

    const computedCss = {
      "--sf-fg": isContrast
        ? "var(--chakra-colors-contrast-fg)"
        : "var(--chakra-colors-surface-fg)",
      "--sf-border": isContrast
        ? "var(--chakra-colors-contrast-border)"
        : "var(--chakra-colors-surface-border)",
      "--sf-hover-bg": isContrast
        ? "color-mix(in srgb, var(--chakra-colors-contrast-fg) 14%, transparent)"
        : "var(--chakra-colors-interactive-hoverBg)",
      "--sf-active-bg": isContrast
        ? "color-mix(in srgb, var(--chakra-colors-contrast-fg) 20%, transparent)"
        : "var(--chakra-colors-interactive-activeBg)",
      "--sf-input-bg": isContrast
        ? "color-mix(in srgb, var(--chakra-colors-contrast-bg) 55%, transparent)"
        : "var(--chakra-colors-surface-subtle)",
      ...cssProp,
    } as const;

    return (
      <chakra.div
        ref={ref}
        data-surface={variant}
        layerStyle={layerStyle}
        css={computedCss}
        {...rest}
      />
    );
  }
);
