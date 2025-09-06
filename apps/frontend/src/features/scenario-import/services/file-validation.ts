export const VALID_FILE_TYPES = [
  "application/json",
  "text/plain",
  "application/x-ndjson",
];

export const VALID_FILE_EXTENSIONS = [".json", ".jsonl", ".txt"];

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateFile(file: File): FileValidationResult {
  const hasValidType = VALID_FILE_TYPES.includes(file.type) || file.type === "";
  const hasValidExtension = VALID_FILE_EXTENSIONS.some((ext) =>
    file.name.endsWith(ext)
  );

  if (!hasValidType && !hasValidExtension) {
    return {
      isValid: false,
      error: "Please select a JSONL file exported from SillyTavern.",
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: "Maximum file size is 50MB.",
    };
  }

  return { isValid: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
