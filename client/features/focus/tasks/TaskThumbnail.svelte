<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { resolveTaskContextMenu } from "./task.store";
  import type { ITaskThumb } from "@nucleum/features/focus/tasks/task.type";
  import { Arrangement } from "@21n/elements/direction.enum";
  import { Size } from "@21n/elements/size.enum";
  import {
    AccessMode,
    ResourceAccessPoint
  } from "@nucleum/datafn/resource.type";
  import ResourceThumbnailBase from "@nucleum/components/records/ResourceThumbnailBase.svelte";
  import { compareDates, parseAndFormatDate } from "@21n/utils/time.utils";
  import TaskCheckbox from "@nucleum/features/focus/tasks/TaskCheckbox.svelte";
  import { hoverable } from "@nucleum/actions/hover.action";
  import DatePicker from "@21n/elements/datetime/DatePicker.svelte";
  import Button from "@21n/elements/button/Button.svelte";
  import { InputStyle } from "@21n/elements/input/input.type";
  import TextInput from "@21n/elements/input/TextInput.svelte";
  import { cn } from "@21n/utils/ui.utils";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import TaskThumbnailObjectiveLabel from "@nucleum/features/focus/tasks/TaskThumbnailGoalLabel.svelte";

  import ResourceThumbnailContextMenu from "@nucleum/components/records/ResourceThumbnailContextMenu.svelte";
  import view from "@nucleum/stores/view.store";
  import { popover, tooltip } from "@nucleum/actions/popover.action";
  import AbsoluteTimeRangePopoverV2 from "@21n/elements/datetime/absolute/AbsoluteTimeRangePopoverV2.svelte";
  import { PopoverTriggerMethod } from "@nucleum/actions/popover.type";
  import { generateMiniRandomId } from "@21n/shared-utils/crypto.utils";
  import { resolveUnixTimestamp } from "@21n/shared-utils/time.utils";
  import FocusItemPickOverlay from "@nucleum/features/focus/elements/focusitem/FocusItemPickOverlay.svelte";
  import {
    activeSession,
    currentFocusItem
  } from "@nucleum/features/focus/session.store";
  import { movingBorder } from "@nucleum/actions/movingBorder.action";

  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import { bulkEditStore } from "@nucleum/stores/resources/bulkedit.store";
  import { resolveBulkSelectionAccessPointId } from "@nucleum/datafn/resource.utils";
  import Task from "@nucleum/features/focus/tasks/Task.svelte";
  import context from "@nucleum/stores/context.store";
  import { stringify } from "@21n/shared-utils/json.utils";
  import { datafn } from "@nucleum/datafn/datafn.store";

  let {
    item: initialItem,
    arrangement = Arrangement.LIST,
    size = Size.lg,
    accessPoint = ResourceAccessPoint.BROWSER,
    accessPointId = undefined,
    isApplyCustomColor = false,
    isDraggable = false,
    parentBgIndex = 1,
    isShowObjective = false,
    onClick = undefined
  }: {
    item: ITaskThumb;
    arrangement?: Arrangement;
    size?: Size.sm | Size.md | Size.lg;
    accessPoint?: ResourceAccessPoint;
    accessPointId?: IRecordId | undefined;
    isApplyCustomColor?: boolean;
    isDraggable?: boolean;
    parentBgIndex?: number;
    isShowObjective?: boolean;
    onClick?: ((event: MouseEvent) => void) | undefined;
  } = $props();

  let item = $state(initialItem);
  void size;
  void parentBgIndex;
  let isHovering = $state(false);
  let isDatePickerOpen = $state(false);
  let isShowDatePickerOnCw = $state(false);
  let isTaskOpened = $state(false);

  $effect(() => {
    item = initialItem;
  });

  const dev_isEnableBorderAnimation = false;
  const dev_isRenderTaskAsSheetOnMobile = false;
  const isOverdue = $derived(
    !!item.dateUnix &&
      !item.isChecked &&
      compareDates(new Date(item.dateUnix), new Date(), "<")
  );
  const isCurrentlyFocusing = $derived(
    activeSession.isCurrentFocusItem(item.id, $currentFocusItem)
  );
  const multiSelectContext = $derived({
    resource: Resource.task,
    accessPoint,
    accessPointId: resolveBulkSelectionAccessPointId(accessPoint, accessPointId)
  });
  let hasBulkSelection = $state(false);

  $effect(() => {
    const state = bulkEditStore.getState();
    if (
      state.context &&
      stringify(state.context, { isPreventReplacer: true }) ===
        stringify(multiSelectContext, { isPreventReplacer: true })
    ) {
      hasBulkSelection = state.selectedIds.length > 0;
    } else {
      hasBulkSelection = false;
    }
  });

  const instanceId = generateMiniRandomId();

  function onContextMenuAction(event: CustomEvent) {
    const action = event.detail.action;
    if (action === "editDate") {
      isShowDatePickerOnCw = true;
    } else if (action === "openTask") {
      if ($view.isConstrainedWidth && dev_isRenderTaskAsSheetOnMobile)
        isTaskOpened = true;
      else openTask();
    }
  }

  async function onDateChange(val: Date | undefined) {
    if (!val) return;
    item.dateUnix = resolveUnixTimestamp(val);
    await datafn.task.mutate({
      operation: "merge",
      id: item.id.toString(),
      record: {
        id: item.id.toString(),
        dateUnix: item.dateUnix
      },
      context: accessPoint
    });
    isShowDatePickerOnCw = false;
  }

  function onTaskPopoverChange(e: Event) {
    const detail = (e as CustomEvent<{ open?: boolean }>).detail;
    const isPopoverVisible = detail?.open ?? false;
    if (isPopoverVisible) {
      isTaskOpened = true;
    } else {
      isTaskOpened = false;
    }
  }

  function onDatePickerPopoverChange(e: Event) {
    const detail = (e as CustomEvent<{ open?: boolean }>).detail;
    const isPopoverVisible = detail?.open ?? false;
    if (isPopoverVisible) {
      isShowDatePickerOnCw = true;
    } else {
      isShowDatePickerOnCw = false;
    }
  }

  function isInteractiveClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (
      accessPoint === ResourceAccessPoint.OBJECTIVE &&
      target instanceof HTMLInputElement &&
      accessPointId
    ) {
      const selectedTask = new URL(window.location.href).searchParams.get(
        navigation.resolveRecordSpecificSearchParam(accessPointId, "task")
      );
      return selectedTask === item.id.toString();
    }
    return !!target?.closest(
      "button,input,textarea,select,a,[contenteditable='true'],[role='textbox']"
    );
  }

  function openTask(event?: MouseEvent) {
    const isInlineContext =
      !$view.isConstrainedWidth &&
      (accessPoint === ResourceAccessPoint.BROWSER ||
        accessPoint === ResourceAccessPoint.OBJECTIVE);
    if (isInlineContext && accessPoint === ResourceAccessPoint.OBJECTIVE) {
      if (accessPointId)
        navigation.toggleSearchParamRecordSpecific(accessPointId, {
          task: item.id.toString()
        });
      return;
    }
    navigation.openResource(
      item.id,
      isInlineContext ? AccessMode.INLINE : AccessMode.POP,
      {
        origin:
          accessPoint === ResourceAccessPoint.OBJECTIVE
            ? accessPointId
            : undefined
      }
    );
  }

  function handleThumbnailClick(event: MouseEvent) {
    if (onClick) {
      onClick(event);
      return;
    }
    if (
      accessPoint === ResourceAccessPoint.PICKER ||
      accessPoint === ResourceAccessPoint.SELF ||
      isInteractiveClick(event)
    ) {
      return;
    }
    openTask(event);
  }
</script>

<ResourceThumbnailBase
  menuResolver={(record, point, params) =>
    resolveTaskContextMenu(record, point, {
      accessPointId: params.accessPointId
    })}
  {item}
  {arrangement}
  {accessPoint}
  {accessPointId}
  {isApplyCustomColor}
  {isDraggable}
  isPreventDefaultContextMenu={true}
  onClick={handleThumbnailClick}
>
  {#if $view.isConstrainedWidth && isTaskOpened}
    <div
      use:popover={{
        content: Task,
        triggerMethod: [PopoverTriggerMethod.SHOW_BY_DEFAULT],
        isRenderAsModalForCW: true,
        componentProps: {
          id: item.id,
          accessPoint,
          accessPointId,
          accessMode: AccessMode.SHEET
        }
      }}
      onchange={onTaskPopoverChange}
    />
  {/if}
  <div
    class={cn("flex gap-2 items-center pr-1 pl-2 py-2 rounded-md", {
      "m-4 min-w-[30rem]": accessPoint === ResourceAccessPoint.SELF,
      "hover:bg-bgs2 border": accessPoint !== ResourceAccessPoint.SELF,
      "border-aps1": isCurrentlyFocusing,
      "border-transparent hover:border-brs2":
        !isCurrentlyFocusing && accessPoint !== ResourceAccessPoint.SELF,
      "min-h-14 h-14": item.objective && isShowObjective,
      "min-h-10 h-10": !item.objective || !isShowObjective
    })}
    use:movingBorder={{
      speed: 4000,
      borderWidth: "2px",
      borderColor: "aps2",
      enabled: isCurrentlyFocusing && dev_isEnableBorderAnimation
    }}
    use:hoverable={{
      onHover: (value) => {
        isHovering = value;
      }
    }}
  >
    <div
      class={cn("flex", {
        "self-start":
          item.objective && accessPoint !== ResourceAccessPoint.OBJECTIVE,
        "opacity-0": hasBulkSelection
      })}
    >
      <TaskCheckbox
        id={item.id}
        bind:isChecked={item.isChecked}
        size={Size.lg}
        {accessPoint}
      />
    </div>
    <div class="flex-1 min-w-0 flex flex-col userdata whitespace-no-wrap">
      {#if item.objective && isShowObjective}
        <TaskThumbnailObjectiveLabel objective={item.objective} {accessPoint} />
      {/if}
      {#if item.isChecked}
        <span class="flex line-through whitespace-no-wrap w-full">
          <span class="truncate">
            {item.label}
          </span>
        </span>
      {:else}
        <span class="">
          <TextInput
            bind:value={item.label}
            style={InputStyle.PLAIN}
            placeholder="Task name"
            onDebouncedChange={(e) => {
              datafn.task.mutate({
                operation: "merge",
                id: item.id.toString(),
                record: {
                  id: item.id.toString(),
                  label: e.detail
                },
                context: accessPoint
              });
            }}
          />
        </span>
      {/if}
    </div>
    {#if isShowDatePickerOnCw}
      <div
        use:popover={{
          content: AbsoluteTimeRangePopoverV2,
          id: "task-date-picker-popover" + instanceId,
          triggerMethod: [PopoverTriggerMethod.SHOW_BY_DEFAULT],
          isRenderAsModalForCW: true,
          componentProps: {
            isDatePickerMode: true,
            selectedDate: item.dateUnix ? new Date(item.dateUnix) : undefined,
            onDateChange
          }
        }}
        onchange={onDatePickerPopoverChange}
      />
    {/if}
    {#if !isHovering && isCurrentlyFocusing}
      <div class="flex flex-col items-end">
        <span class="text-b3 text-aps1 userdata"> Focusing... </span>
      </div>
    {/if}
    {#if accessPoint !== ResourceAccessPoint.PICKER}
      <div class="flex flex-col items-end">
        {#if item.dateUnix && !isHovering && !isCurrentlyFocusing && accessPoint !== ResourceAccessPoint.CALENDAR}
          <div
            class={cn("text-b3 userdata", {
              "text-ars1": isOverdue,
              "text-fgs3": !isOverdue
            })}
          >
            Due: {parseAndFormatDate(item.dateUnix)}
          </div>
        {/if}

        {#if item.completedAtUnix && !isHovering && !$view.isConstrainedWidth}
          {@const isCompletedBeforeDue =
            item.dateUnix &&
            compareDates(
              new Date(item.completedAtUnix),
              new Date(item.dateUnix),
              "<="
            )}
          <span
            class={cn("text-b3 text-ags1 userdata", {
              "text-ags1": isCompletedBeforeDue,
              "text-ars1": !isCompletedBeforeDue && item.dateUnix
            })}
          >
            Completed: {parseAndFormatDate(item.completedAtUnix)}
          </span>
        {/if}
      </div>

      {#if isHovering || isDatePickerOpen || ($context.isTouchDevice && !$view.isPortrait)}
        {@const isInlineContext =
          !$view.isConstrainedWidth &&
          (accessPoint === ResourceAccessPoint.BROWSER ||
            accessPoint === ResourceAccessPoint.OBJECTIVE)}
        {#if !isCurrentlyFocusing}
          <Button
            icon="circle"
            tooltip="Focus now"
            size={Size.sm}
            type={ButtonVariant.PRIMARY}
            style={ButtonStyle.OUTLINED}
            onclick={() => {
              activeSession.focusTask(item.id, item.objectiveId ?? undefined);
            }}
          />
        {/if}
        <div
          class="flex gap-2 shrink-0"
          use:tooltip={{
            text: item.dateUnix ? "Change date" : "Set date",
            delay: 0
          }}
        >
          <DatePicker
            date={item.dateUnix ? new Date(item.dateUnix) : undefined}
            id={instanceId}
            variant="icon-only"
            size={Size.sm}
            onChange={(e) => {
              onDateChange(e.detail);
            }}
            onOpened={() => {
              isDatePickerOpen = true;
            }}
            onClosed={() => {
              isDatePickerOpen = false;
            }}
          />
        </div>
        <Button
          icon={isInlineContext ? "proceed" : "pop"}
          parentBgIndex={2}
          tooltip="Open"
          size={Size.sm}
          style={ButtonStyle.OUTLINED}
          isPreventMinWidth={true}
          onclick={openTask}
        />
      {/if}
      <ResourceThumbnailContextMenu
        menuResolver={(record, point, params) =>
          resolveTaskContextMenu(record, point, {
            accessPointId: params.accessPointId
          })}
        bind:item
        {accessPoint}
        {accessPointId}
        {arrangement}
        {isApplyCustomColor}
        bgSize={Size.sm}
        onAction={onContextMenuAction}
        isInline={true}
      />
    {:else if accessPoint === ResourceAccessPoint.PICKER}
      <FocusItemPickOverlay {isHovering} {item} />
    {/if}
  </div>
</ResourceThumbnailBase>
