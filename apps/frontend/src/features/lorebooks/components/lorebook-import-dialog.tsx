import { Box, HStack, Icon, Stack, Tabs, Text, VStack } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { LuBookCopy, LuFile, LuUpload, LuX } from "react-icons/lu";
import { Button, Dialog, Switch } from "@/components/ui";
import { CharacterSingleSelect } from "@/features/characters/components/character-selector";
import { showErrorToast, showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

interface LorebookImportDialogProps {
  isOpen: boolean;
  onOpenChange: (details: { open: boolean }) => void;
}

export function LorebookImportDialog({ isOpen, onOpenChange }: LorebookImportDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const browseButtonRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<"file" | "character">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDataUri, setFileDataUri] = useState<string>("");
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [linkToCharacter, setLinkToCharacter] = useState(true);
  const fileInputId = useId();

  const importFileMutation = useMutation(
    trpc.lorebooks.import.mutationOptions({
      onSuccess: async (result) => {
        showSuccessToast({ title: `Imported lorebook "${result.name}"` });
        await queryClient.invalidateQueries(trpc.lorebooks.pathFilter());
        resetState();
        onOpenChange({ open: false });
      },
      onError: (error) => setImportError(error.message || "Failed to import lorebook"),
    })
  );

  const importFromCharacterMutation = useMutation(
    trpc.lorebooks.importFromCharacter.mutationOptions({
      onSuccess: async ({ lorebook, created }) => {
        showSuccessToast({
          title: created ? "Lorebook created" : "Lorebook already existed",
          description: created
            ? `Imported lorebook "${lorebook.name}" from character.`
            : `Linked existing lorebook "${lorebook.name}" to your library.`,
        });
        await queryClient.invalidateQueries(trpc.lorebooks.pathFilter());
        resetState();
        onOpenChange({ open: false });
      },
      onError: (error) =>
        showErrorToast({
          title: "Unable to import from character",
          error,
        }),
    })
  );

  const handleFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      setImportError("File too large. Maximum size is 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        setSelectedFile(file);
        setFileDataUri(result);
        setImportError(null);
      }
    };
    reader.onerror = () => setImportError("Failed to read file");
    reader.readAsDataURL(file);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleImportFile = async () => {
    if (!fileDataUri) return;
    await importFileMutation.mutateAsync({
      fileDataUri,
      filename: selectedFile?.name,
    });
  };

  const handleImportFromCharacter = async () => {
    if (!selectedCharacterId) {
      showErrorToast({
        title: "Select a character first",
      });
      return;
    }
    await importFromCharacterMutation.mutateAsync({
      characterId: selectedCharacterId,
      linkToCharacter,
    });
  };

  const resetState = () => {
    setSelectedFile(null);
    setFileDataUri("");
    setImportError(null);
    setSelectedCharacterId(null);
    setLinkToCharacter(true);
    setTab("file");
  };

  const handleClose = () => {
    resetState();
    onOpenChange({ open: false });
  };

  const isImporting = importFileMutation.isPending || importFromCharacterMutation.isPending;

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={({ open }) => {
        if (!open) handleClose();
        else onOpenChange({ open });
      }}
      placement="center"
      size="lg"
      initialFocusEl={() => browseButtonRef.current}
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Import Lorebook</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Tabs.Root value={tab} onValueChange={(details) => setTab(details.value as typeof tab)}>
            <Tabs.List mb={4}>
              <Tabs.Trigger value="file">
                <LuUpload /> File Upload
              </Tabs.Trigger>
              <Tabs.Trigger value="character">
                <LuBookCopy /> From Character Card
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="file">
              <Stack gap={4}>
                <Text color="content.muted" fontSize="sm">
                  Upload a SillyTavern World Info JSON file.
                </Text>
                <Box
                  border="2px dashed"
                  borderColor="border.muted"
                  borderRadius="md"
                  p={8}
                  textAlign="center"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  _hover={{ borderColor: "border.emphasized" }}
                  cursor="pointer"
                  onClick={() => document.getElementById(fileInputId)?.click()}
                >
                  <VStack gap={3}>
                    <Icon fontSize="3xl" color="content.muted">
                      <LuUpload />
                    </Icon>
                    <VStack gap={1}>
                      <Text fontWeight="medium">Drop file here or click to browse</Text>
                      <Text fontSize="sm" color="content.muted">
                        JSON files up to 2MB are supported
                      </Text>
                    </VStack>
                    <Button
                      ref={browseButtonRef}
                      size="sm"
                      variant="outline"
                      disabled={isImporting}
                    >
                      Browse Files
                    </Button>
                  </VStack>
                  <input
                    id={fileInputId}
                    type="file"
                    accept=".json,application/json"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                    disabled={isImporting}
                  />
                </Box>

                {selectedFile && (
                  <VStack gap={2} align="stretch">
                    <Text fontWeight="medium" fontSize="sm">
                      Selected File
                    </Text>
                    <HStack
                      p={3}
                      border="1px solid"
                      borderColor="border.muted"
                      borderRadius="md"
                      justify="space-between"
                    >
                      <HStack gap={3}>
                        <Icon color="content.muted">
                          <LuFile />
                        </Icon>
                        <VStack gap={0} align="start">
                          <Text fontSize="sm" fontWeight="medium">
                            {selectedFile.name}
                          </Text>
                          <Text fontSize="xs" color="content.muted">
                            {(selectedFile.size / 1024).toFixed(1)} KB
                          </Text>
                        </VStack>
                      </HStack>
                      {!isImporting && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setSelectedFile(null);
                            setFileDataUri("");
                          }}
                        >
                          <LuX />
                        </Button>
                      )}
                    </HStack>
                  </VStack>
                )}

                {importError && (
                  <Box
                    p={3}
                    bg="bg.error"
                    color="fg.error"
                    borderRadius="md"
                    border="1px solid"
                    borderColor="border.error"
                  >
                    <Text fontSize="sm">{importError}</Text>
                  </Box>
                )}

                <HStack justify="flex-end">
                  <Button
                    colorPalette="primary"
                    onClick={handleImportFile}
                    disabled={!fileDataUri || isImporting}
                    loading={importFileMutation.isPending}
                  >
                    Import Lorebook
                  </Button>
                </HStack>
              </Stack>
            </Tabs.Content>

            <Tabs.Content value="character">
              <Stack gap={4}>
                <Text color="content.muted" fontSize="sm">
                  Select a character with an embedded character book to import it into your library.
                </Text>
                <CharacterSingleSelect
                  inDialog
                  value={selectedCharacterId}
                  onChange={(id) => setSelectedCharacterId(id)}
                  placeholder="Search characters"
                />
                <HStack align="center">
                  <Switch
                    checked={linkToCharacter}
                    onCheckedChange={({ checked }) => setLinkToCharacter(Boolean(checked))}
                  />
                  <Text fontSize="sm">Link imported lorebook to this character</Text>
                </HStack>
                <HStack justify="flex-end">
                  <Button
                    colorPalette="primary"
                    onClick={handleImportFromCharacter}
                    disabled={!selectedCharacterId || isImporting}
                    loading={importFromCharacterMutation.isPending}
                  >
                    Import From Character
                  </Button>
                </HStack>
              </Stack>
            </Tabs.Content>
          </Tabs.Root>
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="ghost" onClick={handleClose} disabled={isImporting}>
            Close
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
