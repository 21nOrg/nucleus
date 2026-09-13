<svelte:options runes={true} />

<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { appLoadingState, appStore } from "@nucleum/stores/app.store";
  import { appEvents } from "@nucleum/stores/events/app-events.store";
  import context from "@nucleum/stores/context.store";
  import view from "@nucleum/stores/view.store";
  import { InteractionMode } from "@21n/elements/keyboard/interaction-mode.type";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import CommandModePage from "@nucleum/application/commandBar/CommandModePage.svelte";
  import { Embed } from "@nucleum/client/runtime/context.type";
  import { UIState } from "@nucleum/stores/uiState/uiState.type";
  import LeftNav from "@21n/layout/leftPanel/LeftNav.svelte";
  import AppSplitView from "@21n/layout/AppSplitView.svelte";
  import TopNav from "@21n/layout/topNav/TopNav.svelte";
  import RightPanel from "../rightPanel/RightPanel.svelte";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  import { page } from "$app/stores";
  import BottomNav from "../bottomNav/BottomNav.svelte";
  import { hTrail } from "../topNav/tabs/tabs.store";
  import Trail from "../trail/Trail.svelte";
  import type { IAction } from "@nucleum/client/config/action.type";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import ResourceResolver from "../paint/ResourceResolver.svelte";
  import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";
  import ComponentResolver from "../paint/ComponentResolver.svelte";
  import { cn } from "@21n/utils/ui.utils";
  let {
    children,
    topnav: topnavContent,
    main
  }: {
    children?: Snippet;
    topnav?: Snippet;
    main?: Snippet;
  } = $props();
  let isHideLeftNavBar = $state(refreshSidebarState());

  let isMaxMode = $state(
    new URLSearchParams(window.location.search).get(AppSearchParam.MAX) ===
      "true"
  );
  let isHomePage = $state(isHomeRoute(new URL(window.location.href)));
  let rightPanel = $state<IAction | undefined>(undefined);
  let pop = $state<{ id: IRecordId; action: IAction } | undefined>(undefined);
  let mainPath = $state<string | undefined>(undefined);
  let popId = $derived.by(() => {
    if (!pop || typeof pop !== "object") return undefined;
    return typeof pop.id === "string" && pop.id.length > 0 ? pop.id : undefined;
  });

  onMount(() => {
    const uiStateSub = uiState.subscribe(() => {
      isHideLeftNavBar = refreshSidebarState();
    });
    $appLoadingState.isLocalLoaded = true;
    const pageSub = page.subscribe((p) => {
      const searchParams = p?.url?.searchParams ?? new URLSearchParams();
      isMaxMode = searchParams.get(AppSearchParam.MAX) === "true";
      isHomePage = p?.url ? isHomeRoute(p.url) : false;
      const rightPanelParam = searchParams.get(AccessMode.RIGHT);
      if (rightPanelParam) {
        rightPanel =
          requireCommandHost().resolveAction(rightPanelParam) ?? undefined;
      } else {
        rightPanel = undefined;
      }
      const popParam = searchParams.get(AccessMode.POP) ?? undefined;
      if (popParam) {
        resolvePop(popParam);
      } else {
        pop = undefined;
      }
      mainPath = searchParams.get(AccessMode.MAIN) ?? undefined;
    });
    const appEventSub = appEvents.subscribe((x) => {
      if (x.event === GlobalEvent.ESCAPE) {
        navigation.closeResource({ isRestrictToModals: true });
      }
    });
    return () => {
      if (uiStateSub) uiStateSub();
      if (pageSub) pageSub();
      if (appEventSub) appEventSub();
    };
  });

  function resolvePop(resourceId: string) {
    if (!resourceId) {
      pop = undefined;
      return;
    }
    const slug = resourceId.split(":")[0];
    const action = requireCommandHost().resolveAction(slug);
    if (!action) {
      pop = undefined;
      return;
    }
    pop = {
      id: resourceId,
      action
    };
  }

  function refreshSidebarState() {
    return uiState.getState(UIState.isHideLeftNavBar);
  }

  function isHomeRoute(url: URL) {
    return url.pathname.split("/").filter(Boolean).at(-1) === "home";
  }
</script>

{#if $appLoadingState.isBaseLoaded && $appLoadingState.isLocalLoaded}
  {#if $appStore.interactionMode === InteractionMode.AGENT && $context.embed !== Embed.HANDSET}
    <CommandModePage>
      {@render children?.()}
    </CommandModePage>
  {:else}
    <div class="flex flex-col w-full h-full">
      <div
        class={cn("flex w-full flex-grow", {
          "bg-bgs2": $context.experiments?.isEnableRoundedMain
        })}
      >
        {#if $context.embed === Embed.HANDSET}
          <LeftNav variant="fixed" />
        {/if}
        <div class="flex flex-col h-full w-full">
          {#if !$view.isPortrait && !isMaxMode}
            <TopNav topnav={topnavContent} />
          {/if}
          <div class="flex w-full flex-grow">
            {#if $context.embed !== Embed.HANDSET && !isHideLeftNavBar && !isMaxMode}
              <LeftNav variant="fixed" isHidePanel={!!pop || !!mainPath} />
            {/if}
            <div class="min-w-0 flex-grow relative">
              {#if mainPath}
                <div class="absolute inset-0 w-full h-full bg-bgs1 z-40">
                  <ComponentResolver
                    path={mainPath}
                    params={{ isInline: true }}
                  />
                </div>
              {/if}
              {#if popId}
                <div
                  class="absolute inset-0 flex justify-center w-full h-full bg-bgs1 z-50"
                  data-testid="resource-record-surface"
                >
                  <ResourceResolver id={popId} accessMode={AccessMode.POP} />
                </div>
              {/if}
              {#if $hTrail.path.length > 0 && $hTrail.activated && (!$hTrail.isBaseNonRecord || ($hTrail.isBaseNonRecord && $hTrail.activated !== $hTrail.path[0]))}
                <Trail />
              {:else}
                <AppSplitView>
                  {@render main?.()}
                  {#if !main}
                    {@render children?.()}
                  {/if}
                </AppSplitView>
              {/if}
            </div>
            {#if !$view.isConstrainedWidth && rightPanel}
              <RightPanel action={rightPanel} />
            {/if}
          </div>
          {#if $hTrail.path.length > 0 && !isHomePage}
            <BottomNav />
          {/if}
        </div>
      </div>
    </div>
  {/if}
{/if}
