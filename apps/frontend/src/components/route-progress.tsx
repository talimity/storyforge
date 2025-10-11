import { Box, Progress } from "@chakra-ui/react";
import { useNavigation } from "react-router-dom";

export function RouteProgress() {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  return (
    <Box position="sticky" top="0" zIndex="banner" h="0" overflow="visible">
      <Progress.Root size="xs" value={busy ? null : 100} opacity={busy ? 1 : 0} m="0" pb="0">
        <Progress.Track>
          <Progress.Range />
        </Progress.Track>
      </Progress.Root>
    </Box>
  );
}
