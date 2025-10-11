import { Box, ChakraProvider } from "@chakra-ui/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { FormDevtoolsPlugin } from "@tanstack/react-form-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TRPCReactProvider } from "@/lib/trpc-react-provider";
import { router } from "@/router";
import { system } from "@/theme";

const ENABLE_DEVTOOLS = false;
const ENABLE_STRICT_MODE = true;
const ReactRoot = ENABLE_STRICT_MODE ? React.StrictMode : React.Fragment;

// biome-ignore lint/style/noNonNullAssertion: We are sure the root element exists.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ReactRoot>
    <TRPCReactProvider>
      <ChakraProvider value={system}>
        <Box colorPalette="neutral">
          <ThemeProvider attribute="class">
            <RouterProvider router={router} />
            <Toaster />
            {ENABLE_DEVTOOLS && (
              <TanStackDevtools
                config={{ position: "bottom-left", hideUntilHover: true }}
                plugins={[
                  FormDevtoolsPlugin(),
                  {
                    name: "TanStack Query",
                    render: () => <ReactQueryDevtoolsPanel />,
                  },
                ]}
              />
            )}
          </ThemeProvider>
        </Box>
      </ChakraProvider>
    </TRPCReactProvider>
  </ReactRoot>
);
