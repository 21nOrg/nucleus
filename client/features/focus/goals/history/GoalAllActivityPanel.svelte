<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { get } from "svelte/store";
  import type { DatafnChangelogEntry } from "@datafn/client";
  import { isValidArrayWithData } from "@21n/shared-utils/obj.utils";
  import type { IAccessLog } from "@nucleum/features/system/accessLogging/accessLog.type";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import ScrollViewBottomSpacer from "@21n/layout/scrollView/ScrollViewBottomSpacer.svelte";
  import type {
    ISessionThumb,
    ISessionLog
  } from "@nucleum/features/focus/logs/log.type";
  import { isSameResource } from "@nucleum/datafn/resource.utils";
  import { formatSeconds } from "@21n/utils/time.utils";

  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { cn } from "@21n/utils/ui.utils";
  import { datafn, datafnRuntime } from "@nucleum/datafn/datafn.store";
  import { toSvelteStore } from "@datafn/svelte";

  type ActivityLog = {
    action: string;
    timestamp: Date;
    type: "activity" | "focus";
    session?: ISessionThumb;
    logs?: ISessionLog[];
  };

  let {
    objectiveId,
    createdAt
  }: {
    objectiveId: string;
    createdAt: string;
  } = $props();

  let changelogLogs = $state<ActivityLog[]>([]);
  let isChangelogLoading = $state(false);
  const accessLogStore = $derived.by(() =>
    toSvelteStore<IAccessLog[]>(
      objectiveId
        ? datafn.accessLog.signal({
            filters: {
              resourceId: objectiveId.toString()
            }
          })
        : datafn.emptySignal([]),
      { initialData: [] }
    )
  );
  const sessionLogStore = $derived.by(() =>
    toSvelteStore<ISessionLog[]>(
      objectiveId
        ? datafn.sessionLog.signal({
            filters: {
              objectiveId: objectiveId.toString()
            }
          })
        : datafn.emptySignal([]),
      { initialData: [] }
    )
  );
  const sessionLogs = $derived($sessionLogStore.data);
  const sessionIds = $derived.by(() => [
    ...new Set(
      sessionLogs
        .map((log) => log.sessionId?.toString())
        .filter((sessionId): sessionId is string => Boolean(sessionId))
    )
  ]);
  const sessionStore = $derived.by(() =>
    toSvelteStore<ISessionThumb[]>(
      datafn.session.signal({
        filters: {
          id: { $in: sessionIds }
        }
      }),
      { initialData: [] }
    )
  );
  const accessLogs = $derived.by(() => {
    const createdLogs: ActivityLog[] = createdAt
      ? [
          {
            action: "Created",
            timestamp: new Date(createdAt),
            type: "activity"
          }
        ]
      : [];
    const openLogs: ActivityLog[] = $accessLogStore.data.map((log) => ({
      action: "Opened",
      timestamp: new Date(log.createdAt),
      type: "activity"
    }));
    const focusLogs: ActivityLog[] = $sessionStore.data.map((session) => ({
      action: `Focus session - ${formatSeconds(session.elapsed)}`,
      timestamp: new Date(session.startUnix),
      type: "focus",
      session,
      logs: sessionLogs.filter((log) =>
        log.sessionId ? isSameResource(log.sessionId, session) : false
      )
    }));
    return [...createdLogs, ...openLogs, ...changelogLogs, ...focusLogs].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  });
  const isLoading = $derived(
    isChangelogLoading ||
      $accessLogStore.loading ||
      $accessLogStore.refreshing ||
      $sessionLogStore.loading ||
      $sessionLogStore.refreshing ||
      $sessionStore.loading ||
      $sessionStore.refreshing
  );

  $effect(() => {
    if (objectiveId) void refreshChangelog(objectiveId.toString());
    else changelogLogs = [];
  });

  async function refreshChangelog(objectiveId: string) {
    try {
      isChangelogLoading = true;
      const mutations = await get(datafnRuntime)?.storage?.changelogList({
        limit: 500
      });

      if (isValidArrayWithData(mutations)) {
        const objectiveMutations = (mutations ?? []).filter((mutation) =>
          isObjectiveMutation(mutation, objectiveId)
        );
        changelogLogs = [
          ...objectiveMutations.map((mutation) => ({
            action: resolveDatafnAction(
              mutation.mutation.operation?.toString()
            ),
            timestamp: resolveDatafnTimestamp(mutation),
            type: "activity" as const
          }))
        ];
      } else changelogLogs = [];
    } catch (e) {
      logger.error({ at: "ObjectiveAllActivityPanel.refreshChangelog", e });
      changelogLogs = [];
    } finally {
      isChangelogLoading = false;
    }
  }

  function isObjectiveMutation(
    entry: DatafnChangelogEntry,
    objectiveId: string
  ) {
    const mutation = entry.mutation;
    if (mutation.resource !== Resource.objective) return false;
    const mutationIds = Array.isArray(mutation.id)
      ? mutation.id
      : [mutation.id, (mutation.record as Record<string, unknown>)?.id];
    return mutationIds
      .filter(Boolean)
      .some((id) => id?.toString() === objectiveId);
  }

  function resolveDatafnAction(operation?: string) {
    switch (operation) {
      case "insert":
        return "Created";
      case "merge":
      case "replace":
        return "Updated";
      case "trash":
        return "Deleted";
      case "archive":
        return "Archived";
      case "restore":
      case "unarchive":
        return "Restored";
      case "delete":
        return "Removed";
      default:
        return operation ?? "Updated";
    }
  }

  function resolveDatafnTimestamp(entry: DatafnChangelogEntry) {
    if (entry.timestampMs) return new Date(entry.timestampMs);
    if (entry.timestamp) return new Date(entry.timestamp);
    const record = entry.mutation.record as Record<string, unknown> | undefined;
    const recordTimestamp = record?.updatedAt ?? record?.createdAt;
    if (recordTimestamp) return new Date(recordTimestamp as string | number);
    return new Date();
  }
</script>

<div class="flex flex-col gap-6 w-full h-full">
  {#if isLoading || !accessLogs}
    <EmptyStatusView
      isLoadingState={isLoading}
      subText="History not available"
    />
  {:else}
    <div class="flex flex-col gap-3 overflow-y-auto">
      {#each accessLogs as accessLog}
        <button
          class={cn("flex items-center justify-between gap-2 p-2 rounded-lg", {
            "cursor-pointer hover:bg-bgs2": accessLog.type === "focus"
          })}
          onclick={() => {
            if (accessLog.type === "focus" && accessLog.session?.id) {
              navigation.openResource(accessLog.session.id, AccessMode.POP, {
                origin: objectiveId
              });
            }
          }}
        >
          <span class="text-fgs2">{accessLog.action}</span>
          <span class="text-fgs3 text-sm">
            {accessLog.timestamp.toLocaleString()}
          </span>
        </button>
      {/each}
      <ScrollViewBottomSpacer />
    </div>
  {/if}
</div>
