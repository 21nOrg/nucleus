<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { resolveObjectiveSubTypesForSwitcher } from "@nucleum/features/focus/goals/goal.utils";
  import { resolveTaskSubTypesForSwitcher } from "@nucleum/features/focus/tasks/task.utils";
  import { resolveNodeSubTypesForSwitcher } from "@nucleum/features/memory/node/node.utils";
  import { resolveCollectionSubTypesForSwitcher } from "@nucleum/features/collections/collection.utils";

  import Records from "@nucleum/application/record/Records.svelte";
  import { Size } from "@21n/elements/size.enum";
  import ScrollViewBottomSpacer from "@21n/layout/scrollView/ScrollViewBottomSpacer.svelte";
  import { Arrangement, Orientation } from "@21n/elements/direction.enum";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import {
    AccessMode,
    ResourceAccessPoint,
    ResourceAccessPointState
  } from "@nucleum/datafn/resource.type";
  import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
  import { BulkEditor } from "@nucleum/stores/resources/bulk-editor";
  import { bulkEditStore } from "@nucleum/stores/resources/bulkedit.store";

  import LibrarySearchBox from "@nucleum/application/library/LibrarySearchBox.svelte";
  import { CollectionType } from "@nucleum/features/collections/collection.type";
  import { rootNodeTypeList } from "@nucleum/features/memory/node/node.type";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";

  import {
    activeResourceFilter,
    archivedResourceFilter,
    debouncer
  } from "@21n/utils/utils";
  import { type IRecordId, SearchType } from "@nucleum/schema/legacy/data.type";
  import LibraryLoadingPulse from "@nucleum/application/library/LibraryLoadingPulse.svelte";
  import view from "@nucleum/stores/view.store";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { intersection } from "@nucleum/actions/intersection.action";
  import context from "@nucleum/stores/context.store";
  import { Embed } from "@nucleum/client/runtime/context.type";
  import Icon from "@21n/elements/Icon.svelte";
  import InlineSyncingFeedback from "@21n/elements/feedback/InlineSyncingFeedback.svelte";
  import { enumToString } from "@21n/shared-utils/text.utils";
  import Toggle from "@21n/elements/toggle/Toggle.svelte";
  import { toasts } from "@nucleum/stores/notification.store";
  import { onDestroy, onMount } from "svelte";
  import { page } from "$app/stores";
  import InlineSearchBar from "@21n/elements/InlineSearchBar.svelte";
  import { InputStyle } from "@21n/elements/input/input.type";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import { UIState } from "@nucleum/stores/uiState/uiState.type";
  import SwitchInput from "@21n/elements/toggle/SwitchInput.svelte";
  import DropDown from "@21n/elements/dropdown/DropDown.svelte";
  import { fade, fly } from "svelte/transition";
  import {
    availableResources,
    removeDuplicatesFilter,
    resourceAction
  } from "@nucleum/datafn/resource.utils";
  import TaskLibrary from "@nucleum/features/focus/tasks/TaskLibrary.svelte";
  import LibrarySubTypeSwitcher from "@nucleum/components/records/ResourceSubtypeSwitcher.svelte";
  import type { SubType } from "@nucleum/application/library/library.type";
  import { isCustomLibrary } from "@nucleum/application/library/library.utils";
  import LinkTagsControlPanel from "@nucleum/features/memory/linking/LinkTagsControlPanel.svelte";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  import Text from "@21n/elements/text/Text.svelte";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import { dragSelection } from "@nucleum/actions/dragSelection.action";
  import { datafn, datafnRuntime } from "@nucleum/datafn/datafn.store";
  import { toSvelteStore } from "@datafn/svelte";
  import { datafnHeavyComputedSignalOptions } from "@nucleum/datafn/signalCache";

  let {
    resource,
    accessPoint = ResourceAccessPoint.LIBRARY,
    accessPointState = ResourceAccessPointState.DEFAULT,
    arrangement: arrangementProp = null,
    isConstrainedWidth = $view.isConstrainedWidth
  }: {
    resource: Resource;
    accessPoint?: ResourceAccessPoint;
    accessPointState?: ResourceAccessPointState;
    arrangement?: Arrangement | null;
    isConstrainedWidth?: boolean;
  } = $props();

  let arrangement = $state<Arrangement | null>(arrangementProp);
  let searchQuery = $state("");
  let isStarFilterSelected = $state(false);
  let isArchivedFilterSelected = $state(false);
  let data = $state<any[]>([]);
  let starredData = $state<any[]>([]);
  let recordLimit = $state(50);
  let searchType = $state<SearchType>(SearchType.FULL_TEXT);
  let selectedSubType = $state<SubType>("all");
  let isRefreshing = $state(true);
  let totalCountAfterFilter = $state(0);
  let isRefreshingTotalCount = $state(false);
  let refreshResetTimeout: any;
  let searchInputRef: InlineSearchBar;
  let isRefineShown = $state(false);
  let abortController: AbortController | null = null;
  let isInSelectionMode = $state(false);
  let bulkEditChangeUnsub: (() => void) | undefined;
  let searchRefreshRunId = 0;
  let activeSearchSignature = $state("");
  let resolvedSearchSignature = $state("");
  const isSearchActive = $derived(Boolean(searchQuery.trim()));
  const currentSearchSignature = $derived(resolveSearchSignature());
  const isSearchResultPending = $derived(
    isSearchActive && resolvedSearchSignature !== currentSearchSignature
  );
  const signalResource = $derived(
    resource === Resource.relation ? Resource.linkTag : resource
  );
  const signalFilters = $derived.by(() => resolveFilters());
  const listQuery = $derived.by(() =>
    resolveLibraryQuery({
      filters: signalFilters,
      subType: resolveSelectedSubType()
    })
  );
  const recordStore = $derived.by(() =>
    toSvelteStore(
      datafn.table(listQuery.resource).signal({
        select: resolveExpandedSelect(listQuery.resource),
        filters: listQuery.filters,
        metadata: resolveQueryMetadata(),
        sort: resolveSort(listQuery.resource),
        limit: recordLimit
      }),
      { initialData: [] as any[] }
    )
  );
  const starredStore = $derived.by(() =>
    toSvelteStore(
      datafn.table(listQuery.resource).signal({
        select: resolveExpandedSelect(listQuery.resource),
        filters: {
          ...listQuery.filters,
          isStarred: true
        },
        metadata: resolveQueryMetadata(),
        sort: resolveSort(listQuery.resource)
      }),
      { initialData: [] as any[] }
    )
  );
  const countQuery = $derived.by(() => listQuery);
  const countStore = $derived.by(() =>
    toSvelteStore(
      datafn.table(countQuery.resource).signal(
        {
          select: ["id", "isArchived", "trashedAt", "isAncestorInactive"],
          filters: countQuery.filters,
          metadata: resolveQueryMetadata()
        },
        datafnHeavyComputedSignalOptions
      ),
      { initialData: [] as any[] }
    )
  );
  const displayedData = $derived(
    isSearchActive
      ? isSearchResultPending
        ? []
        : data
      : normalizeLibraryRecords($recordStore.data ?? [])
  );
  const displayedStarredData = $derived(
    isSearchActive
      ? isSearchResultPending
        ? []
        : starredData
      : normalizeLibraryRecords($starredStore.data ?? [])
  );
  const displayedTotalCount = $derived(
    isSearchActive
      ? isSearchResultPending
        ? 0
        : totalCountAfterFilter
      : ($countStore.data ?? []).filter(resolveStatusFilter()).length
  );
  const displayedIsInitialLoading = $derived(
    isSearchActive
      ? isRefreshing || isSearchResultPending
      : $recordStore.loading && ($recordStore.data ?? []).length === 0
  );
  const displayedIsRefreshingTotalCount = $derived(
    isSearchActive
      ? isRefreshingTotalCount
      : $countStore.loading || $countStore.refreshing
  );
  const isShowingSeparateStarredSection = $derived(
    isConstrainedWidth &&
      !searchQuery &&
      !isStarFilterSelected &&
      !isArchivedFilterSelected &&
      selectedSubType !== "starred" &&
      displayedStarredData &&
      displayedStarredData.length > 0
  );

  let multiSelectContext = $derived({
    resource,
    accessPoint
  });

  $effect(() => {
    const signature = currentSearchSignature;
    if (isSearchActive) {
      if (signature !== activeSearchSignature) {
        activeSearchSignature = signature;
        resolvedSearchSignature = "";
        data = [];
        starredData = [];
        totalCountAfterFilter = 0;
        isRefreshing = true;
        isRefreshingTotalCount = false;
      }
    } else if (activeSearchSignature || resolvedSearchSignature) {
      activeSearchSignature = "";
      resolvedSearchSignature = "";
      data = [];
      starredData = [];
      totalCountAfterFilter = 0;
      isRefreshing = false;
      isRefreshingTotalCount = false;
      abortController?.abort();
    }
  });

  $effect(() => {
    if (bulkEditStore.matchesContext(multiSelectContext)) {
      resolveBulkEditorInstance();
    }
  });

  let isCustom = $derived(isCustomLibrary(resource));
  let hasChildren = $derived(
    [Resource.node, Resource.objective].includes(resource)
  );

  let pageSub: any;
  let datafnChangeUnsub: (() => void) | undefined;
  onMount(async () => {
    bulkEditChangeUnsub = bulkEditStore.count.subscribe((count) => {
      if (count === 0) {
        isInSelectionMode = false;
        return;
      }
      if (bulkEditStore.matchesContext(multiSelectContext)) {
        resolveBulkEditorInstance();
      }
    });
    if (isCustom) return;
    abortController = new AbortController();
    pageSub = page.subscribe(async (p) => {
      const subResourceParam = p.url.searchParams.get(AppSearchParam.TYPE);
      let isRefreshNeeded = false;
      if (subResourceParam && subResourceParam !== selectedSubType) {
        selectedSubType = (subResourceParam as SubType) ?? "all";
        isRefreshNeeded = true;
      }
      if (p.url.searchParams.get(AppSearchParam.STARRED)) {
        isStarFilterSelected = true;
        isRefreshNeeded = true;
      } else if (isStarFilterSelected) {
        isStarFilterSelected = false;
        isRefreshNeeded = true;
      }

      if (p.url.searchParams.get(AppSearchParam.ARCHIVED)) {
        isArchivedFilterSelected = true;
        isRefreshNeeded = true;
      } else if (isArchivedFilterSelected) {
        isArchivedFilterSelected = false;
        isRefreshNeeded = true;
      }
      if (isRefreshNeeded) await refresh();
    });
    datafnChangeUnsub = datafn.subscribe((event) => {
      if (
        event.type === "mutation_applied" &&
        event.resource === signalResource &&
        isSearchActive
      ) {
        refresh();
      }
    });
  });

  onDestroy(() => {
    if (pageSub) pageSub();
    if (datafnChangeUnsub) datafnChangeUnsub();
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    if (refreshResetTimeout) {
      clearTimeout(refreshResetTimeout);
    }
    if (bulkEditChangeUnsub) bulkEditChangeUnsub();
    if (bulkEditStore.matchesContext(multiSelectContext)) {
      bulkEditStore.clear();
    }
  });

  function resolveBulkEditSubContext() {
    return (
      selectedSubType +
      (isStarFilterSelected ? "starred" : "") +
      (isArchivedFilterSelected ? "archived" : "")
    );
  }

  function resolveBulkEditorInstance() {
    bulkEditStore.activate(multiSelectContext, {
      onAction: onBulkAction,
      onSelectAll: onSelectAll,
      subContext: resolveBulkEditSubContext()
    });
  }

  function onSelectAll() {
    const visibleData = isShowingSeparateStarredSection
      ? [...displayedStarredData, ...displayedData]
      : displayedData;
    return [...new Set(visibleData.map((x) => x.id))];
  }

  async function onBulkAction(
    ids: IRecordId[],
    action: string,
    actionData?: unknown
  ) {
    try {
      const editor = new BulkEditor(resource, bulkEditStore);
      await editor.run(action, actionData);
    } catch (e) {
      toasts.error("Failed to perform bulk action");
    }
  }

  async function refresh(isPagination?: boolean) {
    if (isCustom) return;
    if (!isSearchActive) {
      if (isPagination) recordLimit += 50;
      else recordLimit = 50;
      return;
    }

    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();
    const signal = abortController.signal;
    const runId = ++searchRefreshRunId;
    const requestedSearchQuery = searchQuery.trim();
    const requestedSearchSignature =
      resolveSearchSignature(requestedSearchQuery);

    logger.log({
      at: "LibraryRecordsPane - refresh",
      isPagination,
      resource,
      selectedSubType
    });
    const refreshTimerLabel = `LibraryRecordsPane - refresh ${runId}`;
    console.time(refreshTimerLabel);
    if (!availableResources.has(resource)) {
      data = [];
      resolvedSearchSignature = requestedSearchSignature;
      return;
    }
    if (isPagination !== true) {
      isRefreshing = true;
      data = [];
    }
    try {
      const filters = resolveFilters();
      const newData = await queryLibraryRecords({
        filters,
        searchQuery: requestedSearchQuery,
        limit: 50,
        offset: isPagination ? data.length : 0,
        signal
      });
      if (!isLatestSearchRequest(runId, requestedSearchSignature, signal)) {
        return;
      }
      if (isPagination)
        data = [...data, ...newData]?.filter(removeDuplicatesFilter);
      else data = [...newData];
      resolvedSearchSignature = requestedSearchSignature;
      if (isConstrainedWidth && !requestedSearchQuery) {
        starredData = await queryLibraryRecords({
          filters: {
            ...filters,
            isStarred: true
          },
          signal
        });
        if (!isLatestSearchRequest(runId, requestedSearchSignature, signal)) {
          return;
        }
      }
      clearTimeout(refreshResetTimeout);
      refreshResetTimeout = setTimeout(() => {
        if (isLatestSearchRequest(runId, requestedSearchSignature, signal)) {
          isRefreshing = false;
        }
      }, 1);
      await _refreshFilteredRecordsTotalCount(filters, {
        runId,
        searchSignature: requestedSearchSignature,
        signal
      });
      console.timeEnd(refreshTimerLabel);
    } catch (e) {
      isRefreshing = false;
      if (e instanceof Error && e.message === "Operation aborted") {
        logger.log({ at: "Library - refresh - aborted", e });
      } else {
        logger.error({ at: "Library - refresh", e });
      }
    }
  }

  function resolveSearchSignature(query: string = searchQuery.trim()) {
    return JSON.stringify({
      query,
      resource,
      selectedSubType,
      isStarFilterSelected,
      isArchivedFilterSelected
    });
  }

  function isLatestSearchRequest(
    runId: number,
    searchSignature: string,
    signal?: AbortSignal
  ) {
    return (
      !signal?.aborted &&
      runId === searchRefreshRunId &&
      searchSignature === currentSearchSignature
    );
  }

  async function queryLibraryRecords(params: {
    filters: any;
    searchQuery?: string;
    limit?: number;
    offset?: number;
    signal?: AbortSignal;
  }) {
    const query = resolveLibraryQuery({
      filters: params.filters,
      subType: resolveSelectedSubType()
    });
    if (params.searchQuery?.trim()) {
      const offset = params.offset ?? 0;
      const limit = params.limit ?? 50;
      const searchLimit = offset + limit;
      const result = await datafn.search({
        query: params.searchQuery.trim(),
        resources: [query.resource],
        fields: resolveSearchFields(query.resource),
        filters: {
          [query.resource]: query.filters
        },
        limit: searchLimit,
        limitPerResource: searchLimit,
        source: $datafnRuntime?.mode === "sync-direct" ? "remote" : "local",
        prefix: true,
        fuzzy: 0.2,
        signal: params.signal
      });
      return normalizeLibraryRecords(
        result.results?.map((entry: any) => entry.data) ?? []
      ).slice(offset, searchLimit);
    }
    const result = await datafn.table(query.resource).query({
      select: resolveExpandedSelect(query.resource),
      filters: query.filters,
      metadata: resolveQueryMetadata(),
      sort: resolveSort(query.resource),
      limit: params.limit,
      offset: params.offset,
      signal: params.signal
    } as any);
    return normalizeLibraryRecords(result.data ?? []);
  }

  function normalizeLibraryRecords(records: any[]) {
    return records.filter((record) => {
      if (resource === Resource.node && record.metaType) return false;
      return resolveStatusFilter()(record);
    });
  }

  function resolveStatusFilter() {
    return isArchivedFilterSelected
      ? archivedResourceFilter
      : activeResourceFilter;
  }

  function resolveQueryMetadata() {
    return isArchivedFilterSelected ? { includeArchived: true } : undefined;
  }

  function resolveSearchFields(resource: Resource) {
    if (resource === Resource.node) return ["label", "text", "notes"];
    if (resource === Resource.event) return ["label", "event"];
    return ["label"];
  }

  function resolveSort(resource: Resource) {
    if (resource === Resource.event) return ["startUnix"];
    return ["-updatedAt"];
  }

  function resolveExpandedSelect(resource: Resource) {
    if (resource === Resource.collection)
      return ["*", "properties.*", "views.*", "typeToExtend.*"];
    if (resource === Resource.node)
      return [
        "*",
        "parent.*",
        "file.*",
        "collections.type",
        "collections.avatar",
        "collections.typeToExtend.avatar"
      ];
    if (resource === Resource.objective)
      return ["*", "parent.*", "children.*", "tasks.*"];
    if (resource === Resource.task) return ["*", "objective.*"];
    return undefined;
  }

  function isGenericSubType() {
    return ["all", "starred", "recents"].includes(selectedSubType);
  }

  function resolveFilters() {
    let filters: any = resolveBaseFilters();
    if (!isGenericSubType()) {
      if (resource === Resource.node) {
        filters = { ...filters, contentType: selectedSubType.toUpperCase() };
      } else if (
        resource === Resource.collection ||
        resource === Resource.objective
      ) {
        filters = { ...filters, type: selectedSubType.toUpperCase() };
      } else if (resource === Resource.task) {
        if (selectedSubType === "incomplete") {
          filters = { ...filters, isChecked: false };
        }
      }
    }
    return filters;
  }

  function resolveBaseFilters() {
    return {
      isStarred:
        isStarFilterSelected || selectedSubType === "starred"
          ? true
          : isConstrainedWidth && !searchQuery
            ? false
            : undefined,
      isArchived: isArchivedFilterSelected ? true : undefined
    };
  }

  async function _refreshFilteredRecordsTotalCount(
    filters: any,
    request?: {
      runId: number;
      searchSignature: string;
      signal?: AbortSignal;
    }
  ) {
    try {
      const signal = request?.signal ?? abortController?.signal;
      if (signal?.aborted) {
        return;
      }

      isRefreshingTotalCount = true;
      const nextTotalCount = await queryLibraryRecordCount({
        filters,
        subType: !isGenericSubType()
          ? (selectedSubType.toUpperCase() as NodeType | CollectionType)
          : undefined,
        signal
      });
      if (
        request &&
        !isLatestSearchRequest(
          request.runId,
          request.searchSignature,
          request.signal
        )
      ) {
        return;
      }
      totalCountAfterFilter = nextTotalCount;
      isRefreshingTotalCount = false;
    } catch (e) {
      if (e instanceof Error && e.message === "Operation aborted") {
        logger.log({ at: "Library - refreshTotalCounts - aborted", e });
      } else {
        logger.error({ at: "Library - refreshTotalCounts", e });
      }
      isRefreshingTotalCount = false;
    }
  }

  async function queryLibraryRecordCount(params: {
    filters: any;
    subType?: NodeType | CollectionType;
    signal?: AbortSignal;
  }) {
    const query = resolveLibraryQuery(params);
    const result = await datafn.table(query.resource).query({
      select: ["id", "isArchived", "trashedAt", "isAncestorInactive"],
      filters: query.filters,
      metadata: resolveQueryMetadata(),
      signal: params.signal
    } as any);
    return (result.data ?? []).filter(resolveStatusFilter()).length;
  }

  function resolveSelectedSubType() {
    return !isGenericSubType()
      ? (selectedSubType.toUpperCase() as NodeType | CollectionType)
      : undefined;
  }

  function resolveLibraryQuery(params: {
    filters: any;
    subType?: NodeType | CollectionType;
  }) {
    const targetResource =
      signalResource ??
      (resource === Resource.relation ? Resource.linkTag : resource);
    const filters =
      targetResource === Resource.node
        ? {
            ...(params.filters ?? {}),
            contentType: params.subType
              ? params.subType
              : { $in: [...rootNodeTypeList] },
            metaType: { $is_empty: true },
            creationContext: params.subType ? undefined : { $is_empty: true }
          }
        : {
            ...(params.filters ?? {}),
            ...(targetResource === Resource.objective
              ? {
                  parentId: { $is_empty: true }
                }
              : {}),
            ...(params.subType
              ? {
                  type:
                    targetResource === Resource.objective
                      ? params.subType
                      : { $in: [params.subType] }
                }
              : {})
          };
    return { resource: targetResource, filters };
  }

  const debouncedSearch = debouncer(refresh, 500);

  function resolveFooterMessage(data: any[], totalCount: number) {
    if (!data || !data.length) return;
    const visibleCount =
      typeof totalCount === "number"
        ? Math.min(data.length, totalCount)
        : data.length;
    let prefix = "Showing " + visibleCount + " ";
    const label = resolveResourceLabel();
    if (isStarFilterSelected)
      return `${prefix} ⭐️ staaarrrrrred ${label} ${hasChildren ? "including sub " + label : ""}`;
    else if (searchQuery)
      return `${prefix} ${label} containing "${searchQuery}"`;
    else
      return `Showing ${visibleCount} of ${totalCount ?? "Unknown"} ${label}`;
  }

  function resolveEmptyStateMessage() {
    const label = resolveResourceLabel(true);
    if (isStarFilterSelected)
      return {
        mainText: `No starred ${label} found.`,
        subText: `Please star some ${label} to see them here.`
      };
    else if (searchQuery)
      return {
        mainText: `No ${label} found.`,
        subText: `Please try a different search or create a new ${resource}.`
      };
    else {
      if (resource === Resource.node) {
        return {
          mainText: `Looks like you don't have any ${label} yet.`,
          subText: `Please create nodes using capture or install our chrome extension to clip from web.`
        };
      }
      return {
        mainText: `Looks like you don't have any ${label} yet.`,
        subText: `Please create one.`
      };
    }
  }

  function resolveResourceLabel(isPlural: boolean = false) {
    let label = "items";
    if (resource === Resource.everything) label = "item";
    else if (selectedSubType && selectedSubType !== "all") {
      let txt = enumToString(selectedSubType).toLowerCase();
      if (selectedSubType === NodeType.NODULAR_MARKDOWN.toLowerCase()) {
        txt = "markdown";
      }
      label = ` ${txt} ${resource}`;
    } else label = resource;
    return (
      label +
      ((displayedData && displayedData.length > 1) || isPlural ? "s" : "")
    );
  }

  function resolveArrangement(arrangement?: Arrangement | null) {
    if (arrangement) return arrangement;
    if ($view.isConstrainedWidth) {
      if (resource === Resource.node) return Arrangement.GRID;
      else return Arrangement.LIST;
    }
    if (resource === Resource.task) return Arrangement.LIST;
    return Arrangement.GRID;
  }
</script>

{#if isCustom}
  {#if resource === Resource.relation}
    <LinkTagsControlPanel {accessPoint} />
  {:else if resource === Resource.task}
    <TaskLibrary {accessPoint} />
  {/if}
{:else}
  {#if isConstrainedWidth}
    <div class="flex items-center w-full gap-2 px-2 h-12 min-h-12">
      <InlineSearchBar
        bind:this={searchInputRef}
        bind:query={searchQuery}
        padding="px-2"
        onSearch={() => refresh()}
        placeholder={"Search " + resource + "s"}
        testId={"search-" + resource + "s"}
        style={InputStyle.FILLED}
      >
        <Toggle
          bind:on={isRefineShown}
          icon="sliders-horizontal"
          tooltip="Settings & filters"
          size={Size.lg}
          bgSize={Size.sm}
        />
      </InlineSearchBar>
    </div>
    {#if isRefineShown}
      <div
        class="flex flex-col gap-4 mx-3 p-3 bg-bgs2 rounded-md"
        in:fly={{ y: -20, duration: 300 }}
      >
        <!-- <div class="flex gap-4 items-center">
            <Button
              icon="funnel"
              style={ButtonStyle.OUTLINED}
              size={Size.sm}
              label="Filters"
              isPreventMinWidth={true}
            />
            <Button
              icon="bars-center-left"
              style={ButtonStyle.OUTLINED}
              size={Size.sm}
              label="Sort"
              isPreventMinWidth={true}
            />
          </div> -->

        <DropDown
          label={{
            label: "Arrangement",
            orientation: Orientation.Horizontal
          }}
          items={[
            {
              label: "List",
              icon: "list",
              value: Arrangement.LIST
            },
            {
              label: "Grid",
              icon: "grid",
              value: Arrangement.GRID
            }
          ]}
          width="w-40"
          isDisableSearch={true}
          size={Size.sm}
          value={arrangement ?? undefined}
          onSelect={(e) => {
            if (!e?.detail) return;
            const newArrangement = e.detail;
            uiState.setResourceState(
              resource,
              ResourceAccessPoint.BROWSER,
              UIState.arrangement,
              newArrangement
            );
            arrangement = newArrangement;
          }}
        />

        <SwitchInput
          bind:checked={isArchivedFilterSelected}
          isExpanded={true}
          label={{ label: "Show archived items only" }}
          onChange={() => refresh()}
        />
      </div>
    {/if}
  {:else}
    <LibrarySearchBox
      {selectedSubType}
      {searchType}
      {resource}
      bind:searchQuery
      onRefresh={debouncedSearch}
      onSemanticSearch={(e) => {
        searchType = e.detail ? SearchType.SEMANTIC : SearchType.FULL_TEXT;
        refresh();
      }}
    />
    <LibrarySubTypeSwitcher
      options={resource === Resource.node
        ? resolveNodeSubTypesForSwitcher()
        : resource === Resource.collection
          ? resolveCollectionSubTypesForSwitcher()
          : resource === Resource.objective
            ? resolveObjectiveSubTypesForSwitcher(true)
            : resource === Resource.task
              ? resolveTaskSubTypesForSwitcher()
              : []}
      onSearchParamsChange={(params) => navigation.toggleSearchParam(params)}
      {resource}
      {isConstrainedWidth}
      {accessPoint}
      {selectedSubType}
    />
  {/if}
  <div
    class="flex flex-col gap-4 px-4 overflow-auto-scrollbar grow"
    data-testid="resource-records-container"
    id="records-container"
  >
    <InlineSyncingFeedback {resource} />
    {#if isShowingSeparateStarredSection}
      <div class="flex flex-col gap-2">
        <Text content="Starred" style={TextStyle.SECTION_HEADING} />
        <Records
          data={displayedStarredData}
          {accessPoint}
          {accessPointState}
          {resource}
          defaultAccessMode={accessPoint === ResourceAccessPoint.LIBRARY ||
          $view.isConstrainedWidth
            ? AccessMode.POP
            : AccessMode.INLINE}
          size={$view.isConstrainedWidth ||
          accessPoint === ResourceAccessPoint.BROWSER
            ? Size.sm
            : Size.md}
          arrangement={resolveArrangement(arrangement)}
        />
        {#if displayedData.length > 0}
          <div class="mt-4 -mb-2">
            <Text content="Other" style={TextStyle.SECTION_HEADING} />
          </div>
        {/if}
      </div>
    {/if}
    {#if displayedIsInitialLoading}
      <LibraryLoadingPulse {isConstrainedWidth} {arrangement} />
    {:else if displayedData && displayedData.length > 0}
      <div
        use:dragSelection={{
          selectableSelector: "div[id^='thumbnail-']",
          containerId: "records-container",
          onSelectionChange: (elements, ids) => {
            resolveBulkEditorInstance();
            if (!ids || ids.length === 0) {
              bulkEditStore.reset();
              isInSelectionMode = false;
              return;
            }
            const state = bulkEditStore.getState();
            if (isInSelectionMode) {
              bulkEditStore.select([
                ...new Set([...state.selectedIds, ...ids])
              ]);
            } else {
              isInSelectionMode = true;
              bulkEditStore.select(ids);
            }
            isInSelectionMode = bulkEditStore.getState().selectedIds.length > 0;
          }
        }}
      >
        <Records
          data={displayedData}
          {accessPoint}
          {accessPointState}
          {resource}
          defaultAccessMode={accessPoint === ResourceAccessPoint.LIBRARY ||
          $view.isConstrainedWidth
            ? AccessMode.POP
            : AccessMode.INLINE}
          size={$view.isConstrainedWidth ||
          accessPoint === ResourceAccessPoint.BROWSER
            ? Size.sm
            : Size.md}
          isShowLoadingPulseAtTheEnd={displayedData.length <
            displayedTotalCount &&
            recordLimit < displayedTotalCount &&
            !searchQuery}
          arrangement={resolveArrangement(arrangement)}
        />
      </div>
      <div
        class="flex w-full justify-center text-b2 text-fgs3"
        use:intersection={{
          rootMargin: "100px",
          callback: () => {
            if (
              displayedData.length > 0 &&
              displayedData.length < displayedTotalCount &&
              recordLimit < displayedTotalCount
            ) {
              refresh(true);
            }
          }
        }}
      >
        {#if displayedIsRefreshingTotalCount}
          <Icon icon="svg-spinners:3-dots-fade" />
        {:else if !isConstrainedWidth}
          {resolveFooterMessage(displayedData, displayedTotalCount) ?? ""}
        {/if}
      </div>
      <ScrollViewBottomSpacer />
    {:else if displayedData.length === 0 && ((displayedStarredData && displayedStarredData.length === 0) || !displayedStarredData || searchQuery)}
      <EmptyStatusView
        size={Size.lg}
        {...resolveEmptyStateMessage()}
        isSearchContext={true}
        actionText={resource === Resource.node &&
        $context.embed !== Embed.HANDSET
          ? "Install chrome extension"
          : resource !== Resource.node
            ? "Create new " + resource
            : undefined}
        onclick={() => {
          if (resource === Resource.node) {
            navigation.openLink(
              $appStore.appData?.urls?.chromeExtension ?? "https://memotron.app"
            );
          } else {
            requireCommandHost().runAction(
              resourceAction(resource, ResourceActionType.CREATE)
            );
          }
        }}
      />
    {/if}
  </div>
{/if}
