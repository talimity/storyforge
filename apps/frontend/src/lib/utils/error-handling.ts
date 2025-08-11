import { toaster } from "@/components/ui";

interface ErrorToastOptions {
  title: string;
  error?: Error | unknown;
  fallbackMessage?: string;
  duration?: number;
}

/**
 * Creates a standardized error toast notification
 */
export function showErrorToast({
  title,
  error,
  fallbackMessage = "An unexpected error occurred. Please try again.",
  duration = 6000,
}: ErrorToastOptions) {
  let description: string;

  if (error instanceof Error) {
    description = error.message;
  } else if (typeof error === "string") {
    description = error;
  } else {
    description = fallbackMessage;
  }

  toaster.create({
    title,
    description,
    type: "error",
    duration,
  });
}

/**
 * Creates a standardized success toast notification
 */
export function showSuccessToast({
  title,
  description,
  duration = 5000,
}: {
  title: string;
  description: string;
  duration?: number;
}) {
  toaster.create({
    title,
    description,
    type: "success",
    duration,
  });
}

/**
 * Common error messages for character operations
 */
export const CHARACTER_ERROR_MESSAGES = {
  CREATE_FAILED: "Failed to create character",
  UPDATE_FAILED: "Failed to update character",
  DELETE_FAILED: "Failed to delete character",
  LOAD_FAILED: "Failed to load character",
  IMPORT_FAILED: "Failed to import character",
} as const;

/**
 * Common error messages for file operations
 */
export const FILE_ERROR_MESSAGES = {
  INVALID_FORMAT: "Invalid file format",
  FILE_TOO_LARGE: "File too large",
  UPLOAD_FAILED: "Failed to upload file",
  PROCESS_FAILED: "Failed to process file",
} as const;
