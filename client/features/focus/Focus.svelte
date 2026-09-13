<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import type { Snippet } from "svelte";
  import { page } from "$app/stores";
  import {
    BarStyle,
    PanelSwitcherStyle
  } from "@21n/elements/switcher/switcher.enum";
  import { onMount } from "svelte";
  import QuickStart from "@nucleum/features/focus/quickstart/QuickStart.svelte";
  import Advanced from "@nucleum/features/focus/advanced/Advanced.svelte";
  import view from "@nucleum/stores/view.store";
  import { activeSession } from "@nucleum/features/focus/session.store";
  import PanelSwitcher from "@21n/elements/switcher/PanelSwitcher.svelte";
  import Zen from "@nucleum/features/focus/zen/Zen.svelte";
  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  import Panel from "@21n/layout/paint/Panel.svelte";
  import FloatingButton from "@21n/elements/button/FloatingButton.svelte";
  import AdvancedPortrait from "@nucleum/features/focus/advanced/AdvancedPortrait.svelte";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import {
    ButtonStyle,
    ButtonVariant,
    type IButtonParams
  } from "@21n/elements/button/button.type";
  import { Size } from "@21n/elements/size.enum";

  import QuickStartLayoutToggle from "@nucleum/features/focus/quickstart/actions/QuickStartLayoutToggle.svelte";
  import { cn } from "@21n/utils/ui.utils";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  import ComponentShortcutListener from "@nucleum/components/keyboard/ComponentShortcutListener.svelte";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { getContext } from "svelte";
  import { readable, type Writable } from "svelte/store";
  import { Context } from "@nucleum/stores/appStore.type";
  import type { IContainer } from "@21n/layout/layout.type";
  import { resolveMinWidth } from "@21n/layout/layout.utils";

  const container =
    getContext<Writable<IContainer | undefined>>(Context.CONTAINER) ||
    readable(undefined);
  const MIN_WIDTH_TO_EXPAND = resolveMinWidth(2);

  let {
    accessMode = AccessMode.INLINE,
    nonPadded: nonPaddedContent = undefined,
    right: rightContent = undefined
  }: {
    accessMode?: AccessMode;
    nonPadded?: Snippet | undefined;
    right?: Snippet | undefined;
  } = $props();
  let mode = $state(0);
  let isInlineEnabled = $state(true);
  let fullScreenFocusIsEnabled = $derived(
    $page?.url?.searchParams?.get(AccessMode.FULL) ===
      PointronAction.FULL_SCREEN_FOCUS
  );
  const manualLogHotKey = {
    key: "m"
  };
  const focusToggleHotKey = {
    key: "f"
  };
  let addManualLogButton: IButtonParams = {
    label: "Add manual log",
    callback: onManualLogClicked,
    icon: "clock",
    variant: ButtonVariant.PRIMARY,
    parentBgIndex: $view.isPortrait ? 1 : 3,
    shortcut: manualLogHotKey,
    style: $view.isPortrait ? ButtonStyle.DEFAULT : ButtonStyle.OUTLINED
  };
  let startSessionButton: IButtonParams = {
    label: "Start focus",
    callback: onStartSessionClicked,
    icon: "play",
    variant: ButtonVariant.PRIMARY,
    style: ButtonStyle.DEFAULT,
    shortcut: PointronAction.TOGGLE_FOCUS_SESSION
  };

  onMount(async () => {
    let queryParamMode = $page.url.searchParams.get(AppSearchParam.MODE);
    if (queryParamMode) {
      mode = +queryParamMode;
    }
  });
  async function onManualLogClicked() {
    requireCommandHost().runAction(PointronAction.MANUAL_FOCUS_ENTRY);
  }
  async function onStartSessionClicked() {
    await activeSession.startSession();
  }
</script>

{#if $view.isPortrait || ($container && ($container.isPortrait || $container.width < MIN_WIDTH_TO_EXPAND))}
  {@const isMobile = $view.isPortrait}
  {@const parentBgIndex = isMobile ? 1 : 2}
  <main class="relative flex w-full h-full otop:pt-12">
    <div class="flex flex-col h-full w-full">
      {#if $activeSession.isSessionRunning && !$activeSession.isQuickStartOn && isInlineEnabled && !fullScreenFocusIsEnabled}
        <Zen isInline={true} />
      {:else}
        <div
          class={cn("flex flex-col gap-3 w-full h-full items-center", {
            "py-2": isMobile,
            "px-4": mode !== 0
            // "p-2": !$view.isPortrait
          })}
        >
          <div class="flex w-full gap-8 items-center justify-center">
            <PanelSwitcher
              size={Size.lg}
              items={["Quick Focus", "Advanced"]}
              value={mode === 0 ? "Quick Focus" : "Advanced"}
              style={PanelSwitcherStyle.BAR}
              barStyle={BarStyle.DOT}
              {parentBgIndex}
              isDisableEnabled={$activeSession.isSessionRunning}
              onSwitch={(e) => {
                mode = e.detail === "Quick Focus" ? 0 : 1;
              }}
            />
            <!-- {#if mode === 0}
              <QuickStartActions context="topright" />
            {/if} -->
          </div>
          {#if mode === 0}
            <QuickStart />
            <FloatingButton params={[addManualLogButton]} />
            <!-- <ManualFocusLog /> -->
          {:else}
            <AdvancedPortrait {parentBgIndex} />
            <FloatingButton params={[startSessionButton]} />
          {/if}
        </div>
      {/if}
    </div>
    <!-- {#if mode === 0}
      <FloatingButton params={addManualLogButton} />
    {/if} -->
  </main>
{:else}
  <div class="flex w-full h-full">
    {#if $activeSession.isSessionRunning && !$activeSession.isQuickStartOn && !fullScreenFocusIsEnabled}
      <Zen isInline={true} />
    {:else}
      <Panel
        title="Quick Focus"
        info={{
          body: "Tap on an objective to start a focus session."
        }}
        floatingButton={addManualLogButton}
        titleStyle={TextStyle.PANEL_HEADING}
        isProminentDivider={true}
        extraLargeScreenComponent={$activeSession.isSessionRunning ||
        accessMode === AccessMode.POP
          ? undefined
          : "simpleDigitalClock"}
      >
        {#snippet nonPadded()}
          {#if nonPaddedContent}
            {@render nonPaddedContent?.()}
          {:else}
            <QuickStart />
          {/if}
        {/snippet}
        {#snippet topRightActions()}
          <span>
            <QuickStartLayoutToggle />
          </span>
        {/snippet}
        {#snippet right()}
          {#if rightContent}
            {@render rightContent?.()}
          {:else if $activeSession.isSessionRunning}
            <Zen isInline={true} />
          {:else}
            <Advanced />
            <FloatingButton params={[startSessionButton]} />
          {/if}
        {/snippet}
      </Panel>
    {/if}
  </div>
{/if}
<ComponentShortcutListener
  shortcuts={[
    {
      shortcut: manualLogHotKey,
      callback: onManualLogClicked
    },
    {
      shortcut: focusToggleHotKey,
      callback: () => {
        requireCommandHost().runAction(PointronAction.TOGGLE_FOCUS_SESSION);
      }
    }
  ]}
/>
