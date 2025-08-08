import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { ThemeProvider } from "next-themes";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TRPCReactProvider } from "@/lib/providers";
import { router } from "@/router";

// biome-ignore lint/style/noNonNullAssertion: We are sure the root element exists.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TRPCReactProvider>
      <ChakraProvider value={defaultSystem}>
        <ThemeProvider attribute="class">
          <RouterProvider router={router} />
          <Toaster />
        </ThemeProvider>
      </ChakraProvider>
    </TRPCReactProvider>
  </React.StrictMode>
);
