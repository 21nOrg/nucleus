<script lang="ts">
  import DatePicker from "@21n/elements/datetime/DatePicker.svelte";
  import TextInput from "@21n/elements/input/TextInput.svelte";
  import TextSearchInput from "@21n/elements/input/TextSearchInput.svelte";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import { InputStyle } from "@21n/elements/input/input.type";
  import { Size } from "@21n/elements/size.enum";
  import { onMount } from "svelte";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import { ResourceAccessPoint } from "@nucleum/datafn/resource.type";
  import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
  import { resourceAction } from "@nucleum/datafn/resource.utils";
  import {
    ObjectiveStatus,
    type IObjective,
    type IObjectiveThumb
  } from "@nucleum/features/focus/goals/goal.type";
  import modalEvent from "@nucleum/stores/overlays/modal.store";
  import TaskThumbnailObjectiveLabel from "@nucleum/features/focus/tasks/TaskThumbnailGoalLabel.svelte";
  import { Product } from "@nucleum/client/config/product.type";
  import { appStore } from "@nucleum/stores/app.store";
  import { resolveUnixTimestamp } from "@21n/shared-utils/time.utils";
  import { toasts } from "@nucleum/stores/notification.store";
  import { appEvents } from "@nucleum/stores/events/app-events.store";
  import ObjectiveSearchResultItem from "@nucleum/features/focus/goals/GoalSearchResultItem.svelte";
  import Button from "@21n/elements/button/Button.svelte";
  import { ButtonStyle } from "@21n/elements/button/button.type";
  import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import { generateResourceId } from "@nucleum/datafn/id.utils";

  let {
    date: initialDate = undefined,
    objectiveId: initialObjectiveId = undefined,
    onClose = undefined
  }: {
    date?: Date | undefined;
    objectiveId?: IRecordId | undefined;
    onClose?: ((event: CustomEvent<void>) => void) | undefined;
  } = $props();

  const action = resourceAction(Resource.task, ResourceActionType.CREATE);
  let date = $state<Date | undefined>(initialDate);
  let objectiveId = $state<IRecordId | undefined>(initialObjectiveId);
  let label = $state("");
  let inputRef = $state<TextInput | undefined>(undefined);
  let isShowObjectivePicker = $state(false);
  let objectiveSearchQuery = $state("");
  let objectiveSearchInput = $state<TextSearchInput | undefined>(undefined);
  let objective = $state<IObjective | undefined>(undefined);
  let isFocusing = $state(false);
  let isCreateInProgress = $state(false);
  onMount(() => {
    const appEventSub = appEvents.subscribe((x) => {
      if (x.event === GlobalEvent.ENTER && isFocusing) {
        handleCreate();
      }
    });

    const initialize = async () => {
      if (objectiveId) {
        const result = await datafn.objective.query({
          select: ["*", "parent.*"],
          filters: { id: objectiveId.toString() },
          limit: 1
        });
        objective = result.data[0] as IObjective | undefined;
        isShowObjectivePicker = false;
      }
    };

    void initialize();

    return () => {
      appEventSub();
    };
  });

  function handleKeydown(keyboardEvent: KeyboardEvent) {
    if (keyboardEvent.key === "ArrowDown") {
      keyboardEvent.preventDefault();
      isShowObjectivePicker = true;
      setTimeout(() => {
        objectiveSearchInput?.focus();
        objectiveSearchInput?.showDefaultResults();
      }, 0);
    }
  }

  function handleKeydownFromObjectiveSearch(keyboardEvent: KeyboardEvent) {
    if (keyboardEvent.key === "ArrowUp") {
      keyboardEvent.preventDefault();
      isShowObjectivePicker = false;
      setTimeout(() => {
        inputRef?.focus();
      }, 0);
    }
  }

  function resolveObjectiveThumb(objective: IObjective) {
    return objective as unknown as IObjectiveThumb;
  }

  function emitClose() {
    const closeEvent = new CustomEvent<void>("close");
    onClose?.(closeEvent);
  }

  async function handleCreate(event?: any) {
    if (isCreateInProgress) return;
    try {
      isCreateInProgress = true;
      const task = {
        id: generateResourceId(Resource.task),
        label,
        dateUnix: date ? resolveUnixTimestamp(date) : 0,
        isChecked: false,
        objectiveId: objectiveId ?? objective?.id ?? ""
      };
      await datafn.task.mutate({
        operation: "insert",
        id: task.id,
        record: task,
        context: action
      });
      appStore.addToRecents({
        record: task,
        type: Resource.task,
        timestamp: new Date()
      });
      const result = [task];
      if (result) {
        label = "";
        if (event instanceof KeyboardEvent && event.shiftKey === true) {
          toasts.success("Task created successfully");
          return;
        } else {
          emitClose();
        }
      }
      return result;
    } finally {
      isCreateInProgress = false;
    }
  }

  async function handleCreateOnEnter(e: any) {
    const result = await handleCreate(e.detail.event);
    if (result) modalEvent.hide(action);
  }

  function searchObjectiveCallback(query: string) {
    return datafn.objective
      .query({
        select: ["*", "parent.*"],
        search: query ? { query, fields: ["label"] } : undefined,
        limit: 30,
        filters: {
          status: {
            $ne: ObjectiveStatus.COMPLETED
          }
        }
      })
      .then((result) => result.data);
  }
</script>

<div
  class="w-full h-fit flex flex-col gap-2 rounded-md border border-brs3 p-2 transition-all duration-200"
>
  <div class="flex items-center gap-3">
    <div class="flex-1">
      <TextInput
        bind:value={label}
        bind:this={inputRef}
        onMount={() => {
          inputRef?.focus();
        }}
        onFocus={() => (isFocusing = true)}
        onBlur={() => (isFocusing = false)}
        onKeydown={(event) => handleKeydown(event.detail.event ?? event.detail)}
        placeholder="Enter task name"
        testId="task-name-input"
        style={InputStyle.PLAIN}
        onEnter={handleCreateOnEnter}
      />
    </div>
    <div class="flex items-center gap-1">
      <Button
        icon="save"
        onclick={handleCreate}
        size={Size.sm}
        tooltip="Create task"
        shortcut={GlobalEvent.ENTER}
      />
      <Button icon="cross" onclick={emitClose} size={Size.sm} />
    </div>
  </div>
  <div class="w-full flex items-center justify-between">
    {#if isShowObjectivePicker}
      <div
        class="flex items-center h-fit flex-grow transition-all duration-200"
      >
        <TextSearchInput
          bind:value={objectiveSearchQuery}
          bind:this={objectiveSearchInput}
          searchCallback={searchObjectiveCallback}
          searchResultComponent={ObjectiveSearchResultItem}
          onKeydown={handleKeydownFromObjectiveSearch}
          placeholder="Search to assign an objective"
          onSelect={(e) => {
            objective = e.detail.item;
            isShowObjectivePicker = false;
          }}
          style={InputStyle.PLAIN}
        />
        <Button
          icon="cross"
          size={Size.sm}
          onclick={() => (isShowObjectivePicker = false)}
        />
      </div>
    {:else if objective}
      <div class="min-w-0 flex-1 transition-all duration-200">
        <TaskThumbnailObjectiveLabel
          objective={resolveObjectiveThumb(objective)}
          onClearObjective={() => {
            isShowObjectivePicker = true;
            objective = undefined;
          }}
          accessPoint={ResourceAccessPoint.CAPTURE}
        />
      </div>
    {/if}
    <div class="flex gap-2 items-center">
      {#if !isShowObjectivePicker && !objective && ($appStore.product === Product.POINTRON || $appStore.product === Product.NUCLEUM)}
        <Button
          label="Assign objective"
          size={Size.xs}
          style={ButtonStyle.OUTLINED}
          onclick={() => (isShowObjectivePicker = true)}
        />
      {/if}
      <span class="flex items-center shrink-0">
        <DatePicker
          bind:date
          style={InputStyle.PLAIN}
          size={Size.sm}
          variant={date ? "inline-with-icon" : "icon-only"}
        />
      </span>
    </div>
  </div>
</div>
