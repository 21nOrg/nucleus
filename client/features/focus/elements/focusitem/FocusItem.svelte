<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import {
    focusItemsStore,
    activeSession,
    currentFocusItem
  } from "@nucleum/features/focus/session.store";
  import { onMount } from "svelte";
  import AddTodo from "@nucleum/features/focus/elements/focusitem/AddTodo.svelte";
  import { formatSeconds } from "@21n/utils/time.utils";
  import { SessionState } from "@nucleum/features/focus/sessionState.enum";
  import { Size } from "@21n/elements/size.enum";
  import Button from "@21n/elements/button/Button.svelte";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import { Embed } from "@nucleum/client/runtime/context.type";
  import context from "@nucleum/stores/context.store";
  import BreadcrumbMini from "@21n/elements/breadcrumb/BreadcrumbMini.svelte";
  import CustomColorPropagator from "@21n/elements/style/CustomColorPropagator.svelte";
  import { cn } from "@21n/utils/ui.utils";
  import { SessionType } from "@nucleum/features/focus/logs/log.type";
  import type {
    IFocusItem,
    ISessionInterval
  } from "@nucleum/features/focus/session.type";
  import { resolveTaskFocus } from "@nucleum/features/focus/session.utils";
  import type { IObjectiveThumb } from "@nucleum/features/focus/goals/goal.type";
  import {
    isSameResource,
    resourceInList
  } from "@nucleum/datafn/resource.utils";
  import FocusTask from "@nucleum/features/focus/elements/focusitem/FocusTask.svelte";
  import type { ITaskThumb } from "@nucleum/features/focus/tasks/task.type";

  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { resolveObjectiveColor } from "@nucleum/features/focus/goals/goal.utils";
  import { toasts } from "@nucleum/stores/notification.store";
  import { reorderList } from "@nucleum/actions/rearrange.action";
  import Icon from "@21n/elements/Icon.svelte";

  let {
    focusItem,
    tasks = [],
    objectives = [],
    isFocusAddTask = false,
    isInEditMode = false,
    contxt = "current",
    intervals = [],
    focusItemsList = [],
    onCreateNew = undefined,
    onSelect = undefined,
    onRemove = undefined,
    onReorderTasks = undefined
  }: {
    focusItem: IFocusItem;
    tasks?: ITaskThumb[];
    objectives?: IObjectiveThumb[];
    isFocusAddTask?: boolean;
    isInEditMode?: boolean;
    contxt?: "current" | "history";
    intervals?: ISessionInterval[];
    focusItemsList?: IFocusItem[];
    onCreateNew?:
      | ((event: CustomEvent<{ label: string; objectiveId: any }>) => void)
      | undefined;
    onSelect?: ((event: CustomEvent<any>) => void) | undefined;
    onRemove?: ((event: CustomEvent<any>) => void) | undefined;
    onReorderTasks?: ((event: CustomEvent<any>) => void) | undefined;
  } = $props();
  /**
   * Needed if the contxt param is "history"
   */
  let objective = $derived(objectives.find(resourceInList(focusItem.id)));
  let color = $derived(resolveObjectiveColor(objective));
  let tasksUnderObjective = $derived(resolveTaskFocusItems(focusItem));

  let parentHierarchy: string[] = [];
  let addTaskInputRef: any;
  let isInprogressDerived = $derived(
    (contxt !== "history" &&
      $currentFocusItem &&
      isSameResource(focusItem, $currentFocusItem)) ??
      false
  );

  let parentHierarchyDerived = $derived(
    objective?.parent ? objective.parent?.map((x: any) => x.label) : []
  );

  onMount(() => {
    try {
      if (focusItem.id && contxt == "current") {
        if (
          isFocusAddTask &&
          addTaskInputRef &&
          $context.embed != Embed.HANDSET
        ) {
          addTaskInputRef?.focus();
        }
      }
    } catch (e) {
      console.warn("Error in focusItem.svelte", e);
    }
  });

  async function clickHandler() {
    if (
      isInEditMode ||
      contxt === "history" ||
      ($activeSession.isSessionRunning &&
        $activeSession.type === SessionType.PREDEFINED_INTERVALS &&
        $activeSession.state === SessionState.BREAK_RUNNING)
    ) {
      if ($activeSession.state === SessionState.BREAK_RUNNING) {
        toasts.error("Cannot start working on an item while break is running", {
          title: "Break running"
        });
      }
      return;
    }
    if ($activeSession.isSessionRunning) {
      if (isInprogressDerived) {
        await activeSession.stopCurrentFocusItem();
      } else {
        await activeSession.startTask(focusItem.id);
      }
    }
  }
  async function onRemoveClicked() {
    const removeEvent = new CustomEvent("remove", {
      detail: focusItem.id
    });
    onRemove?.(removeEvent);
  }

  function resolveTaskFocusItems(focusItem: IFocusItem) {
    if (contxt === "current") {
      return (
        focusItem.tasks
          ?.map((taskId) => $focusItemsStore.items.find(resourceInList(taskId)))
          .filter((item): item is IFocusItem => Boolean(item)) ?? []
      );
    } else {
      return (
        focusItem.tasks
          ?.map((taskId) => focusItemsList.find(resourceInList(taskId)))
          .filter((item): item is IFocusItem => Boolean(item)) ?? []
      );
    }
  }

  function resolveWorkedDuration() {
    if (
      contxt === "history" &&
      "worked" in focusItem &&
      typeof focusItem.worked === "number"
    ) {
      return focusItem.worked;
    }
    return resolveTaskFocus(
      contxt == "current" ? $activeSession.intervals : intervals,
      focusItem.blocks
    );
  }

  function handleReorderTasks(event: any) {
    const { fromId, toId } = event;
    if (!objective || !focusItem.tasks) return;
    const reorderTasksEvent = new CustomEvent("reorderTasks", {
      detail: { fromId, toId, objectiveId: focusItem.id }
    });
    onReorderTasks?.(reorderTasksEvent);
  }
</script>

<div
  class={cn("flex flex-col gap-4 w-full userdata", {
    "cursor-move": isInEditMode
  })}
>
  {#if (objective && (!$activeSession.isSessionRunning || isInEditMode) && contxt === "current") || (objective && tasksUnderObjective.length > 0)}
    <CustomColorPropagator
      {color}
      class="relative flex items-center gap-2 w-full"
    >
      <div
        class="relative flex flex-col gap-2 w-full pb-2 border border-brs3 rounded-md"
      >
        {#if isInEditMode}
          <span class="absolute left-2 top-3">
            <Icon icon="rearrange" class="text-fgs2" />
          </span>
        {/if}
        <div
          class={cn("text-left px-3 pt-3 font-medium truncate min-w-0 flex-1", {
            "text-ccs1": color,
            "text-fgs2": !color,
            "pl-8": isInEditMode
          })}
        >
          <div>
            <BreadcrumbMini
              hierarchy={parentHierarchyDerived}
              slice={3}
              truncateLength={15}
            />
          </div>
          <button
            class="notouch:hover:underline active:underline"
            onclick={(e) => {
              e.stopPropagation();
              navigation.openResource(objective.id, AccessMode.POP);
            }}
          >
            {objective.label}
          </button>
        </div>
        <div class="px-2">
          {#if tasksUnderObjective && tasksUnderObjective.length > 0}
            <div
              use:reorderList={{
                listId: `focus-tasks-${focusItem.id}`,
                draggedOverClass: "outline outline-ass1",
                dragImage: "dragimage",
                onDrop: handleReorderTasks
              }}
            >
              {#each tasksUnderObjective as taskFocusItem, index (taskFocusItem.id)}
                {@const task = tasks.find(resourceInList(taskFocusItem.id))}
                {#if task}
                  <div
                    data-index={index}
                    data-id={taskFocusItem.id}
                    data-testid={`focus-session-item:${taskFocusItem.id}`}
                    data-current-focus={$currentFocusItem &&
                    isSameResource(taskFocusItem, $currentFocusItem)
                      ? "true"
                      : "false"}
                    draggable={(contxt === "current" &&
                      !$activeSession.isSessionRunning) ||
                      isInEditMode}
                  >
                    <FocusTask
                      focusItem={taskFocusItem}
                      {task}
                      {intervals}
                      {isInEditMode}
                      context={contxt}
                      {onRemove}
                    />
                  </div>
                {/if}
                {#if index < tasksUnderObjective.length - 1}
                  <div class="mx-1 border-b border-bgs2" />
                {/if}
              {/each}
            </div>
          {/if}
          {#if (contxt === "current" && !$activeSession.isSessionRunning) || isInEditMode}
            <div class="mx-1 border-b border-bgs2" />
            <AddTodo
              objectiveId={focusItem.id}
              placeholder="Add a task"
              bind:this={addTaskInputRef}
              {onCreateNew}
              {onSelect}
            />
          {/if}
        </div>
      </div>
      {#if isInEditMode || (contxt === "current" && !$activeSession.isSessionRunning)}
        <div class="absolute bg-bgs1 right-1 -top-3">
          <Button
            icon="minus-circle"
            size={Size.xs}
            type={ButtonVariant.DANGER}
            style={ButtonStyle.OUTLINED}
            isPreventMinWidth={true}
            tooltip="Remove"
            ariaLabel={`Remove ${objective.label}`}
            testId={`focus-session-remove:${focusItem.id}`}
            onclick={onRemoveClicked}
          />
        </div>
      {/if}
    </CustomColorPropagator>
  {:else if objective}
    <CustomColorPropagator
      type="button"
      class={cn(
        "flex h-16 gap-4 items-center border border-brs3 w-full p-3 rounded-md",
        {
          "bg-ccs1 border-ccs1": isInprogressDerived,
          "text-ccs1": !isInprogressDerived
        }
      )}
      {color}
      onclick={clickHandler}
    >
      <div class="text-left truncate min-w-0 flex-1">
        <div>
          <BreadcrumbMini
            hierarchy={parentHierarchyDerived}
            slice={3}
            truncateLength={15}
          />
        </div>
        <button
          class="notouch:hover:underline active:underline"
          onclick={(e) => {
            e.stopPropagation();
            navigation.openResource(objective.id, AccessMode.POP);
          }}
        >
          {objective.label}
        </button>
      </div>
      {#if isInprogressDerived && contxt == "current" && $currentFocusItem}
        <div class="leading-none text-b3">
          {formatSeconds(
            resolveTaskFocus(
              $activeSession.intervals,
              focusItem.blocks,
              $currentFocusItem.start
            )
          )}
        </div>
      {:else}
        <div class="text-fgs3 text-b3">
          {formatSeconds(resolveWorkedDuration())}
        </div>
      {/if}
    </CustomColorPropagator>
  {:else}
    {@const task = tasks.find(resourceInList(focusItem.id))}
    {#if task}
      <FocusTask
        {focusItem}
        {task}
        {intervals}
        {isInEditMode}
        context={contxt}
        isStandalone={true}
        {onRemove}
      />
    {/if}
  {/if}
</div>
