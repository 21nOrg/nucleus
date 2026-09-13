<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { onMount, onDestroy } from "svelte";
  import dayjs from "dayjs";
  import DayTimelineEntry from "@nucleum/features/calendar/column/timeline/daytimeline/DayTimelineEntry.svelte";
  import {
    CalendarColumnLayout,
    type CalendarTimelineEntry
  } from "@nucleum/features/calendar/calendar.type";
  import { formatTime } from "@21n/utils/time.utils";
  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import Button from "@21n/elements/button/Button.svelte";
  import { Size } from "@21n/elements/size.enum";
  import { ButtonStyle } from "@21n/elements/button/button.type";
  import { cn } from "@21n/utils/ui.utils";

  import RefreshingOverlayFeedback from "@21n/elements/feedback/RefreshingOverlayFeedback.svelte";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import { UIState, UIStateScope } from "@nucleum/stores/uiState/uiState.type";

  import { PointronAction } from "@nucleum/client/config/focus-action.enum";

  let {
    date = new Date(),
    data = [],
    layout,
    isRefreshing = false
  }: {
    date?: Date;
    data?: Array<CalendarTimelineEntry>;
    layout: CalendarColumnLayout;
    isRefreshing?: boolean;
  } = $props();

  let container: HTMLElement;
  const isToday = $derived(dayjs(date).isSame(dayjs(), "day"));
  const isFocusing = $derived(
    isToday &&
      typeof document !== "undefined" &&
      document
        .getElementById("focusData")
        ?.getAttribute("data-focus-active") === "true"
  );
  const BASE_HOUR_HEIGHT = 80;
  let scale = $state(resolveInitialScale());
  const hourHeight = $derived(BASE_HOUR_HEIGHT * scale);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  function resolveInitialScale() {
    const scale = uiState.getState(UIState.calendarDayTimelineScale, {
      scope: UIStateScope.DAP
    });
    return scale ?? 1;
  }
  function persistScaleState() {
    uiState.setState(UIState.calendarDayTimelineScale, scale, {
      scope: UIStateScope.DAP
    });
  }

  // Handle zoom
  function zoomIn() {
    scale = Math.min(2.5, scale + 0.1);
    persistScaleState();
  }

  function zoomOut() {
    scale = Math.max(0.4, scale - 0.1);
    persistScaleState();
  }

  function resetZoom() {
    scale = 1;
    persistScaleState();
  }

  let now = $state(new Date());
  let interval: ReturnType<typeof setInterval>;

  function updateTime() {
    now = new Date();
  }

  onMount(() => {
    updateTime();
    if (isToday) {
      interval = setInterval(updateTime, 60000); // Update every minute
    }

    const nowLine = document.querySelector(".now-line") as HTMLDivElement;
    if (nowLine) {
      nowLine.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });

  $effect(() => {
    if (interval) clearInterval(interval);
    if (isToday) {
      interval = setInterval(updateTime, 60000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  });

  function getTimePosition(unixTime: number): number {
    const timeDate = new Date(unixTime);
    const hours = timeDate.getHours();
    const minutes = timeDate.getMinutes();
    const seconds = timeDate.getSeconds();
    return (hours + minutes / 60 + seconds / 3600) * hourHeight;
  }

  function getEventHeight(start: number, end: number): number {
    const duration = (end - start) / 3600000; // hours
    return Math.max(30, duration * hourHeight); // Minimum 30px height
  }

  // Function to detect overlapping events and group them accordingly
  function calculatePositionGroups(
    events: Array<CalendarTimelineEntry & { top: number; height: number }>
  ): Array<
    CalendarTimelineEntry & {
      top: number;
      height: number;
      positionInGroup: number;
      groupSize: number;
    }
  > {
    if (!events.length) return [];

    // Sort events by start time
    const sortedEvents = [...events].sort((a, b) => a.startUnix - b.startUnix);

    // Group events that overlap in time
    const overlapGroups: Array<
      Array<CalendarTimelineEntry & { top: number; height: number }>
    > = [];

    for (const event of sortedEvents) {
      // Find an existing group this event overlaps with
      let foundGroup = false;

      for (const group of overlapGroups) {
        // Check if this event overlaps with any event in this group
        const overlapsWithGroup = group.some(
          (existingEvent) =>
            event.startUnix < existingEvent.endUnix &&
            event.endUnix > existingEvent.startUnix
        );

        if (overlapsWithGroup) {
          group.push(event);
          foundGroup = true;
          break;
        }
      }

      // If no overlapping group found, create a new one
      if (!foundGroup) {
        overlapGroups.push([event]);
      }
    }

    // Process each overlap group to assign positions within the group
    const processedEvents = new Map<
      CalendarTimelineEntry & { top: number; height: number },
      {
        positionInGroup: number;
        groupSize: number;
      }
    >();

    for (const group of overlapGroups) {
      if (group.length === 1) {
        // Solo event gets full width
        processedEvents.set(group[0], {
          positionInGroup: 0,
          groupSize: 1
        });
        continue;
      }

      // For events that overlap, we need to assign each one a column
      const columns: Array<
        Array<CalendarTimelineEntry & { top: number; height: number }>
      > = [];

      // Sort by start time within group
      const sortedGroup = [...group].sort((a, b) => a.startUnix - b.startUnix);

      for (const event of sortedGroup) {
        // Try to find a column where this event doesn't overlap with existing events
        let placed = false;

        for (let i = 0; i < columns.length; i++) {
          const column = columns[i];
          const overlapsWithColumn = column.some(
            (existingEvent) =>
              event.startUnix < existingEvent.endUnix &&
              event.endUnix > existingEvent.startUnix
          );

          if (!overlapsWithColumn) {
            column.push(event);
            processedEvents.set(event, {
              positionInGroup: i,
              groupSize:
                columns.length > 0
                  ? Math.max(columns.length, sortedGroup.length)
                  : 1
            });
            placed = true;
            break;
          }
        }

        // If couldn't place in existing column, create a new one
        if (!placed) {
          columns.push([event]);
          processedEvents.set(event, {
            positionInGroup: columns.length - 1,
            groupSize:
              columns.length > 0
                ? Math.max(columns.length, sortedGroup.length)
                : 1
          });
        }
      }

      // Update group size for all events in this group to be the total number of columns needed
      const totalColumns = columns.length;
      for (const event of sortedGroup) {
        const currentPosition = processedEvents.get(event);
        if (currentPosition) {
          processedEvents.set(event, {
            ...currentPosition,
            groupSize: totalColumns
          });
        }
      }

      // Optimize layout: allow events to expand if they have no conflicts to the right
      for (let i = 0; i < columns.length; i++) {
        for (const event of columns[i]) {
          // Check if this event can expand to the right
          let canExpandToRight = true;
          for (let j = i + 1; j < columns.length; j++) {
            const conflictsWithRightColumn = columns[j].some(
              (rightEvent) =>
                event.startUnix < rightEvent.endUnix &&
                event.endUnix > rightEvent.startUnix
            );
            if (conflictsWithRightColumn) {
              canExpandToRight = false;
              break;
            }
          }

          if (canExpandToRight) {
            processedEvents.set(event, {
              positionInGroup: i,
              groupSize: i + 1 // This allows the event to take up space up to the next occupied column
            });
          }
        }
      }
    }

    // Return events with position information
    return sortedEvents.map((event) => {
      const positionInfo = processedEvents.get(event) || {
        positionInGroup: 0,
        groupSize: 1
      };

      return {
        ...event,
        positionInGroup: positionInfo.positionInGroup,
        groupSize: positionInfo.groupSize
      };
    });
  }

  const entriesWithBasicPosition = $derived(
    data.map((entry) => ({
      ...entry,
      top: getTimePosition(entry.startUnix),
      height: getEventHeight(entry.startUnix, entry.endUnix)
    }))
  );

  const entries = $derived(calculatePositionGroups(entriesWithBasicPosition));

  const nowPosition = $derived(isToday ? getTimePosition(now.getTime()) : -1);
</script>

<div
  class="flex flex-col w-full h-full overflow-hidden bg-bgs1 relative"
  bind:this={container}
>
  {#if isRefreshing}
    <RefreshingOverlayFeedback />
  {/if}
  <div
    class="timeline-container flex flex-col w-full h-full overflow-y-auto relative pt-4"
    style="--hour-height: {hourHeight}px;"
  >
    <!-- <div class="time-labels absolute top-0 left-0 h-full z-10">
        {#each hours as hour}
          <div
            class="hour-label flex items-center h-6 whitespace-nowrap"
            style="position: absolute; top: {hour * hourHeight}px; left: 0;"
          >
            <span class="text-fgs2 text-b3 px-2">{hour}:00</span>
          </div>
        {/each}
      </div> -->
    <div
      class="border-l border-brs2 absolute left-16"
      style="height: {25 * hourHeight}px;"
    ></div>
    <div
      class="timeline-content relative pb-4"
      style="height: {24 * hourHeight}px;"
    >
      {#each hours as hour}
        <div
          class="flex gap-2 items-start absolute w-full"
          style="top: {hour * hourHeight}px;"
        >
          <span
            class="text-fgs4 text-b4 w-14 h-4 -mt-2 flex justify-end tabular-nums"
          >
            <!-- {hour}:00 -->
            {formatTime(
              $userPreferences,
              new Date(new Date().setHours(hour, 0, 0, 0))
            )}
          </span>
          <div class="hour-marker grow border-t border-brs2"></div>
        </div>
      {/each}

      {#if isToday && nowPosition >= 0}
        <div
          class="now-line absolute w-full border-t border-aps1 z-20 flex items-center"
          style="top: {nowPosition}px;"
        >
          <div
            class="w-0.5 h-4 rounded-full bg-aps1 absolute -left--1 -mt-0.5"
          ></div>
        </div>
        <div
          class="absolute text-aps1 text-b4 w-14 flex justify-end bg-gradient-to-t from-bgs1 via-bgs1 to-transparent rounded-md px-2 pt-2 left-2 whitespace-nowrap tabular-nums"
          style="top: {nowPosition - 26}px;"
        >
          {formatTime($userPreferences, now)}
        </div>
        {#if isFocusing}
          <button
            class="absolute z-20 text-abg text-b3 flex justify-end rounded-md px-2 mr-1 right-0 whitespace-nowrap bg-aps1"
            style="top: {nowPosition - 10}px;"
            onclick={() => {
              const action = PointronAction.FOCUS;
              requireCommandHost().runAction(action);
            }}
          >
            Focusing now...
          </button>
        {/if}
      {/if}

      {#each entries as entry}
        <DayTimelineEntry {entry} />
      {/each}
    </div>
  </div>

  <div
    class={cn(
      "absolute right-3 bottom-3 flex gap-2 z-20 bg-bgs2 rounded-md border border-brs2"
    )}
  >
    {#if scale !== 1}
      <div class="px-2 flex items-center justify-center">
        <Button
          icon="reset"
          label="Reset"
          size={Size.sm}
          style={ButtonStyle.PLAIN}
          isPreventMinWidth={true}
          onclick={resetZoom}
        />
      </div>
    {/if}
    <Button icon="magnifying-glass-plus" parentBgIndex={2} onclick={zoomIn} />
    <Button icon="magnifying-glass-minus" parentBgIndex={2} onclick={zoomOut} />
  </div>
</div>

<!-- <style>
    .timeline-container {
      scrollbar-width: thin;
    }
  </style> -->
