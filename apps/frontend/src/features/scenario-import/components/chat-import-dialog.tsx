import { HStack } from "@chakra-ui/react";
import { Button, Dialog } from "@/components/ui/index";
import { CharacterMappingStep } from "@/features/scenario-import/components/character-mapping-step";
import { ChatUploadStep } from "@/features/scenario-import/components/chat-upload-step";
import { useChatImport } from "@/features/scenario-import/hooks/use-chat-import";

interface ChatImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (scenarioId: string) => void;
}

export function ChatImportDialog({ isOpen, onClose, onImportSuccess }: ChatImportDialogProps) {
  const vm = useChatImport({ onClose, onImportSuccess });

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) vm.handleClose();
      }}
      size="lg"
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>
            {vm.step === "upload" ? "Import SillyTavern Chat" : "Assign Characters"}
          </Dialog.Title>
        </Dialog.Header>

        <Dialog.Body>
          {vm.step === "upload" ? (
            <ChatUploadStep
              selectedFile={vm.selectedFile}
              onBrowseClick={() => vm.fileInputRef.current?.click()}
              onFileInput={vm.handleFileChange}
              onDrop={vm.handleDrop}
              onDragOver={vm.handleDragOver}
              onRemoveFile={vm.removeFile}
              fileInputRef={vm.fileInputRef}
            />
          ) : (
            <CharacterMappingStep
              scenarioName={vm.scenarioName}
              setScenarioName={vm.setScenarioName}
              scenarioDescription={vm.scenarioDescription}
              setScenarioDescription={vm.setScenarioDescription}
              analyzeResult={vm.analyzeResult}
              characterMappings={vm.characterMappings}
              updateMapping={vm.updateMapping}
            />
          )}
        </Dialog.Body>

        <Dialog.Footer>
          <HStack justify="space-between" w="full">
            <Button variant="ghost" onClick={vm.handleClose} disabled={vm.isProcessing}>
              Cancel
            </Button>

            {vm.step === "upload" ? (
              <Button
                colorPalette="primary"
                onClick={vm.handleAnalyze}
                disabled={!vm.selectedFile || vm.isProcessing}
                loading={vm.isProcessing}
              >
                Analyze Chat
              </Button>
            ) : (
              <HStack gap={2}>
                <Button
                  variant="ghost"
                  onClick={() => vm.setStep("upload")}
                  disabled={vm.isProcessing}
                >
                  Back
                </Button>
                <Button
                  colorPalette="primary"
                  onClick={vm.handleImport}
                  disabled={!vm.scenarioName || vm.isProcessing}
                  loading={vm.isProcessing}
                >
                  Import as Scenario
                </Button>
              </HStack>
            )}
          </HStack>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
