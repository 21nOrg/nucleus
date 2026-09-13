<svelte:options runes={true} />

<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { LayoutContext } from "@21n/layout/layout-mode.type";
  import { onMount } from "svelte";
  import AppMenuSwitcherItem from "@21n/layout/leftPanel/appMenuSwitcher/AppMenuSwitcherItem.svelte";
  import { ActionType, type IAction } from "@nucleum/client/config/action.type";
  import CaptureComponent from "@nucleum/application/CaptureComponent.svelte";
  import { appStore, isInEditMode } from "@nucleum/stores/app.store";
  import { appMenuStore } from "@21n/layout/navigation/app-menu.store";
  import type { IAppMenuStore } from "@21n/layout/navigation/app-menu.type";
  import { toasts } from "@nucleum/stores/notification.store";
  import { appEvents } from "@nucleum/stores/events/app-events.store";
  import Divider from "@21n/elements/Divider.svelte";
  import { ColorStrength } from "@21n/theme/appearance.type";
  import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";
  import view from "@nucleum/stores/view.store";
  import { cn } from "@21n/utils/ui.utils";
  import AppMenuSwitcherItemGroup from "@21n/layout/leftPanel/appMenuSwitcher/AppMenuSwitcherItemGroup.svelte";
  import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
  import { resourceAction } from "@nucleum/datafn/resource.utils";
  import { resolveProductConfig } from "@nucleum/products/product.config";
  import type { Resource } from "@nucleum/datafn/resource.enum";
  import { hTrail, vTrail } from "@21n/layout/topNav/tabs/tabs.store";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  let {
    layoutContext = LayoutContext.DEFAULT,
    parentBackgroundIndex,
    isHovered = false
  }: {
    layoutContext?: LayoutContext;
    parentBackgroundIndex: number;
    isHovered?: boolean;
  } = $props();
  let allPages = $state<IAction[]>([]);
  let defaultPages = $state<IAction[]>([]);
  let userPinnedPages = $state<IAction[]>([]);
  let current = $state("");
  const productConfig = resolveProductConfig();
  const isEnableUserPinnedPages = false;

  refresh(appMenuStore.get());
  onMount(() => {
    const unsubscribe = appMenuStore.subscribe((x: IAppMenuStore) => {
      refresh(x);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  });

  function refresh(x: IAppMenuStore) {
    allPages = [];
    let items = [];
    const app = $appStore.product;
    let defaultMenu = productConfig.appMenu;
    if ($view.isConstrainedWidth || $view.isPortrait) {
      defaultMenu = productConfig.appMenuPt;
    }
    let userPinnedMenu: string[] = [];
    if (!$view.isConstrainedWidth) userPinnedMenu = x[app]?.user ?? [];
    userPinnedMenu = userPinnedMenu
      .filter((x) => x && !x.includes("browse"))
      .map((x) => resourceAction(x as Resource, ResourceActionType.BROWSE));
    const contextualMenu = [...defaultMenu, ...userPinnedMenu];
    // console.log({ defaultMenu, contextualMenu });
    if (layoutContext === LayoutContext.PORTRAIT) {
      items = contextualMenu.slice(
        0,
        productConfig.isShowCaptureOnMobile ? 3 : 4
      );
      items.push("cp");
    } else {
      items = contextualMenu.filter((item) => item !== "cp");
    }
    items.forEach((action: string) => {
      const currentPage = requireCommandHost().resolveAction(action);
      if (currentPage) {
        allPages.push(currentPage);
      }
    });
    defaultPages = allPages.filter((x) => defaultMenu.includes(x.action));
    userPinnedPages = allPages
      .filter((x) => userPinnedMenu.includes(x.action))
      .filter((x) => x);
    if (layoutContext != LayoutContext.PORTRAIT) {
    }
    let currentPath = window?.location?.pathname?.replace("/", "");
    let currentPage = allPages.find((item) =>
      currentPath.includes(item.path ?? item.action)
    );
    current = currentPage ? currentPage.action : "";
  }

  function onClick(item: IAction) {
    if (layoutContext == LayoutContext.PORTRAIT) {
      toasts.reset();
    }
    isInEditMode.set(false);
    hTrail.clear();
    vTrail.clear();
    const currentPath = window.location.pathname.replace("/", "");
    const resolvedCurrent =
      allPages.find((pageItem) =>
        currentPath.includes(pageItem.path ?? pageItem.action)
      )?.action ?? "";
    const isActivePageWithRightPanel =
      resolvedCurrent === item.action &&
      item.type === ActionType.PAGE &&
      Boolean(new URL(window.location.href).searchParams.get(AccessMode.RIGHT));
    if (
      resolvedCurrent !== item.action ||
      window.location.pathname.includes("/tab") ||
      item.type !== ActionType.PAGE ||
      isActivePageWithRightPanel
    ) {
      requireCommandHost().runAction(item.action);
    }
    current = item.action;
    appEvents.publish(GlobalEvent.APP_MENU_SWITCHED, item.action);
  }

  function onClickFromGroup(e: CustomEvent<IAction>) {
    onClick(e.detail);
  }
</script>

{#if layoutContext === LayoutContext.PORTRAIT}
  <div
    id="app-menu"
    class={cn("flex justify-around items-center min-w-min w-full", {
      "px-2": allPages.length < 4
    })}
  >
    {#each allPages as item, index (item.action)}
      {#if index == Math.floor(allPages.length / 2) && productConfig.isShowCaptureOnMobile}
        <CaptureComponent />
      {/if}
      <AppMenuSwitcherItem
        {parentBackgroundIndex}
        {layoutContext}
        onClick={() => onClick(item)}
        {item}
      />
    {/each}
  </div>
{:else}
  <div
    id="app-menu"
    class={cn("flex flex-col justify-center rounded-lg min-w-min w-full", {
      "gap-3": layoutContext === LayoutContext.THIN_WITH_LABEL,
      "gap-1": layoutContext !== LayoutContext.THIN_WITH_LABEL
    })}
  >
    <AppMenuSwitcherItemGroup
      {parentBackgroundIndex}
      {layoutContext}
      items={defaultPages}
      {onClick}
    />
    {#if isEnableUserPinnedPages && userPinnedPages.length > 0}
      <div
        class={cn("flex flex-col", {
          "gap-3": layoutContext === LayoutContext.THIN_WITH_LABEL,
          "gap-1": layoutContext !== LayoutContext.THIN_WITH_LABEL
        })}
      >
        <div class="w-full flex justify-center">
          <div class="w-1/2">
            <Divider colorStrength={ColorStrength.Strong} />
          </div>
        </div>
        <AppMenuSwitcherItemGroup
          {parentBackgroundIndex}
          {layoutContext}
          items={userPinnedPages}
          {onClick}
        />
      </div>
    {/if}
  </div>
{/if}
