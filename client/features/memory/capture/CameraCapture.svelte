<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { onMount } from "svelte";
  import Button from "@21n/elements/button/Button.svelte";
  import { Size } from "@21n/elements/size.enum";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import view from "@nucleum/stores/view.store";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { cn } from "@21n/utils/ui.utils";
  import { ErrorMessage } from "@nucleum/stores/notifications/error.enum";

  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import type { IActiveCaptureStore } from "@nucleum/features/memory/capture/capture.store";
  import { resourceAction } from "@nucleum/datafn/resource.utils";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
  import PlayerControl from "@21n/elements/player/controls/PlayerControl.svelte";

  let {
    captureStore,
    onClear = undefined
  }: {
    captureStore: IActiveCaptureStore;
    onClear?: (() => void) | undefined;
  } = $props();
  let videoElement: HTMLVideoElement;
  let canvasElement: HTMLCanvasElement;
  let photoTaken = $state(false);
  let savedResource = $state<IRecordId | null>(null);
  let containerHeight = $state(0);
  let containerWidth = $state(0);
  let isSaving = $state(false);
  let error = $state<string | null>(null);
  let stream: MediaStream | null = null;

  onMount(() => {
    containerHeight = window.innerHeight;
    containerWidth = window.innerWidth;
    startCamera();
    return () => {
      stopCamera();
    };
  });
  let deviceInfo = $state<MediaDeviceInfo | null>(null);
  async function startCamera() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevice = devices.find(
        (device) => device.kind === "videoinput"
      );
      if (videoDevice) {
        deviceInfo = { ...videoDevice };
      }

      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment"
        }
      });
      if (!videoElement) return;
      videoElement.srcObject = stream;
      videoElement.onloadedmetadata = () => {
        adjustVideoSize();
      };
    } catch (e) {
      error = "No Camera found.";
    }
  }
  function stopCamera() {
    if (stream) {
      const tracks = stream.getTracks();
      tracks.forEach((track) => {
        track.enabled = false;
        track.stop();
        stream?.removeTrack(track);
      });

      if (videoElement) {
        videoElement.srcObject = null;
        videoElement.load();
      }

      stream = null;
    }
  }

  function adjustVideoSize() {
    const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
    const containerAspect = containerWidth / containerHeight;

    if (videoAspect > containerAspect) {
      videoElement.style.width = "100%";
      videoElement.style.height = "auto";
    } else {
      videoElement.style.width = "auto";
      videoElement.style.height = "100%";
    }
    videoElement.style.objectFit = "contain";
  }

  function capturePhoto() {
    if (error) return;
    if (canvasElement && videoElement) {
      const { videoWidth, videoHeight } = videoElement;
      const { width: containerWidth, height: containerHeight } =
        videoElement.getBoundingClientRect();
      canvasElement.width = videoWidth;
      canvasElement.height = videoHeight;
      const context = canvasElement.getContext("2d");
      context?.drawImage(videoElement, 0, 0, videoWidth, videoHeight);
      stopCamera();
      setTimeout(() => {
        photoTaken = true;
      }, 100);
    }
  }

  async function savePhoto() {
    if (!canvasElement) {
      error = "Something went wrong. Please try again.";
      return;
    }
    try {
      isSaving = true;
      const blob = await new Promise<Blob | null>((resolve) => {
        canvasElement.toBlob((b) => resolve(b), "image/jpeg");
      });
      if (!blob) {
        error = ErrorMessage.DEFAULT;
        logger.error({ at: "CameraCapture.savePhoto", error: "No blob" });
        isSaving = false;
        return;
      }
      const result = await captureStore.saveCameraCapture(blob, {
        deviceInfo,
        isMediaDeviceCapture: true
      });
      isSaving = false;
      const node = Array.isArray(result) ? result[0] : result;
      if (!result || !node || !node?.id) {
        error = ErrorMessage.DEFAULT;
        logger.error({ at: "CameraCapture.savePhoto", error: result });
        isSaving = false;
        return;
      }
      savedResource = node.id;
    } catch (e) {
      error = ErrorMessage.DEFAULT;
      logger.error({ at: "CameraCapture.savePhoto", error: e });
      isSaving = false;
    }
  }

  function retakePhoto() {
    photoTaken = false;
    startCamera();
  }
</script>

<div
  class="relative flex flex-col items-center justify-between w-full h-full overflow-hidden"
  style={$view.isConstrainedWidth
    ? `height: ${containerHeight}px; width: ${containerWidth}px;`
    : ""}
>
  {#if error}
    <span class="absolute inset-0 flex items-center justify-center text-ars1">
      {error}
    </span>
  {/if}
  <div
    class="relative w-full h-full overflow-hidden flex items-center justify-center"
  >
    <video
      bind:this={videoElement}
      class="max-w-full max-h-full"
      class:hidden={photoTaken}
      autoplay
      playsinline
      muted
      disablePictureInPicture
      controlsList="nodownload nofullscreen noremoteplayback"
    ></video>
    <canvas
      bind:this={canvasElement}
      class="max-w-full max-h-full object-contain"
      class:hidden={!photoTaken}
    ></canvas>
  </div>
  <div
    class={cn(
      "absolute mo:bottom-20 bottom-0 left-0 right-0 h-24 flex gap-4 items-center bg-bgs1 px-4",
      {
        "grid grid-cols-3": $view.isConstrainedWidth || !photoTaken,
        "flex justify-center": !$view.isConstrainedWidth
      }
    )}
  >
    {#if savedResource}
      <div class="flex flex-col items-center justify-center text-fgs3">
        <p>Node saved successfully!</p>
        <Button
          icon="cross"
          label="Close"
          size={$view.isConstrainedWidth ? Size.sm : Size.md}
          isPreventMinWidth={true}
          onclick={() => {
            const captureAction = resourceAction(
              Resource.node,
              ResourceActionType.CREATE
            );
            navigation.closeResource({
              id: captureAction,
              accessMode: AccessMode.POP
            });
          }}
        />
      </div>
    {:else if photoTaken}
      {#if !isSaving}
        <Button
          icon="reset"
          label="Retake"
          type={ButtonVariant.DANGER}
          size={$view.isConstrainedWidth ? Size.sm : Size.md}
          isPreventMinWidth={true}
          onclick={retakePhoto}
        />
      {/if}
      <Button
        icon="save"
        label="Save"
        type={ButtonVariant.PRIMARY}
        size={$view.isConstrainedWidth ? Size.sm : Size.md}
        isLoading={isSaving}
        isPreventMinWidth={true}
        onclick={savePhoto}
      />
      {#if !isSaving}
        <Button
          icon="back"
          label="Go back"
          size={$view.isConstrainedWidth ? Size.sm : Size.md}
          isPreventMinWidth={true}
          style={ButtonStyle.PLAIN}
          onclick={() => onClear?.()}
        />
      {/if}
    {:else}
      <div class="col-span-1"></div>
      <div class="col-span-1 flex justify-center">
        <button
          class="self-center w-16 h-16 rounded-full bg-aps1 border-none outline-none cursor-pointer relative"
          onclick={capturePhoto}
        >
          <div class="absolute inset-1 rounded-full border-4 border-bgs1"></div>
        </button>
      </div>
      <div class="col-span-1 flex justify-center">
        <PlayerControl
          onclick={() => onClear?.()}
          icon="back"
          tooltip={"Go back"}
          style={ButtonStyle.PLAIN}
        />
      </div>
    {/if}
  </div>
</div>

<style>
  .hidden {
    display: none;
  }
</style>
