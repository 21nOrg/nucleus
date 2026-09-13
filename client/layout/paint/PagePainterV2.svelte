<svelte:options runes={true} />

<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/stores";
  import type { Page } from "@sveltejs/kit";
  import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";
  import { appStore } from "@nucleum/stores/app.store";
  import context from "@nucleum/stores/context.store";
  import type { IAction } from "@nucleum/client/config/action.type";
  import { onDestroy, onMount } from "svelte";
  import ComponentResolver from "@21n/layout/paint/ComponentResolver.svelte";
  import { resolveProductConfig } from "@nucleum/products/product.config";
  import view from "@nucleum/stores/view.store";

  let {
    prefix = undefined,
    cmdPageLaunch = undefined
  }: {
    prefix?: string;
    cmdPageLaunch?: string;
  } = $props();

  let action = $state<IAction | null>(null);
  let pageSub: any;
  let pendingRefreshes = $state<number[]>([]);
  const fileBasedRoutes = ["cparchived"];
  const productConfig = resolveProductConfig();
  function resolvePath(pageData?: Page) {
    if (cmdPageLaunch) {
      return cmdPageLaunch;
    }
    if ($context.isSheet) {
      return $appStore.sheetPath;
    }
    let currentPath =
      pageData?.url?.pathname ??
      (typeof window !== "undefined" ? window.location.pathname : "");
    currentPath = currentPath.replace(/^\/+|\/+$/g, "");
    if (prefix) {
      currentPath = prefix + "/" + currentPath;
    }
    return currentPath?.endsWith("/") ? currentPath.slice(0, -1) : currentPath;
  }

  function queueRefresh() {
    [0, 50, 200].forEach((delay) => {
      const timeoutId = window.setTimeout(() => {
        refresh();
        pendingRefreshes = pendingRefreshes.filter((id) => id !== timeoutId);
      }, delay);
      pendingRefreshes = [...pendingRefreshes, timeoutId];
    });
  }

  afterNavigate(() => {
    queueRefresh();
  });

  onMount(() => {
    const refreshFromWindow = () => {
      queueRefresh();
    };
    pageSub = page.subscribe(async (pageData) => {
      await refresh(pageData);
    });
    window.addEventListener("popstate", refreshFromWindow);
    window.addEventListener(GlobalEvent.CUSTOM_NAVIGATION, refreshFromWindow);
    queueRefresh();
    return () => {
      pageSub?.();
      window.removeEventListener("popstate", refreshFromWindow);
      window.removeEventListener(
        GlobalEvent.CUSTOM_NAVIGATION,
        refreshFromWindow
      );
      pendingRefreshes.forEach((id) => window.clearTimeout(id));
      pendingRefreshes = [];
    };
  });
  onDestroy(() => {
    pageSub?.();
  });
  async function refresh(pageData?: Page) {
    const path = resolvePath(pageData);
    if (
      fileBasedRoutes.some((x) => window.location.pathname.startsWith("/" + x))
    ) {
      return;
    }
    if (path === "" || path === "index.html") {
      const homePath = $view.isPortrait
        ? productConfig.homePathPt
        : productConfig.homePath;
      navigation.gotoPath(homePath);
      return;
    } else if (!path) {
      navigation.gotoPath("/404");
      return;
    }

    action = appStore.resolveComponentFromPath(path);

    if (!action) {
      if (path === "index.html") navigation.gotoPath("/");
      else navigation.gotoPath("/404", { queryParams: { path } });
      return;
    }
    $appStore.currentComponent = action;
    $appStore.isMenuHidden = action.isMenuHidden || $context.isSheet;
  }
</script>

{#if action}
  <ComponentResolver {action} params={action.componentParams} />
{/if}
