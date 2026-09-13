<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { fileDrop } from "@nucleum/actions/fileDrop.action";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import Button from "@21n/elements/button/Button.svelte";
  import Divider from "@21n/elements/Divider.svelte";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import Icon from "@21n/elements/Icon.svelte";
  import InlineErrorMessage from "@21n/elements/text/InlineErrorMessage.svelte";
  import account from "@nucleum/stores/account.store";

  import context from "@nucleum/stores/context.store";
  import view from "@nucleum/stores/view.store";
  import { ButtonVariant } from "@21n/elements/button/button.type";
  import { Embed } from "@nucleum/client/runtime/context.type";
  import { wait } from "@21n/shared-utils/wait";
  import { MAX_FILE_SIZE_MB } from "@nucleum/stores/files/file.constants";
  import { resolveFileUploadErrorMessage } from "@nucleum/features/memory/capture/upload-error.utils";
  import { MemotronAction } from "@nucleum/features/memory/memory-action.enum";

  import type { IMultiFileCaptureData } from "@nucleum/features/memory/capture/capture.type";
  import { resolveMultipleFilesData } from "@nucleum/features/memory/capture/capture.utils";
  import {
    clipboard,
    type IActiveCaptureStore
  } from "@nucleum/features/memory/capture/capture.store";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  import { fly } from "svelte/transition";

  let {
    captureStore,
    onClear = undefined
  }: {
    captureStore: IActiveCaptureStore;
    onClear?: (() => void) | undefined;
  } = $props();

  const imageFileTypes = [
    ".jpg",
    ".png",
    ".jpeg",
    ".webp",
    ".gif",
    ".svg",
    ".heic"
  ];
  const videoFileTypes = [".mp4", ".mov"];
  const audioFileTypes = [".wav", ".mp3"];
  const pdfFileTypes = [".pdf"];

  const supportedFileTypes = [
    ...imageFileTypes,
    ...videoFileTypes,
    ...audioFileTypes,
    ...pdfFileTypes,
    ".md"
  ].join(",");

  let multipleFilesData = $state<IMultiFileCaptureData | undefined>(undefined);
  let error = $state<string | undefined>(undefined);

  let isValidMultipleFiles = $state(false);
  const uploadProgressElementId = "node-embed-upload-progress";

  async function handleDrop(
    all: File[],
    valid: File[],
    errors: { file: File; type: string }[]
  ) {
    try {
      error = undefined;
      if (account.isCloudUserAndOffline()) {
        error =
          "You seem to be offline. File upload is not yet available in offline mode.";
        return;
      }
      if (errors && errors.length > 0) {
        error = resolveFileUploadErrorMessage(errors, {
          maxFileSizeMB: MAX_FILE_SIZE_MB
        });
        return;
      }
      if (all.length === 1) {
        let file = all[0];
        await captureStore.saveFile(file);
      } else if (all.length > 1) {
        multipleFilesData = resolveMultipleFilesData(all, MAX_FILE_SIZE_MB);
        if (multipleFilesData && multipleFilesData.sizeExceededCount > 0) {
          error = `${multipleFilesData.sizeExceededCount} files exceed the maximum size of ${MAX_FILE_SIZE_MB} MB.`;
        } else {
          isValidMultipleFiles = true;
        }
      }
    } catch (e: any) {
      logger.error({ at: "FileUploader.handleDrop", error: e });
      error = "Something went wrong";
    } finally {
      $captureStore.isSaving = false;
    }
  }

  async function saveAll(e: MouseEvent) {
    if (e) e.stopPropagation();
    if (!multipleFilesData) return;
    await wait(10);
    await captureStore.saveMultipleFiles(multipleFilesData.files, {
      uploadProgressId: uploadProgressElementId
    });
  }
  async function handleInsertIntoMd(e: MouseEvent) {
    if (e) e.stopPropagation();
    if (!multipleFilesData) return;
    clipboard.set({
      multipleFiles: multipleFilesData
    });
    requireCommandHost().runAction(MemotronAction.CAPTURE_SECONDARY, {
      searchParams: {
        [AppSearchParam.CLIPBOARD]: true
      },
      componentParams: {
        captureId: $captureStore.id
      }
    });
  }
</script>

<div
  class="w-full h-full flex flex-col items-center justify-center"
  in:fly={{ duration: 300, y: 100 }}
>
  {#if $captureStore.isSaving && !isValidMultipleFiles}
    <EmptyStatusView
      isLoadingState={true}
      loadingText="Processing and uploading..."
    />
  {:else}
    <div
      class="flex flex-col gap-6 w-full mo:h-9/10 h-full justify-between items-center border border-dashed border-brs3 bg-bgs2/50 rounded-md"
      use:fileDrop={{
        accept: supportedFileTypes,
        multiple: true,
        maxSize: MAX_FILE_SIZE_MB * 1024 * 1024,
        onDrop: handleDrop,
        dragOverClass: ["bg-bgs2/100", "border-fgs3"]
      }}
    >
      <div class="flex w-full justify-end p-3">
        <div>
          <Button
            icon="back"
            tooltip="Go back"
            parentBgIndex={2}
            onclick={() => onClear?.()}
          />
        </div>
      </div>
      <div class="flex flex-col items-center gap-6 w-full">
        <div class="flex flex-col items-center gap-2">
          {#if $captureStore.isSaving}
            <div class="flex items-center gap-1">
              <span class="text-fgs3 text-b3">Processing and uploading...</span>
              <span id={uploadProgressElementId} class="text-fgs3 text-b3"
              ></span>
            </div>
          {:else if isValidMultipleFiles && multipleFilesData}
            <div>
              {multipleFilesData.files.length} files selected
            </div>
          {:else}
            <div class="text-fgs1">
              {#if $context.embed === Embed.HANDSET}
                Browse files
              {:else}
                Drag and drop your files here
              {/if}
            </div>
            <div class="flex gap-3 items-center">
              <Icon icon="ph:image" class="stroke-fgs3" />
              <Icon icon="ph:music-note" class="stroke-fgs3" />
              <Icon icon="ph:file-pdf" class="stroke-fgs3" />
            </div>
          {/if}
        </div>
        <div class="w-1/2">
          <Divider />
        </div>
        <div class="flex mo:flex-col gap-3">
          {#if isValidMultipleFiles}
            <Button
              label="Save all"
              isLoading={$captureStore.isSaving}
              type={ButtonVariant.PRIMARY}
              icon="proceed"
              parentBgIndex={2}
              onclick={saveAll}
            />
            <Button
              label="Insert into markdown"
              icon="markdown"
              parentBgIndex={2}
              onclick={handleInsertIntoMd}
            />
          {:else}
            <Button label="Select file" icon="upload" parentBgIndex={2} />
          {/if}
        </div>
        {#if error}
          <InlineErrorMessage {error} isDissappear={false} />
        {/if}
      </div>
      <div class="flex mo:flex-col text-fgs3 text-b3 gap-3 p-3">
        <span
          >Currently accepted file types: <b> image, audio, pdf, md </b>
        </span>
        {#if !$view.isConstrainedWidth}
          |
        {/if}
        <span>Max size per file: {MAX_FILE_SIZE_MB}MB</span>
      </div>
    </div>
  {/if}
</div>
