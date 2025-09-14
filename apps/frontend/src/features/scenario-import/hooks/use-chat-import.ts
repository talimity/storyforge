import type { CharacterMapping, ChatImportAnalyzeOutput } from "@storyforge/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useRef, useState } from "react";
import { toaster } from "@/components/ui/index";
import { validateFile } from "@/features/scenario-import/services/file-validation";
import { showSuccessToast } from "@/lib/error-handling";
import { makeScenarioName } from "@/lib/make-scenario-name";
import { useTRPC } from "@/lib/trpc";

interface UseChatImportProps {
  onClose: () => void;
  onImportSuccess: (scenarioId: string) => void;
}

export type ImportStep = "upload" | "mapping";

export function useChatImport({ onClose, onImportSuccess }: UseChatImportProps) {
  const trpc = useTRPC();
  const [step, setStep] = useState<ImportStep>("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDataUri, setFileDataUri] = useState<string>("");
  const [analyzeResult, setAnalyzeResult] = useState<ChatImportAnalyzeOutput | null>(null);
  const [scenarioName, setScenarioName] = useState("");
  const [scenarioDescription, setScenarioDescription] = useState("");
  const [characterMappings, setCharacterMappings] = useState<CharacterMapping[]>([]);

  const queryClient = useQueryClient();
  const analyzeMutation = useMutation(trpc.chatImport.analyzeChat.mutationOptions());
  const importMutation = useMutation(trpc.chatImport.importChat.mutationOptions());

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = (file: File) => {
    const validation = validateFile(file);

    if (!validation.isValid) {
      toaster.error({
        title: "Invalid file format",
        description: validation.error,
        duration: 5000,
      });
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") setFileDataUri(result);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!fileDataUri) return;

    setIsProcessing(true);
    try {
      const result = await analyzeMutation.mutateAsync({ fileDataUri });

      setAnalyzeResult(result);

      const mappings: CharacterMapping[] = result.detectedCharacters.map(
        (char): CharacterMapping => {
          if (char.suggestedCharacterId) {
            return {
              detectedName: char.name,
              targetType: "character",
              characterId: char.suggestedCharacterId,
            };
          }

          if (char.isSystem) {
            return { detectedName: char.name, targetType: "narrator" };
          }

          return { detectedName: char.name, targetType: "ignore" };
        }
      );

      setCharacterMappings(mappings);

      const charas = mappings.filter((m) => m.targetType === "character");
      const defaultName = makeScenarioName(charas.map((c) => c.detectedName));
      const fileName =
        defaultName || selectedFile?.name.replace(/\.(json|jsonl|txt)$/i, "") || "Imported Chat";
      setScenarioName(fileName);

      setStep("mapping");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!fileDataUri || !scenarioName) return;

    setIsProcessing(true);
    try {
      const result = await importMutation.mutateAsync({
        fileDataUri,
        scenarioName,
        scenarioDescription,
        mappings: characterMappings,
      });

      showSuccessToast({
        title: "Import successful",
        description: `Created scenario with ${result.turnCount} turns.`,
      });

      await queryClient.invalidateQueries(trpc.scenarios.list.pathFilter());

      if (result.scenarioId) {
        onImportSuccess(result.scenarioId);
      }
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const updateMapping = (index: number, mapping: Partial<CharacterMapping>) => {
    setCharacterMappings((prev) => {
      const updated = [...prev];
      const current = updated[index];

      if (mapping.targetType === "character") {
        updated[index] = {
          detectedName: current.detectedName,
          targetType: "character",
          characterId: mapping.characterId || "",
        };
      } else if (mapping.targetType === "narrator") {
        updated[index] = {
          detectedName: current.detectedName,
          targetType: "narrator",
        };
      } else if (mapping.targetType === "ignore") {
        updated[index] = {
          detectedName: current.detectedName,
          targetType: "ignore",
        };
      } else if ("characterId" in mapping) {
        if (current.targetType === "character") {
          updated[index] = {
            ...current,
            characterId: mapping.characterId || "",
          };
        }
      }

      return updated;
    });
  };

  const handleClose = () => {
    setStep("upload");
    setSelectedFile(null);
    setFileDataUri("");
    setAnalyzeResult(null);
    setScenarioName("");
    setScenarioDescription("");
    setCharacterMappings([]);
    onClose();
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileDataUri("");
  };

  return {
    step,
    setStep,
    isProcessing,
    fileInputRef,
    selectedFile,
    analyzeResult,
    scenarioName,
    setScenarioName,
    scenarioDescription,
    setScenarioDescription,
    characterMappings,
    updateMapping,
    handleFileChange,
    handleDragOver,
    handleDrop,
    handleAnalyze,
    handleImport,
    handleClose,
    removeFile,
  };
}
