<script lang="ts">
  import { Arrangement } from "@21n/elements/direction.enum";
  import { ResourceAccessPoint } from "@nucleum/datafn/resource.type";
  import {
    TaskSubTypeForSwitcher,
    type ITaskThumb
  } from "@nucleum/features/focus/tasks/task.type";
  import { parseAndFormatDate } from "@21n/utils/time.utils";
  import { Size } from "@21n/elements/size.enum";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import Button from "@21n/elements/button/Button.svelte";
  import type { TaskLibrarySubType as SubType } from "./task.type";
  import { appEvents } from "@nucleum/stores/events/app-events.store";
  import { onMount } from "svelte";
  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  import type { IEvent } from "@21n/elements/input/event.type";
  import CreateTaskInlineWizard from "./CreateTaskInlineWizard.svelte";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import { LoadingAnimationType } from "@21n/elements/feedback/feedback.type";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import view from "@nucleum/stores/view.store";
  import { UIState, UIStateScope } from "@nucleum/stores/uiState/uiState.type";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import ComponentShortcutListener from "@nucleum/components/keyboard/ComponentShortcutListener.svelte";
  import { Action } from "@nucleum/client/config/action.enum";
  import TasksGroupedByObjective from "./TasksGroupedByGoal.svelte";
  let {
    data,
    arrangement = Arrangement.LIST,
    accessPoint = ResourceAccessPoint.LIBRARY,
    accessPointId = undefined,
    parentBgIndex = 1,
    subType = undefined,
    isRefreshing = false,
    searchQuery = "",
    isPreventAddNew = false,
    date = undefined,
    onCreate = undefined
  }: {
    data: ITaskThumb[];
    arrangement?: Arrangement;
    accessPoint?: ResourceAccessPoint;
    accessPointId?: IRecordId | undefined;
    parentBgIndex?: number;
    subType?: SubType | undefined;
    isRefreshing?: boolean;
    searchQuery?: string;
    isPreventAddNew?: boolean;
    date?: Date | undefined;
    onCreate?: ((event: CustomEvent<void>) => void) | undefined;
  } = $props();

  let isShowCreateTaskWizard = $state(false);
  let createTaskParams = $state<any | undefined>(undefined);
  let isShowCompletedTasks = $state(refreshShowCompletedTasksState());
  const inboxZeroIllustrations = ["inboxZero", "travel", "check", "globe"];
  let selectedIllustration = $state<string | undefined>(undefined);
  const _data = $derived(applyFilters(data, { isShowCompletedTasks }));
  const completedTasksCount = $derived(
    data.filter((task: ITaskThumb) => task.isChecked).length
  );

  $effect(() => {
    if (
      accessPoint === ResourceAccessPoint.CALENDAR &&
      completedTasksCount > 0 &&
      !selectedIllustration
    ) {
      selectedIllustration =
        inboxZeroIllustrations[Math.floor(Math.random() * 4)];
    } else if (completedTasksCount === 0) {
      selectedIllustration = undefined;
    }
  });

  const tasksByDate = $derived(
    subType === TaskSubTypeForSwitcher.BY_MONTH ? groupTasksByDate(_data) : null
  );

  onMount(() => {
    const appEventSub = appEvents.subscribe((x: IEvent) => {
      if (x.event?.toString() === PointronAction.CREATE_TASK_INLINE) {
        isShowCreateTaskWizard = !isShowCreateTaskWizard;
        createTaskParams = x.value;
      }
    });

    return () => {
      appEventSub();
    };
  });

  function refreshShowCompletedTasksState() {
    return (
      uiState.getState(UIState.showCompletedTasks, {
        scope: UIStateScope.DEVICE
      }) ?? false
    );
  }

  function applyFilters(
    tasks: ITaskThumb[],
    filters: { isShowCompletedTasks?: boolean }
  ) {
    if (filters.isShowCompletedTasks === false) {
      return tasks.filter((task: ITaskThumb) => !task.isChecked);
    }
    return tasks;
  }

  export function scrollToDate(date: Date) {
    const dateKey = parseAndFormatDate(date);
    let dateElement = document.querySelector(
      `[data-date="${dateKey}"]`
    ) as HTMLDivElement;

    if (!dateElement && tasksByDate && tasksByDate.length > 0) {
      const targetTime = date.getTime();
      let closestDate: string | null = null;
      let minDiff = Infinity;

      tasksByDate.forEach(([dateStr]) => {
        if (dateStr === "No Date") return;

        const currentDate = new Date(dateStr);
        const diff = Math.abs(currentDate.getTime() - targetTime);

        if (diff < minDiff) {
          minDiff = diff;
          closestDate = dateStr;
        }
      });

      if (closestDate) {
        dateElement = document.querySelector(
          `[data-date="${parseAndFormatDate(new Date(closestDate))}"]`
        ) as HTMLDivElement;
      }
    }

    dateElement?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function groupTasksByDate(tasks: ITaskThumb[]) {
    const groups = new Map<string, ITaskThumb[]>();

    tasks.forEach((task) => {
      const dateKey = task.dateUnix
        ? parseAndFormatDate(new Date(task.dateUnix))!
        : "No Date";
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(task);
    });

    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === "No Date") return 1;
      if (b[0] === "No Date") return -1;
      return new Date(a[0]).getTime() - new Date(b[0]).getTime();
    });
  }

  function toggleCompletedTasks() {
    isShowCompletedTasks = !isShowCompletedTasks;
    uiState.setState(UIState.showCompletedTasks, isShowCompletedTasks, {
      scope: UIStateScope.DEVICE
    });
  }

  function handleCreateTask() {
    const createEvent = new CustomEvent<void>("create");
    onCreate?.(createEvent);
  }
</script>

<div class="flex flex-col gap-2 w-full h-full">
  {#if isShowCreateTaskWizard}
    <div class="flex w-full mb-2">
      <CreateTaskInlineWizard
        {...createTaskParams ?? {}}
        onClose={() => (isShowCreateTaskWizard = false)}
      />
    </div>
  {/if}
  {#if _data && _data.length > 0 && !isRefreshing}
    {#if subType === TaskSubTypeForSwitcher.BY_MONTH && tasksByDate}
      <div class="flex flex-col gap-12">
        {#each tasksByDate as [date, tasks]}
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <h3
                class="text-fgs3 text-h5"
                data-date={parseAndFormatDate(new Date(date))}
              >
                {date}
              </h3>
            </div>
            <TasksGroupedByObjective
              {tasks}
              date={new Date(date)}
              {accessPoint}
              {accessPointId}
              {parentBgIndex}
              {arrangement}
            />
          </div>
        {/each}
      </div>
    {:else}
      <TasksGroupedByObjective
        tasks={_data}
        {accessPoint}
        {accessPointId}
        {parentBgIndex}
        {arrangement}
        {date}
        isDisableGrouping={accessPoint === ResourceAccessPoint.OBJECTIVE ||
          accessPoint === ResourceAccessPoint.LIBRARY ||
          accessPoint === ResourceAccessPoint.BROWSER}
      />
    {/if}
  {:else}
    <EmptyStatusView
      isLoadingState={isRefreshing}
      isSearchContext={searchQuery !== ""}
      size={accessPoint === ResourceAccessPoint.CALENDAR ? Size.sm : Size.md}
      loadingAnimation={LoadingAnimationType.FOCUS_ITEMS_PULSE}
      mainText={completedTasksCount > 0 ? "Inbox zero" : "No tasks found"}
      subText={searchQuery !== ""
        ? "Try different search criteria or create a new task."
        : completedTasksCount > 0
          ? `You completed ${completedTasksCount > 1 ? "all your" : "your"} ${completedTasksCount} task${completedTasksCount > 1 ? "s" : ""}!`
          : isPreventAddNew
            ? "You can't add tasks to this objective when it is archived/deleted."
            : "Choose a different filters or create a task"}
      actionText={accessPoint !== ResourceAccessPoint.CALENDAR &&
      !isPreventAddNew &&
      !$view.isConstrainedWidth
        ? "Create task"
        : undefined}
      actionShortcut={Action.CREATE}
      onclick={handleCreateTask}
      emptyIllustration={selectedIllustration}
    >
      {#if completedTasksCount > 0}
        <div class="my-4">
          <Button
            icon={isShowCompletedTasks ? "hide" : ""}
            label={isShowCompletedTasks
              ? "Hide completed"
              : `Completed (${completedTasksCount})`}
            size={Size.sm}
            type={ButtonVariant.SECONDARY}
            style={ButtonStyle.PLAIN}
            onclick={toggleCompletedTasks}
          />
        </div>
      {/if}
    </EmptyStatusView>
  {/if}
  {#if !isRefreshing && _data.length > 0}
    <div class="flex flex-col justify-center items-center gap-6">
      {#if completedTasksCount > 0}
        <Button
          icon={isShowCompletedTasks ? "hide" : ""}
          label={isShowCompletedTasks
            ? "Hide completed"
            : `Completed (${completedTasksCount})`}
          size={Size.sm}
          type={ButtonVariant.SECONDARY}
          style={ButtonStyle.PLAIN}
          onclick={toggleCompletedTasks}
        />
      {/if}
      {#if accessPoint === ResourceAccessPoint.PICKER}
        <Button
          icon="plus"
          label="New task"
          size={Size.sm}
          shortcut={Action.CREATE}
          type={ButtonVariant.PRIMARY}
          style={ButtonStyle.OUTLINED}
          onclick={handleCreateTask}
        />
      {/if}
    </div>
  {/if}
</div>
<ComponentShortcutListener
  shortcuts={[
    {
      shortcut: Action.CREATE,
      callback: handleCreateTask
    }
  ]}
/>
