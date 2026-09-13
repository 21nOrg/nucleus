<script lang="ts">
  import { onMount } from "svelte";
  import { syncStore } from "@nucleum/extensions/clipper/contentScripts/store";
  import FeedbackPaneBase from "@nucleum/extensions/clipper/feedbackPane/FeedbackPaneBase.svelte";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import Button from "@21n/elements/button/Button.svelte";
  import { SyncStatus } from "@nucleum/extensions/clipper/contentScripts/types";
  import { ButtonVariant } from "@21n/elements/button/button.type";
  import { appEvents } from "@nucleum/stores/events/app-events.store";
  import { ClipperExtensionEvent } from "@nucleum/client/config/events/clipper-event.type";
  import { Size } from "@21n/elements/size.enum";
  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import { formatDatetime } from "@21n/utils/time.utils";
  import Icon from "@21n/elements/Icon.svelte";

  onMount(() => {
    logger.log({ at: "SyncPane onMount", syncStore: $syncStore });
  });
  function resolveLabel() {
    if ($syncStore.id === NodeType.KINDLE_BOOK) return "Kindle highlights sync";
  }
  function resolveButtonLabel(status: SyncStatus) {
    switch (status) {
      case SyncStatus.SYNCED:
        return "Resync";
      case SyncStatus.SYNCING:
        return "Syncing...";
      case SyncStatus.NOT_SYNCED:
        return "Start sync";
      default:
        return "Start sync";
    }
  }
</script>

<FeedbackPaneBase>
  <div class="flex flex-col gap-3 h-40 justify-between">
    <div class="flex w-full justify-center items-center">{resolveLabel()}</div>
    {#if $syncStore.status === SyncStatus.SYNCING}
      <div class="w-full flex justify-center text-fgs2 text-b3">
        {#if $syncStore.progress}
          {Math.floor($syncStore.progress)}%
        {:else}
          {$syncStore.message}
        {/if}
      </div>
    {/if}
    {#if $syncStore.status === SyncStatus.SYNCED}
      <div class="flex gap-2 items-center w-full justify-center">
        <Icon icon="check-circle" />
        <span>{$syncStore.message ?? "Sync completed."}</span>
      </div>
    {/if}
    {#if $syncStore.status === SyncStatus.ERRORED}
      <div class="flex gap-2 items-center w-full justify-center text-ars1">
        <Icon icon="x-circle" />
        <span>{$syncStore.message ?? "Sync failed."}</span>
      </div>
    {/if}
    <div class="flex w-full justify-center items-center">
      <Button
        icon="sync"
        size={Size.sm}
        type={ButtonVariant.PRIMARY}
        label={resolveButtonLabel($syncStore.status)}
        isDisabled={$syncStore.status === SyncStatus.SYNCING}
        onclick={() => {
          if ($syncStore.status === SyncStatus.SYNCING) return;
          appEvents.publish(ClipperExtensionEvent.START_SYNC);
        }}
      />
    </div>
    {#if $syncStore.lastSyncedAt}
      <span class="text-b3 text-fgs3 w-full flex justify-center">
        <span>
          Last synced: {formatDatetime(
            $userPreferences,
            $syncStore.lastSyncedAt
          )}
        </span>
      </span>
    {/if}
  </div>
</FeedbackPaneBase>
