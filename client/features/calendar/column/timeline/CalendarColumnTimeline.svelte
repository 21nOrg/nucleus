<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import PanelSwitcher from "@21n/elements/switcher/PanelSwitcher.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import { Product } from "@nucleum/client/config/product.type";
  import {
    BarStyle,
    PanelSwitcherStyle
  } from "@21n/elements/switcher/switcher.enum";
  import { cn } from "@21n/utils/ui.utils";
  import CalendarColumnTasksPanel from "@nucleum/features/calendar/column/CalendarColumnTasksPanel.svelte";
  import CalendarColumnEventsPanel from "@nucleum/features/calendar/column/CalendarColumnEventsPanel.svelte";
  import { CalendarColumnLayout } from "@nucleum/features/calendar/calendar.type";
  import DayTimeline from "@nucleum/features/calendar/column/timeline/daytimeline/DayTimeline.svelte";
  import Button from "@21n/elements/button/Button.svelte";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import { UIState, UIStateScope } from "@nucleum/stores/uiState/uiState.type";
  import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import DatePicker from "@21n/elements/datetime/DatePicker.svelte";
  import ButtonGroup from "@21n/elements/button/ButtonGroup.svelte";
  import { Size } from "@21n/elements/size.enum";
  import BoxSwitcher from "@21n/elements/switcher/BoxSwitcher.svelte";
  import { TimeScaleUnit } from "@21n/utils/time.type";
  import BoxButton from "@21n/elements/button/BoxButton.svelte";
  import { resourceAction } from "@nucleum/datafn/resource.utils";
  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  import { Action } from "@nucleum/client/config/action.enum";

  let {
    date = $bindable(),
    isExpandable = false,
    layout,
    scale,
    onDateChange = undefined
  }: {
    date?: Date;
    isExpandable?: boolean;
    layout: CalendarColumnLayout;
    scale: TimeScaleUnit;
    onDateChange?: ((event: CustomEvent<Date>) => void) | undefined;
  } = $props();

  let timelinePanelSubItem = $state<"tasks" | "events">(
    resolveTimlinePanelSelection()
  );
  let allDayPanelState = $state<"default" | "collapsed" | "expanded">(
    "default"
  );
  let tasksPanelRef: CalendarColumnTasksPanel | undefined = $state(undefined);
  const timelinePanelSubItems = $derived(
    resolveTimelinePanelSubItems($appStore.product)
  );

  const createNewLabel = $derived(
    timelinePanelSubItem === "tasks" ? "New task" : "New event"
  );

  function resolveTimlinePanelSelection() {
    const persistedValue = uiState.getState(
      UIState.calendarDayTimelinePanelSelection,
      {
        scope: UIStateScope.DEVICE
      }
    );
    const supportedValues = ["tasks", "events"];
    if (persistedValue && supportedValues.includes(persistedValue)) {
      return persistedValue;
    }
    return "tasks";
  }

  /**
   * TODO - tasks and events count badges
   * @param product
   */
  function resolveTimelinePanelSubItems(product: Product) {
    const events = {
      label: "Events",
      value: "events"
    };
    const tasks = {
      label: "Tasks",
      value: "tasks"
    };
    switch (product) {
      case Product.POINTRON:
        return [events, tasks];
      case Product.NUCLEUM:
        return [events, tasks];
      default:
        return [];
    }
  }

  function onTimelinePanelSwitch(e: CustomEvent<string>) {
    uiState.setState(UIState.calendarDayTimelinePanelSelection, e.detail, {
      scope: UIStateScope.DEVICE
    });
  }

  function emitDateChange(event: CustomEvent<Date>) {
    onDateChange?.(event);
  }

  function handleCreate() {
    if (timelinePanelSubItem === "tasks") {
      handleCreateTask();
    } else if (timelinePanelSubItem === "events") {
      handleCreateEvent();
    }
  }

  function handleCreateEvent() {
    requireCommandHost().runAction(
      resourceAction(Resource.event, ResourceActionType.CREATE),
      {
        componentParams: { date }
      }
    );
  }

  async function handleCreateTask() {
    requireCommandHost().runAction(PointronAction.CREATE_TASK_INLINE, {
      componentParams: { date }
    });
  }
</script>

<div
  class={cn("flex flex-col", {
    "flex-grow": isExpandable,
    "col-span-3 border-l border-brs2": layout === CalendarColumnLayout.FULL,
    "lp:max-w-sm 2k:max-w-lg": layout === CalendarColumnLayout.SPLIT,
    "w-1/2 shrink-0": !isExpandable && layout !== CalendarColumnLayout.TABS,
    "w-full": !isExpandable && layout === CalendarColumnLayout.TABS
  })}
>
  {#if layout !== CalendarColumnLayout.TABS}
    <div class="flex justify-between gap-3 min-h-10 h-10 border-b border-brs2">
      <div class="flex h-full gap-1">
        {#if scale !== TimeScaleUnit.DAY}
          <div class="hover:bg-bgs2-striped">
            <DatePicker
              bind:date
              onChange={emitDateChange}
              variant="inline-with-icon"
            />
          </div>
        {/if}
        <span>
          <BoxButton
            width="w-fit px-3"
            icon="plus"
            label={scale === TimeScaleUnit.DAY ? createNewLabel : undefined}
            tooltip={scale !== TimeScaleUnit.DAY ? createNewLabel : undefined}
            testId="calendar-timeline-create-button"
            shortcut={Action.CREATE}
            onclick={handleCreate}
          />
        </span>
      </div>
      {#if timelinePanelSubItems.length > 1}
        <div>
          <BoxSwitcher
            options={timelinePanelSubItems}
            bind:selected={timelinePanelSubItem}
            onSelect={onTimelinePanelSwitch}
          />
        </div>
      {/if}
    </div>
  {/if}
  <div class="flex flex-col flex-grow">
    <div
      class={cn(
        "flex flex-col w-full border-b transition-all",
        {
          "min-h-full h-full border-transparent":
            layout === CalendarColumnLayout.FULL ||
            allDayPanelState === "expanded"
        },
        layout !== CalendarColumnLayout.FULL && {
          "min-h-[45vh] h-[45vh]": allDayPanelState === "default",
          "min-h-fit h-fit": allDayPanelState === "collapsed",
          "border-brs2": allDayPanelState !== "expanded"
        }
      )}
    >
      {#if allDayPanelState !== "collapsed" && timelinePanelSubItems.length > 0 && layout === CalendarColumnLayout.TABS}
        <div class="flex justify-center pb-1">
          <PanelSwitcher
            items={timelinePanelSubItems}
            bind:value={timelinePanelSubItem}
            style={PanelSwitcherStyle.BAR}
            barStyle={BarStyle.DOT}
            isExpandToFullWidth={layout === CalendarColumnLayout.TABS}
            onSwitch={onTimelinePanelSwitch}
          >
            {#snippet right()}
              <div class="flex items-center gap-2 mr-3">
                <Button
                  icon="plus"
                  tooltip={createNewLabel}
                  testId="calendar-timeline-create-button"
                  onclick={handleCreate}
                  shortcut={Action.CREATE}
                />
              </div>
            {/snippet}
          </PanelSwitcher>
        </div>
      {/if}
      {#if allDayPanelState !== "collapsed"}
        <div class="overflow-y-auto w-full min-h-0 flex-1 px-3">
          {#if timelinePanelSubItem === "tasks"}
            <CalendarColumnTasksPanel {date} bind:this={tasksPanelRef} />
          {:else if timelinePanelSubItem === "events"}
            <CalendarColumnEventsPanel {date} />
          {/if}
        </div>
      {/if}
      <div
        class={cn("w-full h-8 flex", {
          "justify-end pt-1": allDayPanelState !== "collapsed",
          "justify-between": allDayPanelState === "collapsed"
        })}
      >
        {#if allDayPanelState === "collapsed"}
          <!-- TODO: Counts -->
          <div class="text-fgs3 px-1 flex h-full items-center">
            Tasks & Events
          </div>
        {/if}
        {#if layout !== CalendarColumnLayout.FULL}
          <div class="h-full w-fit">
            <ButtonGroup
              width="w-10"
              buttons={[
                ...(allDayPanelState === "default" ||
                allDayPanelState === "collapsed"
                  ? [
                      {
                        size: Size.sm,
                        icon: "chevron-down",
                        tooltip: "Expand",
                        callback: async () => {
                          if (allDayPanelState === "default")
                            allDayPanelState = "expanded";
                          else if (allDayPanelState === "collapsed")
                            allDayPanelState = "default";
                        }
                      }
                    ]
                  : []),
                ...(allDayPanelState === "default" ||
                allDayPanelState === "expanded"
                  ? [
                      {
                        size: Size.sm,
                        icon: "chevron-up",
                        tooltip: "Collapse",
                        callback: async () => {
                          if (allDayPanelState === "default")
                            allDayPanelState = "collapsed";
                          else if (allDayPanelState === "expanded")
                            allDayPanelState = "default";
                        }
                      }
                    ]
                  : []),
                ...(allDayPanelState === "collapsed" ||
                allDayPanelState === "expanded"
                  ? [
                      {
                        size: Size.sm,
                        icon:
                          allDayPanelState === "collapsed"
                            ? "ph:caret-double-down"
                            : "ph:caret-double-up",
                        tooltip:
                          allDayPanelState === "collapsed"
                            ? "Expand fully"
                            : "Collapse fully",
                        callback: async () => {
                          if (allDayPanelState === "collapsed")
                            allDayPanelState = "expanded";
                          else if (allDayPanelState === "expanded")
                            allDayPanelState = "collapsed";
                        }
                      }
                    ]
                  : [])
              ]}
            />
          </div>
        {/if}
      </div>
    </div>
    {#if layout !== CalendarColumnLayout.FULL}
      <div class="flex flex-col flex-grow">
        <DayTimeline {date} {layout} />
      </div>
    {/if}
  </div>
</div>
