import { IconButton } from "@chakra-ui/react";
import { useState } from "react";
import { FaPlug, FaPlugCircleCheck, FaPlugCircleXmark } from "react-icons/fa6";
import { Tooltip } from "@/components/ui/index";
import { showErrorToast, showSuccessToast } from "@/lib/error-handling";
import { trpc } from "@/lib/trpc";

interface TestConnectionButtonProps {
  providerId: string;
  modelProfileId: string;
}

export function TestConnectionButton({ providerId, modelProfileId }: TestConnectionButtonProps) {
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const testConnectionMutation = trpc.providers.testConnection.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        setTestResult("success");
        showSuccessToast({
          title: "Connection successful",
          description: "Provider connection test passed",
        });
      } else {
        setTestResult("error");
        showErrorToast({ title: "Connection failed", error: "Unknown error" });
      }
      // Reset the status after 3 seconds
      setTimeout(() => setTestResult(null), 3000);
    },
    onError: (error) => {
      setTestResult("error");
      showErrorToast({ title: "Connection test failed", error: error.message });
      // Reset the status after 3 seconds
      setTimeout(() => setTestResult(null), 3000);
    },
  });

  const getIcon = () => {
    if (testConnectionMutation.isPending) return <FaPlug />;
    if (testResult === "success") return <FaPlugCircleCheck />;
    if (testResult === "error") return <FaPlugCircleXmark />;
    return <FaPlug />;
  };

  const getTooltip = () => {
    if (testConnectionMutation.isPending) return "Testing connection...";
    if (testResult === "success") return "Connection successful";
    if (testResult === "error") return "Connection failed";
    return "Test connection";
  };

  const getColorPalette = () => {
    if (testResult === "success") return "green";
    if (testResult === "error") return "red";
    return "neutral";
  };

  return (
    <Tooltip content={getTooltip()}>
      <IconButton
        variant="ghost"
        size="xs"
        colorPalette={getColorPalette()}
        loading={testConnectionMutation.isPending}
        onClick={() => testConnectionMutation.mutate({ providerId, modelProfileId })}
      >
        {getIcon()}
      </IconButton>
    </Tooltip>
  );
}
