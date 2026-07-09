import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userFacingError } from "../../shared/api/client";
import { queryKeys } from "../../shared/queryKeys";
import {
  createSubscription,
  deleteSubscription,
  fetchSubscriptions,
  updateSubscription,
} from "./api";
import type { SubscriptionInput, SubscriptionUpdate } from "./types";


export function useSubscriptions(userId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.subscriptions(userId),
    queryFn: () => fetchSubscriptions(userId),
  });
  const refresh = () => queryClient.invalidateQueries({
    queryKey: queryKeys.subscriptions(userId),
  });
  const create = useMutation({
    mutationFn: (payload: SubscriptionInput) => createSubscription(payload),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({
      subscriptionId,
      payload,
    }: {
      subscriptionId: string;
      payload: SubscriptionUpdate;
    }) => updateSubscription(subscriptionId, payload),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: deleteSubscription,
    onSuccess: refresh,
  });
  const error = query.error ?? create.error ?? update.error ?? remove.error;
  return {
    subscriptions: query.data?.subscriptions ?? [],
    loading: query.isPending,
    saving: create.isPending || update.isPending,
    deleting: remove.isPending,
    error: error ? userFacingError(error) : "",
    create: create.mutateAsync,
    update: update.mutateAsync,
    remove: remove.mutateAsync,
  };
}
