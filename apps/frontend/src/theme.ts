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
      50: { value: "hsl(40, 23%, 98%)" }, // Lightest parchment
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

    neutralDark: {
      50: { value: "hsl(30, 5%, 8%)" }, // Darkest charcoal
      100: { value: "hsl(30, 6%, 10%)" }, // Main dark surface
      200: { value: "hsl(30, 7%, 12%)" }, // Slightly lighter
      300: { value: "hsl(30, 8%, 14%)" },
      400: { value: "hsl(30, 8%, 16%)" },
      500: { value: "hsl(30, 10%, 20%)" }, // Borders
      600: { value: "hsl(35, 12%, 65%)" }, // Muted text
      700: { value: "hsl(35, 15%, 75%)" },
      800: { value: "hsl(35, 18%, 85%)" }, // Main text
      900: { value: "hsl(35, 20%, 90%)" }, // Bright text
      950: { value: "hsl(35, 25%, 94%)" }, // Brightest (not white)
    },
    // Dark mode: slightly warmer/lighter for contrast areas
    accentDark: {
      50: { value: "hsl(25, 10%, 12%)" },
      100: { value: "hsl(25, 12%, 14%)" },
      200: { value: "hsl(25, 14%, 16%)" },
      300: { value: "hsl(25, 15%, 18%)" },
      400: { value: "hsl(25, 15%, 20%)" },
      500: { value: "hsl(25, 15%, 22%)" }, // Main contrast surface
      600: { value: "hsl(25, 15%, 24%)" },
      700: { value: "hsl(25, 15%, 26%)" },
      800: { value: "hsl(25, 12%, 28%)" },
      900: { value: "hsl(25, 10%, 30%)" },
      950: { value: "hsl(25, 8%, 32%)" },
    },
    // Dark mode highlights - more muted but still distinctive
    goldDark: {
      300: { value: "hsl(48, 50%, 25%)" },
      400: { value: "hsl(46, 55%, 35%)" },
      500: { value: "hsl(45, 60%, 45%)" }, // Main gold - dimmer
      600: { value: "hsl(43, 65%, 50%)" },
      700: { value: "hsl(41, 70%, 55%)" },
    },
  },
  fonts: {
    heading: { value: "'Aleo', serif" },
    body: { value: "'Funnel Sans', -apple-system, sans-serif" },
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
    // Chakra defaults with light/dark support
    bg: {
      DEFAULT: {
        value: {
          _light: "{colors.neutral.100}",
          _dark: "{colors.neutralDark.100}",
        },
      },
      panel: {
        value: {
          _light: "{colors.neutral.50}",
          _dark: "{colors.neutralDark.50}",
        },
      },
      muted: {
        value: {
          _light: "{colors.neutral.200}",
          _dark: "{colors.neutralDark.200}",
        },
      },
      emphasized: {
        value: {
          _light: "{colors.neutral.300}",
          _dark: "{colors.neutralDark.300}",
        },
      },
    },
    fg: {
      DEFAULT: {
        value: {
          _light: "{colors.neutral.800}",
          _dark: "{colors.neutralDark.800}",
        },
      },
      muted: {
        value: {
          _light: "{colors.neutral.600}",
          _dark: "{colors.neutralDark.600}",
        },
      },
      subtle: {
        value: {
          _light: "{colors.neutral.700}",
          _dark: "{colors.neutralDark.700}",
        },
      },
      emphasized: {
        value: {
          _light: "{colors.neutral.950}",
          _dark: "{colors.neutralDark.950}",
        },
      },
    },
    border: {
      DEFAULT: {
        value: {
          _light: "{colors.neutral.500}",
          _dark: "{colors.neutralDark.500}",
        },
      },
    },

    // Primary surface (paper/parchment in light, dark charcoal in dark)
    surface: {
      base: {
        value: {
          _light: "{colors.neutral.100}",
          _dark: "{colors.neutralDark.100}",
        },
      },
      subtle: {
        value: {
          _light: "{colors.neutral.50}",
          _dark: "{colors.neutralDark.50}",
        },
      },
      muted: {
        value: {
          _light: "{colors.neutral.200}",
          _dark: "{colors.neutralDark.200}",
        },
      },
      emphasized: {
        value: {
          _light: "{colors.neutral.300}",
          _dark: "{colors.neutralDark.300}",
        },
      },
      border: {
        value: {
          _light: "{colors.neutral.500}",
          _dark: "{colors.neutralDark.500}",
        },
      },
    },

    // Primary content (ink in light, warm light text in dark)
    content: {
      base: {
        value: {
          _light: "{colors.neutral.800}",
          _dark: "{colors.neutralDark.800}",
        },
      },
      muted: {
        value: {
          _light: "{colors.neutral.600}",
          _dark: "{colors.neutralDark.600}",
        },
      },
      subtle: {
        value: {
          _light: "{colors.neutral.700}",
          _dark: "{colors.neutralDark.700}",
        },
      },
      emphasized: {
        value: {
          _light: "{colors.neutral.950}",
          _dark: "{colors.neutralDark.950}",
        },
      },
    },

    // Contrast surface (leather in light, slightly warmer dark in dark mode)
    surfaceContrast: {
      base: {
        value: {
          _light: "{colors.accent.500}",
          _dark: "{colors.accentDark.500}",
        },
      },
      muted: {
        value: {
          _light: "{colors.accent.600}",
          _dark: "{colors.accentDark.600}",
        },
      },
      subtle: {
        value: {
          _light: "{colors.accent.400}",
          _dark: "{colors.accentDark.400}",
        },
      },
      emphasized: {
        value: {
          _light: "{colors.accent.300}",
          _dark: "{colors.accentDark.300}",
        },
      },
      border: {
        value: {
          _light: "{colors.accent.700}",
          _dark: "{colors.accentDark.700}",
        },
      },
    },

    // Contrast content
    contentContrast: {
      base: {
        value: {
          _light: "{colors.neutral.100}",
          _dark: "{colors.neutralDark.800}",
        },
      },
      muted: {
        value: {
          _light: "{colors.neutral.200}",
          _dark: "{colors.neutralDark.700}",
        },
      },
      subtle: {
        value: {
          _light: "{colors.neutral.300}",
          _dark: "{colors.neutralDark.600}",
        },
      },
      emphasized: {
        value: {
          _light: "{colors.neutral.50}",
          _dark: "{colors.neutralDark.900}",
        },
      },
    },

    // Highlight colors with light/dark variants
    highlight: {
      gold: {
        value: {
          _light: "{colors.gold.500}",
          _dark: "{colors.goldDark.500}",
        },
      },
      goldMuted: {
        value: {
          _light: "{colors.gold.600}",
          _dark: "{colors.goldDark.400}",
        },
      },
    },

    // Component color palettes with light/dark support
    neutral: {
      solid: {
        value: {
          _light: "{colors.neutral.400}",
          _dark: "{colors.neutralDark.600}",
        },
      },
      contrast: {
        value: {
          _light: "{colors.neutral.900}",
          _dark: "{colors.neutralDark.100}",
        },
      },
      fg: {
        value: {
          _light: "{colors.neutral.700}",
          _dark: "{colors.neutralDark.700}",
        },
      },
      muted: {
        value: {
          _light: "{colors.neutral.500}",
          _dark: "{colors.neutralDark.500}",
        },
      },
      subtle: {
        value: {
          _light: "{colors.neutral.300}",
          _dark: "{colors.neutralDark.300}",
        },
      },
      emphasized: {
        value: {
          _light: "{colors.neutral.400}",
          _dark: "{colors.neutralDark.400}",
        },
      },
      focusRing: {
        value: {
          _light: "{colors.accent.500}",
          _dark: "{colors.goldDark.500}",
        },
      },
    },

    // Primary palette
    primary: {
      solid: {
        value: {
          _light: "{colors.accent.500}",
          _dark: "{colors.accentDark.500}",
        },
      },
      contrast: {
        value: {
          _light: "{colors.neutral.100}",
          _dark: "{colors.neutralDark.900}",
        },
      },
      fg: {
        value: {
          _light: "{colors.accent.700}",
          _dark: "{colors.accentDark.300}",
        },
      },
      muted: {
        value: {
          _light: "{colors.accent.100}",
          _dark: "{colors.accentDark.700}",
        },
      },
      subtle: {
        value: {
          _light: "{colors.accent.100}",
          _dark: "{colors.accentDark.600}",
        },
      },
      emphasized: {
        value: {
          _light: "{colors.accent.300}",
          _dark: "{colors.accentDark.400}",
        },
      },
      focusRing: {
        value: {
          _light: "{colors.accent.500}",
          _dark: "{colors.goldDark.500}",
        },
      },
    },

    // Gold accent palette
    accent: {
      solid: {
        value: {
          _light: "{colors.gold.500}",
          _dark: "{colors.goldDark.500}",
        },
      },
      contrast: {
        value: {
          _light: "{colors.accent.800}",
          _dark: "{colors.neutralDark.900}",
        },
      },
      fg: {
        value: {
          _light: "{colors.gold.600}",
          _dark: "{colors.goldDark.400}",
        },
      },
      muted: {
        value: {
          _light: "{colors.gold.300}",
          _dark: "{colors.goldDark.700}",
        },
      },
      subtle: {
        value: {
          _light: "{colors.gold.400}",
          _dark: "{colors.goldDark.600}",
        },
      },
      emphasized: {
        value: {
          _light: "{colors.gold.600}",
          _dark: "{colors.goldDark.300}",
        },
      },
      focusRing: {
        value: {
          _light: "{colors.gold.500}",
          _dark: "{colors.goldDark.500}",
        },
      },
    },
  },

  gradients: {
    surfaceGradient: {
      value: {
        _light: "linear-gradient(135deg, {colors.surface} 0%, {colors.surface.muted} 100%)",
        _dark: "linear-gradient(135deg, {colors.surface} 0%, {colors.surface.muted} 100%)",
      },
    },
    contrastGradient: {
      value: {
        _light:
          "linear-gradient(135deg, {colors.surfaceContrast} 0%, {colors.surfaceContrast.subtle} 100%)",
        _dark:
          "linear-gradient(315deg, {colors.surfaceContrast} 0%, {colors.surfaceContrast.subtle} 100%)",
      },
    },
  },

  shadows: {
    subtle: {
      value: {
        _light: "0 2px 8px -2px hsl(25 15% 15% / 0.2)",
        _dark: "0 2px 8px -2px hsl(0 0% 0% / 0.4)",
      },
    },
    medium: {
      value: {
        _light: "0 4px 15px -3px hsl(25 15% 15% / 0.15)",
        _dark: "0 4px 15px -3px hsl(0 0% 0% / 0.5)",
      },
    },
    strong: {
      value: {
        _light: "0 8px 30px -5px hsl(25 15% 15% / 0.3)",
        _dark: "0 8px 30px -5px hsl(0 0% 0% / 0.6)",
      },
    },
  },
});

export const tintedNormalStyle = makeTintedStyle("normal");
export const tintedSubtleStyle = makeTintedStyle("subtle");
export const tintedMutedStyle = makeTintedStyle("muted");

function makeTintedStyle(key: string) {
  return {
    "--tint-source": `var(--input-color, currentColor, var(--chakra-colors-fg-${key === "normal" ? "emphasized" : key}))`,
    "--tint-input-hued": "color-mix(in oklch, var(--tint-source) 99%, var(--_tint-seed) 1%)",
    color:
      `oklch(from var(--tint-input-hued) ` +
      `calc(var(--tint-L-base-${key}) + (var(--tint-L-${key}) - var(--tint-L-base-${key})) * clamp(0, calc(c / var(--tint-C-norm)), 1))` +
      ` clamp(0, calc(c * ${key === "normal" ? "0.85" : "0.50"}), var(--tint-C-cap-${key})) h)`,
  };
}

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
      borderWidth: "1px",
      boxShadow: "subtle",
    },
  },
  // Primary material, subtle variant
  surfaceMuted: {
    value: {
      bg: "surface.muted",
      color: "content",
      backgroundImage: "none",
      borderColor: "surface.border",
      borderRadius: "md",
      borderWidth: "1px",
      boxShadow: "none",
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
      borderWidth: "1px",
      boxShadow: "medium",
    },
  },

  // Tint layers
  "tinted.normal": { value: tintedNormalStyle },
  "tinted.subtle": { value: tintedSubtleStyle },
  "tinted.muted": { value: tintedMutedStyle },
});

// Override input styles to support the two-material system
export const inputRecipe = {
  variants: {
    variant: {
      outline: {
        bg: {
          _light: "{colors.white}/60",
          _dark: "{colors.neutralDark.200}/30",
        },
        color: "{colors.content}",
        _placeholder: {
          color: "{colors.content}/60",
        },
        borderColor: "{colors.surface.border}",
        focusVisibleRing: "outside",
        focusRingOffset: "0px",
        focusRingColor: "{colors.content.subtle}",
      },
      onContrast: {
        bg: {
          _light: "{colors.surface}/10",
          _dark: "{colors.neutralDark.100}/20",
        },
        color: "{colors.contentContrast}",
        _placeholder: {
          color: "{colors.contentContrast}/60",
        },
        borderWidth: "1px",
        borderColor: {
          _light: "{colors.surface.border}/20",
          _dark: "{colors.neutralDark.500}/30",
        },
        focusVisibleRing: "outside",
        focusRingOffset: "0px",
        focusRingColor: "{colors.contentContrast}",
        _focusVisible: {
          boxShadow: {
            _light: "0px 0px 0px 4px {colors.accent.200}",
            _dark: "0px 0px 0px 4px {colors.goldDark.300}/30",
          },
        },
      },
    },
  },
};

// Button variant fixes
const buttonRecipe = {
  variants: {
    variant: {
      solid: {
        _hover: {
          bg: "colorPalette.solid/75",
          color: "colorPalette.contrast",
        },
        _expanded: {
          bg: "colorPalette.solid/75",
          color: "colorPalette.contrast",
        },
      },
      outline: {
        color: "colorPalette.fg",
        _hover: {
          bg: "colorPalette.solid/75",
          color: "colorPalette.contrast",
        },
        _expanded: {
          bg: "colorPalette.solid/75",
          color: "colorPalette.contrast",
        },
      },
      ghost: {
        _hover: {
          bg: "colorPalette.solid/75",
          color: "colorPalette.contrast",
        },
        _expanded: {
          bg: "colorPalette.solid/75",
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

const tintConstants = {
  ":where(:root, :host)": {
    "--_tint-seed": "oklch(0.70 0.15 200)",

    "--tint-L-normal": "0.64",
    "--tint-L-subtle": "0.58",
    "--tint-L-muted": "0.50",

    "--tint-C-cap-normal": "0.18",
    "--tint-C-cap-subtle": "0.14",
    "--tint-C-cap-muted": "0.12",

    "--tint-L-base-normal": "0.28",
    "--tint-L-base-subtle": "0.24",
    "--tint-L-base-muted": "0.22",

    "--tint-C-norm": "0.05", // Normalization factor for chroma
  },

  "html.dark": {
    "--tint-L-normal": "0.84",
    "--tint-L-subtle": "0.78",
    "--tint-L-muted": "0.70",

    "--tint-C-cap-normal": "0.09",
    "--tint-C-cap-subtle": "0.07",
    "--tint-C-cap-muted": "0.05",

    "--tint-L-base-normal": "0.94",
    "--tint-L-base-subtle": "0.92",
    "--tint-L-base-muted": "0.8",
  },
};

// Complete theme configuration
export const appTheme = defineConfig({
  globalCss: {
    ...tintConstants,
    // Mainly only needed for dialogs as they are outside the app root
    body: {
      fontFamily: "var(--chakra-fonts-body)",
      color: "var(--chakra-colors-content)",
    },
    "::selection": {
      backgroundColor: {
        _light: "var(--chakra-colors-gold-500)/30", // Semi-transparent gold for light mode
        _dark: "var(--chakra-colors-gold-dark-500)/40", // Brighter semi-transparent gold for dark mode
      },
      color: {
        _light: "var(--chakra-colors-neutral-900)", // Dark text on light selection
        _dark: "var(--chakra-colors-neutral-dark-950)", // Bright text on dark selection
      },
    },
    em: {
      fontStyle: "italic",
      color: {
        _light: "var(--chakra-colors-content-emphasized)",
        _dark: "var(--chakra-colors-content-emphasized)",
      },
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

export const system = createSystem(defaultConfig, appTheme);
