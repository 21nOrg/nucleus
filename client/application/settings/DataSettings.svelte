<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { fileDrop } from "@nucleum/actions/fileDrop.action";
  import { fileStore } from "@nucleum/stores/files/file.store";
  import Button from "@21n/elements/button/Button.svelte";
  import TextInput from "@21n/elements/input/TextInput.svelte";
  import InlineInfoBanner from "@21n/elements/text/InlineInfoBanner.svelte";
  import Text from "@21n/elements/text/Text.svelte";
  import account from "@nucleum/stores/account.store";
  import { appStore } from "@nucleum/stores/app.store";
  import {
    clearDatafnLocalData,
    changeNucleumDatafnE2eePassword,
    datafn,
    datafnRuntime,
    disableNucleumDatafnE2ee,
    enableNucleumDatafnE2ee,
    reconcileDatafnNow,
    refreshNucleumDatafnStatus
  } from "@nucleum/datafn/datafn.store";
  import {
    datafnE2eeState,
    validateDatafnE2eePassword
  } from "@nucleum/datafn/datafnE2ee.store";
  import context from "@nucleum/stores/context.store";
  import {
    confirmationNotification,
    toasts
  } from "@nucleum/stores/notification.store";
  import { Action } from "@nucleum/client/config/action.enum";
  import { ButtonVariant } from "@21n/elements/button/button.type";
  import { Product } from "@nucleum/client/config/product.type";
  import { Size } from "@21n/elements/size.enum";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import { InfoTextType } from "@21n/elements/text/info.type";
  import { AlertType } from "@nucleum/stores/notifications/notification.type";
  import type { DatafnImportResult } from "@nucleum/datafn/datafn.type";
  import { parseAndFormatDate } from "@21n/utils/time.utils";
  import { parse, stringify } from "@21n/shared-utils/json.utils";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { generateSimpleRandomId } from "@21n/shared-utils/crypto.utils";
  import {
    detectLegacyLocalData,
    exportLegacyLocalData,
    resolveLegacyImportableRecordCount,
    type LegacyLocalDataSummary
  } from "@nucleum/persistence/legacyLocalDataBackup";
  import { onMount } from "svelte";

  let isBackupInProgress = $state(false);
  let isRestoreInProgress = $state(false);
  let isResyncInProgress = $state(false);
  let isE2eeInProgress = $state(false);
  let e2eePasswordMode = $state<"enable" | "change" | null>(null);
  let e2eePasswordValue = $state("");
  let e2eePasswordConfirmation = $state("");
  let e2eePasswordError = $state<string | undefined>(undefined);
  let legacyLocalDataSummary = $state<LegacyLocalDataSummary | undefined>(
    undefined
  );
  let isLegacyLocalDataDetectionComplete = $state(false);
  let isLegacyLocalBackupInProgress = $state(false);
  const hasLocalDatafnStorage = $derived(Boolean($datafnRuntime?.storage));
  const canResyncData = $derived($datafnRuntime?.mode === "sync");
  const canManageE2ee = $derived($datafnRuntime?.mode === "sync");
  const legacyLocalRecordCount = $derived(
    resolveLegacyImportableRecordCount(legacyLocalDataSummary)
  );
  const hasLegacyLocalData = $derived(legacyLocalRecordCount > 0);

  onMount(() => {
    void refreshLegacyLocalDataSummary();
  });

  async function handleBackup() {
    isBackupInProgress = true;
    try {
      if (!$datafnRuntime?.storage) {
        showInfoToast("Local backup is not available in cloud direct mode");
        return;
      }
      const data = await datafn.exportData();
      const product = $appStore.product;
      const fileName = `${product}-backup-${parseAndFormatDate(new Date())}.json`;
      const blob = new Blob([stringify(data, { isPreventReplacer: true })], {
        type: "application/json"
      });
      const isDelivered = await fileStore.downloadFromBlob(blob, {
        fileName: fileName,
        fileNameForEmbed: `${product}_backup`,
        contentType: "application/json",
        isHandleEmbedCase: true
      });
      if (!isDelivered) throw new Error("Backup delivery failed");
      if ($context.isEmbed) {
        toasts.success("Backup file downloaded successfully");
        return;
      }
    } catch (e) {
      console.error(e);
    } finally {
      isBackupInProgress = false;
    }
  }
  async function handleDrop(
    all: File[],
    valid: File[],
    errors: { file: File; type: string }[]
  ) {
    console.log("restore", all, valid, errors);
    isRestoreInProgress = true;
    try {
      if (!$datafnRuntime?.storage) {
        showInfoToast("Restore is not available in cloud direct mode");
        return;
      }
      const data = await all[0].text();
      if (data) {
        if (!$datafnRuntime) return;
        const result = (await datafn.importData(parse(data), {
          triggerCloneUp: $datafnRuntime.mode === "sync"
        })) as DatafnImportResult;
        const skipped = [
          ...Object.values(result?.stats?.resources ?? {}),
          ...Object.values(result?.stats?.joins ?? {})
        ].reduce((total, stats) => total + (stats.skipped ?? 0), 0);
        if (result?.ok !== true || skipped > 0) {
          throw new Error(
            result?.errors?.[0]?.message ?? "DataFn restore failed"
          );
        }
        await refreshNucleumDatafnStatus();
        toasts.success("Data restored successfully");
      }
    } catch (e) {
      logger.error({ at: "DataSettings.handleDrop", error: e });
      toasts.error("Unable to restore data");
    } finally {
      isRestoreInProgress = false;
    }
  }

  async function handleClear() {
    if (!$datafnRuntime?.storage) {
      showInfoToast("There is no local DataFn cache to clear");
      return;
    }
    confirmationNotification.notify({
      title: "Clear local cache",
      // size: Size.sm,
      askInputConfirmation: "clear data",
      message:
        "This will clear all data from your local cache and log you out. Your data will be lost if you are using offline mode.",
      confirmAction: {
        label: "Confirm",
        icon: "trash",
        variant: ButtonVariant.DANGER,
        callback: async () => {
          await clearDatafnLocalData();
          toasts.success("Data cleared successfully");
          await account.signOut();
          return true;
        }
      }
    });
  }

  async function handleResync() {
    if (!canResyncData) return;
    try {
      isResyncInProgress = true;
      await reconcileDatafnNow();
      isResyncInProgress = false;
    } catch (e) {
      logger.error({ at: "handleResync", error: e });
    } finally {
      isResyncInProgress = false;
    }
  }

  function openE2eePasswordForm(mode: "enable" | "change") {
    e2eePasswordMode = mode;
    e2eePasswordValue = "";
    e2eePasswordConfirmation = "";
    e2eePasswordError = undefined;
  }

  function resetE2eePasswordForm() {
    e2eePasswordMode = null;
    e2eePasswordValue = "";
    e2eePasswordConfirmation = "";
    e2eePasswordError = undefined;
  }

  function validateE2eePasswordForm() {
    if (!e2eePasswordValue || !e2eePasswordConfirmation) {
      e2eePasswordError = "Please fill both password fields.";
      return false;
    }
    if (e2eePasswordValue !== e2eePasswordConfirmation) {
      e2eePasswordError = "Passwords do not match.";
      return false;
    }
    const validation = validateDatafnE2eePassword(e2eePasswordValue);
    if (!validation.ok) {
      e2eePasswordError = validation.message;
      return false;
    }
    e2eePasswordError = undefined;
    return true;
  }

  async function handleSubmitE2eePassword() {
    if (!e2eePasswordMode || !validateE2eePasswordForm()) return;
    const password = e2eePasswordValue;
    if (e2eePasswordMode === "enable") {
      window.alert(
        "A local copy of your data will be kept on this device and will consume device storage."
      );
    }
    isE2eeInProgress = true;
    try {
      if (e2eePasswordMode === "enable") {
        await enableNucleumDatafnE2ee(password);
        toasts.success("End-to-end encryption turned on");
      } else {
        await changeNucleumDatafnE2eePassword(password);
        toasts.success("E2EE password changed");
      }
      resetE2eePasswordForm();
    } catch (error) {
      logger.error({ at: "handleSubmitE2eePassword", error });
      toasts.error(
        e2eePasswordMode === "enable"
          ? "Unable to turn on end-to-end encryption"
          : "Unable to change E2EE password"
      );
    } finally {
      isE2eeInProgress = false;
    }
  }

  function handleDisableE2ee() {
    confirmationNotification.notify({
      title: "Turn off E2EE",
      message:
        "This will replace encrypted cloud data with the decrypted local copy from this device.",
      confirmAction: {
        label: "Turn off",
        icon: "lock",
        variant: ButtonVariant.DANGER,
        callback: async () => {
          isE2eeInProgress = true;
          try {
            await disableNucleumDatafnE2ee();
            toasts.success("End-to-end encryption turned off");
            return true;
          } catch (error) {
            logger.error({ at: "handleDisableE2ee", error });
            toasts.error("Unable to turn off end-to-end encryption");
            return false;
          } finally {
            isE2eeInProgress = false;
          }
        }
      }
    });
  }

  async function refreshLegacyLocalDataSummary() {
    try {
      legacyLocalDataSummary = await detectLegacyLocalData($appStore.product);
    } catch (error) {
      logger.error({ at: "refreshLegacyLocalDataSummary", error });
      legacyLocalDataSummary = undefined;
    } finally {
      isLegacyLocalDataDetectionComplete = true;
    }
  }

  async function handleLegacyBackup() {
    isLegacyLocalBackupInProgress = true;
    try {
      const data = await exportLegacyLocalData($appStore.product);
      if (!data?.databases.length) {
        showInfoToast("No legacy local data was found on this device");
        await refreshLegacyLocalDataSummary();
        return;
      }
      const product = $appStore.product;
      const fileName = `${product}-legacy-local-backup-${parseAndFormatDate(new Date(), "iso-short")}.json`;
      const blob = new Blob([stringify(data, { isPreventReplacer: true })], {
        type: "application/json"
      });
      const isDelivered = await fileStore.downloadFromBlob(blob, {
        fileName,
        fileNameForEmbed: `${product}_legacy_local_backup`,
        contentType: "application/json",
        isHandleEmbedCase: true
      });
      if (!isDelivered) throw new Error("Legacy backup delivery failed");
      toasts.success("Legacy local backup downloaded successfully");
      await refreshLegacyLocalDataSummary();
    } catch (error) {
      logger.error({ at: "handleLegacyBackup", error });
      toasts.error("Unable to download legacy local backup");
    } finally {
      isLegacyLocalBackupInProgress = false;
    }
  }

  function showInfoToast(message: string) {
    toasts.trigger({
      id: generateSimpleRandomId(),
      message,
      type: AlertType.INFO
    });
  }
</script>

<main class="flex flex-col gap-12 text-left">
  <section class="flex flex-col gap-4">
    <Text content="Backup and restore" style={TextStyle.SECTION_HEADING} />
    <div class="flex items-center gap-4">
      <Button
        label="Backup"
        icon="download"
        type={ButtonVariant.PRIMARY}
        onclick={handleBackup}
        isLoading={isBackupInProgress}
        isDisabled={!hasLocalDatafnStorage}
      />
      <div use:fileDrop={{ accept: "application/json", onDrop: handleDrop }}>
        <Button
          label="Restore"
          icon="restore"
          isLoading={isRestoreInProgress}
          isDisabled={!hasLocalDatafnStorage}
        />
      </div>
    </div>
    <InlineInfoBanner
      type={InfoTextType.WARNING}
      size={Size.sm}
      content="Note: At the moment, Restore only works on new accounts. It might fail if old conflicting data is present."
    />
  </section>
  {#if isLegacyLocalDataDetectionComplete && hasLegacyLocalData}
    <section class="flex flex-col gap-4">
      <Text content="Legacy local data" style={TextStyle.SECTION_HEADING} />
      <InlineInfoBanner
        type={InfoTextType.WARNING}
        size={Size.sm}
        content={`Old local data was found on this device (${legacyLocalRecordCount} records across ${legacyLocalDataSummary?.databases.length ?? 0} databases). Use the startup recovery prompt to import it into DataFn, or download a raw backup before clearing browser data.`}
      />
      <div>
        <Button
          label="Download legacy backup"
          icon="download"
          type={ButtonVariant.SECONDARY}
          onclick={handleLegacyBackup}
          isLoading={isLegacyLocalBackupInProgress}
        />
      </div>
    </section>
  {/if}
  <section class="flex flex-col gap-4">
    <Text content="End-to-end encryption" style={TextStyle.SECTION_HEADING} />
    <InlineInfoBanner
      type={$datafnE2eeState.enabled ? InfoTextType.INFO : InfoTextType.WARNING}
      size={Size.sm}
      content={$datafnE2eeState.enabled
        ? "E2EE is on. Data queries and search use the decrypted local clone on this device."
        : "E2EE encrypts cloud data before upload. Relationship and system fields stay readable for sync."}
    />
    <div class="flex flex-wrap items-center gap-4">
      {#if $datafnE2eeState.enabled}
        <Button
          label="Change password"
          icon="lock"
          onclick={() => openE2eePasswordForm("change")}
          isLoading={isE2eeInProgress}
          isDisabled={!canManageE2ee || !$datafnE2eeState.unlocked}
        />
        <Button
          label="Turn off E2EE"
          icon="lock"
          type={ButtonVariant.DANGER}
          onclick={handleDisableE2ee}
          isLoading={isE2eeInProgress}
          isDisabled={!canManageE2ee || !$datafnE2eeState.unlocked}
        />
      {:else}
        <Button
          label="Turn on E2EE"
          icon="lock"
          type={ButtonVariant.PRIMARY}
          onclick={() => openE2eePasswordForm("enable")}
          isLoading={isE2eeInProgress}
          isDisabled={!canManageE2ee}
        />
      {/if}
    </div>
    {#if e2eePasswordMode}
      <div class="flex flex-col gap-3 w-full max-w-md bg-bgs2 rounded-md p-3">
        <TextInput
          bind:value={e2eePasswordValue}
          type="password"
          label="E2EE password"
          placeholder="********"
          onInput={() => {
            e2eePasswordError = undefined;
          }}
        />
        <TextInput
          bind:value={e2eePasswordConfirmation}
          type="password"
          label="Confirm E2EE password"
          placeholder="********"
          onInput={() => {
            e2eePasswordError = undefined;
          }}
          onEnter={handleSubmitE2eePassword}
        />
        {#if e2eePasswordError}
          <div class="text-ars1 text-b3">{e2eePasswordError}</div>
        {/if}
        <div class="flex gap-2">
          <Button
            label={e2eePasswordMode === "enable"
              ? "Turn on E2EE"
              : "Change password"}
            size={Size.sm}
            type={ButtonVariant.PRIMARY}
            isLoading={isE2eeInProgress}
            isDisabled={isE2eeInProgress}
            onclick={handleSubmitE2eePassword}
          />
          <Button
            label="Cancel"
            size={Size.sm}
            isDisabled={isE2eeInProgress}
            onclick={resetE2eePasswordForm}
          />
        </div>
      </div>
    {/if}
  </section>
  <section class="flex flex-col gap-4">
    <Text content="Import and export" style={TextStyle.SECTION_HEADING} />
    <span class="text-b2 text-fgs2">
      We enormously value your privacy and data. We want to make Memotron as
      interoperable and sustainable as possible. We will keep extending our
      support to import/export data from other apps.
    </span>
    <div>
      {#if $appStore.product !== Product.POINTRON}
        <Button
          label="Import from other apps"
          icon="download"
          onclick={() => {
            requireCommandHost().runAction(Action.IMPORT_FROM_OTHER_APPS);
          }}
        />
      {/if}
    </div>
  </section>
  <section class="flex flex-col gap-4">
    <Text content="More" style={TextStyle.SECTION_HEADING} />
    <div class="flex items-center gap-4">
      <Button
        label="Resync data"
        icon="reload"
        isLoading={isResyncInProgress}
        onclick={handleResync}
        isDisabled={!canResyncData}
      />
      {#if !$context.isEmbed}
        <Button
          label="Reload"
          icon="reload"
          onclick={() => window.location.reload()}
        />
      {/if}
      <Button
        label="Clear local cache"
        icon="trash"
        onclick={handleClear}
        type={ButtonVariant.DANGER}
        isDisabled={!hasLocalDatafnStorage}
      />
    </div>
  </section>
</main>
