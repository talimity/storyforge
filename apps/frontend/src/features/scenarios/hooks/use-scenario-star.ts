import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

export function useScenarioStar() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const mutation = useMutation(
    trpc.scenarios.setStarred.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries(trpc.scenarios.list.pathFilter());
      },
    })
  );

  const toggleStar = (id: string, nextValue: boolean) => {
    mutation.mutate({ id, isStarred: nextValue });
  };

  const isPendingFor = (id: string) => mutation.isPending && mutation.variables?.id === id;

  return {
    toggleStar,
    isPending: mutation.isPending,
    isPendingFor,
  };
}
