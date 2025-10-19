"use client";

import {
  Toaster as ChakraToaster,
  type CreateToasterReturn,
  createToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
} from "@chakra-ui/react";
import { CloseButton } from "@/components/ui/close-button";

export const toaster: CreateToasterReturn = createToaster({
  placement: "top",
  offsets: "16px",
  pauseOnPageIdle: true,
});

export const Toaster = () => {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }}>
        {(toast) => {
          const color =
            toast.type === "error"
              ? "red"
              : toast.type === "success"
                ? "green"
                : toast.type === "warning"
                  ? "yellow"
                  : "blue";
          return (
            <Toast.Root
              layerStyle="surface"
              width={{ md: "sm" }}
              borderColor={`${color}`}
              borderWidth="1px"
              boxShadow="md"
              data-testid={`toast-${toast.type || "default"}`}
              alignItems="center"
            >
              {toast.type === "loading" ? (
                <Spinner size="sm" color="blue.solid" />
              ) : (
                <Toast.Indicator boxSize="8" color={`${color}`} />
              )}
              <Stack gap="1" flex="1" maxWidth="100%">
                {toast.title && <Toast.Title color={`${color}.solid`}>{toast.title}</Toast.Title>}
                {toast.description && <Toast.Description>{toast.description}</Toast.Description>}
              </Stack>
              {toast.action && <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>}
              {toast.closable && (
                <Toast.CloseTrigger>
                  <CloseButton />
                </Toast.CloseTrigger>
              )}
            </Toast.Root>
          );
        }}
      </ChakraToaster>
    </Portal>
  );
};
