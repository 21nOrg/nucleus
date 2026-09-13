<script lang="ts">
  import { fileUpload } from "@nucleum/stores/files/file-upload";

  import { fileDrop } from "$lib/client/actions/fileDrop.action";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import Button from "$lib/client/elements/button/Button.svelte";
  import EmptyStatusView from "$lib/client/elements/feedback/EmptyStatusView.svelte";
  import Icon from "$lib/client/elements/Icon.svelte";
  import InlineErrorMessage from "$lib/client/elements/text/InlineErrorMessage.svelte";
  import account from "$lib/client/stores/account.store";
  import { ButtonVariant } from "@21n/elements/button/button.type";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import { MAX_FILE_SIZE_MB } from "@nucleum/stores/files/file.constants";
  import { MemotronAction } from "@nucleum/features/memory/memory-action.enum";
  import modalStore from "@nucleum/stores/overlays/modal.store";
  import { Size } from "@21n/elements/size.enum";
  import { toasts } from "$lib/client/stores/notification.store";
  import { onDestroy } from "svelte";
  import { datafn } from "@nucleum/datafn/datafn.store";

  let {
    nodeId,
    nodeLabel = undefined
  }: {
    nodeId: IRecordId;
    nodeLabel?: string | undefined;
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

  let selectedFile: File | undefined = undefined;
  let error: string | undefined = undefined;
  let isSaving: boolean = false;
  let previewUrl: string | undefined = undefined;

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
        error = "Please select a valid image file.";
        return;
      }
      if (all.length > 0) {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        selectedFile = all[0];
        previewUrl = URL.createObjectURL(selectedFile);
      }
    } catch (e: any) {
      logger.error({ at: "PreviewImageUploader.handleDrop", error: e });
      error = "Something went wrong";
    }
  }

  async function handleSave() {
    if (!selectedFile) {
      error = "Please select an image file";
      return;
    }

    const fileName = selectedFile.name.toLowerCase();
    const isValidType = imageFileTypes.some((ext) => fileName.endsWith(ext));
    if (!isValidType) {
      error = "Unsupported file type. Please select a valid image file.";
      return;
    }

    try {
      isSaving = true;
      error = undefined;

      const response = await fileUpload.uploadFileV2(
        selectedFile.type,
        selectedFile.name,
        new Blob([selectedFile], { type: selectedFile.type }),
        {
          isGenerateThumbnail: true
        }
      );
      if (response && response.length > 0) {
        const fileId = response[0].id;
        await datafn.node.mutate({
          operation: "merge",
          id: nodeId,
          record: {
            previewImage: fileId
          }
        });
        toasts.success("Preview image updated successfully");
        handleClose();
      } else {
        error = "Failed to upload image";
      }
    } catch (e: any) {
      logger.error({ at: "PreviewImageUploader.handleSave", error: e });
      error = "Failed to save preview image";
    } finally {
      isSaving = false;
    }
  }

  function handleClose() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    selectedFile = undefined;
    previewUrl = undefined;
    error = undefined;
    modalStore.hide(MemotronAction.PREVIEW_IMAGE_UPLOADER);
  }

  function handleRemovePreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    selectedFile = undefined;
    previewUrl = undefined;
  }

  onDestroy(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  });
</script>

<div class="flex flex-col gap-4 w-full h-full pb-12">
  <div class="flex items-center justify-between">
    <h2 class="text-h5 text-fgs2">
      Custom preview image {nodeLabel ? `: ${nodeLabel}` : ""}
    </h2>
    <Button icon="close" onclick={handleClose} parentBgIndex={1} />
  </div>

  {#if isSaving}
    <EmptyStatusView isLoadingState={true} loadingText="Uploading image..." />
  {:else}
    <div
      class="flex flex-col gap-4 w-full min-h-48 flex-grow justify-center items-center border border-dashed border-brs3 bg-bgs2/50 rounded-md p-4"
      use:fileDrop={{
        accept: imageFileTypes.join(","),
        multiple: false,
        maxSize: MAX_FILE_SIZE_MB * 1024 * 1024,
        onDrop: handleDrop,
        dragOverClass: ["bg-bgs2/100", "border-fgs3"]
      }}
    >
      {#if previewUrl}
        <div class="flex flex-col gap-2 items-center w-full">
          <img
            src={previewUrl}
            alt="Preview"
            class="max-h-48 max-w-full object-contain rounded-md"
          />
          <Button
            label="Remove"
            icon="trash"
            size={Size.sm}
            onclick={handleRemovePreview}
            parentBgIndex={2}
          />
        </div>
      {:else}
        <div class="flex flex-col items-center gap-2">
          <Icon icon="ph:image" class="stroke-fgs3 w-12 h-12" />
          <div class="text-fgs1">Drag and drop your image here</div>
          <div class="text-fgs3 text-b3">or</div>
          <Button
            label="Select image"
            icon="upload"
            parentBgIndex={2}
            size={Size.sm}
          />
        </div>
      {/if}
    </div>

    {#if error}
      <InlineErrorMessage {error} isDissappear={false} />
    {/if}
    <div class="text-fgs3 text-b3">
      Accepted file types: image (jpg, png, jpeg, webp, gif, svg, heic)
      <br />
      Max size: {MAX_FILE_SIZE_MB}MB
    </div>

    <div class="flex gap-2 justify-end">
      <Button
        label="Cancel"
        onclick={handleClose}
        parentBgIndex={1}
        size={Size.sm}
      />
      <Button
        label="Save"
        type={ButtonVariant.PRIMARY}
        onclick={handleSave}
        size={Size.sm}
        isDisabled={!selectedFile}
        parentBgIndex={1}
      />
    </div>
  {/if}
</div>
