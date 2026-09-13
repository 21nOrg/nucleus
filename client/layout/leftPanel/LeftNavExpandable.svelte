<svelte:options runes={true} />

<script lang="ts">
  import { sidebarState } from "@21n/layout/leftPanel/sidebar-state";

  import type { Snippet } from "svelte";
  import AppMenuSwitcher from "@21n/layout/leftPanel/appMenuSwitcher/AppMenuSwitcher.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import view from "@nucleum/stores/view.store";
  import { LayoutContext } from "@21n/layout/layout-mode.type";
  import { Size } from "@21n/elements/size.enum";
  import Button from "@21n/elements/button/Button.svelte";
  import LeftBottomBar from "@21n/layout/leftPanel/LeftBottomBar.svelte";
  import { onMount } from "svelte";
  import { cn } from "@21n/utils/ui.utils";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import { UIState } from "@nucleum/stores/uiState/uiState.type";
  import LeftNavCommandAction from "@21n/layout/leftPanel/LeftNavCommandAction.svelte";
  import LeftNavOfflineStatus from "@21n/layout/leftPanel/LeftNavOfflineStatus.svelte";
  let {
    isRounded = false,
    top,
    header,
    headerThin,
    mid
  }: {
    isRounded?: boolean;
    top?: Snippet;
    header?: Snippet;
    headerThin?: Snippet;
    mid?: Snippet;
  } = $props();
  let isMinimized = $state(false);
  const headerHeight = 150;
  let isHovered = $state(false);
  let isInThinMode = $state(refreshSidebarCollapseState());
  onMount(() => {
    if ($view.landscapiness < 1.25) {
      isInThinMode = true;
    }
    const sub = uiState.subscribe((x) => {
      isInThinMode = refreshSidebarCollapseState();
    });
    return () => {
      sub();
    };
  });
  function refreshSidebarCollapseState() {
    return uiState.getState(UIState.isInThinMode);
  }
  function onMinimizeToggled() {
    isMinimized = !isMinimized;
    if (isMinimized) isHovered = false;
  }
</script>

{#if isMinimized}
  <button
    class="leftnav flex flex-col items-center gap-4 absolute rounded-md left-1 z-30 {isHovered
      ? 'bg-bgs3 p-4 w-48'
      : 'bg-aps1 opacity-50'}"
    style="top: {headerHeight}px"
    onmouseenter={() => (isHovered = true)}
    onmouseleave={() => (isHovered = false)}
  >
    <AppMenuSwitcher
      {isHovered}
      parentBackgroundIndex={1}
      layoutContext={LayoutContext.MINIMIZED}
    />
    {#if isHovered}
      <Button
        onclick={onMinimizeToggled}
        size={Size.sm}
        label="switch to verbose"
      />
    {/if}
  </button>
{:else}
  <button
    class={cn("leftnav flex justify-center items-center h-full", {
      "w-16 min-w-[4rem]": isInThinMode,
      "w-56 min-w-[14rem]": !isInThinMode,
      "ml-2": isRounded,
      "border--r border-r-brs2": !isRounded
    })}
    onmouseenter={() => (isHovered = true)}
    onmouseleave={() => (isHovered = false)}
  >
    <div
      class={cn(
        "flex flex-col pt-4 gap-4 items-center justify-between overflow-auto w-full bg-bgs2",
        {
          "rounded-lg border-none": isRounded,
          "border-r border-brs2": !isRounded
        }
      )}
      style={isRounded ? "height: calc(100% - 1rem);" : "height:100%"}
    >
      <div class="w-full flex flex-col gap-8">
        <div
          class="w-full flex items-center h-6 {isInThinMode
            ? 'justify-center'
            : top
              ? 'justify-between'
              : 'justify-end'}  px-2"
        >
          {#if !isInThinMode}
            {@render top?.()}
          {/if}
          {#if isHovered}
            <Button
              icon="sidebar-toggle"
              size={Size.lg}
              testId="leftnav-sidebar-toggle-icon"
              ariaLabel="Toggle sidebar width"
              onclick={() => {
                sidebarState.toggleSidebar();
              }}
            />
          {/if}
        </div>
        {#if isInThinMode}
          {@render headerThin?.()}
        {:else}
          {@render header?.()}
        {/if}
        <div class="flex flex-col gap-8 items-center w-full p-2">
          <AppMenuSwitcher
            parentBackgroundIndex={1}
            layoutContext={isInThinMode
              ? LayoutContext.THIN
              : LayoutContext.DEFAULT}
          />
          {#if !isInThinMode}
            {@render mid?.()}
          {/if}
        </div>
      </div>
      <div class="w-full flex flex-col gap-2 items-center">
        {#if $appStore.isDebugMode}
          <Button
            onclick={onMinimizeToggled}
            size={Size.xs}
            label={isInThinMode ? "min" : "switch to min mode"}
            parentBgIndex={2}
          />
        {/if}
        <LeftNavOfflineStatus {isInThinMode} />
        <LeftNavCommandAction {isInThinMode} />
        <LeftBottomBar {isInThinMode} {isRounded} />
      </div>
    </div>
  </button>
{/if}
