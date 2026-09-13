<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import Icon from "@21n/elements/Icon.svelte";
  import Button from "@21n/elements/button/Button.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import view from "@nucleum/stores/view.store";
  import DebugInfoItem from "@21n/layout/layers/debug/DebugInfoItem.svelte";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { LogType } from "@nucleum/client/runtime/logging/log.type";
  import appearance from "@nucleum/stores/appearance.store";
  import Divider from "@21n/elements/Divider.svelte";
  import { ColorStrength } from "@21n/theme/appearance.type";
  import { Size } from "@21n/elements/size.enum";
  import context from "@nucleum/stores/context.store";
  import { cn } from "@21n/utils/ui.utils";
  import account from "@nucleum/stores/account.store";

  import { FallbackTracker } from "@21n/utils/fallbackTracker.utils";
  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  let { isShowAsPage = false }: { isShowAsPage?: boolean } = $props();
  let isShowDebugOverlay: boolean = false;
  let environment: string = $appStore.env;
  let isShowLogs: boolean = false;
  const defaultLogLevel = logger.level ?? LogType.INFO;
  let isTraceLoggingEnabled = logger.level >= LogType.TRACE;
  let isDboUpdateInProgress: boolean = false;
  let storageQuota: number | undefined;
  let storageUsage: number | undefined;
  let fallbackStatuses: any = {};
  let isShowFallbacks: boolean = false;
  checkStorage();
  loadFallbackStatuses();
  function checkStorage() {
    try {
      navigator.storage.estimate().then((estimate) => {
        console.log(`Using ${estimate.usage} out of ${estimate.quota} bytes.`);
        storageQuota = estimate.quota;
        storageUsage = estimate.usage;
      });
    } catch (e) {
      console.log("Storage estimate not supported");
    }
  }
  function clearCache() {
    account.signOut();
  }
  async function loadFallbackStatuses() {
    try {
      fallbackStatuses = await FallbackTracker.getAll();
    } catch (error) {
      console.error("Failed to load fallback statuses:", error);
      fallbackStatuses = {};
    }
  }
  async function resetAllFallbacks() {
    try {
      await FallbackTracker.resetAll();
      await loadFallbackStatuses();
    } catch (error) {
      console.error("Failed to reset fallbacks:", error);
    }
  }

  function toggleTraceLogging() {
    console.log("toggleTraceLogging", isTraceLoggingEnabled, defaultLogLevel);
    if (isTraceLoggingEnabled) {
      logger.setDefaultLevel();
      isTraceLoggingEnabled = logger.level >= LogType.TRACE;
    } else {
      logger.setLevel(LogType.TRACE);
      isTraceLoggingEnabled = true;
    }
  }
</script>

{#if isShowDebugOverlay || isShowAsPage}
  <div
    class={cn("flex flex-col gap-2 p-2 dp:p-8 text-fgs1", {
      "absolute z-50 bottom-20 right-0 bg-bgs3 rounded-lg": !isShowAsPage,
      "w-full h-full": isShowAsPage
    })}
  >
    {#if !isShowAsPage}
      <button
        class="absolute top-0 right-0 flex flex-col p-1 bg-bgs3 text-fgs1 rounded-lg z-50"
        onclick={() => (isShowDebugOverlay = false)}
      >
        <Icon icon="minus-circle" />
      </button>
    {/if}
    <DebugInfoItem
      label="Context"
      value={` isEmbed: ${$context.isEmbed}, isSheet: ${$context.isSheet}, embed: ${$context.embed}, os: ${$context.os}`}
    />
    <DebugInfoItem
      label="Host"
      value={"host: " +
        window.location.host +
        " protocol: " +
        window.location.protocol}
    />
    <DebugInfoItem label="Agent" value={navigator?.userAgent} />
    <DebugInfoItem label="Path" value={window.location.pathname} />
    <DebugInfoItem
      label="Dimensions (W x H)"
      value={$view.width + " x " + $view.height}
    />
    <DebugInfoItem
      label="Landscapiness"
      value={$view.landscapiness.toFixed(2)}
    />
    <DebugInfoItem label="Scale" value={$view.scale.toFixed(2)} />
    <DebugInfoItem label="Display" value={$view.display} />
    <DebugInfoItem label="Skin" value={$userPreferences?.appearance?.skin} />
    <DebugInfoItem
      label="Theme & Color scheme"
      value={$appearance.theme +
        "  " +
        $appearance.colorScheme.tailwindSelector}
    />
    <DebugInfoItem
      label="Typeface"
      value={$userPreferences?.appearance?.typeface}
    />
    <DebugInfoItem label="Portrait mode" value={$view.isPortrait} />
    <DebugInfoItem
      label="Storage quota"
      value={storageQuota
        ? `${(storageQuota / 1000000000).toFixed(2)} GB`
        : "NA"}
    />
    <DebugInfoItem
      label="Storage used"
      value={storageUsage ? `${(storageUsage / 1000000).toFixed(2)} MB` : "NA"}
    />
    <Divider colorStrength={ColorStrength.Strong} />
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold">Fallback Status</span>
        <Button
          size={Size.xs}
          icon="reload"
          onclick={loadFallbackStatuses}
          label="Refresh"
        />
        <Button
          size={Size.xs}
          type={ButtonVariant.DANGER}
          style={ButtonStyle.OUTLINED}
          icon="trash"
          onclick={resetAllFallbacks}
          label="Reset All"
        />
      </div>
      {#if Object.keys(fallbackStatuses).length > 0}
        <div class="text-xs max-h-32 overflow-y-auto">
          {#each Object.entries(fallbackStatuses) as [name, status]}
            <div
              class="flex justify-between items-center py-1 border-b border-brs1"
            >
              <span class="truncate">{name}</span>
              <span class="text-green-500 text-xs">✓</span>
            </div>
          {/each}
        </div>
      {:else}
        <span class="text-xs text-fgs2">No fallbacks run yet</span>
      {/if}
    </div>
    <Divider colorStrength={ColorStrength.Strong} />
    <div class="flex flex-wrap gap-2 w-full justify-center items-center">
      <Button
        type={ButtonVariant.PRIMARY}
        onclick={() => {
          requireCommandHost().runAction("dexie-console");
        }}
        size={Size.sm}
        icon="terminal"
        label="Dexie console"
      />
      <Button
        onclick={toggleTraceLogging}
        size={Size.sm}
        icon={isTraceLoggingEnabled ? "check" : "terminal"}
        label={isTraceLoggingEnabled
          ? "Trace logging enabled"
          : "Enable trace logging"}
      />
      <Button
        icon="trash"
        size={Size.sm}
        type={ButtonVariant.DANGER}
        style={ButtonStyle.OUTLINED}
        onclick={clearCache}
        label="Clear cache and logout"
      />
      {#if !isShowAsPage}
        <Button
          onclick={() => {
            isShowDebugOverlay = false;
          }}
          label="Close"
        />
      {/if}
    </div>
  </div>
{:else}
  <button
    class="absolute bottom-20 right-0 flex flex-col p-4 bg-bgs3 opacity-50 text-fgs1 rounded-lg z-50"
    onclick={() => (isShowDebugOverlay = true)}
  >
    <Icon icon="code" />
  </button>
{/if}
{#if isShowLogs}
  <div
    class="absolute top-10 left-4 flex flex-col w-3/4 h-3/4 p-10 bg-bgs2 text-fgs1 rounded-lg z-50 shadow-lg border border-brs1"
  >
    <button
      class="absolute top-0 right-0 flex flex-col p-1 text-fgs1 rounded-lg z-50"
      onclick={() => (isShowLogs = false)}
    >
      <Icon icon="minus-circle" size={Size.lg} />
    </button>
    <span> Replaced with telemetry. </span>
    <!-- <div class="flex flex-col items-start gap-2 overflow-y-auto">
      {#if $logger.items && $logger.items.length > 0}
        {#each $logger.items as log}
          <div class="text-left">
            {log.type.toString().toUpperCase()} -- {log.message}
          </div>
          <Divider colorStrength={ColorStrength.Strong} />
        {/each}
      {:else}
        <div>No logs</div>
      {/if}
    </div> -->
  </div>
{/if}
{#if environment}
  <div class="fixed right-0 top-20 text-bgs1 z-50 w-20 px-2 bg-aps1 opacity-30">
    {environment}
  </div>
{/if}
