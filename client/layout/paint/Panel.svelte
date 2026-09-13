<script lang="ts">
  import type { Snippet } from "svelte";
  import Divider from "@21n/elements/Divider.svelte";
  import Text from "@21n/elements/text/Text.svelte";
  import view from "@nucleum/stores/view.store";
  import type { IButtonParams } from "@21n/elements/button/button.type";
  import { Orientation } from "@21n/elements/direction.enum";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import { ColorStrength } from "@21n/theme/appearance.type";
  import { Size } from "@21n/elements/size.enum";
  import { bg, cn } from "@21n/utils/ui.utils";
  import { onMount } from "svelte";
  import { appEvents } from "@nucleum/stores/events/app-events.store";
  import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";
  import { Display } from "@21n/elements/display.enum";
  import Icon from "@21n/elements/Icon.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import { InteractionMode } from "@21n/elements/keyboard/interaction-mode.type";
  import { tooltip } from "@nucleum/actions/popover.action";
  import ComponentResolver from "@21n/layout/paint/ComponentResolver.svelte";
  import type { InputLabelInfoToolTip } from "@21n/elements/input/input.type";
  import FormLabelTooltip from "@21n/elements/text/formLabel/FormLabelTooltip.svelte";
  import { fly } from "svelte/transition";
  import ButtonGroup from "@21n/elements/button/ButtonGroup.svelte";
  let {
    children,
    title = undefined,
    titleStyle = TextStyle.PANEL_HEADING,
    floatingButton = undefined,
    panelSize = Size.md,
    isNavActivated = false,
    isShowBackButton = false,
    parentBgIndex = 1,
    isExpanded = false,
    isProminentDivider = false,
    extraLargeScreenComponent = undefined,
    info = undefined,
    isPreventCwPadding = false,
    isHideRightSplit = false,
    onBack = undefined,
    topRightActions,
    nonPadded,
    nav,
    right
  }: {
    children?: Snippet;
    title?: string;
    titleStyle?: TextStyle;
    floatingButton?: IButtonParams | IButtonParams[];
    panelSize?: Size.sm | Size.md | Size.lg | Size.xl;
    isNavActivated?: boolean;
    isShowBackButton?: boolean;
    parentBgIndex?: number;
    isExpanded?: boolean;
    isProminentDivider?: boolean;
    extraLargeScreenComponent?: string;
    info?: InputLabelInfoToolTip;
    isPreventCwPadding?: boolean;
    isHideRightSplit?: boolean;
    onBack?: () => void;
    topRightActions?: Snippet;
    nonPadded?: Snippet;
    nav?: Snippet;
    right?: Snippet;
  } = $props();
  let isExplicitlyCollapsed = false;
  let isCollapsed = $state(false);
  const isShowCollapseButton = $derived(
    $view.display !== Display.TK &&
      !$view.isConstrainedWidth &&
      panelSize !== Size.xl &&
      $appStore.interactionMode !== InteractionMode.AGENT
  );
  const isExtraLargeScreen = $derived(
    $view.landscapiness > 1.7 && $view.scale > 1.8
  );

  onMount(() => {
    const collapsePanelHandler: EventListener = () => {
      isCollapsed = $view.display !== Display.TK;
    };
    const expandPanelHandler: EventListener = () => {
      if (isExplicitlyCollapsed) return;
      isCollapsed = false;
    };
    const unsubscribe = appEvents.subscribe((e) => {
      if (e.event === GlobalEvent.APP_MENU_SWITCHED) {
        const currentPath = window?.location?.pathname?.replace("/", "");
        if (currentPath !== e.value) return;
        isCollapsed = !isCollapsed;
        isExplicitlyCollapsed = false;
      }
    });
    window.addEventListener(GlobalEvent.COLLAPSE_PANEL, collapsePanelHandler);
    window.addEventListener(GlobalEvent.EXPAND_PANEL, expandPanelHandler);
    return () => {
      window.removeEventListener(
        GlobalEvent.COLLAPSE_PANEL,
        collapsePanelHandler
      );
      window.removeEventListener(GlobalEvent.EXPAND_PANEL, expandPanelHandler);
      if (unsubscribe) unsubscribe();
    };
  });
</script>

<div class="flex w-full h-full">
  {#if !isCollapsed}
    <div
      class={cn(
        "relative flex flex-col h-full",
        {
          "w-full": $view.isConstrainedWidth || isExpanded,
          "otop:pt-12": !isPreventCwPadding
        },
        !$view.isConstrainedWidth &&
          !isExpanded && {
            "w-[20rem] min-w-[20rem]": panelSize === Size.sm,
            "w-[24rem] min-w-[24rem] 2k:w-[28rem] 2k:min-w-[28rem]":
              panelSize === Size.md,
            "w-[28rem] min-w-[28rem]": panelSize === Size.lg,
            "w-1/2 min-w-1/2": panelSize === Size.xl
          }
      )}
      in:fly={{ x: -10 }}
    >
      {#if !isNavActivated && (title || isShowCollapseButton)}
        <div
          class={cn(
            "flex justify-between items-center w-full px-4 pt-2 overflow-auto min-h-fit mo:min-h-14"
          )}
        >
          <button
            type="button"
            class="flex items-center rounded-md gap-2 px-1"
            onclick={() => {
              if (!isShowBackButton) return;
              onBack?.();
            }}
          >
            {#if isShowBackButton}
              <Icon icon="chevron-left" size={Size.lg} />
            {/if}
            <Text style={titleStyle} content={title || ""} />
            {#if info}
              <FormLabelTooltip {info} />
            {/if}
          </button>
          {#if topRightActions}
            {@render topRightActions()}
          {:else if !isExpanded && isShowCollapseButton && !isShowBackButton}
            <button
              class="flex items-center text-fgs3 p-1 hover:bg-bgs2 rounded-md"
              use:tooltip={{
                text: "Collapse panel"
              }}
              onclick={() => {
                isCollapsed = true;
                isExplicitlyCollapsed = true;
              }}
            >
              <Icon icon="chevron-left" class="text-fgs3" size={Size.lg} />
            </button>
          {/if}
        </div>
      {/if}
      {#if nonPadded}
        {@render nonPadded()}
      {:else if isNavActivated && nav}
        {@render nav()}
      {:else}
        <div class="px-4 flex-grow">
          {@render children?.()}
        </div>
      {/if}
      {#if floatingButton}
        <ButtonGroup
          isFooter={true}
          buttons={Array.isArray(floatingButton)
            ? [...floatingButton]
            : [floatingButton]}
        />
      {/if}
    </div>
  {/if}
  {#if !$view.isConstrainedWidth && !isExpanded && !isHideRightSplit}
    {#if right}
      <Divider
        orientation={Orientation.Vertical}
        colorStrength={ColorStrength.Normal}
      />
    {/if}
    {#if isProminentDivider}
      <div class="w-0.5 bg-bgs2"></div>
      <Divider
        orientation={Orientation.Vertical}
        colorStrength={ColorStrength.Normal}
      />
    {/if}
    <div
      class={cn("relative flex flex-grow h-full", {
        "max-w-6xl": extraLargeScreenComponent
      })}
    >
      {@render right?.()}
    </div>
    {#if isExtraLargeScreen && extraLargeScreenComponent}
      <div class="flex h-full flex-grow">
        <ComponentResolver path={extraLargeScreenComponent} />
      </div>
    {/if}
  {/if}
</div>
