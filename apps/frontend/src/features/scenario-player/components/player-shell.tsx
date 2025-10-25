import {
  Box,
  Flex,
  Grid,
  HStack,
  IconButton,
  Skeleton,
  useBreakpointValue,
} from "@chakra-ui/react";
import { Suspense, useEffect, useState } from "react";
import { LuArrowLeft, LuBookOpen, LuGitBranch } from "react-icons/lu";
import { Link, Navigate, Outlet, useParams } from "react-router-dom";
import { ErrorBoundary } from "@/components/error-boundary";
import { LoreActivationPreviewDialog } from "@/features/lorebooks/components/lore-activation-preview-dialog";
import { PlayerMetaMenu } from "@/features/scenario-player/components/player-meta-menu";
import { ScenarioNavigation } from "@/features/scenario-player/components/scenario-navigation";
import { TurnGraphDialog } from "@/features/scenario-player/graph";
import {
  ScenarioProvider,
  useScenarioContext,
} from "@/features/scenario-player/providers/scenario-provider";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";

export default function PlayerShell() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/scenarios" replace />;

  return (
    <ErrorBoundary fallbackTitle="Scenario Player Error">
      <Suspense fallback={<PlayerChromeSkeleton />}>
        <ScenarioProvider scenarioId={id}>
          <PlayerShellInner />
        </ScenarioProvider>
      </Suspense>
    </ErrorBoundary>
  );
}

function PlayerShellInner() {
  const isMobile = useBreakpointValue({ base: true, md: false });

  const { scenario } = useScenarioContext();
  const previewLeafTurnId = useScenarioPlayerStore((s) => s.previewLeafTurnId);
  const [showPreview, setShowPreview] = useState(false);
  const [showGraph, setShowGraph] = useState(false);

  useEffect(() => {
    if (scenario.title) {
      document.title = `${scenario.title} - StoryForge`;
    } else {
      document.title = `Play Scenario - StoryForge`;
    }
  }, [scenario.title]);

  return (
    <Flex direction="column" h="100dvh" colorPalette="neutral" data-testid="player-shell">
      {/* Top Scenario Title Bar */}
      <Grid
        as="header"
        h="12"
        px={2}
        bg="surface"
        gridTemplateColumns="1fr auto 1fr"
        alignItems="center"
        data-testid="player-shell-header"
      >
        {/* Left Section */}
        <HStack gap={0.5} justifySelf="start" alignItems="center">
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Exit scenario"
            data-testid="scenario-back-button"
            asChild
          >
            <Link to="/scenarios">
              <LuArrowLeft />
            </Link>
          </IconButton>
        </HStack>

        {/* Center Section - Story Nav */}
        <Box
          textAlign="center"
          justifySelf="center"
          alignItems="center"
          overflow="hidden"
          gridColumn="2"
          minW={0}
          maxW="100%"
          asChild
        >
          <ScenarioNavigation />
        </Box>

        {/* Right Section - Meta Toolbar */}
        <HStack gap={0.5} justifySelf="end" alignItems="center">
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Open turn graph"
            onClick={() => setShowGraph(true)}
          >
            <LuGitBranch />
          </IconButton>
          <IconButton variant="ghost" size="sm" onClick={() => setShowPreview(true)}>
            <LuBookOpen />
          </IconButton>
          <PlayerMetaMenu />
        </HStack>
      </Grid>
      <Flex
        flex="1"
        overflow="hidden"
        data-testid="player-shell-content"
        direction={{ base: "column-reverse", lg: "row" }}
      >
        {/* Content Area Layout */}
        <Box
          as="main"
          flex="1"
          minH="0"
          minW="0"
          layerStyle="surface"
          borderRadius="0"
          borderTopRightRadius={isMobile ? "0" : "sm"}
          boxShadow="inset 0 0 8px rgba(0, 0, 0, 0.1)"
          data-testid="player-shell-main"
        >
          <Outlet />
        </Box>

        {/* Eventual Side Panel Area */}
        {/*<Box width="96" minH="36">*/}
        {/*  Testing*/}
        {/*</Box>*/}
      </Flex>

      <LoreActivationPreviewDialog
        isOpen={showPreview}
        onOpenChange={setShowPreview}
        scenarioId={scenario.id}
        leafTurnId={previewLeafTurnId ?? undefined}
        title={`Lore Preview – ${scenario.title}`}
      />
      <TurnGraphDialog scenarioId={scenario.id} isOpen={showGraph} onOpenChange={setShowGraph} />
    </Flex>
  );
}

function PlayerChromeSkeleton() {
  return (
    <Flex direction="column" h="100vh">
      <Flex as="header" h="12" px={4} align="center" justify="space-between">
        <HStack gap={3}>
          <Skeleton height="8" width="80px" />
        </HStack>
        <Box flex="1" textAlign="center" px={4}>
          <Skeleton height="4" width="220px" mx="auto" />
        </Box>
        <HStack gap={2}>
          <Skeleton boxSize="8" />
          <Skeleton boxSize="8" />
        </HStack>
      </Flex>
      <Flex flex="1" overflow="hidden">
        <Box w="50%" p={3} display={{ base: "none", lg: "block" }}>
          <Skeleton height="5" mb={3} />
          <Skeleton height="16" mb={2} />
          <Skeleton height="16" mb={2} />
        </Box>
      </Flex>
    </Flex>
  );
}
