import { useCallback, useEffect, useState } from "react";
import { useBlocker } from "react-router-dom";

interface UseUnsavedChangesProtectionOptions {
  hasUnsavedChanges: boolean;
  message?: string;
}

export function useUnsavedChangesProtection({
  hasUnsavedChanges,
  message = "You have unsaved changes. Are you sure you want to leave?",
}: UseUnsavedChangesProtectionOptions) {
  const [showDialog, setShowDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);

  // Handle browser refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = message; // Chrome requires returnValue to be set
        return message; // For other browsers
      }
      return undefined; // Explicitly return when no unsaved changes
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, message]);

  // Handle react-router navigation
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
      setShowDialog(true);
      setPendingNavigation(() => blocker.proceed);
    }
  }, [blocker]);

  const handleConfirmNavigation = useCallback(() => {
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
    setShowDialog(false);
  }, [pendingNavigation]);

  const handleCancelNavigation = useCallback(() => {
    if (blocker.state === "blocked") {
      blocker.reset();
    }
    setPendingNavigation(null);
    setShowDialog(false);
  }, [blocker]);

  // For programmatic navigation (like Cancel button)
  const confirmNavigation = useCallback(
    (navigateFn: () => void) => {
      if (hasUnsavedChanges) {
        setShowDialog(true);
        setPendingNavigation(() => navigateFn);
      } else {
        navigateFn();
      }
    },
    [hasUnsavedChanges]
  );

  return {
    showDialog,
    handleConfirmNavigation,
    handleCancelNavigation,
    confirmNavigation,
  };
}
