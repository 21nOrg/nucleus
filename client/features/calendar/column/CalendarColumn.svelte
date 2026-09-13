<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { resizeListener } from "@nucleum/actions/resize.action";
  import DatePicker from "@21n/elements/datetime/DatePicker.svelte";
  import Text from "@21n/elements/text/Text.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import { UIState, UIStateScope } from "@nucleum/stores/uiState/uiState.type";
  import { Product } from "@nucleum/client/config/product.type";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import { TimeScaleUnit } from "@21n/utils/time.type";
  import { cn } from "@21n/utils/ui.utils";
  import {
    CalendarColumnLayout,
    CalendarColumnPanel,
    CalendarExpansionMode
  } from "@nucleum/features/calendar/calendar.type";
  import CalendarColumnPanelResolver from "@nucleum/features/calendar/column/CalendarColumnPanelResolver.svelte";
  import CalendarColumnPanelSelector from "@nucleum/features/calendar/column/CalendarColumnPanelSelector.svelte";
  import CalendarColumnTimeline from "@nucleum/features/calendar/column/timeline/CalendarColumnTimeline.svelte";

  import { generateSimpleRandomId } from "@21n/shared-utils/crypto.utils";
  import { page } from "$app/stores";
  import Icon from "@21n/elements/Icon.svelte";
  import { Size } from "@21n/elements/size.enum";
  import view from "@nucleum/stores/view.store";
  import {
    resolveCalendarColumnPanels,
    resolveCalendarNotesId
  } from "@nucleum/features/calendar/calendar.utils";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  import DayTimeline from "./timeline/daytimeline/DayTimeline.svelte";
  import BoxButton from "@21n/elements/button/BoxButton.svelte";

  let {
    scale,
    viewScale = TimeScaleUnit.DAY,
    date = $bindable(),
    expansionMode = CalendarExpansionMode.JOURNAL,
    isRewind = false,
    isCwContext = false,
    onDateChange = undefined
  }: {
    scale: TimeScaleUnit;
    viewScale?: TimeScaleUnit;
    date?: Date;
    expansionMode?: CalendarExpansionMode;
    isRewind?: boolean;
    isCwContext?: boolean;
    onDateChange?: ((event: CustomEvent<Date>) => void) | undefined;
  } = $props();
  let mdId = generateSimpleRandomId();
  const backPath = $derived(
    $page.url?.searchParams?.get(AppSearchParam.RETURN_TO)
  );

  let selectedPanel = $state<CalendarColumnPanel>(resolvePanelSelection());

  function resolvePanelSelection() {
    const panelState = uiState.getState(UIState.calendarColumnPanel, {
      scope: UIStateScope.DEVICE
    });
    return (
      panelState ??
      ($appStore.product === Product.MEMOTRON
        ? CalendarColumnPanel.Notes
        : CalendarColumnPanel.Timeline)
    );
  }

  let containerWidth = $state(0);
  const layout = $derived(resolveLayout(containerWidth));
  const panels = $derived(
    resolveCalendarColumnPanels($appStore.product, layout)
  );

  $effect(() => {
    if (panels.length === 1) {
      selectedPanel = panels[0].value;
    }
  });

  function resolveLayout(width: number) {
    if (width > 1400) {
      return CalendarColumnLayout.FULL;
    } else if (width > 900) {
      return CalendarColumnLayout.SPLIT;
    } else {
      return CalendarColumnLayout.TABS;
    }
  }

  function handleDateChange(e: CustomEvent<Date>) {
    onDateChange?.(e);
  }

  function openNotesInFullScreen() {
    const id = resolveCalendarNotesId(date, scale);
    if (!id) return;
    navigation.openResource(id, AccessMode.POP);
  }
</script>

<div
  class="flex flex-col h-full w-full"
  id="mdcontainer-{mdId}"
  use:resizeListener={(e) => {
    containerWidth = e.width;
  }}
>
  {#if layout === CalendarColumnLayout.TABS}
    <div
      class="flex items-center justify-between border-b h-10 min-h-10 border-brs3"
    >
      <div class="flex items-center gap-2 hover:bg-bgs2-striped h-full">
        {#if isCwContext && backPath}
          <Icon
            icon="ph:caret-left"
            class="text-fgs3"
            size={Size.lg}
            onclick={() => {
              navigation.gotoPath(backPath);
            }}
          />
        {/if}
        <div class="flex text-fgs2 h-full">
          <!-- {formatDate(date)} -->
          <DatePicker
            bind:date
            onChange={handleDateChange}
            variant="inline-with-icon"
          />
        </div>
      </div>
      <div class="flex items-center gap-2 h-full">
        {#if !$view.isPortrait && selectedPanel === CalendarColumnPanel.Notes}
          <BoxButton
            icon="expand"
            tooltip="Expand notes"
            size={Size.sm}
            onclick={openNotesInFullScreen}
          />
        {/if}
        <CalendarColumnPanelSelector bind:selectedPanel {panels} />
      </div>
    </div>
  {/if}
  <div
    class={cn("w-full flex-grow", {
      "grid grid-cols-10": layout === CalendarColumnLayout.FULL,
      flex: layout !== CalendarColumnLayout.FULL
    })}
  >
    {#key date.toISOString()}
      {#if (layout === CalendarColumnLayout.TABS && selectedPanel === CalendarColumnPanel.Timeline) || (layout !== CalendarColumnLayout.TABS && expansionMode === CalendarExpansionMode.JOURNAL)}
        {#if viewScale === TimeScaleUnit.DAY}
          <div class="flex flex-grow col-span-3">
            <DayTimeline {date} {layout} />
          </div>
        {/if}
        <CalendarColumnTimeline
          {date}
          scale={viewScale}
          isExpandable={layout === CalendarColumnLayout.FULL}
          {layout}
          onDateChange={handleDateChange}
        />
      {/if}
      {#if layout !== CalendarColumnLayout.TABS}
        {@const isShowNotesFullScreenButton =
          !$view.isPortrait && selectedPanel === CalendarColumnPanel.Notes}
        <div class="flex flex-col flex-grow border-l border-brs2 col-span-4">
          {#if panels.length === 1}
            <Text
              content={`${viewScale} ${selectedPanel}`}
              style={TextStyle.PANEL_HEADING_SMALL}
            />
          {:else}
            <div
              class={cn(
                "flex w-full gap-2 border-b border-brs2 h-10 min-h-10",
                {
                  "justify-between": isShowNotesFullScreenButton,
                  "justify-end": !isShowNotesFullScreenButton
                }
              )}
            >
              {#if isShowNotesFullScreenButton}
                <div class="flex items-center w-10">
                  <BoxButton
                    icon="expand"
                    tooltip="Expand notes"
                    size={Size.sm}
                    onclick={openNotesInFullScreen}
                  />
                </div>
              {/if}
              <CalendarColumnPanelSelector bind:selectedPanel {panels} />
            </div>
          {/if}
          <CalendarColumnPanelResolver
            {mdId}
            {selectedPanel}
            {date}
            {scale}
            {isRewind}
          />
        </div>
      {:else if selectedPanel !== CalendarColumnPanel.Timeline}
        <CalendarColumnPanelResolver
          {mdId}
          {selectedPanel}
          {date}
          {scale}
          {isRewind}
        />
      {/if}
      {#if layout !== CalendarColumnLayout.TABS && expansionMode === CalendarExpansionMode.TIMELINE}
        <CalendarColumnTimeline
          {date}
          scale={viewScale}
          isExpandable={true}
          {layout}
          onDateChange={handleDateChange}
        />
      {/if}
    {/key}
  </div>
</div>
