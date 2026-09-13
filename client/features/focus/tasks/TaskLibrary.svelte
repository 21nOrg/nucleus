<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { resolveTaskSubTypesForSwitcher } from "./task.utils";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import { ResourceAccessPoint } from "@nucleum/datafn/resource.type";
  import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
  import { onDestroy, onMount } from "svelte";
  import { BulkEditor } from "@nucleum/stores/resources/bulk-editor";
  import {
    TaskDueDateFilter,
    TaskSubTypeForSwitcher,
    type ITaskThumb
  } from "@nucleum/features/focus/tasks/task.type";
  import { isValidArray } from "@21n/shared-utils/obj.utils";
  import TaskRecords from "@nucleum/features/focus/tasks/TaskRecords.svelte";
  import { type IRecordId } from "@nucleum/schema/legacy/data.type";
  import InlineSearchBar from "@21n/elements/InlineSearchBar.svelte";
  import { InputStyle } from "@21n/elements/input/input.type";
  import { page } from "$app/stores";
  import type { TaskLibrarySubType as SubType } from "./task.type";
  import LibrarySubTypeSwitcher from "@nucleum/components/records/ResourceSubtypeSwitcher.svelte";
  import ScrollViewBottomSpacer from "@21n/layout/scrollView/ScrollViewBottomSpacer.svelte";
  import { cn } from "@21n/utils/ui.utils";
  import {
    activeResourceFilter,
    archivedResourceFilter
  } from "@21n/utils/utils";
  import Toggle from "@21n/elements/toggle/Toggle.svelte";
  import { Size } from "@21n/elements/size.enum";
  import DatePickerRow from "@21n/elements/datetime/DatePickerRow.svelte";
  import AbsoluteTimeRangePopoverV2 from "@21n/elements/datetime/absolute/AbsoluteTimeRangePopoverV2.svelte";
  import { Placement } from "@21n/elements/direction.enum";
  import { popover } from "@nucleum/actions/popover.action";
  import {
    compareDates,
    parseAndFormatDate,
    isSameDay
  } from "@21n/utils/time.utils";
  import { toasts } from "@nucleum/stores/notification.store";
  import Button from "@21n/elements/button/Button.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import {
    removeDuplicatesFilter,
    resourceAction
  } from "@nucleum/datafn/resource.utils";
  import { ButtonVariant, ButtonStyle } from "@21n/elements/button/button.type";

  import { generateMiniRandomId } from "@21n/shared-utils/crypto.utils";
  import { bulkEditStore } from "@nucleum/stores/resources/bulkedit.store";
  import view from "@nucleum/stores/view.store";
  import InlineSyncingFeedback from "@21n/elements/feedback/InlineSyncingFeedback.svelte";
  import { fly } from "svelte/transition";
  import SwitchInput from "@21n/elements/toggle/SwitchInput.svelte";
  import OptionSelector from "@21n/elements/select/OptionSelector.svelte";
  import { resolveTaskDueDateFilters } from "@nucleum/features/focus/tasks/task.utils";
  import { OptionSelectorStyle } from "@21n/elements/select/select.type";

  import { intersection } from "@nucleum/actions/intersection.action";
  import { resolveUnixTimestamp } from "@21n/shared-utils/time.utils";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  import { dragSelection } from "@nucleum/actions/dragSelection.action";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import { UIState, UIStateScope } from "@nucleum/stores/uiState/uiState.type";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import { toSvelteStore } from "@datafn/svelte";
  import { time } from "@datafn/client";
  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  import { generateResourceId } from "@nucleum/datafn/id.utils";

  let {
    objectiveId = undefined,
    collectionId = undefined,
    accessPoint = undefined,
    parentBgIndex = 1,
    isPreventAddNew = false
  }: {
    objectiveId?: IRecordId | undefined;
    collectionId?: IRecordId | undefined;
    accessPoint?: ResourceAccessPoint | undefined;
    parentBgIndex?: number;
    isPreventAddNew?: boolean;
  } = $props();

  const instance = generateMiniRandomId();
  let tasks = $state<ITaskThumb[]>([]);
  let taskLimit = $state(50);
  let searchQuery = $state("");
  let searchInputRef = $state<InlineSearchBar | undefined>(undefined);
  let isArchivedFilterSelected = $state(false);
  let isHideObjectiveTasksFilterSelected = $state(false);
  let dueDateFilter = $state<TaskDueDateFilter>(TaskDueDateFilter.ALL);
  let isFiltersExpanded = $state(false);
  let selectedSubType = $state<SubType>("all");
  let selectedDate = $state(new Date());
  let viewDate = $state(new Date());
  let lastSelectableTaskIds = $state<IRecordId[]>([]);
  let taskRecordsRef = $state<TaskRecords | undefined>(undefined);
  let dateSelectionPopoverRef = $state<HTMLButtonElement | undefined>(
    undefined
  );
  let isRefreshing = $state(false);
  let isInSelectionMode = $state(false);
  let isShowSearchBar = $state(false);
  let bulkEditChangeUnsub = $state<(() => void) | undefined>(undefined);
  const isSearchActive = $derived(Boolean(searchQuery.trim()));
  const signalQuery = $derived.by(() => resolveSignalQuery());
  const signalLimit = $derived(
    selectedSubType !== TaskSubTypeForSwitcher.BY_MONTH &&
      selectedSubType !== TaskSubTypeForSwitcher.BY_DATE
      ? taskLimit
      : undefined
  );
  const taskStore = $derived.by(() =>
    toSvelteStore(
      datafn.task.signal({
        select: ["*", "objective.*"],
        filters: signalQuery.filters,
        metadata: resolveQueryMetadata(),
        ...(signalQuery.temporal ? { temporal: signalQuery.temporal } : {}),
        limit: signalLimit
      }),
      { initialData: [] as ITaskThumb[] }
    )
  );
  const signalTasks = $derived.by(() =>
    normalizeTasks(($taskStore.data ?? []) as ITaskThumb[])
  );
  const displayedTasks = $derived(isSearchActive ? tasks : signalTasks);
  const displayedIsRefreshing = $derived(
    isSearchActive ? isRefreshing : $taskStore.loading || $taskStore.refreshing
  );
  const multiSelectContext = $derived.by(() => ({
    resource: Resource.task,
    accessPoint: resolveAccessPoint(),
    accessPointId: resolveAccessPointId()
  }));

  function resolveBulkEditSubContext() {
    return selectedSubType + (isArchivedFilterSelected ? "archived" : "");
  }

  function resolveBulkEditorInstance() {
    bulkEditStore.activate(multiSelectContext, {
      onAction: onBulkAction,
      onSelectAll: onSelectAll,
      subContext: resolveBulkEditSubContext()
    });
  }

  $effect(() => {
    if (bulkEditStore.matchesContext(multiSelectContext)) {
      resolveBulkEditorInstance();
    }
  });

  function resolveFiltersExpandedState() {
    return (
      uiState.getState(UIState.taskLibraryFiltersExpanded, {
        scope: UIStateScope.DAP
      }) ?? false
    );
  }

  function resolveSelectedSubTypeState() {
    return (
      uiState.getState(UIState.taskLibrarySelectedSubType, {
        scope: UIStateScope.DAP
      }) ?? "all"
    );
  }

  function persistFiltersExpandedState() {
    uiState.setState(UIState.taskLibraryFiltersExpanded, isFiltersExpanded, {
      scope: UIStateScope.DAP
    });
  }

  function persistSelectedSubTypeState() {
    uiState.setState(UIState.taskLibrarySelectedSubType, selectedSubType, {
      scope: UIStateScope.DAP
    });
  }

  onMount(() => {
    isFiltersExpanded = resolveFiltersExpandedState();
    selectedSubType = resolveSelectedSubTypeState();

    bulkEditChangeUnsub = bulkEditStore.count.subscribe((count) => {
      if (count === 0) {
        isInSelectionMode = false;
        return;
      }
      if (bulkEditStore.matchesContext(multiSelectContext)) {
        bulkEditStore.activate(multiSelectContext, {
          onAction: onBulkAction,
          onSelectAll: onSelectAll,
          subContext: resolveBulkEditSubContext()
        });
      }
    });

    const pageSub = page.subscribe(async (p) => {
      const subResourceParam = objectiveId
        ? p.url.searchParams.get(`${instance}-${AppSearchParam.TYPE}`)
        : p.url.searchParams.get(AppSearchParam.TYPE);
      let isRefreshNeeded = false;
      if (subResourceParam && subResourceParam !== selectedSubType) {
        selectedSubType = (subResourceParam as SubType) ?? "all";
        persistSelectedSubTypeState();
        selectedDate = new Date();
        viewDate = new Date();
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

    return () => {
      pageSub();
    };
  });

  onDestroy(() => {
    if (bulkEditChangeUnsub) bulkEditChangeUnsub();
    if (bulkEditStore.matchesContext(multiSelectContext)) {
      bulkEditStore.clear();
    }
  });

  async function refresh(params?: {
    isPagination?: boolean;
    scrollToDate?: boolean;
  }) {
    if (!isSearchActive) {
      if (params?.isPagination) taskLimit += 50;
      else taskLimit = 50;
      if (params?.scrollToDate) scrollToDate();
      return;
    }
    try {
      if (!params?.isPagination) {
        isRefreshing = true;
        tasks = [];
      }
      const taskQuery = resolveFilters();
      const limit =
        selectedSubType !== TaskSubTypeForSwitcher.BY_MONTH &&
        selectedSubType !== TaskSubTypeForSwitcher.BY_DATE
          ? 50
          : undefined;
      let result = await queryTasks({
        filters: taskQuery.filters,
        temporal: taskQuery.temporal,
        query: searchQuery,
        limit,
        offset: params?.isPagination ? tasks.length : undefined
      });
      if (isValidArray(result)) {
        result = normalizeTasks(result);
        if (params?.isPagination)
          tasks = [...tasks, ...result].filter(removeDuplicatesFilter);
        else tasks = [...result];
        lastSelectableTaskIds = tasks.map((x) => x.id);
      } else if (!params?.isPagination) {
        tasks = [];
        lastSelectableTaskIds = [];
      }
      isRefreshing = false;
      if (params?.scrollToDate) scrollToDate();
    } catch (e) {
      isRefreshing = false;
      logger.error({ at: "TaskLibrary - refresh", e });
      toasts.error("Failed to refresh tasks. Please try again.");
    }
  }

  function normalizeTasks(records: ITaskThumb[]) {
    let result = records.filter(resolveStatusFilter());
    if (dueDateFilter === TaskDueDateFilter.OVERDUE) {
      result = result.filter((x: any) => {
        return (
          x.dateUnix && compareDates(new Date(x.dateUnix), new Date(), "<")
        );
      });
    }
    return result;
  }

  async function queryTasks(params: {
    filters: any;
    temporal?: ReturnType<typeof time.day>;
    query?: string;
    limit?: number;
    offset?: number;
  }) {
    if (params.query?.trim()) {
      const result = await datafn.search({
        query: params.query.trim(),
        resources: [Resource.task],
        fields: ["label"],
        filters: {
          [Resource.task]: params.filters
        },
        ...(params.temporal
          ? { temporalByResource: { [Resource.task]: params.temporal } }
          : {}),
        select: ["*", "objective.*"],
        limit: params.limit,
        limitPerResource: params.limit,
        source: "local",
        prefix: true,
        fuzzy: 0.2
      });
      return (result.results?.map((entry: any) => entry.data) ?? []).filter(
        resolveStatusFilter()
      );
    }
    const result = await datafn.task.query({
      select: ["*", "objective.*"],
      filters: params.filters,
      metadata: resolveQueryMetadata(),
      ...(params.temporal ? { temporal: params.temporal } : {}),
      limit: params.limit,
      offset: params.offset
    });
    return result.data ?? [];
  }

  function resolveBaseFilters() {
    return {
      isArchived: isArchivedFilterSelected ? true : undefined,
      objectiveId: isHideObjectiveTasksFilterSelected ? false : undefined,
      isChecked: dueDateFilter === TaskDueDateFilter.OVERDUE ? false : undefined
    };
  }

  function resolveStatusFilter() {
    return isArchivedFilterSelected
      ? archivedResourceFilter
      : activeResourceFilter;
  }

  function resolveQueryMetadata() {
    return isArchivedFilterSelected ? { includeArchived: true } : undefined;
  }

  function resolveSignalQuery() {
    const filters: any = resolveBaseFilters();
    if (objectiveId) {
      filters.objectiveId = objectiveId.toString();
    }
    if (selectedSubType === TaskSubTypeForSwitcher.BY_DATE) {
      return {
        filters,
        temporal: time.day("dateUnix", selectedDate)
      };
    }
    if (selectedSubType === TaskSubTypeForSwitcher.BY_MONTH) {
      return {
        filters,
        temporal: time.month("dateUnix", selectedDate)
      };
    }
    return { filters: { ...filters, dateUnix: resolveDateFilter() } };
  }

  function resolveFilters() {
    let filters: any = resolveBaseFilters();
    if (objectiveId) {
      filters = { ...filters, objectiveId: objectiveId.toString() };
    }
    if (selectedSubType === TaskSubTypeForSwitcher.BY_DATE) {
      return {
        filters,
        temporal: time.day("dateUnix", selectedDate)
      };
    }
    if (selectedSubType === TaskSubTypeForSwitcher.BY_MONTH) {
      return {
        filters,
        temporal: time.month("dateUnix", selectedDate)
      };
    }
    return { filters: { ...filters, dateUnix: resolveDateFilter() } };
  }

  function resolveDateFilter() {
    if (dueDateFilter === TaskDueDateFilter.ALL) return undefined;
    else if (dueDateFilter === TaskDueDateFilter.OVERDUE) {
      const dayStart = datafn.temporal.resolveBucketSync({
        value: new Date(),
        scale: "day",
        output: "unix-ms"
      });
      return {
        $gt: 0,
        $lt: typeof dayStart === "number" ? dayStart : Date.now()
      };
    } else if (dueDateFilter === TaskDueDateFilter.WITHOUT_DUE_DATE)
      return false;
  }

  function resolveAccessPoint() {
    if (accessPoint) return accessPoint;
    if (objectiveId) return ResourceAccessPoint.OBJECTIVE;
    else if (collectionId) return ResourceAccessPoint.COLLECTION;
    return ResourceAccessPoint.LIBRARY;
  }

  function hidePopover() {
    dateSelectionPopoverRef?.dispatchEvent(new CustomEvent("hide"));
  }

  function onDateSelectionChange(val: Date) {
    selectedDate = val;
    viewDate = selectedDate;
    refresh({ scrollToDate: true });
    hidePopover();
  }

  async function onAdd(e: any) {
    const label = e.detail;
    if (!label) return;
    try {
      const newTaskDate = resolveDateForNewTask();
      const now = new Date();
      const createdTask = {
        id: generateResourceId(Resource.task),
        label,
        dateUnix: newTaskDate ? resolveUnixTimestamp(newTaskDate) : 0,
        isChecked: false,
        objectiveId: objectiveId ?? "",
        createdAt: now,
        updatedAt: now
      };
      await datafn.task.mutate({
        operation: "insert",
        id: createdTask.id,
        record: createdTask,
        context: resourceAction(Resource.task, ResourceActionType.CREATE)
      });
      appStore.addToRecents({
        record: createdTask,
        type: Resource.task,
        timestamp: new Date()
      });
      if (isSearchActive) tasks = [...tasks, createdTask];
      toasts.success("Task created successfully.");
    } catch (error) {
      logger.error({ at: "TaskLibrary.onAdd", error });
      toasts.error("Failed to add task. Please try again.");
    }

    function resolveDateForNewTask() {
      if (selectedSubType === TaskSubTypeForSwitcher.BY_DATE)
        return selectedDate;
      else if (selectedSubType === TaskSubTypeForSwitcher.BY_MONTH)
        return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      return undefined;
    }
  }

  function resolveVisibleTaskIds() {
    if (typeof document === "undefined") return [];
    return Array.from(
      document.querySelectorAll<HTMLElement>(
        "#task-library div[id^='thumbnail-task:'][data-id]"
      )
    )
      .map((element) => element.dataset.id)
      .filter((id): id is IRecordId => !!id);
  }

  function onSelectAll() {
    const visibleTaskIds = resolveVisibleTaskIds();
    if (visibleTaskIds.length > 0) return visibleTaskIds;
    if (displayedTasks.length > 0) return displayedTasks.map((x) => x.id);
    if (displayedIsRefreshing) return lastSelectableTaskIds;
    return [];
  }

  async function onBulkAction(
    ids: IRecordId[],
    action: string,
    data?: unknown
  ) {
    try {
      const editor = new BulkEditor(Resource.task, bulkEditStore);
      await editor.run(action, data);
      refresh();
    } catch (e) {
      toasts.error("Failed to perform bulk action");
    }
  }

  function resolveAccessPointId() {
    if (objectiveId) return objectiveId.toString();
    else if (collectionId) return collectionId.toString();
    return undefined;
  }

  function scrollToDate() {
    try {
      setTimeout(() => {
        if (taskRecordsRef) taskRecordsRef.scrollToDate(selectedDate);
      }, 100);
    } catch (e) {
      logger.error({ at: "TaskLibrary.scrollToDate", e });
    }
  }
</script>

<div
  class={cn("flex flex-col w-full h-full gap-4", {
    "p-4": accessPoint === ResourceAccessPoint.LIBRARY,
    "px-4": accessPoint === ResourceAccessPoint.BROWSER
  })}
  data-testid="task-library"
  id="task-library"
  use:dragSelection={{
    selectableSelector: "div[id^='thumbnail-']",
    containerId: "task-library",
    onSelectionChange: (elements, ids) => {
      resolveBulkEditorInstance();
      if (!ids || ids.length === 0) {
        bulkEditStore.reset();
        isInSelectionMode = false;
        return;
      }
      const state = bulkEditStore.getState();
      if (isInSelectionMode) {
        bulkEditStore.select([...new Set([...state.selectedIds, ...ids])]);
      } else {
        isInSelectionMode = true;
        bulkEditStore.select(ids);
      }
      isInSelectionMode = bulkEditStore.getState().selectedIds.length > 0;
    }
  }}
>
  <LibrarySubTypeSwitcher
    options={resolveTaskSubTypesForSwitcher()}
    onSearchParamsChange={(params) => navigation.toggleSearchParam(params)}
    resource={Resource.task}
    accessPoint={resolveAccessPoint()}
    {selectedSubType}
    subContext={objectiveId ? instance : undefined}
  >
    <Toggle bind:on={isShowSearchBar} icon="search" tooltip="Search" />
    {#if selectedSubType !== TaskSubTypeForSwitcher.BY_DATE || !objectiveId}
      <Toggle
        bind:on={isFiltersExpanded}
        icon="ph:sliders-light"
        tooltip="Filters and options"
        onChange={() => persistFiltersExpandedState()}
      />
    {/if}
    {#if !isPreventAddNew && ((!$view.isConstrainedWidth && accessPoint === ResourceAccessPoint.LIBRARY) || accessPoint === ResourceAccessPoint.OBJECTIVE)}
      <Button
        icon="plus"
        type={ButtonVariant.PRIMARY}
        style={ButtonStyle.OUTLINED}
        size={Size.md}
        isPreventMinWidth={true}
        onclick={() => {
          requireCommandHost().runAction(PointronAction.CREATE_TASK_INLINE, {
            componentParams: {
              date:
                selectedSubType === TaskSubTypeForSwitcher.BY_DATE ||
                selectedSubType === TaskSubTypeForSwitcher.BY_MONTH
                  ? selectedDate
                  : undefined,
              objectiveId: objectiveId,
              collectionId: collectionId
            }
          });
        }}
      />
    {/if}
  </LibrarySubTypeSwitcher>

  {#if isFiltersExpanded}
    <div
      class={cn("flex flex-col gap-4 bg-bgs2 rounded-md p-4", {
        "cw:mx-0 mx-4": accessPoint === ResourceAccessPoint.LIBRARY
      })}
      in:fly={{ y: -20, duration: 300 }}
    >
      {#if selectedSubType !== TaskSubTypeForSwitcher.BY_DATE}
        <OptionSelector
          options={resolveTaskDueDateFilters({
            isDatedContext: selectedSubType === TaskSubTypeForSwitcher.BY_MONTH
          })}
          labelProps={{ label: "Due date" }}
          selected={dueDateFilter}
          size={Size.sm}
          style={OptionSelectorStyle.TRAIN}
          onSelect={(event: CustomEvent<TaskDueDateFilter>) => {
            if (!event.detail) return;
            dueDateFilter = event.detail;
            refresh();
          }}
        />
      {/if}
      {#if !objectiveId}
        <SwitchInput
          bind:checked={isHideObjectiveTasksFilterSelected}
          isExpanded={true}
          label={{ label: "Hide tasks with an objective" }}
          onChange={() => refresh()}
        />
      {/if}
    </div>
  {/if}

  {#if selectedSubType === TaskSubTypeForSwitcher.BY_DATE || selectedSubType === TaskSubTypeForSwitcher.BY_MONTH}
    <div
      class={cn("flex border border-brs2 rounded-md", {
        "mx-4": accessPoint === ResourceAccessPoint.LIBRARY
      })}
    >
      <button
        class="w-32 flex items-center justify-center gap-2 text-b2 text-fgs2 font-medium tabular-nums h-full whitespace-nowrap cw:py-1 py-2 cw:px-2 px-4 rounded-l-md bg-bgs2 hover:bg-bgs3-striped border-r border-brs2"
        bind:this={dateSelectionPopoverRef}
        use:popover={{
          content: AbsoluteTimeRangePopoverV2,
          placement: Placement.BottomCenter,
          id: "date-picker-popover",
          isRenderAsModalForCW: true,
          componentProps: {
            isDatePickerMode: true,
            selectedDate: selectedDate,
            onDateChange: onDateSelectionChange
          }
        }}
      >
        {selectedSubType === TaskSubTypeForSwitcher.BY_DATE &&
        isSameDay(viewDate, selectedDate)
          ? parseAndFormatDate(viewDate)
          : selectedSubType === TaskSubTypeForSwitcher.BY_DATE ||
              (selectedSubType === TaskSubTypeForSwitcher.BY_MONTH &&
                isSameDay(viewDate, selectedDate))
            ? parseAndFormatDate(viewDate, "mmm-yyyy")
            : parseAndFormatDate(viewDate, "yyyy")}
      </button>
      <div class="flex-grow h-full">
        <DatePickerRow
          isDateMode={selectedSubType === TaskSubTypeForSwitcher.BY_DATE}
          date={selectedDate}
          onPageChange={(
            event: CustomEvent<{ page: number; viewDate: Date }>
          ) => {
            viewDate = event.detail.viewDate;
          }}
          onChange={(event: CustomEvent<Date>) => {
            selectedDate = event.detail;
            viewDate = selectedDate;
            refresh({ scrollToDate: true });
          }}
        />
      </div>
    </div>
  {/if}
  {#if isShowSearchBar}
    <div class="flex gap-2 items-center" in:fly={{ y: -20, duration: 300 }}>
      <InlineSearchBar
        bind:this={searchInputRef}
        bind:query={searchQuery}
        onSearch={() => refresh()}
        padding={cn({
          "pl-4":
            !$view.isConstrainedWidth &&
            accessPoint === ResourceAccessPoint.LIBRARY
        })}
        placeholder={"Search tasks"}
        testId="search-tasks"
        style={InputStyle.BORDERED}
      />
    </div>
  {/if}

  <InlineSyncingFeedback
    resource={Resource.task}
    padding="cw:px-0 px-4"
    isDisableOutTransition={true}
  />

  <div
    class={cn(
      "flex flex-col gap-4 pr-1.5 overflow-auto-scrollbar grow userdata",
      {
        "px-4": accessPoint === ResourceAccessPoint.LIBRARY
      }
    )}
  >
    <TaskRecords
      bind:this={taskRecordsRef}
      data={displayedTasks}
      accessPoint={resolveAccessPoint()}
      accessPointId={resolveAccessPointId()}
      {parentBgIndex}
      subType={selectedSubType}
      isRefreshing={displayedIsRefreshing}
      {searchQuery}
      onCreate={() => {
        requireCommandHost().runAction(PointronAction.CREATE_TASK_INLINE, {
          componentParams: {
            date:
              selectedSubType === TaskSubTypeForSwitcher.BY_DATE ||
              selectedSubType === TaskSubTypeForSwitcher.BY_MONTH
                ? selectedDate
                : undefined,
            objectiveId: objectiveId,
            collectionId: collectionId
          }
        });
      }}
    />
    <div
      use:intersection={{
        rootMargin: "100px",
        callback: () => {
          refresh({ isPagination: true });
        }
      }}
    />
    <ScrollViewBottomSpacer />
  </div>
</div>
