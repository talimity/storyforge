import { useCallback, useState } from "react";
import { FILE_ERROR_MESSAGES, showErrorToast } from "@/lib/error-handling";
import { convertFileToDataUri } from "@/lib/file-to-data-uri";

export type ImageFieldState =
  | { type: "none" }
  | { type: "existing"; url: string; displayName?: string }
  | { type: "new"; file: File; dataUri: string; displayName: string }
  | { type: "removed" };

export interface UseImageFieldOptions {
  initialUrl?: string;
  initialDisplayName?: string;
  maxSizeBytes?: number;
  allowedTypes?: string[];
}

export function useImageField({
  initialUrl,
  initialDisplayName,
  maxSizeBytes = 10 * 1024 * 1024, // 10MB default
  allowedTypes = ["image/png", "image/jpeg", "image/jpg"],
}: UseImageFieldOptions = {}) {
  const [state, setState] = useState<ImageFieldState>(() => {
    if (initialUrl) {
      return {
        type: "existing",
        url: initialUrl,
        displayName: initialDisplayName,
      };
    }
    return { type: "none" };
  });

  const validateFile = useCallback(
    (file: File): boolean => {
      // Check file type
      if (!allowedTypes.includes(file.type)) {
        showErrorToast({
          title: FILE_ERROR_MESSAGES.INVALID_FORMAT,
          error: `Only ${allowedTypes.join(", ")} files are supported.`,
        });
        return false;
      }

      // Check file size
      if (file.size > maxSizeBytes) {
        const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(1);
        showErrorToast({
          title: FILE_ERROR_MESSAGES.FILE_TOO_LARGE,
          error: `Maximum file size is ${maxSizeMB}MB.`,
        });
        return false;
      }

      return true;
    },
    [allowedTypes, maxSizeBytes]
  );

  const handleUpload = useCallback(
    async (file: File) => {
      if (!validateFile(file)) return;

      try {
        const dataUri = await convertFileToDataUri(file);
        setState({ type: "new", file, dataUri, displayName: file.name });
      } catch (error) {
        showErrorToast({
          title: FILE_ERROR_MESSAGES.PROCESS_FAILED,
          error,
          fallbackMessage: "Unable to process the selected image file.",
        });
      }
    },
    [validateFile]
  );

  const handleRemove = useCallback(() => {
    setState(state.type === "existing" ? { type: "removed" } : { type: "none" });
  }, [state.type]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const file = files[0]; // Only take the first file
      await handleUpload(file);
    },
    [handleUpload]
  );

  // Helper methods for getting values
  const getPreviewUrl = useCallback((): string | null => {
    switch (state.type) {
      case "existing":
        return state.url;
      case "new":
        return state.dataUri;
      default:
        return null;
    }
  }, [state]);

  const getDisplayName = useCallback((): string | null => {
    switch (state.type) {
      case "existing":
        return state.displayName || null;
      case "new":
        return state.displayName;
      default:
        return null;
    }
  }, [state]);

  const getFileSize = useCallback(
    () => (state.type === "new" ? `${(state.file.size / 1024).toFixed(1)} KB` : null),
    [state]
  );

  // Get the value to submit to the API
  const getSubmissionValue = useCallback(() => {
    switch (state.type) {
      case "new":
        return state.dataUri;
      case "removed":
        return null; // Explicitly remove the image
      default:
        return undefined; // Keep existing image unchanged
    }
  }, [state]);

  return {
    state,
    handleUpload,
    handleRemove,
    handleFiles,
    getPreviewUrl,
    getDisplayName,
    getFileSize,
    getSubmissionValue,
    hasImage: state.type === "existing" || state.type === "new",
  };
}
