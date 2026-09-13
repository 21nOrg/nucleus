<svelte:options runes={true} />

<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";
  import { subscription } from "@nucleum/application/subscription/subscription";

  import "@nucleum/application/composition/resource-hosts";
  import type { Snippet } from "svelte";
  import { onDestroy, onMount } from "svelte";
  import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";
  import { Persistence } from "@nucleum/persistence/persistence";
  import account from "@nucleum/stores/account.store";
  import { appLoadingState, appStore } from "@nucleum/stores/app.store";
  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import {
    confirmationNotification,
    toasts
  } from "@nucleum/stores/notification.store";
  import context from "@nucleum/stores/context.store";
  import DebugLayer from "@21n/layout/layers/debug/DebugLayer.svelte";
  import ModalLayer from "@21n/layout/layers/ModalLayer.svelte";
  import AnalyticsLayer from "@21n/layout/layers/analytics/AnalyticsLayer.svelte";
  import ShortcutRunner from "@nucleum/application/shortcuts/ShortcutRunner.svelte";
  import Intercom from "@21n/layout/layers/Intercom.svelte";
  import SyncLayer from "@21n/layout/layers/SyncLayer.svelte";
  import {
    isExtensionEnvironment,
    safeRequestIdleCallback
  } from "@21n/utils/browser.utils";
  import { AlertType } from "@nucleum/stores/notifications/notification.type";
  import AppLoadingView from "@21n/layout/paint/AppLoadingView.svelte";
  import DynamicMetadataLayer from "@21n/layout/layers/DynamicMetadataLayer.svelte";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { UserDataMode } from "@nucleum/client/runtime/account/account.type";
  import { getDapId } from "@nucleum/persistence/persistence.utils";
  import PageError from "@nucleum/application/error/PageError.svelte";
  import posthog from "posthog-js";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import { Action } from "@nucleum/client/config/action.enum";
  import { BillingCycle } from "@nucleum/schema/account/subscription";
  import { fileEmbedChannel } from "@nucleum/stores/files/fileEmbedChannel.store";
  import { fileStore } from "@nucleum/stores/files/file.store";
  import { ErrorMessage } from "@nucleum/stores/notifications/error.enum";
  import modalEvent from "@nucleum/stores/overlays/modal.store";
  import { PaymentProvider } from "@nucleum/schema/account/payment-provider";
  import { embedBridge } from "@nucleum/client/runtime/embed/embed.store";
  import { postMessageToParent } from "@nucleum/client/runtime/embed/embed.utils";
  import { EmbedMessage } from "@nucleum/client/runtime/embed/embedMessage.enum";
  import { OperatingSystem } from "@nucleum/client/runtime/context.type";
  import UserLayout from "@21n/layout/layers/UserLayout.svelte";
  import LegacyLocalDataRecoveryGate from "@21n/layout/layers/LegacyLocalDataRecoveryGate.svelte";
  import { compareVersions } from "@21n/shared-utils/utils";
  import { UIStateScope } from "@nucleum/stores/uiState/uiState.type";
  import { parse, stringify } from "@21n/shared-utils/json.utils";
  import { detectTimeZone, parseAndFormatDate } from "@21n/utils/time.utils";
  import { recentsStore } from "@nucleum/stores/resources/recent.store";
  import { resolveProductResources } from "@nucleum/datafn/resource.utils";
  import {
    datafn,
    nucleumDatafnStatus,
    initializeNucleumDatafn,
    cloneUpAllDatafnData,
    pullDatafnNow,
    reconcileDatafnNow,
    refreshNucleumDatafnStatus,
    type NucleumDatafnRuntime
  } from "@nucleum/datafn/datafn.store";
  import {
    convertLegacyLocalDataBackupToDatafnImport,
    completeLegacyLocalDataCloudUpload,
    detectLegacyLocalData,
    exportLegacyLocalData,
    getLegacyLocalDataRecoveryDecision,
    hasRecoverableLegacyLocalData,
    hasPendingLegacyLocalDataCloudUpload,
    normalizeLegacyDatafnImportIds,
    resolveLegacyLocalDataRecordCount,
    saveLegacyLocalDataRecoveryDecision,
    type LegacyLocalDataBackup,
    type LegacyLocalDataSummary
  } from "@nucleum/persistence/legacyLocalDataBackup";
  import type { DatafnImportResult } from "@nucleum/datafn/datafn.type";
  let {
    children,
    topnav: topnavContent,
    onReady
  }: {
    children?: Snippet;
    topnav?: Snippet;
    onReady?: () => void | Promise<void>;
  } = $props();
  const loadingMessages = {
    cloneUp: {
      message: "Syncing your local data with the cloud...",
      subMessage: "This might take a while."
    },
    pull: {
      message: "Syncing your data from cloud..."
    },
    cloneDown: {
      message: "First login detected. Syncing your data..."
    }
  };
  type LegacyRecoveryMode = "required" | "importing" | "downloading";
  let loadingMessage = $state<{
    message: string;
    subMessage?: string;
    duration?: number;
    percentage?: number;
  }>({
    message: ""
  });
  let isAppLoading = $state(false);
  let error = $state<string | null>(null);
  let legacyRecoveryMode = $state<LegacyRecoveryMode | null>(null);
  let legacyRecoveryError = $state<string | undefined>(undefined);
  let legacyLocalDataSummary = $state<LegacyLocalDataSummary | undefined>(
    undefined
  );
  let isLegacyCloudUploadPending = $state(false);
  let isLegacyCloudUploadInProgress = false;
  let dev_isDisableSyncOnAppear = false;
  let subs: any[] = [];
  let isStartupCompleted = false;
  const isDebug = import.meta.env?.DEV;

  $effect(() => {
    if (
      $nucleumDatafnStatus.nucleumMode === "sync" &&
      isLegacyCloudUploadPending
    ) {
      void uploadPendingLegacyCloudData();
    }
  });

  onMount(async () => {
    postMessageToParent(EmbedMessage.MOUNT);
    if ((<any>window).Intercom)
      (<any>window).Intercom("update", {
        hide_default_launcher: true
      });
    addWindowEventListeners();
    refreshUIStateDerived();
    const uiStateSub = uiState.subscribe(() => {
      refreshUIStateDerived();
    });
    subs.push(uiStateSub);

    const isLegacyRecoveryRequired = await prepareLegacyLocalDataRecoveryGate();
    if (!isLegacyRecoveryRequired) {
      await startApplication();
    }
  });

  function refreshUIStateDerived() {
    const interactionMode = uiState.getState(Action.MODE_OF_INTERACTION, {
      scope: UIStateScope.PRODUCT
    });
    $appStore.interactionMode = interactionMode;
  }

  async function prepareLegacyLocalDataRecoveryGate() {
    if ($context.isSheet || isExtensionEnvironment()) return false;
    try {
      isLegacyCloudUploadPending = await hasPendingLegacyLocalDataCloudUpload(
        $appStore.product
      );
      const summary = await detectLegacyLocalData($appStore.product);
      if (!summary.isSupported || !hasRecoverableLegacyLocalData(summary)) {
        return false;
      }
      const decision = await getLegacyLocalDataRecoveryDecision(
        $appStore.product,
        summary
      );
      if (decision) {
        isLegacyCloudUploadPending =
          isLegacyCloudUploadPending || Boolean(decision.isCloudUploadPending);
        return false;
      }
      legacyLocalDataSummary = summary;
      legacyRecoveryMode = "required";
      return true;
    } catch (error) {
      logger.error({ at: "prepareLegacyLocalDataRecoveryGate", error });
      return false;
    }
  }

  async function startApplication(options?: {
    isOfflinabilityEnabled?: boolean;
  }) {
    if (isStartupCompleted) return;
    const runtime = await initializeDatabase(options);
    if (runtime) {
      try {
        await completeApplicationStartup();
      } catch (startupError) {
        error = "Unable to initialize local data. Please try again later.";
        logger.error({ at: "startApplication", error: startupError });
      }
    }
  }

  async function completeApplicationStartup() {
    if (isStartupCompleted) return;
    await Promise.all([
      initializeUserConfig(),
      recentsStore.refresh(
        resolveProductResources($appStore.product, "search") ?? []
      )
    ]);
    $appLoadingState.isBaseLoaded = true;
    isStartupCompleted = true;
    if (typeof onReady === "function") {
      await onReady();
    }
    if ($context.isEmbed && $context.isSheet) {
      $appLoadingState.isLocalLoaded = true;
    }
    scheduleIdleMaintenance();
  }

  function scheduleIdleMaintenance() {
    safeRequestIdleCallback(async () => {
      if ($nucleumDatafnStatus.nucleumMode === "sync" && !isDebug) {
        await reconcileDatafnNow();
      }
      await refreshNucleumDatafnStatus();
      await syncAccountPaidPlanFromExternalProvider();
    });
  }

  async function handleImportLegacyLocalData() {
    if (!legacyLocalDataSummary || legacyRecoveryMode !== "required") return;
    legacyRecoveryMode = "importing";
    legacyRecoveryError = undefined;
    loadingMessage = {
      message: "Importing old local data...",
      subMessage: "Preparing a local backup first."
    };
    try {
      const backup = await exportLegacyLocalData($appStore.product);
      if (!backup?.databases.length) {
        legacyRecoveryMode = null;
        const runtime = await initializeDatabase();
        if (runtime) {
          await completeApplicationStartup();
        }
        return;
      }
      const runtime = await initializeDatabase({
        isOfflinabilityEnabled: true
      });
      if (!runtime) return;
      const importStats = await importLegacyLocalDataBackup(runtime, backup);
      const isCloudUploadPending =
        $account.dataMode === UserDataMode.CLOUD &&
        runtime.mode === "local-only";
      await saveLegacyLocalDataRecoveryDecision(
        {
          version: 1,
          product: $appStore.product,
          action: "import_old_data",
          decidedAt: new Date().toISOString(),
          backupExportedAt: backup.exportedAt,
          sourceRecordCount: resolveLegacyLocalDataRecordCount(backup),
          importedResourceCount: importStats.resources,
          importedJoinCount: importStats.joins,
          isCloudUploadPending
        },
        backup
      );
      isLegacyCloudUploadPending =
        isLegacyCloudUploadPending || isCloudUploadPending;
      legacyRecoveryMode = null;
      toasts.success("Old local data imported successfully");
      await completeApplicationStartup();
    } catch (error) {
      logger.error({ at: "handleImportLegacyLocalData", error });
      legacyRecoveryError =
        "Unable to import old local data. Download backup and continue is still available.";
      legacyRecoveryMode = "required";
    }
  }

  async function handleDownloadLegacyBackupAndContinue() {
    if (!legacyLocalDataSummary || legacyRecoveryMode === "importing") return;
    legacyRecoveryMode = "downloading";
    legacyRecoveryError = undefined;
    try {
      const backup = await exportLegacyLocalData($appStore.product);
      if (backup?.databases.length) {
        await downloadLegacyLocalBackup(backup);
        await saveLegacyLocalDataRecoveryDecision(
          {
            version: 1,
            product: $appStore.product,
            action: "download_backup_continue",
            decidedAt: new Date().toISOString(),
            backupExportedAt: backup.exportedAt,
            sourceRecordCount: resolveLegacyLocalDataRecordCount(backup)
          },
          backup
        );
        toasts.success("Legacy local backup downloaded successfully");
      }
      legacyRecoveryMode = null;
      await startApplication();
    } catch (error) {
      logger.error({ at: "handleDownloadLegacyBackupAndContinue", error });
      legacyRecoveryError = "Unable to download legacy local backup.";
      legacyRecoveryMode = "required";
    }
  }

  async function importLegacyLocalDataBackup(
    runtime: NucleumDatafnRuntime,
    backup: LegacyLocalDataBackup
  ) {
    if (!runtime.storage) {
      throw new Error("Local DataFn storage is required for legacy import");
    }
    const { kv = {}, ...payload } = normalizeLegacyDatafnImportIds(
      convertLegacyLocalDataBackupToDatafnImport(backup)
    );
    const hasStructuredRows =
      Object.values(payload.resources).some((records) => records.length > 0) ||
      Object.values(payload.joins ?? {}).some((records) => records.length > 0);
    let result: DatafnImportResult = { ok: true };
    if (hasStructuredRows) {
      result = (await datafn.importData(payload, {
        triggerCloneUp: runtime.mode === "sync"
      })) as DatafnImportResult;
      const skipped =
        countDatafnImportRows(result.stats?.resources, "skipped") +
        countDatafnImportRows(result.stats?.joins, "skipped");
      if (!result?.ok || skipped > 0) {
        throw new Error(
          result?.errors?.[0]?.message ??
            (skipped > 0
              ? "DataFn legacy import skipped records"
              : "DataFn legacy import failed")
        );
      }
    }
    for (const [key, value] of Object.entries(kv)) {
      const kvResult = await datafn.kv.set(key, value);
      if (!kvResult.ok) throw kvResult.error;
    }
    await refreshNucleumDatafnStatus();
    return {
      resources:
        countDatafnImportRows(result.stats?.resources, "imported") +
        Object.keys(kv).length,
      joins: countDatafnImportRows(result.stats?.joins, "imported")
    };
  }

  function countDatafnImportRows(
    stats: Record<string, { imported?: number; skipped?: number }> | undefined,
    field: "imported" | "skipped"
  ) {
    return (
      Object.values(stats ?? {}).reduce(
        (total, item) => total + (item[field] ?? 0),
        0
      ) ?? 0
    );
  }

  async function downloadLegacyLocalBackup(backup: LegacyLocalDataBackup) {
    const product = $appStore.product;
    const fileName = `${product}-legacy-local-backup-${parseAndFormatDate(new Date(), "iso-short")}.json`;
    const blob = new Blob([stringify(backup, { isPreventReplacer: true })], {
      type: "application/json"
    });
    const isDelivered = await fileStore.downloadFromBlob(blob, {
      fileName,
      fileNameForEmbed: `${product}_legacy_local_backup`,
      contentType: "application/json",
      isHandleEmbedCase: true
    });
    if (!isDelivered) {
      throw new Error("Legacy local backup delivery failed");
    }
  }

  /**
   * Disabled visibility change listener for onAppear() - using focus event instead as visibilitychange only get triggered when the tab is switched not the window.
   * @param event
   */
  const visibilityChangeListener = async (event: Event) => {
    if (document?.hidden) return;
    // await onAppear();
  };

  async function onAppear() {
    try {
      await uploadPendingLegacyCloudData();
      await refreshTimeZone();
      const isCloudUser = $nucleumDatafnStatus.nucleumMode === "sync";
      if (isCloudUser && !dev_isDisableSyncOnAppear) {
        await pullDatafnNow();
      }
      if (isExtensionEnvironment() || isDebug) return;
      performAppUpdateCheck();
      await refreshNucleumDatafnStatus();
    } catch (e) {
      logger.error({ at: "onAppear", error: e });
    }
  }

  async function refreshTimeZone() {
    if ($nucleumDatafnStatus.nucleumMode === null) return;
    const timeZone = detectTimeZone();
    if (!timeZone || !$userPreferences) return;
    const offset = timeZone.offset * 60;
    if (
      $userPreferences.timeZoneOffset === offset &&
      $userPreferences.timeZone === timeZone.zone
    ) {
      return;
    }
    logger.info({
      at: "refreshTimeZone - timezone change detected",
      timeZone
    });
    await userPreferences.setTimeZone(offset, timeZone.label, timeZone.zone);
  }

  async function uploadPendingLegacyCloudData() {
    if (
      !isLegacyCloudUploadPending ||
      isLegacyCloudUploadInProgress ||
      $nucleumDatafnStatus.nucleumMode !== "sync"
    ) {
      return;
    }
    isLegacyCloudUploadInProgress = true;
    try {
      await cloneUpAllDatafnData();
      await completeLegacyLocalDataCloudUpload($appStore.product);
      isLegacyCloudUploadPending = false;
    } catch (error) {
      logger.error({ at: "uploadPendingLegacyCloudData", error });
    } finally {
      isLegacyCloudUploadInProgress = false;
    }
  }

  /**
   * Checks if the app version on client is different from the version on server. If the versions are different, it will run the dbo update and prompt user to reload the app if it is a web app.
   */
  async function performAppUpdateCheck() {
    const versionOnClient = $appStore.version;
    await refreshAppStaticData();
    const latestVersion = resolveLatestVersion();
    if (!latestVersion || !versionOnClient) return;
    const comparer = compareVersions(latestVersion, versionOnClient);
    if (comparer > 0) {
      if ($context.isEmbed) {
        confirmationNotification.notify({
          title: `App update available (v${latestVersion}) 🎉`,
          message: "Please update the app to continue.",
          type: AlertType.INFO,
          confirmAction: {
            label: "Update",
            callback: async () => {
              if (
                $context.os === OperatingSystem.IOS ||
                $context.os === OperatingSystem.MACOS
              ) {
                return navigation.openLink(
                  $appStore.appData?.urls?.appStore ??
                    $appStore.appData?.urls?.docs ??
                    ""
                );
              } else if ($context.os === OperatingSystem.WINDOWS) {
                return navigation.openLink(
                  $appStore.appData?.urls?.microsoftStore ?? ""
                );
              } else if ($context.os === OperatingSystem.ANDROID) {
                return navigation.openLink(
                  $appStore.appData?.urls?.playStore ?? ""
                );
              }
            }
          }
        });
      } else {
        toasts.trigger({
          id: "appUpdateAvailable",
          title: `App update available (v${latestVersion}) 🎉`,
          type: AlertType.INFO,
          actionText: "Reload",
          callback: () => {
            window.location.reload();
          }
        });
      }
    }
    logger.log({
      at: "performAppUpdateCheck",
      versionOnClient,
      latestVersion,
      comparer
    });

    function resolveLatestVersion() {
      const availability = $appStore.appData?.availability;
      if (!availability) return;
      const ctx = !$context.isEmbed ? "web" : $context.os?.toLowerCase();
      const updated = availability[ctx];
      if (!updated) return;
      return updated;
    }
  }

  async function initializeDatabase(options?: {
    isOfflinabilityEnabled?: boolean;
  }) {
    try {
      const isLiteMode = $context.isSheet;
      logger.log({
        at: "UserBaseLayer.initializeData",
        isLiteMode,
        account: $account
      });
      if (!isLiteMode && !isDebug && !$context.isInOfflineMode) {
        await refreshAppStaticData();
      }
      const dapId = await getDapId();

      const hasUserSpace = Boolean($account.userId || $account.userInfo?.id);
      if ($account.dataMode !== UserDataMode.LOCAL && !hasUserSpace) {
        error = "User id not found. Please try again later.";
        return;
      }
      loadingMessage = loadingMessages.cloneDown;
      const runtime = await initializeNucleumDatafn({
        product: $appStore.product,
        account: $account,
        env: $appStore.env,
        appVersion: $appStore.version + "." + $appStore.build,
        dapId: dapId!,
        isOffline: $context.isInOfflineMode,
        isOfflinabilityEnabled: options?.isOfflinabilityEnabled
      });
      logger.log({
        at: "UserBaseLayer.initializeData - datafn",
        mode: runtime.mode,
        namespace: runtime.namespace,
        storageDbName: runtime.storageDbName,
        os: $context.os,
        isEmbed: $context.isEmbed,
        embed: $context.embed,
        userAgent: navigator.userAgent
      });
      return runtime;
    } catch (e) {
      error = "Unable to initialize local data. Please try again later.";
      logger.error({ at: "initializeDatabase", error: e });
    }
  }

  async function initializeUserConfig() {
    console.time("initializeUserConfig");
    const isLiteMode = $context.isSheet;
    if (
      ($nucleumDatafnStatus.nucleumMode === "sync" ||
        $nucleumDatafnStatus.nucleumMode === "sync-direct") &&
      !isLiteMode
    ) {
      setAnalyticsUserIdentity();
    }
    console.timeEnd("initializeUserConfig");
    function setAnalyticsUserIdentity() {
      if (!$account.userInfo) return;
      posthog.identify($account.userInfo.id, {
        region: $account.userInfo.region
      });
    }
  }

  /**
   * TODO - load static data (not from url)
   * Refreshes the app static data from the server.
   */
  async function refreshAppStaticData() {
    try {
      const appData = await new Persistence().fetchAppData($appStore.env);
      if (!appData) {
        throw new Error("App data not found");
      }
      appStore.loadAppData(appData);
    } catch (e) {
      logger.error({ at: "refreshAppStaticData", error: e });
    }
  }

  async function syncAccountPaidPlanFromExternalProvider() {
    if (
      $account.dataMode === UserDataMode.LOCAL ||
      !$account.plan?.provider ||
      $account.plan?.provider === PaymentProvider.SELF ||
      $account.plan?.cycle === BillingCycle.LIFETIME
    )
      return;
    const response = await subscription.modifySubscription({
      type: "sync"
    });
    if (response.userPlan) {
      subscription.handlePlanStatus(response.userPlan);
    }
  }

  function handlePersistAppearance(event: any) {
    userPreferences.setAppearance(event.detail);
  }

  function handleAppLoadingStatus(event: any) {
    logger.log({ at: "handleAppLoadingStatus", event });
    const detail = event.detail;
    if (detail.message || detail.subMessage) {
      isAppLoading = true;
    }
    if (detail.isFinished) {
      setTimeout(() => {
        isAppLoading = false;
      }, 500);
    }
    if (detail.message !== undefined) {
      loadingMessage.message = detail.message;
    }
    if (detail.subMessage !== undefined) {
      loadingMessage.subMessage = detail.subMessage;
    }
    if (detail.duration !== undefined) {
      loadingMessage.duration = detail.duration;
    }
    if (detail.percentage !== undefined) {
      loadingMessage.percentage = detail.percentage;
    }
  }

  function handleAddToRecents(event: any) {
    logger.log({ at: "handleAddToRecents", event });
    const { record, type, timestamp } = event.detail;
    recentsStore.add(record, { type, timestamp });
  }

  async function handleMessageFromParent(event: any) {
    try {
      if (!isTrustedNativeMessage(event)) return;
      if (event?.data?.type === "SWIFT_MESSAGE" && event?.data?.payload) {
        if (typeof event.data.payload !== "string") return;
        if (!event.data.payload.trim().startsWith("{")) return;
        const parsed = parse(event.data.payload);
        console.log({
          at: "handleMessageFromParent - SWIFT_MESSAGE",
          parsed
        });
        if (parsed.type === "PURCHASE_SUCCESS") {
          loadingMessage.message = "Verifying payment...";
          const response = await subscription.verifyPayment(
            parsed.nonce,
            parsed.embedTransaction
          );
          isAppLoading = false;
          modalEvent.hide(Action.USER_PLAN);
          if (response?.status === "success") {
            requireCommandHost().runAction(Action.PLAN_ONBOARDING);
          } else {
            toasts.error(ErrorMessage.DEFAULT);
          }
        } else if (parsed.type === "PURCHASE_ERROR") {
          isAppLoading = false;
          modalEvent.hide(Action.USER_PLAN);
          toasts.error(ErrorMessage.DEFAULT);
        } else if (parsed.type === "RESTORE_PURCHASE_SUCCESS") {
          const response = await subscription.modifySubscription({
            type: "sync",
            embedTransaction: parsed.embedTransaction
          });
        } else if (
          (parsed.type === "DOWNLOAD_SUCCESS" ||
            parsed.type === "DOWNLOAD_ERROR") &&
          parsed.id
        ) {
          fileEmbedChannel.setDownloadResult(
            parsed.id,
            parsed.type === "DOWNLOAD_SUCCESS"
          );
        } else if (parsed?.type && parsed?.id && parsed?.data) {
          embedBridge.setData(parsed.id, parsed.type, parsed.data);
        } else if (parsed?.id && parsed?.data) {
          fileEmbedChannel.setFile(parsed.id, parsed.data);
        }
      }
    } catch (e) {
      logger.error({
        at: "handleMessageFromParent",
        error: e,
        eventType: event?.data?.type,
        origin: event?.origin
      });
    }
  }

  function isTrustedNativeMessage(event: MessageEvent) {
    if (event?.data?.type !== "SWIFT_MESSAGE") return true;
    if (event.source !== window) return false;
    return event.origin === window.location.origin || event.origin === "null";
  }

  function addWindowEventListeners() {
    window.addEventListener(
      GlobalEvent.PERSIST_APPEARANCE_USER,
      handlePersistAppearance
    );
    window.addEventListener(
      GlobalEvent.APP_LOADING_STATUS,
      handleAppLoadingStatus
    );
    window.addEventListener(GlobalEvent.ADD_TO_RECENTS, handleAddToRecents);
    window.addEventListener("message", handleMessageFromParent);
    window.addEventListener("focus", onAppear);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("unload", handleBeforeUnload);
    document.addEventListener("visibilitychange", visibilityChangeListener);
  }
  function removeWindowEventListeners() {
    window.removeEventListener(
      GlobalEvent.PERSIST_APPEARANCE_USER,
      handlePersistAppearance
    );
    window.removeEventListener(
      GlobalEvent.APP_LOADING_STATUS,
      handleAppLoadingStatus
    );
    window.removeEventListener(GlobalEvent.ADD_TO_RECENTS, handleAddToRecents);
    window.removeEventListener("message", handleMessageFromParent);
    window.removeEventListener("focus", onAppear);
    window.removeEventListener("beforeunload", handleBeforeUnload);
    window.removeEventListener("unload", handleBeforeUnload);
    document.removeEventListener("visibilitychange", visibilityChangeListener);
  }
  function handleBeforeUnload(event: any) {
    if (
      !isDebug &&
      ($context.isInOfflineMode || $account.dataMode === UserDataMode.LOCAL)
    ) {
      event.preventDefault();
      event.returnValue = "";
      // confirmationNotification.notify({
      //   title: "You are offline.",
      //   message:
      //     "Reloading the page may not load the app again if you are not connected to the internet",
      //   type: AlertType.WARNING,
      //   confirmAction: {
      //     label: "Reload",
      //     callback: async () => {
      //       window.location.reload();
      //     }
      //   }
      // });
    }
  }
  onDestroy(() => {
    removeWindowEventListeners();
    subs.forEach((sub) => sub());
  });
</script>

{#if $appStore?.appData?.isAnalyticsEnabled && $account?.dataMode === UserDataMode.CLOUD && !$context.isInOfflineMode}
  <AnalyticsLayer />
{/if}
<div class="flex w-screen h-screen">
  {#if error}
    <PageError />
  {:else if legacyLocalDataSummary && legacyRecoveryMode}
    <LegacyLocalDataRecoveryGate
      summary={legacyLocalDataSummary}
      mode={legacyRecoveryMode}
      errorMessage={legacyRecoveryError}
      onImport={handleImportLegacyLocalData}
      onDownloadAndContinue={handleDownloadLegacyBackupAndContinue}
    />
  {:else if !$appLoadingState.isBaseLoaded || !$appLoadingState.isLocalLoaded || isAppLoading}
    <AppLoadingView
      message={loadingMessage.message}
      subMessage={loadingMessage.subMessage}
      duration={loadingMessage.duration}
      percentage={loadingMessage.percentage}
    />
  {:else}
    <UserLayout topnav={topnavContent}>
      {@render children?.()}
    </UserLayout>
  {/if}
</div>
{#if $appStore.isDebugMode}
  <DebugLayer />
{/if}
{#if $appLoadingState.isBaseLoaded}
  <DynamicMetadataLayer
    metadata={{
      title: $appStore?.appData?.name ?? $appStore?.product,
      ...$appStore?.appData?.meta
    }}
  />
  <ModalLayer />
  <ShortcutRunner />
  <SyncLayer />
{/if}
<Intercom />
