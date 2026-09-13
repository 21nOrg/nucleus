<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import {
    activeSession,
    currentFocusItem
  } from "@nucleum/features/focus/session.store";
  import Icon from "@21n/elements/Icon.svelte";
  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import { Layout } from "@21n/layout/layout-mode.type";
  import { TimeFormat } from "@21n/utils/time.type";
  import { formatTime, formatSeconds } from "@21n/utils/time.utils";
  import BreadcrumbMini from "@21n/elements/breadcrumb/BreadcrumbMini.svelte";
  import CustomColorPropagator from "@21n/elements/style/CustomColorPropagator.svelte";
  import { cn } from "@21n/utils/ui.utils";
  import { resolveTaskFocus } from "@nucleum/features/focus/session.utils";
  import UnpinAction from "@nucleum/features/focus/quickstart/actions/UnpinAction.svelte";
  import { toasts } from "@nucleum/stores/notification.store";
  import type { IObjectiveThumb } from "@nucleum/features/focus/goals/goal.type";
  import { hoverable } from "@nucleum/actions/hover.action";
  import { isSameResource } from "@nucleum/datafn/resource.utils";

  import { AccessMode } from "@nucleum/datafn/resource.type";
  import context from "@nucleum/stores/context.store";
  import { datafn } from "@nucleum/datafn/datafn.store";

  let {
    item,
    layout,
    isInEditMode = false,
    onUnpin = undefined
  }: {
    item: Pick<IObjectiveThumb, "id" | "label" | "color" | "parent"> & {
      focus?: number;
    };
    layout: Layout;
    isInEditMode?: boolean;
    onUnpin?: ((event: CustomEvent<any>) => void) | undefined;
  } = $props();
  let isColorObjectiveTextExperimental = false;
  let todayFocusDuration = $derived(item.focus);
  let parentLabels = $derived(
    item.parent && item.parent.length > 0
      ? (item.parent.map((x: any) => x.label) ?? [])
      : []
  );
  let focusTime = $state(0);
  let isHovering = $state(false);
  let isFinishingState = $state(false);

  let isActive = $derived(
    $currentFocusItem &&
      isSameResource(item, $currentFocusItem) &&
      $activeSession.isQuickStartOn &&
      $activeSession.isSessionRunning &&
      !isFinishingState
  );
  $effect(() => {
    if (!isActive) {
      focusTime = 0;
      return;
    }
    const resolvedFocusTime = resolveTaskFocus(
      $activeSession.intervals,
      undefined,
      $currentFocusItem?.start
    );
    focusTime = Number.isFinite(resolvedFocusTime) ? resolvedFocusTime : 0;
  });

  async function toggleSession(e: MouseEvent) {
    if (isInEditMode || e.altKey) {
      navigation.openResource(item.id, AccessMode.POP);
      return;
    }
    if (isActive) {
      isFinishingState = true;
      await activeSession.finishSession({ isClose: true });
      isFinishingState = false;
    } else {
      await activeSession.quickStart(item.id);
    }
  }

  async function unPin(e: any) {
    e.stopPropagation();
    await datafn.objective.mutate({
      operation: "merge",
      id: item.id.toString(),
      record: {
        id: item.id.toString(),
        isPinnedForQuickFocus: false
      }
    });
    toasts.success(`Objective **${item.label}** unpinned from quick focus`);
    const unpinEvent = new CustomEvent("unpin", {
      detail: item.id
    });
    onUnpin?.(unpinEvent);
  }

  function onTitleClick(e: MouseEvent) {
    if (!$context.isEmbed) {
      navigation.openResource(item.id, AccessMode.POP);
      e.stopPropagation();
    }
  }
</script>

{#if layout === Layout.LIST}
  <button
    id={item.id.toString()}
    use:hoverable={{
      onHover: (val) => {
        isHovering = val;
      }
    }}
    class={cn("relative cursor-pointer userdata", {})}
  >
    <CustomColorPropagator
      class={cn(
        "flex justify-between gap-2 h-16 min-h-[4rem] w-full items-center rounded-md  z-10",
        {
          "px-3": isActive || isInEditMode,
          "bg-ccs1": isActive && !isInEditMode,
          "bg-bgs2 notouch:hover:bg-bgs3 active:bg-bgs3 pr-3":
            !isActive && !isInEditMode,
          "border-[1.5px] border-dashed border-ccs1 notouch:hover:bg-bgs2 active:bg-bgs2":
            isInEditMode
        }
      )}
      color={item.color}
      onclick={toggleSession}
    >
      <div class="flex gap-2 items-center h-full flex-1 min-w-0">
        {#if !isActive && !isInEditMode}
          <div
            class={cn("w-0.5 h-8 ml-0.5 rounded-full", {
              "bg-ccs1": item.color,
              "bg-fgs2": !item.color
            })}
          />
        {/if}
        <div
          class={cn("flex flex-col items-start flex-1 min-w-0", {
            "text-ccs1": !isActive && isColorObjectiveTextExperimental,
            "text-fgs1": !isActive
          })}
        >
          <!-- {#if parentLabels.length > 0}
            <div class="text-start text-b4 truncate actualQSContent">
              {parentLabels.slice(-2).join(" ・ ")}
            </div>
          {/if} -->
          {#key parentLabels}
            <div
              class={cn({
                "text-fgs3": !isActive
              })}
            >
              <BreadcrumbMini hierarchy={parentLabels} slice={2} />
            </div>
          {/key}
          <div class="text-left flex items-center gap-2 actualQSContent w-full">
            <!-- {#if !isActive}
              <div class="w-2 h-2 bg-ccs1 rounded-full"></div>
            {/if} -->
            <div class="truncate">
              {item.label ? item.label : "Untitled"}
            </div>
          </div>
        </div>
      </div>

      {#if isActive && $currentFocusItem}
        <div class="flex flex-col items-end">
          <div class="flex items-center gap-1 text-b4">
            <div>
              {formatTime($userPreferences, $activeSession.start ?? new Date())}
            </div>
            <Icon icon="arrow-right-mini" isCustomBgContext={isActive} />
            <div>Now</div>
          </div>
          <div class="text-h3 leading-none">
            {formatSeconds(focusTime, TimeFormat.CLOCK)}
          </div>
        </div>
      {:else}
        <div class="text-b4">
          {isFinishingState
            ? "Finishing session..."
            : isHovering && !isInEditMode
              ? "Click to start"
              : todayFocusDuration
                ? "Today: " + formatSeconds(todayFocusDuration)
                : "Not focused today"}
        </div>
      {/if}
    </CustomColorPropagator>
    {#if isInEditMode}
      <UnpinAction onclick={unPin} />
    {/if}
  </button>
{:else}
  <!-- TODO - dark:bg-ccs3 isn't working due to bg-cc classes implementation. replacing `bg-ccs4 dark:bg-ccs3` with regular bg classes `bg-bgs1 dark:bg-bgs2` works -->
  <CustomColorPropagator
    type="button"
    class={cn(
      "relative flex rounded-md h-[4.3rem] p-2 transition-ease userdata",
      {
        "bg-ccs1 border border-ccs1": isActive && !isInEditMode,
        "bg-ccs4 dark:bg-ccs3 border border-ccs2":
          !isActive && !isInEditMode && item.color,
        "bg-bgs2/60 border border-brs3":
          !isActive && !isInEditMode && !item.color,
        "border-[1.5px] border-dashed border-ccs1 dark:border-ccs2 notouch:hover:bg-bgs2 active:bg-bgs2":
          isInEditMode
      }
    )}
    color={item.color}
    onclick={toggleSession}
  >
    <div
      use:hoverable={{
        onHover: (val) => {
          isHovering = val;
        }
      }}
      class="flex flex-col items-start w-full h-full justify-between"
    >
      <div class="flex gap-2 items-center">
        <div class="flex flex-col items-start">
          <div class="text-left text-b2 truncate w-40 md:w-40">
            {item.label ? item.label : "Untitled"}
          </div>
        </div>
      </div>
      {#if isActive && $currentFocusItem}
        <div class="flex w-full justify-between text-h4">
          <!-- <div class="flex items-center gap-1 text-b5">
          <div>
            {formatTime($sessionStore.start ?? new Date())}
          </div>
        </div> -->
          <div class="leading-none font-medium">
            {formatSeconds(focusTime, TimeFormat.CLOCK)}
          </div>
        </div>
      {:else}
        <div class="text-b4 text-fgs2">
          {isFinishingState
            ? "Finishing session..."
            : isHovering && !isInEditMode
              ? "Click to start"
              : todayFocusDuration
                ? formatSeconds(todayFocusDuration) + " today"
                : "Not focused today"}
        </div>
      {/if}
    </div>
    {#if isInEditMode}
      <UnpinAction onclick={unPin} />
    {/if}
  </CustomColorPropagator>
{/if}
