import {
  createSystem,
  defaultConfig,
  defineConfig,
  defineLayerStyles,
  defineSemanticTokens,
  defineTokens,
} from "@chakra-ui/react";

// Base color tokens - abstract names instead of material names
const tokens = defineTokens({
  colors: {
    // Neutral scale for primary content surfaces
    neutral: {
      50: { value: "hsl(35, 25%, 98%)" }, // Lightest parchment
      100: { value: "hsl(35, 25%, 95%)" }, // Main parchment
      200: { value: "hsl(40, 20%, 90%)" }, // Aged parchment
      300: { value: "hsl(40, 15%, 88%)" }, // Muted parchment
      400: { value: "hsl(35, 20%, 85%)" },
      500: { value: "hsl(35, 15%, 80%)" }, // Border
      600: { value: "hsl(25, 10%, 45%)" }, // Faded ink
      700: { value: "hsl(25, 15%, 30%)" },
      800: { value: "hsl(25, 15%, 20%)" }, // Dark ink
      900: { value: "hsl(25, 15%, 15%)" }, // Darkest ink
      950: { value: "hsl(25, 15%, 10%)" },
    },
    // Accent scale for secondary/contrast surfaces
    accent: {
      50: { value: "hsl(20, 20%, 40%)" },
      100: { value: "hsl(20, 25%, 35%)" },
      200: { value: "hsl(20, 30%, 30%)" },
      300: { value: "hsl(20, 30%, 25%)" },
      400: { value: "hsl(20, 30%, 22%)" },
      500: { value: "hsl(20, 30%, 20%)" }, // Main leather
      600: { value: "hsl(20, 35%, 18%)" },
      700: { value: "hsl(20, 35%, 15%)" },
      800: { value: "hsl(20, 35%, 12%)" },
      900: { value: "hsl(20, 35%, 10%)" },
      950: { value: "hsl(20, 35%, 8%)" },
    },
    // Highlight colors
    gold: {
      300: { value: "hsl(50, 80%, 65%)" },
      400: { value: "hsl(48, 82%, 60%)" },
      500: { value: "hsl(45, 85%, 55%)" }, // Main gold
      600: { value: "hsl(43, 80%, 50%)" },
      700: { value: "hsl(40, 75%, 45%)" },
    },
    emerald: {
      200: { value: "hsl(150, 30%, 70%)" },
      300: { value: "hsl(150, 35%, 40%)" },
      400: { value: "hsl(150, 38%, 35%)" },
      500: { value: "hsl(150, 40%, 30%)" }, // Main emerald
      600: { value: "hsl(150, 42%, 25%)" },
      700: { value: "hsl(150, 45%, 20%)" },
      800: { value: "hsl(150, 50%, 15%)" },
      900: { value: "hsl(150, 55%, 10%)" },
    },
  },
  fonts: {
    heading: { value: "'Aleo', serif" },
    body: { value: "'Overpass', -apple-system, sans-serif" },
  },
  shadows: {
    subtle: { value: "0 2px 8px -2px hsl(25 15% 15% / 0.2)" },
    medium: { value: "0 4px 15px -3px hsl(25 15% 15% / 0.15)" },
    strong: { value: "0 8px 30px -5px hsl(25 15% 15% / 0.3)" },
  },
});

// Semantic tokens for the two-material system
const semanticTokens = defineSemanticTokens({
  colors: {
    // Primary surface (paper in light mode, dark in dark mode)
    surface: {
      base: { value: "{colors.neutral.100}" },
      subtle: { value: "{colors.neutral.50}" },
      muted: { value: "{colors.neutral.200}" },
      emphasized: { value: "{colors.neutral.300}" },
      border: { value: "{colors.neutral.500}" },
    },
    // Primary content (ink in light mode, light text in dark mode)
    content: {
      base: { value: "{colors.neutral.800}" },
      muted: { value: "{colors.neutral.600}" },
      subtle: { value: "{colors.neutral.700}" },
      emphasized: { value: "{colors.neutral.950}" },
    },
    // Contrast surface (leather in light mode, slightly different in dark)
    surfaceContrast: {
      base: { value: "{colors.accent.500}" },
      muted: { value: "{colors.accent.600}" },
      subtle: { value: "{colors.accent.400}" },
      emphasized: { value: "{colors.accent.300}" },
      border: { value: "{colors.accent.700}" },
    },
    // Contrast content (light text on dark surfaces)
    contentContrast: {
      base: { value: "{colors.neutral.100}" },
      muted: { value: "{colors.neutral.200}" },
      subtle: { value: "{colors.neutral.300}" },
      emphasized: { value: "{colors.neutral.50}" },
    },
    // Highlight colors
    highlight: {
      gold: { value: "{colors.gold.500}" },
      emerald: { value: "{colors.emerald.500}" },
      goldMuted: { value: "{colors.gold.600}" },
      emeraldMuted: { value: "{colors.emerald.600}" },
    },
    // Color palette semantic tokens for components
    neutral: {
      solid: { value: "{colors.surface-contrast}" },
      contrast: { value: "{colors.content-contrast}" },
      bg: { value: "{colors.surface}" },
      fg: { value: "{colors.content}" },
      muted: { value: "{colors.surface.muted}" },
      subtle: { value: "{colors.surface.subtle}" },
      emphasized: { value: "{colors.surface.emphasized}" },
      focusRing: { value: "{colors.accent.500}" },
    },
    // Primary palette
    primary: {
      solid: { value: "{colors.accent.500}" },
      contrast: { value: "{colors.neutral.100}" },
      fg: { value: "{colors.accent.700}" },
      muted: { value: "{colors.accent.100}" },
      subtle: { value: "{colors.accent.100}" },
      emphasized: { value: "{colors.accent.300}" },
      focusRing: { value: "{colors.accent.500}/40" },
    },
    // Secondary palette (emerald)
    secondary: {
      solid: { value: "{colors.emerald.500}" },
      contrast: { value: "{colors.neutral.100}" },
      fg: { value: "{colors.emerald.600}" },
      muted: { value: "{colors.emerald.300}" },
      subtle: { value: "{colors.emerald.400}" },
      emphasized: { value: "{colors.emerald.700}" },
      focusRing: { value: "{colors.emerald.500}/40" },
    },
    // Gold accent palette
    accent: {
      solid: { value: "{colors.gold.500}" },
      contrast: { value: "{colors.accent.800}" },
      fg: { value: "{colors.gold.600}" },
      muted: { value: "{colors.gold.300}" },
      subtle: { value: "{colors.gold.400}" },
      emphasized: { value: "{colors.gold.600}" },
      focusRing: { value: "{colors.gold.500}/40" },
    },
    // Danger palette
    danger: {
      solid: { value: "{colors.red.500}" },
      contrast: { value: "white" },
      fg: { value: "{colors.red.600}" },
      muted: { value: "{colors.red.100}" },
      subtle: { value: "{colors.red.200}" },
      emphasized: { value: "{colors.red.300}" },
      focusRing: { value: "{colors.red.500}/40" },
    },
    // Success palette
    success: {
      solid: { value: "{colors.green.500}" },
      contrast: { value: "white" },
      fg: { value: "{colors.green.600}" },
      muted: { value: "{colors.green.100}" },
      subtle: { value: "{colors.green.200}" },
      emphasized: { value: "{colors.green.300}" },
      focusRing: { value: "{colors.green.500}/40" },
    },
    // Info palette
    info: {
      solid: { value: "{colors.blue.500}" },
      contrast: { value: "white" },
      fg: { value: "{colors.blue.600}" },
      muted: { value: "{colors.blue.100}" },
      subtle: { value: "{colors.blue.200}" },
      emphasized: { value: "{colors.blue.300}" },
      focusRing: { value: "{colors.blue.500}/40" },
    },
  },
  gradients: {
    // Material texture
    surfaceGradient: {
      value:
        "linear-gradient(135deg, {colors.surface} 0%, {colors.surface.muted} 100%)",
    },
    contrastGradient: {
      value:
        "linear-gradient(135deg, {colors.surfaceContrast} 0%, {colors.surfaceContrast.subtle} 100%)",
    },
  },
});

// Layer styles for the two materials and interactables
const layerStyles = defineLayerStyles({
  // Primary material
  surface: {
    value: {
      bg: "surface",
      color: "content",
      backgroundImage: "surfaceGradient",
      borderColor: "surface.border",
      borderRadius: "md",
      boxShadow: "subtle",
    },
  },
  // Contrast material
  contrast: {
    value: {
      bg: "surfaceContrast",
      color: "contentContrast",
      backgroundImage: "contrastGradient",
      borderColor: "surfaceContrast.border",
      borderRadius: "md",
      boxShadow: "medium",
    },
  },
  // Interactive elements
  interactive: {
    value: {
      cursor: "pointer",
      transition: "all 0.2s ease",
      _hover: {
        transform: "translateY(-1px)",
        boxShadow: "subtle",
      },
      _active: {
        transform: "translateY(0)",
        boxShadow: "none",
      },
    },
  },
  interactiveStrong: {
    value: {
      cursor: "pointer",
      transition: "all 0.2s ease",
      _hover: {
        transform: "translateY(-1px)",
        boxShadow: "strong",
      },
      _active: {
        transform: "translateY(0)",
        boxShadow: "subtle",
      },
    },
  },
});

// Override input styles to support the two-material system
export const inputRecipe = {
  variants: {
    variant: {
      outline: {
        bg: "{colors.white}/60",
        fg: "{colors.content}",
        _placeholder: {
          color: "{colors.content}/60",
        },
        borderColor: "{colors.surface.border}",
        focusVisibleRing: "outside",
        focusRingOffset: "0px",
        focusRingColor: "{colors.content.subtle}",
      },
      onContrast: {
        bg: "{colors.surface}/10",
        fg: "{colors.contentContrast}",
        _placeholder: {
          color: "{colors.contentContrast}/60",
        },
        borderWidth: "1px",
        borderColor: "{colors.surface.border}/20",
        focusVisibleRing: "outside",
        focusRingOffset: "0px",
        focusRingColor: "{colors.contentContrast}",
        _focusVisible: {
          boxShadow: "0px 0px 0px 4px {colors.accent.200}",
        },
      },
    },
  },
};

// Button variant fixes
const buttonRecipe = {
  variants: {
    variant: {
      outline: {
        color: "colorPalette.fg",
        _hover: {
          bg: "colorPalette.solid/90",
          color: "colorPalette.contrast",
        },
        _expanded: {
          bg: "colorPalette.solid/90",
          color: "colorPalette.contrast",
        },
      },
      ghost: {
        _hover: {
          bg: "colorPalette.solid/90",
          color: "colorPalette.contrast",
        },
        _expanded: {
          bg: "colorPalette.solid/90",
          color: "colorPalette.contrast",
        },
      },
      subtle: {
        color: "colorPalette.contrast",
      },
      plain: {
        color: "colorPalette.fg",
      },
    },
  },
};

// Complete theme configuration
export const storyforgeTheme = defineConfig({
  globalCss: {
    body: {
      bg: "var(--chakra-colors-surface)",
      color: "var(--chakra-colors-content)",
      fontFamily: "var(--chakra-fonts-body)",
    },
    "h1, h2, h3, h4, h5, h6": {
      fontFamily: "var(--chakra-fonts-heading)",
      color: "var(--chakra-colors-content-emphasized)",
    },
  },
  theme: {
    tokens,
    semanticTokens,
    layerStyles,
    textStyles: {
      heading: {
        value: {
          fontFamily: "heading",
          color: "content.emphasized",
          fontWeight: "600",
          lineHeight: "1.2",
        },
      },
      body: {
        value: {
          fontFamily: "body",
          color: "content",
          lineHeight: "1.6",
        },
      },
      "body-muted": {
        value: {
          fontFamily: "body",
          color: "content.muted",
          lineHeight: "1.6",
        },
      },
    },
    recipes: {
      input: inputRecipe,
      textarea: inputRecipe,
      select: inputRecipe,
      button: buttonRecipe,
    },
  },
  // Conditions for responsive design and states
  conditions: {
    hover: "&:hover",
    focus: "&:focus",
    active: "&:active",
    disabled: "&:disabled",
    dark: ".dark &",
    light: ".light &",
  },
});

export const system = createSystem(defaultConfig, storyforgeTheme);
