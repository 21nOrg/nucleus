<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { combineSignals, time } from "@datafn/client";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import { type IRecordId } from "@nucleum/schema/legacy/data.type";
  import { formatSeconds, formatTime } from "@21n/utils/time.utils";
  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import { appStore } from "@nucleum/stores/app.store";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import ScrollViewBottomSpacer from "@21n/layout/scrollView/ScrollViewBottomSpacer.svelte";
  import { Product } from "@nucleum/client/config/product.type";
  import {
    determineResourceType,
    resolveProductResources
  } from "@nucleum/datafn/resource.utils";
  import { rootNodeTypeList } from "@nucleum/features/memory/node/node.type";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import { toSvelteDataStore, toSvelteStore } from "@datafn/svelte";
  import { properCase } from "@21n/shared-utils/text.utils";

  type ActivityLog = {
    action: string;
    timestamp: Date;
    resourceLabel?: string;
    resourceId?: IRecordId;
  };

  type AccessLogRecord = {
    action?: string;
    createdAt?: Date | string | number;
    resource?: string;
    resourceId?: IRecordId;
    timestamp?: Date | string | number;
  };

  type LabelRecord = {
    event?: unknown;
    id?: string;
    label?: unknown;
  };

  type LabelRecordById = Record<string, LabelRecord>;

  let { date }: { date: Date } = $props();
  const dayDate = $derived(
    new Date(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const isFocusProduct = $derived(
    $appStore.product === Product.POINTRON ||
      $appStore.product === Product.NUCLEUM
  );
  const focusSessionStore = $derived.by(() =>
    toSvelteStore<any[]>(
      isFocusProduct
        ? datafn.sessionLog.signal({
            temporal: time.day("startUnix", dayDate),
            select: ["*", "objective.*", "task.*", "session.*"],
            sort: ["-startUnix"]
          })
        : datafn.emptySignal([]),
      { initialData: [] }
    )
  );
  const createdActivityStore = $derived.by(() =>
    toSvelteStore(createCreatedActivitySignal(dayDate), { initialData: [] })
  );
  const deletedActivityStore = $derived.by(() =>
    toSvelteStore(createDeletedActivitySignal(dayDate), { initialData: [] })
  );
  const accessLogStore = $derived.by(() =>
    toSvelteStore<AccessLogRecord[]>(
      datafn.accessLog.signal({
        temporal: time.day("createdAt", dayDate),
        sort: ["-createdAt"]
      }),
      { initialData: [] }
    )
  );
  const accessLogLabelStore = $derived.by(() =>
    toSvelteDataStore(
      datafn.recordsByIdsSignal({
        ids: resolveAccessLogResourceIds($accessLogStore.data),
        selectByResource: {
          [Resource.collection]: ["id", "label"],
          [Resource.event]: ["id", "label", "event"],
          [Resource.node]: ["id", "label"],
          [Resource.objective]: ["id", "label"],
          [Resource.space]: ["id", "label"],
          [Resource.task]: ["id", "label"]
        },
        metadata: {
          includeArchived: true,
          includeTrashed: true
        }
      }),
      { initialData: {} as LabelRecordById }
    )
  );
  const focusLogs = $derived.by(() =>
    $focusSessionStore.data.map((log: any) => ({
      action: `○ Focus`,
      resourceLabel: resolveFocusLogLabel(log),
      timestamp: new Date(log.startUnix),
      resourceId: resolveFocusLogResourceId(log)
    }))
  );
  const accessLogs = $derived.by(() =>
    $accessLogStore.data.map((log) => ({
      action: resolveAccessLogAction(log.action),
      resourceLabel: resolveAccessLogResourceLabel(log, $accessLogLabelStore),
      timestamp: new Date(log.timestamp ?? log.createdAt),
      resourceId: log.resourceId
    }))
  );
  const logs = $derived.by(() =>
    [
      ...$createdActivityStore.data,
      ...$deletedActivityStore.data,
      ...accessLogs,
      ...focusLogs
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  );
  const isLoading = $derived(
    $accessLogStore.loading ||
      $accessLogStore.refreshing ||
      $focusSessionStore.loading ||
      $focusSessionStore.refreshing ||
      $createdActivityStore.loading ||
      $createdActivityStore.refreshing ||
      $deletedActivityStore.loading ||
      $deletedActivityStore.refreshing
  );

  function createCreatedActivitySignal(date: Date) {
    const resources = resolveCreatedActivityResources();
    const signals = resources.map((resource) =>
      datafn.table(resource).signal({
        select: ["id", "label", "event", "createdAt", "contentType"],
        filters: resolveCreatedActivityFilters(resource),
        temporal: time.day("createdAt", date),
        sort: ["-createdAt"],
        limit: 200
      })
    );
    return combineSignals(signals, () =>
      signals.flatMap((signal, index) => {
        const resource = resources[index];
        const records = signal.get();
        if (!Array.isArray(records)) return [];
        return records.map((record: any) => ({
          action: "Created",
          resourceLabel: resolveCreatedResourceLabel(resource, record),
          timestamp: new Date(record.createdAt),
          resourceId: record.id
        }));
      })
    );
  }

  function createDeletedActivitySignal(date: Date) {
    const resources = resolveCreatedActivityResources();
    const signals = resources.map((resource) =>
      datafn.table(resource).signal({
        select: ["id", "label", "event", "trashedAt", "contentType"],
        filters: resolveCreatedActivityFilters(resource),
        metadata: { includeTrashed: true },
        temporal: time.day("trashedAt", date),
        sort: ["-trashedAt"],
        limit: 200
      })
    );
    return combineSignals(signals, () =>
      signals.flatMap((signal, index) => {
        const resource = resources[index];
        const records = signal.get();
        if (!Array.isArray(records)) return [];
        return records.map((record: any) => ({
          action: "Deleted",
          resourceLabel: resolveCreatedResourceLabel(resource, record),
          timestamp: new Date(record.trashedAt),
          resourceId: record.id
        }));
      })
    );
  }

  function resolveAccessLogResourceIds(logs: AccessLogRecord[]) {
    return Array.from(
      new Set(logs.map(resolveAccessLogResourceId).filter(isRecordIdString))
    );
  }

  function resolveAccessLogResource(log: AccessLogRecord) {
    const resource = determineResourceType(log.resourceId);
    if (resource !== Resource.unknown) return resource;
    return isResource(log.resource) ? log.resource : undefined;
  }

  function isResource(value: unknown): value is Resource {
    return (
      typeof value === "string" &&
      (Object.values(Resource) as string[]).includes(value)
    );
  }

  function resolveAccessLogResourceId(log: AccessLogRecord) {
    return isRecordIdString(log.resourceId) ? log.resourceId : undefined;
  }

  function isRecordIdString(id: unknown): id is IRecordId {
    return typeof id === "string" && id.includes(":");
  }

  function resolveCreatedActivityResources() {
    return (resolveProductResources($appStore.product, "search") ?? []).filter(
      (resource) =>
        [
          Resource.collection,
          Resource.event,
          Resource.node,
          Resource.objective,
          Resource.space,
          Resource.task
        ].includes(resource)
    );
  }

  function resolveCreatedActivityFilters(resource: Resource) {
    if (resource !== Resource.node) return undefined;
    return {
      contentType: { $in: [...rootNodeTypeList] },
      metaType: { $is_empty: true },
      creationContext: { $is_empty: true }
    };
  }

  function resolveAccessLogAction(action?: string) {
    if (action === "open") return "Opened";
    return action ?? "Opened";
  }

  function resolveCreatedResourceLabel(resource: Resource, record: any) {
    return resolveResourceRecordLabel(resource, record);
  }

  function resolveResourceRecordLabel(
    resource: Resource | undefined,
    record: LabelRecord
  ) {
    return (
      resolveDisplayText(record.label) ??
      resolveDisplayText(record.event) ??
      resolveResourceDisplayLabel(resource)
    );
  }

  function resolveAccessLogResourceLabel(
    log: AccessLogRecord,
    recordsById: LabelRecordById
  ) {
    const resource = resolveAccessLogResource(log);
    const id = resolveAccessLogResourceId(log);
    const record = id ? recordsById[id] : undefined;
    if (record) return resolveResourceRecordLabel(resource, record);
    return resolveResourceDisplayLabel(resource);
  }

  function resolveDisplayText(value: unknown) {
    if (typeof value !== "string") return undefined;
    const text = value.trim();
    return text.length > 0 ? text : undefined;
  }

  function resolveResourceDisplayLabel(resource: Resource | undefined) {
    if (!resource || resource === Resource.unknown) return undefined;
    return resource === Resource.objective ? "Objective" : properCase(resource);
  }

  function resolveFocusLogLabel(log: any) {
    const focusText = formatSeconds(log.focus ?? 0);
    const label =
      log.task?.label ??
      log.objective?.label ??
      log.taskName ??
      log.session?.label ??
      "";
    return label ? `${label} · ${focusText}` : focusText;
  }

  function resolveFocusLogResourceId(log: any) {
    return [log.taskId, log.objectiveId, log.sessionId, log.id].find(
      (id) => typeof id === "string" && id.length > 0
    );
  }
</script>

{#if isLoading || logs.length === 0}
  <EmptyStatusView
    isLoadingState={isLoading}
    mainText="No activity found."
    isSearchContext={true}
  />
{:else if logs.length > 0}
  <div class="flex flex-col flex-grow gap-4 overflow-y-auto userdata">
    {#each logs as log}
      <button
        class="flex flex-row items-start gap-2 p-2 hover:bg-bgs2 rounded-md"
        onclick={() => {
          let id = log.resourceId;
          if (!id) return;
          navigation.openResource(id, AccessMode.POP);
        }}
      >
        <span class="text-b3 text-fgs3 whitespace-nowrap"
          >{formatTime($userPreferences, log.timestamp)}</span
        >
        <div class="flex justify-between gap-4 flex-1">
          <span class="text-b3 text-fgs3 text-left">{log.action}</span>
          {#if log.resourceLabel}
            <span class="text-b2 notouch:hover:text-aps1 text-right"
              >{log.resourceLabel}</span
            >
          {/if}
        </div>
      </button>
    {/each}
    <ScrollViewBottomSpacer />
  </div>
{/if}
