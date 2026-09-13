<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { untrack } from "svelte";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import {
    AccessMode,
    ResourceAccessPoint
  } from "@nucleum/datafn/resource.type";
  import type { ITaskThumb } from "@nucleum/features/focus/tasks/task.type";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import { recentsStore } from "@nucleum/stores/resources/recent.store";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import DatePicker from "@21n/elements/datetime/DatePicker.svelte";
  import { Orientation } from "@21n/elements/direction.enum";
  import TextInput from "@21n/elements/input/TextInput.svelte";
  import { Size } from "@21n/elements/size.enum";
  import { InputStyle } from "@21n/elements/input/input.type";
  import Button from "@21n/elements/button/Button.svelte";
  import TaskCheckbox from "@nucleum/features/focus/tasks/TaskCheckbox.svelte";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import { appStore } from "@nucleum/stores/app.store";
  import InlineFeedbackText from "@nucleum/extensions/clipper/InlineFeedbackText.svelte";
  import {
    AlertType,
    type IInlineStatus
  } from "@nucleum/stores/notifications/notification.type";
  import TaskThumbnailObjectiveLabel from "@nucleum/features/focus/tasks/TaskThumbnailGoalLabel.svelte";
  import { resolveUnixTimestamp } from "@21n/shared-utils/time.utils";
  import TextSearchInput from "@21n/elements/input/TextSearchInput.svelte";
  import type { IObjectiveThumb } from "@nucleum/features/focus/goals/goal.type";
  import { Product } from "@nucleum/client/config/product.type";
  import {
    activeSession,
    currentFocusItem
  } from "@nucleum/features/focus/session.store";
  import Icon from "@21n/elements/Icon.svelte";
  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  import RecordTrashBanner from "@nucleum/components/records/RecordTrashBanner.svelte";
  import { cn } from "@21n/utils/ui.utils";
  import view from "@nucleum/stores/view.store";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import { toSvelteStore } from "@datafn/svelte";
  import { resolveTrashedAtDate } from "@nucleum/datafn/resource.utils";

  let {
    id,
    accessPoint = ResourceAccessPoint.SELF,
    accessMode = AccessMode.POP,
    accessPointId = undefined
  }: {
    id: IRecordId;
    accessPoint?: ResourceAccessPoint;
    accessMode?: AccessMode;
    accessPointId?: IRecordId | undefined;
  } = $props();

  let status = $state<IInlineStatus | undefined>(undefined);
  let task = $state<ITaskThumb | undefined>(undefined);
  let date = $state<Date | undefined>(undefined);
  let completedDate = $state<Date | undefined>(undefined);
  let inputRef = $state<TextInput | undefined>(undefined);
  let isShowObjectivePicker = $state(
    $appStore.product === Product.POINTRON ||
      $appStore.product === Product.NUCLEUM
  );
  let objectiveSearchQuery = $state("");
  let objective = $state<IObjectiveThumb | undefined>(undefined);
  const isCurrentlyFocusing = $derived(
    activeSession.isCurrentFocusItem(id, $currentFocusItem)
  );
  const taskStore = $derived.by(() =>
    toSvelteStore(
      datafn.task.signal({
        select: ["*", "objective.*"],
        filters: {
          id: id?.toString()
        },
        limit: 1,
        metadata: {
          includeTrashed: true,
          includeArchived: true
        }
      }),
      { initialData: [] }
    )
  );
  const isLoading = $derived($taskStore.loading);
  const trashedAt = $derived(resolveTrashedAtDate(task));

  $effect(() => {
    const record = $taskStore.data?.[0];
    if (record) {
      untrack(() => applyTaskRecord(record));
    }
  });

  async function updateTaskRecord(properties: Partial<ITaskThumb>) {
    return datafn.task.mutate({
      operation: "merge",
      id: id.toString(),
      record: {
        id: id.toString(),
        ...properties
      },
      context: accessPoint
    });
  }

  function applyTaskRecord(record: ITaskThumb) {
    task = record;
    if (!task) return;
    date = task.dateUnix ? new Date(task.dateUnix) : undefined;
    completedDate = task.completedAtUnix
      ? new Date(task.completedAtUnix)
      : undefined;
    if (task.objective) {
      objective = task.objective;
      isShowObjectivePicker = false;
    } else if (!task.objectiveId) {
      objective = undefined;
      isShowObjectivePicker = true;
    }
    recentsStore.add(task, {
      type: Resource.task,
      timestamp: new Date()
    });
  }

  async function handleLabelChange(e: CustomEvent) {
    status = {
      message: "Updating task name...",
      type: AlertType.PROGRESS
    };
    const result = await updateTaskRecord({ label: e.detail });
    if (result) {
      status = {
        message: "Task name updated",
        type: AlertType.SUCCESS
      };
    } else {
      status = {
        message: "Failed to update task name. Please try again.",
        type: AlertType.ERROR
      };
    }
  }
  async function onDateChange(e: CustomEvent<Date>) {
    const val = e.detail;
    if (!task) return;
    status = {
      message: "Updating due date...",
      type: AlertType.PROGRESS
    };
    task.dateUnix = resolveUnixTimestamp(val);
    const result = await updateTaskRecord({ dateUnix: task.dateUnix });
    if (result) {
      status = {
        message: "Due date updated",
        type: AlertType.SUCCESS
      };
    } else {
      status = {
        message: "Failed to save date. Please try again.",
        type: AlertType.ERROR
      };
    }
  }
  async function onCompletedDateChange(e: CustomEvent<Date>) {
    const val = e.detail;
    if (!task) return;
    task.completedAtUnix = resolveUnixTimestamp(val);
    const result = await updateTaskRecord({
      completedAtUnix: task.completedAtUnix
    });
    if (result) {
      status = {
        message: "Completed date updated",
        type: AlertType.SUCCESS
      };
    } else {
      status = {
        message: "Failed to update completed date. Please try again.",
        type: AlertType.ERROR
      };
    }
  }

  function objectiveSearchCallback(query: string) {
    return datafn.objective
      .query({
        select: ["*", "parent.*"],
        search: query ? { query, fields: ["label"] } : undefined,
        limit: 30
      })
      .then((result) => result.data);
  }

  async function onObjectiveSelect(e: CustomEvent<{ item: IObjectiveThumb }>) {
    objective = e.detail.item;
    isShowObjectivePicker = false;
    if (!task) return;
    status = {
      message: "Updating objective...",
      type: AlertType.PROGRESS
    };
    task.objectiveId = objective.id;
    const result = await updateTaskRecord({ objectiveId: objective.id });
    if (result) {
      status = {
        message: "Objective updated",
        type: AlertType.SUCCESS
      };
    } else {
      status = {
        message: "Failed to update objective. Please try again.",
        type: AlertType.ERROR
      };
    }
  }

  async function onObjectiveClear() {
    if (!task) return;
    status = {
      message: "Clearing objective...",
      type: AlertType.PROGRESS
    };
    const result = await updateTaskRecord({ objectiveId: null as any });
    if (result) {
      objective = undefined;
      task.objectiveId = undefined;
      isShowObjectivePicker = true;
      status = {
        message: "Objective cleared",
        type: AlertType.SUCCESS
      };
    } else {
      status = {
        message: "Failed to clear objective. Please try again.",
        type: AlertType.ERROR
      };
    }
  }

  function onClose() {
    if (accessPoint === ResourceAccessPoint.OBJECTIVE) {
      if (accessPointId)
        navigation.toggleSearchParamRecordSpecific(accessPointId, ["task"]);
    } else {
      navigation.closeResource({
        accessMode: accessMode
      });
    }
  }
</script>

<div
  class={cn(
    "flex p-4 cw:w-full portrait:w-full cw:h-full otop:pt-12 h-[28rem]",
    {
      "landscape:w-[32rem]": accessMode !== AccessMode.INLINE,
      "w-full": accessMode === AccessMode.INLINE,
      "w-full min-h-[28rem]": accessMode === AccessMode.SHEET
    }
  )}
>
  {#if isLoading}
    <EmptyStatusView isLoadingState={isLoading} />
  {:else if task}
    <div
      class="w-full flex flex-col justify-between gap-4 h-full userdata ph-no-capture"
    >
      <div class="flex flex-col gap-6 mt-4">
        {#if $view.isConstrainedWidth}
          <div class="flex justify-end w-full">
            <Button
              icon="cross"
              style={ButtonStyle.OUTLINED}
              onclick={onClose}
            />
          </div>
        {/if}
        <div class="flex flex-col gap-1">
          {#if isShowObjectivePicker}
            <TextSearchInput
              bind:value={objectiveSearchQuery}
              searchCallback={objectiveSearchCallback}
              placeholder="Search to assign an objective"
              icon="plus"
              onSelect={onObjectiveSelect}
              style={InputStyle.PLAIN}
            />
          {:else if objective}
            <TaskThumbnailObjectiveLabel
              {objective}
              onClearObjective={onObjectiveClear}
              {accessPoint}
            />
          {/if}
          <div class="flex gap-2">
            <TaskCheckbox
              id={task.id}
              bind:isChecked={task.isChecked}
              size={Size.lg}
              {accessPoint}
              onToggle={() => {
                if (task?.isChecked) {
                  completedDate = new Date();
                }
              }}
            />
            <TextInput
              bind:value={task.label}
              bind:this={inputRef}
              size={Size.lg}
              onMount={() => {
                inputRef?.focus();
              }}
              placeholder="Enter task name"
              testId="task-name-input"
              style={InputStyle.PLAIN}
              onDebouncedChange={handleLabelChange}
            />
          </div>
        </div>

        <div class="flex gap-2">
          <DatePicker
            bind:date
            placeholder="Set due date"
            label={{ label: "Due date", orientation: Orientation.Vertical }}
            onChange={onDateChange}
          />
          {#if task.isChecked}
            <DatePicker
              bind:date={completedDate}
              placeholder="Set completed date"
              label={{
                label: "Completed date",
                orientation: Orientation.Vertical
              }}
              onChange={onCompletedDateChange}
            />
          {/if}
        </div>
        {#if isCurrentlyFocusing}
          <button
            onclick={() => {
              navigation.gotoPath(PointronAction.FOCUS);
            }}
            class="flex items-center gap-1 text-b3 text-aps1"
          >
            <Icon icon="hourglass" size={Size.sm} class="text-aps1" />
            <span> Currently focusing... </span>
          </button>
        {/if}
        {#if trashedAt}
          <RecordTrashBanner
            deletedAt={trashedAt.toISOString()}
            onRestore={async () => {
              await datafn.task.mutate({
                operation: "restore",
                id: id.toString(),
                context: accessPoint
              });
            }}
          />
        {/if}
      </div>
      <div class="flex flex-col gap-3 justify-center w-full">
        <InlineFeedbackText feedback={status} />
        <div class="flex gap-2 justify-center w-full cw:pb-6">
          <Button
            icon="trash"
            label="Delete"
            style={ButtonStyle.OUTLINED}
            type={ButtonVariant.DANGER}
            onclick={async () => {
              await datafn.task.mutate({
                operation: "trash",
                id: id.toString(),
                context: accessPoint
              });
              navigation.closeResource({
                accessMode: accessMode
              });
            }}
          />
          {#if !$view.isConstrainedWidth}
            <Button icon="x-circle" label="Close" onclick={onClose} />
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
