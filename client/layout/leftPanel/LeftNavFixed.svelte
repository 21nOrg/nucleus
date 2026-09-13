<svelte:options runes={true} />

<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import type { Snippet } from "svelte";
  import AppMenuSwitcher from "@21n/layout/leftPanel/appMenuSwitcher/AppMenuSwitcher.svelte";
  import { LayoutContext } from "@21n/layout/layout-mode.type";
  import { Size } from "@21n/elements/size.enum";
  import LeftBottomBar from "@21n/layout/leftPanel/LeftBottomBar.svelte";
  import { cn } from "@21n/utils/ui.utils";
  import { popover, tooltip } from "@nucleum/actions/popover.action";
  import { PopoverTriggerMethod } from "@nucleum/actions/popover.type";
  import LeftNavSettingsPopover from "@21n/layout/leftPanel/LeftNavSettingsPopover.svelte";
  import { Placement } from "@21n/elements/direction.enum";
  import Icon from "@21n/elements/Icon.svelte";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import { UIState, UIStateScope } from "@nucleum/stores/uiState/uiState.type";
  import { onMount } from "svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import OfflineStatusMessage from "@21n/elements/feedback/OfflineStatusMessage.svelte";
  import context from "@nucleum/stores/context.store";
  import { Action } from "@nucleum/client/config/action.enum";
  import BoxButton from "@21n/elements/button/BoxButton.svelte";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { page } from "$app/stores";
  import AppMenuSwitcherItem from "./appMenuSwitcher/AppMenuSwitcherItem.svelte";

  let {
    isRounded = false,
    panel
  }: {
    isRounded?: boolean;
    panel?: Snippet;
  } = $props();
  const dev_mixedPanel = false;
  let isHideMenuLabels = $state(
    uiState.getState(UIState.hideLeftNavMenuLabels, {
      scope: UIStateScope.DAP
    })
  );
  const isEnableAppMenuCustomization = false;

  let currentSearchParams = $state(new URLSearchParams(window.location.search));

  let isNavigatorActive = $derived(
    Action.NAVIGATOR === currentSearchParams.get(AccessMode.RIGHT)
  );

  onMount(() => {
    const unsubscribe = uiState.subscribe(() => {
      isHideMenuLabels = uiState.getState(UIState.hideLeftNavMenuLabels, {
        scope: UIStateScope.DAP
      });
    });

    const unsubscribePage = page.subscribe((p) => {
      currentSearchParams = p?.url?.searchParams ?? new URLSearchParams();
    });

    return () => {
      unsubscribe?.();
      unsubscribePage?.();
    };
  });

  function handleToggleMenuLabels(): void {
    uiState.setState(UIState.hideLeftNavMenuLabels, !isHideMenuLabels, {
      scope: UIStateScope.DAP
    });
  }

  function handleLeftNavKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleToggleMenuLabels();
    }
  }
</script>

<div
  class={cn(
    "leftnav flex justify-center items-center h-full",
    !$appStore.currentComponent?.panel && {
      // "w-[5.5rem] min-w-[5.5rem]": !isHideMenuLabels,
      // "w-[3.5rem] min-w-[3.5rem]": isHideMenuLabels,
      "ml-2": isRounded,
      "border--r border-r-brs2": !isRounded
    }
  )}
>
  <div
    class={cn(
      "flex items-center justify-center h-full w-full bg-bgs2",
      $appStore.currentComponent?.panel && {
        "rounded-lg border-none": isRounded,
        "border-r border-bgs4":
          !isRounded && !$context.experiments?.isEnableRoundedMain
      }
    )}
  >
    <div
      data-testid="leftnav-sidebar-toggle"
      aria-label="Toggle sidebar width"
      class={cn(
        "relative flex flex-col items-center justify-between overflow-auto bg-bgs2",
        {
          "w-[5.5rem] min-w-[5.5rem] !cursor-w-resize": !isHideMenuLabels,
          "w-[3.5rem] min-w-[3.5rem] !cursor-e-resize": isHideMenuLabels
        },
        (!dev_mixedPanel || !$appStore.currentComponent?.panel) && {
          "rounded-lg border-none": isRounded,
          "border-r border-bgs4":
            !isRounded && !$context.experiments?.isEnableRoundedMain
        }
      )}
      role="button"
      tabindex="0"
      onclick={handleToggleMenuLabels}
      onkeydown={handleLeftNavKeyDown}
      style={isRounded ? "height: calc(100% - 1rem);" : "height:100%"}
    >
      <button
        type="button"
        aria-label="Toggle sidebar width"
        tabindex="-1"
        class={cn("absolute inset-y-0 right-0 z-10 w-3 bg-transparent", {
          "cursor-w-resize": !isHideMenuLabels,
          "cursor-e-resize": isHideMenuLabels
        })}
        onclick={(event) => {
          event.stopPropagation();
          handleToggleMenuLabels();
        }}
      ></button>
      <div class="w-full flex flex-col gap-8 overflow-auto">
        <div
          class="w-full flex justify-center transition-opacity duration-200 py--2"
        >
          <!--  -->
          <div class="w-full h-16 {isNavigatorActive ? 'bg-bgs3' : ''}">
            <BoxButton
              icon={isNavigatorActive ? "cross" : "heroicons:slash"}
              size={Size.md}
              onclick={(e) => {
                e.stopPropagation();
                requireCommandHost().runAction(Action.NAVIGATOR);
              }}
            />
            <!-- <AppMenuSwitcherItem
              parentBackgroundIndex={2}
              onClick={() => {
                requireCommandHost().runAction(Action.NAVIGATOR);
              }}
              item={() => requireCommandHost().resolveAction(Action.NAVIGATOR)}
            /> -->
          </div>
        </div>
        <div
          class={cn(
            "flex flex-col gap-3 items-center w-full overflow-auto cursor-default transition-all duration-300",
            {
              "p-2": !isHideMenuLabels,
              "opacity-60": isNavigatorActive
            }
          )}
          role="group"
        >
          <AppMenuSwitcher
            parentBackgroundIndex={1}
            layoutContext={LayoutContext.THIN_WITH_LABEL}
          />
          {#if isEnableAppMenuCustomization}
            <div
              class="flex justify-center items-center w-full mt-2"
              use:tooltip={{
                text: "Menu settings"
              }}
              role="presentation"
            >
              <button
                data-testid="leftnav-settings"
                class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-bgs3 transition-colors duration-200"
                use:popover={{
                  content: LeftNavSettingsPopover,
                  id: "leftnav-settings-popover",
                  placement: Placement.Right,
                  triggerMethod: [PopoverTriggerMethod.CLICK],
                  offsetInPx: 10
                }}
                onclick={(event) => {
                  event.stopPropagation();
                }}
              >
                <Icon
                  icon="more-outline-horizontal"
                  size={Size.md}
                  class="text-fgs3"
                />
              </button>
            </div>
          {/if}
        </div>
      </div>
      <div class="w-full flex flex-col gap-2 items-center">
        <OfflineStatusMessage isIconOnly={true} />
        <!-- <LeftNavCommandAction isInThinMode={true} size={Size.lg} /> -->
        <LeftBottomBar {isRounded} />
      </div>
    </div>
    {@render panel?.()}
  </div>
</div>
