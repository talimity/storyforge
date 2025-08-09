import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    tokens: {
      fonts: {
        body: {
          value:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        heading: {
          value: "'Crimson Text', Georgia, 'Times New Roman', serif",
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
