<svelte:options runes={true} />

<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import "@nucleum/application/composition/resource-hosts";
  import type { Snippet } from "svelte";
  import { onMount, onDestroy, setContext } from "svelte";
  import { PRODUCT_NAV_CONTEXT } from "@nucleum/client/config/product-nav.config";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";
  import {
    Embed,
    OperatingSystem,
    type IAppContext
  } from "@nucleum/client/runtime/context.type";
  import {
    pingParent,
    postDataToParent
  } from "@nucleum/client/runtime/embed/embed.utils";
  import account from "@nucleum/stores/account.store";
  import { appStore, currentTime } from "@nucleum/stores/app.store";
  import { toasts } from "@nucleum/stores/notification.store";
  import context from "@nucleum/stores/context.store";
  import ThemeLayer from "@21n/layout/layers/themeLayer/ThemeLayer.svelte";
  import { detectSystemOS, detectTouchDevice } from "@21n/utils/browser.utils";
  import { extractProduct } from "@21n/shared-utils/utils";
  import { AlertType } from "@nucleum/stores/notifications/notification.type";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { LogType } from "@nucleum/client/runtime/logging/log.type";
  import {
    clientStorage,
    getDapId
  } from "@nucleum/persistence/persistence.utils";
  import { ClientStorageKey } from "@nucleum/persistence/persistence.type";
  import { cn } from "@21n/utils/ui.utils";
  import appearance from "@nucleum/stores/appearance.store";
  import MetadataLayer from "@21n/layout/layers/MetadataLayer.svelte";
  import PosthogTelemetry from "@21n/layout/layers/analytics/PosthogTelemetry.svelte";
  import dynamicProductData from "$lib/product.json";
  import { getSettingsAsModal } from "@21n/layout/settingsActionMap";
  import { globalActions } from "@nucleum/application/commandBar/actionMap";
  import { EmbedDataMessage } from "@nucleum/client/runtime/embed/embedMessage.enum";
  import { updateNucleumDatafnConnectivity } from "@nucleum/datafn/datafn.store";
  import { parse } from "@21n/shared-utils/json.utils";
  import { productData } from "@nucleum/products/product.resolver";
  import {
    product,
    resolveProductConfig
  } from "@nucleum/products/product.config";
  import view from "@nucleum/stores/view.store";
  import { initDevLogCapture } from "@nucleum/application/debug/devLogCapture";

  let { children }: { children?: Snippet } = $props();
  let timer: any;
  let isMounted = $state(false);
  let lastOrientation: "portrait" | "landscape" | null = null;
  const productConfig = resolveProductConfig();
  setContext(PRODUCT_NAV_CONTEXT, productConfig);

  onMount(async () => {
    if (browser) {
      initDevLogCapture({ product });
      pingParent();
      addWindowEventListeners();
    }
    try {
      await bootup();
    } catch (e) {
      logger.error({ at: "BaseLayer.onMount", error: e });
    } finally {
      isMounted = true;
    }
  });
  onDestroy(() => {
    clearInterval(timer);
  });

  const visibilityChangeListener = async (event: Event) => {
    if (document?.hidden) return;
    pingParent();
  };
  /**
   * Sets up the app for the first time when the app is loaded.
   *
   * Note: The order of operations is important as later operations rely on earlier ones.
   */
  async function bootup() {
    setAppVersion();
    await account.init();
    await setLaunchContext();
    initActions();
    runCurrentTime();
    navigation.setCurrentPath(window.location.pathname);
    initializeServiceWorker();
    await checkForEnvironmentChange();
    function runCurrentTime() {
      clearInterval(timer);
      timer = setInterval(() => {
        $currentTime = new Date();
      }, 1000);
    }
    function initializeServiceWorker() {
      if (!browser || $context.isEmbed) return;
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
        logger.debug({
          at: "BaseLayer.sw.register",
          message: "Service workers not supported"
        });
        return;
      }

      navigator.serviceWorker
        .register("/worker.js")
        .then((registration) => {
          logger.debug({
            at: "BaseLayer.sw.register",
            message: "Service worker registered",
            registration
          });
        })
        .catch((error) => {
          logger.error({
            at: "BaseLayer.sw.register",
            error,
            message: "Service worker registration failed"
          });
          if (error.name === "NetworkError") {
            logger.error({
              at: "BaseLayer.sw.register",
              message:
                "Network error during SW registration - offline features may be limited"
            });
          }
        });
    }
  }

  function initActions() {
    const isSheet = $context.isSheet;
    const localActions = productData.actions;
    const modifiedGlobalActions = globalActions.filter(
      (x) => !localActions.some((y) => y.action === x.action)
    );
    let actions = [...localActions, ...modifiedGlobalActions];
    if (isSheet) appStore.initActionsForSheet(actions);
    else appStore.initActions(actions, getSettingsAsModal());
  }

  function setAppVersion() {
    appStore.setVersion(productData.version, productData.build);
  }

  /**
   * Sets the launch context of the app. This includes the product, debug mode, embed mode, touch device, protocol, and OS.
   */
  async function setLaunchContext() {
    try {
      const dapId = await getDapId();
      $context.dapId = dapId;
      const appDataFromUrl = extractProduct(resolveLaunchHost());
      const appDetails = {
        product,
        env: appDataFromUrl.env ?? "live"
      };
      if (appDetails) appStore.initializeProductInformation(appDetails);
      const cachedAppData = await clientStorage.get(ClientStorageKey.APP_DATA);
      const cachedAppDataJson = parse(cachedAppData ?? "{}");

      let data =
        cachedAppDataJson &&
        cachedAppDataJson?.dataVersion >= dynamicProductData?.dataVersion
          ? {
              ...cachedAppDataJson
            }
          : {
              ...dynamicProductData
            };
      data = {
        ...data,
        name: productConfig.name,
        version: productData.version,
        build: productData.build
      };
      appStore.loadAppData(data, {
        isDefaultData: true
      });
      clientStorage.set(
        ClientStorageKey.PRODUCT,
        appDetails?.product ?? "tidigit"
      );
      let isDebugMode =
        $page.url?.searchParams?.get("debug") ||
        import.meta.env?.VITE_DEBUG_MODE === "true";
      if (isDebugMode) {
        $appStore.isDebugMode = true;
      }
      const isDebugEmbedMode = import.meta.env?.VITE_IS_DEBUG_EMBED === "true";
      let browserAgent = navigator?.userAgent;
      if (isDebugEmbedMode || browserAgent.includes("embed")) {
        $context.isEmbed = true;
      }
      const isDebugHandheldMode =
        import.meta.env?.VITE_IS_DEBUG_HANDSET === "true";
      if (browserAgent.includes("handset") || isDebugHandheldMode) {
        $context.embed = Embed.HANDSET;
      } else if (browserAgent.includes("tablet")) {
        $context.embed = Embed.TABLET;
      } else {
        $context.embed = Embed.DESKTOP;
      }
      let isSheet = $page.url?.searchParams?.get("isSheet");
      let sheetPath = $page.url?.searchParams?.get("spath");
      if (isSheet) {
        $context.isSheet = true;
        if (sheetPath) $appStore.sheetPath = sheetPath;
      }
      $context.os = detectSystemOS();
      $context.isTouchDevice = detectTouchDevice();
      $context.protocol = window.location.protocol;
      const isInOfflineMode = await clientStorage.get(
        ClientStorageKey.OFFLINE_MODE
      );
      $context.isInOfflineMode =
        isInOfflineMode === "true" || !navigator.onLine;
      const isInLowDataMode = await clientStorage.get(
        ClientStorageKey.LOW_DATA_MODE
      );
      if (isInLowDataMode)
        $context.isInLowDataMode = isInLowDataMode === "true";
      initUserAgentClasses($context);
      updateOrientationClasses();
    } catch (e) {
      const errorMessage =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : JSON.stringify(e);

      postDataToParent(EmbedDataMessage.ERROR, {
        type: "ERROR",
        message: errorMessage
      });
    }
  }

  function initUserAgentClasses(ctx: IAppContext) {
    const userAgent = navigator.userAgent;
    const html = document.documentElement;

    if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
      html.classList.add("browser-safari");
    }
    if (userAgent.includes("Chrome")) html.classList.add("browser-chrome");
    if (userAgent.includes("Firefox")) html.classList.add("browser-firefox");
    if (ctx.os === OperatingSystem.IOS) html.classList.add("os-ios");
    else if (ctx.os === OperatingSystem.ANDROID)
      html.classList.add("os-android");
    else if (ctx.os === OperatingSystem.MACOS) html.classList.add("os-macos");
    else if (ctx.os === OperatingSystem.WINDOWS)
      html.classList.add("os-windows");
    else if (ctx.os === OperatingSystem.LINUX) html.classList.add("os-linux");

    if (userAgent.includes("embed")) {
      html.classList.add("embed");
      if (userAgent.includes("handset")) html.classList.add("embed-handset");
      if (userAgent.includes("tablet")) html.classList.add("embed-tablet");
    }
  }

  function updateOrientationClasses(): boolean {
    const html = document.documentElement;
    const isPortrait = window.innerHeight > window.innerWidth;
    const currentOrientation = isPortrait ? "portrait" : "landscape";

    const hasOrientationChanged =
      lastOrientation !== null && lastOrientation !== currentOrientation;
    lastOrientation = currentOrientation;

    html.classList.remove("device-portrait", "device-landscape");

    if (isPortrait) {
      html.classList.add("device-portrait");
    } else {
      html.classList.add("device-landscape");
    }

    return hasOrientationChanged;
  }

  /**
   * Checks if the environment has changed and signs out the user if the environment has changed to avoid issues of using the cached token and 401 errors.
   */
  async function checkForEnvironmentChange() {
    const envCachedOnMachine = await clientStorage.get(ClientStorageKey.ENV);
    if (envCachedOnMachine === null) {
      clientStorage.set(ClientStorageKey.ENV, $appStore.env);
      return;
    }
    const cachedEnv = normalizeEnvForComparison(envCachedOnMachine);
    const currentEnv = normalizeEnvForComparison($appStore.env);
    if (envCachedOnMachine && currentEnv !== cachedEnv) {
      clientStorage.set(ClientStorageKey.ENV, $appStore.env);
      logger.log(
        {
          at: "checkForEnvironmentChange",
          message: "Environment changed. Signing out user.",
          envCachedOnMachine,
          env: $appStore.env
        },
        LogType.INFO
      );
      await account.signOut();
      return;
    }
    if (envCachedOnMachine !== $appStore.env) {
      clientStorage.set(ClientStorageKey.ENV, $appStore.env);
    }
  }

  function resolveLaunchHost() {
    if (isHttpBrowserLocation()) {
      return window.location.host;
    }
    return (
      import.meta.env?.VITE_HOST ??
      (typeof process !== "undefined"
        ? process.env?.PLASMO_PUBLIC_APP_URL
        : undefined) ??
      window.location.host
    );
  }

  function isHttpBrowserLocation() {
    return (
      typeof window !== "undefined" &&
      (window.location.protocol === "http:" ||
        window.location.protocol === "https:")
    );
  }

  function normalizeEnvForComparison(env: string | null | undefined) {
    if (isLocalDevelopmentHost() && (env === "landing" || env === "local")) {
      return "local";
    }
    return env;
  }

  function isLocalDevelopmentHost() {
    const host = window.location.hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".localhost") ||
      host.startsWith("local.")
    );
  }

  function handleUnhandledRejection(event: any) {
    logger.error({
      at: "GlobalPromiseErrorHandler",
      error: event.reason,
      message: event.reason?.message || "Unhandled Promise Rejection"
    });
    event.preventDefault();
  }

  function setupGlobalErrorHandler() {
    // For synchronous errors
    window.onerror = (message, source, lineno, colno, error) => {
      logger.error({
        at: "GlobalErrorHandler",
        error: error,
        message,
        source,
        lineno,
        colno
      });

      // Return true to prevent the error from bubbling up and crashing the app
      return true;
    };
  }

  function handleCustomNavigation(event: any) {
    logger.log({
      at: "handleCustomNavigation",
      event,
      path: event.detail?.path
    });
    logger.info({
      at: "BaseLayer.handleCustomNavigation",
      path: event.detail?.path,
      isReload: event.detail?.isReload,
      replaceState: event.detail?.replaceState,
      currentPath: window.location.pathname,
      protocol: window.location.protocol,
      isEmbed: $context.isEmbed
    });
    if (event.detail?.isReload) {
      if (!$context.isEmbed) window.location.reload();
      else {
        goto(
          (import.meta.env?.VITE_CUSTOM_PROTOCOL ?? "tauri") +
            "://localhost/index.html"
        );
        // postToParent({ reload: true });
      }
    }
    const host = window.location.host;
    if (
      event.detail.path &&
      ((event.detail.path.includes("http") &&
        event.detail.path.includes(host) &&
        !event.detail.path.includes("/oauth/")) ||
        !event.detail.path.includes("http")) &&
      !event.detail.path.includes("mailto:") &&
      !event.detail.path.includes("//oauthsignin")
    ) {
      goto(event.detail.path, {
        replaceState: event.detail?.replaceState ?? false
      });
    } else if (event.detail.path) window.location = event.detail.path;
  }

  /**
   * Handles custom alert events from the app like network.utils and similar files where stores are directly used.
   *
   *
   * Disabling network error message for embed mode as on iOS and macOS app, sometimes the network call is failing with error "Load Failed" - which is only happening on iOS and macOS embed scenarios.
   * TODO - further investigation is required to understand the root cause of this issue.
   *
   * @param event
   */
  function handleCustomAlert(event: any) {
    try {
      if (event.detail) {
        logger.info({ at: "handleCustomAlert", detail: event.detail });
      }
      if (event.detail?.error === "networkerror") {
        if (
          $context.isEmbed &&
          event.detail.message?.toLowerCase()?.includes("load failed")
        ) {
          return;
        }
        toasts.trigger({
          title: "Network Error",
          message: event.detail.message ?? "Something went wrong.",
          type: AlertType.ERROR,
          id: "networkerror",
          isNonDismissable: true
        });
      }
    } catch (e) {
      logger.error({ at: "handleCustomAlert", error: e });
    }
  }

  function handleToggleSearchParam(event: any) {
    navigation.toggleSearchParam(event.detail);
  }

  async function updateOnlineStatus() {
    try {
      const storedOfflineMode = await clientStorage.get(
        ClientStorageKey.OFFLINE_MODE
      );
      const isOffline =
        String(storedOfflineMode) === "true" || !navigator.onLine;
      $context.isInOfflineMode = isOffline;
      await updateNucleumDatafnConnectivity(isOffline);
    } catch (error) {
      logger.error({ at: "BaseLayer.updateOnlineStatus", error });
    }
  }

  function handleMessageFromChromeWebview(event: any) {
    const messageFromChromeWebView = event.data;
    logger.debug({
      at: "handleMessageFromChromeWebview",
      message: "Received from Chrome Webview",
      data: messageFromChromeWebView
    });
  }

  function handleViewportChange() {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const hasKeyboard = window.innerHeight > viewport.height;
    if (hasKeyboard) {
      document.documentElement.style.setProperty(
        "--viewport-height",
        `${viewport.height}px`
      );
    } else {
      document.documentElement.style.removeProperty("--viewport-height");
    }
  }

  const windowResizeListener = (event: Event) => {
    view.refresh(window.innerWidth, window.innerHeight);
    const hasOrientationChanged = updateOrientationClasses();
    if (hasOrientationChanged) {
      navigation.gotoPath("/");
    }
  };

  const handleScreenOrientationChange = () => {
    setTimeout(() => {
      view.refresh(window.innerWidth, window.innerHeight);
      updateOrientationClasses();
      navigation.gotoPath("/");
    }, 100);
  };

  function addWindowEventListeners() {
    // setupGlobalErrorHandler();
    // window.addEventListener("unhandledrejection", handleUnhandledRejection);
    document.addEventListener("visibilitychange", visibilityChangeListener);
    window.addEventListener(
      GlobalEvent.CUSTOM_NAVIGATION,
      handleCustomNavigation
    );
    window.addEventListener(GlobalEvent.CUSTOM_ALERT, handleCustomAlert);
    window.addEventListener(
      GlobalEvent.TOGGLE_SEARCH_PARAM,
      handleToggleSearchParam
    );
    window.onpopstate = () => {
      navigation.setCurrentPath(document.location.pathname);
    };
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    window.addEventListener("resize", windowResizeListener);
    window.addEventListener("click", handlePlaceholderClick as EventListener);
    // try {
    //   //@ts-ignore
    //   window.chrome.webview.addEventListener(
    //     "message",
    //     handleMessageFromChromeWebview
    //   );
    // } catch (error) {
    //   logger.error({
    //     at: "BaseLayer.addWindowEventListeners - webview listener",
    //     error
    //   });
    // }
    if ("visualViewport" in window) {
      const viewport = window.visualViewport;
      viewport?.addEventListener("resize", handleViewportChange);
      viewport?.addEventListener("scroll", handleViewportChange);
    }

    if (screen?.orientation) {
      screen.orientation.addEventListener(
        "change",
        handleScreenOrientationChange
      );
    }
  }
  function removeWindowEventListeners() {
    // window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    document.removeEventListener("visibilitychange", visibilityChangeListener);
    window.removeEventListener(
      GlobalEvent.CUSTOM_NAVIGATION,
      handleCustomNavigation
    );
    window.removeEventListener(GlobalEvent.CUSTOM_ALERT, handleCustomAlert);
    window.removeEventListener(
      GlobalEvent.TOGGLE_SEARCH_PARAM,
      handleToggleSearchParam
    );
    window.onpopstate = null;
    window.removeEventListener("online", updateOnlineStatus);
    window.removeEventListener("offline", updateOnlineStatus);
    window.removeEventListener("resize", windowResizeListener);
    window.removeEventListener(
      "click",
      handlePlaceholderClick as EventListener
    );
    if ("visualViewport" in window) {
      const viewport = window.visualViewport;
      viewport?.removeEventListener("resize", handleViewportChange);
      viewport?.removeEventListener("scroll", handleViewportChange);
    }
    // try {
    //   //@ts-ignore
    //   window.chrome.webview.removeEventListener(
    //     "message",
    //     handleMessageFromChromeWebview
    //   );
    // } catch (error) {
    //   logger.error({
    //     at: "BaseLayer.removeWindowEventListeners - webview listener",
    //     error
    //   });
    // }

    if (screen?.orientation) {
      screen.orientation.removeEventListener(
        "change",
        handleScreenOrientationChange
      );
    }
  }

  function handlePlaceholderClick(event: Event) {
    const target = event.target as HTMLElement | null;
    if (target?.tagName === "PLACEHOLDER" && target.dataset?.href) {
      navigation.openLink(target.dataset.href);
    }
  }
  onDestroy(() => {
    removeWindowEventListeners();
  });
</script>

<div
  id="base"
  class={cn(
    "text-base text-fgs1 bg-bgs1 relative w-screen h-screen flex",
    $appearance.theme,
    $appearance.colorScheme.tailwindSelector
  )}
>
  <MetadataLayer />
  <ThemeLayer>
    {#if isMounted}
      {@render children?.()}
    {/if}
    <div id="popovers"></div>
    <div id="secondary-popovers"></div>
    <div id="tooltips"></div>
    <div id="toolbars"></div>
  </ThemeLayer>
</div>
{#if import.meta.env.VITE_NATIVE_EMBED !== "true"}
  <PosthogTelemetry />
{/if}
