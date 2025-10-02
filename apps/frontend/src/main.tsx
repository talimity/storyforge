import { ChakraProvider } from "@chakra-ui/react";
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

// biome-ignore lint/style/noNonNullAssertion: We are sure the root element exists.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TRPCReactProvider>
      <ChakraProvider value={system}>
        <ThemeProvider attribute="class">
          <RouterProvider router={router} />
          <Toaster />
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
        </ThemeProvider>
      </ChakraProvider>
    </TRPCReactProvider>
  </React.StrictMode>
);
