<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { createClipPointer } from "@nucleum/extensions/clipper/clipper.utils";
  import { ExtensionEvent } from "@nucleum/extensions/extension.type";
  import { type IClipCapture } from "@nucleum/features/memory/node/node.type";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import { ClipperExtensionEvent } from "@nucleum/client/config/events/clipper-event.type";
  import { webpage } from "@nucleum/extensions/clipper/contentScripts/store";
  import { appEvents } from "@nucleum/stores/events/app-events.store";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { relayToBackgroundScript } from "@21n/utils/extension.utils";
  import Icon from "@21n/elements/Icon.svelte";
  import { getPort } from "@plasmohq/messaging/port";
  import { cn } from "@21n/utils/ui.utils";
  import { formatSeconds } from "@21n/utils/time.utils";
  import { TimeFormat } from "@21n/utils/time.type";
  let {
    isRenderedAsOverlay = false
  }: {
    isRenderedAsOverlay?: boolean;
  } = $props();
  let clipCount = 0;
  let isClipInProgress = false;
  const channel = getPort("channel");

  function refreshTimestamps() {
    removeAllPointers();
    clipCount = 0;
    const clips = $webpage.clips;
    logger.log({ at: "refreshTimestamps", clips });
    if (clips && clips.length > 0) {
      const timestamps = clips.filter(
        (clip) => clip.contentType === NodeType.YOUTUBE_BOOKMARK
      );
      clipCount = timestamps.length;
      for (let i = 0; i < timestamps.length; i++) {
        placePointerOnPlayer(timestamps[i].body.timestamp);
      }
    }
  }

  async function clip() {
    if (
      window.location.hostname === "www.youtube.com" &&
      window.location.pathname === "/watch"
    ) {
      const videoId = new URLSearchParams(window.location.search).get("v");
      const videoPlayer = document.querySelector("video");
      if (videoPlayer && !isNaN(videoPlayer.currentTime)) {
        const adModuleElement = document.querySelector(".ytp-ad-module");
        const videoAdElement = document.querySelector(".video-ads");
        if (adModuleElement || videoAdElement) {
          const childrenCount = adModuleElement?.children.length;
          const videoAdChildrenCount = videoAdElement?.children.length;
          console.log({
            at: "adModuleElement",
            childrenCount,
            videoAdChildrenCount
          });
          if (
            (childrenCount && childrenCount > 0) ||
            (videoAdChildrenCount && videoAdChildrenCount > 0)
          ) {
            window.alert(
              `Cannot clip video while an ad is playing. Please wait for the ad to finish.`
            );
            return null;
          }
        }
        const timestamp = Math.floor(videoPlayer.currentTime);
        //if already exists, don't create a new pointer
        const isExists = $webpage.clips?.find(
          (clip) => clip.body?.timestamp === timestamp
        );
        if (isExists) {
          window.alert(
            `Clip already exists at this timestamp: ${formatSeconds(timestamp, TimeFormat.CLOCK)}`
          );
          return null;
        }
        placePointerOnPlayer(timestamp);
        const contentType = "image/png";
        const dataUrl = captureVideoFrame(videoPlayer);
        let s3Url;
        const response = await relayToBackgroundScript({
          event: ExtensionEvent.UPLOAD_FILE,
          data: { dataUrl, contentType }
        });
        const videoUrlWithTimestamp = `https://www.youtube.com/watch?v=${videoId}&t=${timestamp}s`;
        const fileId =
          response && typeof response === "object" && "id" in response
            ? response.id
            : "";
        return { videoUrlWithTimestamp, timestamp, fileId };
      } else {
        console.error(
          "YouTube video player not found or no video is currently playing."
        );
        return null;
      }
    } else {
      console.error("Not on a YouTube video page.");
      return null;
    }

    function captureVideoFrame(video) {
      var canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);
      var imageURL = canvas.toDataURL("image/png");
      return imageURL;
    }
  }

  /**
   * Places pointer at the timestamp location above the progress bar.
   */
  function placePointerOnPlayer(timestamp) {
    const playerControls = document.querySelector(".ytp-chrome-bottom");
    if (playerControls && playerControls instanceof HTMLElement) {
      const pointer = createClipPointer();
      const duration = document.querySelector("video").duration;
      const position = (timestamp / duration) * playerControls.offsetWidth;
      pointer.style.left = `${position - 5}px`;
      pointer.addEventListener("click", function () {
        const player = document.querySelector("video");
        console.log("Seeking to timestamp: ", {
          timestamp,
          player
        });
        if (player && timestamp) {
          player.currentTime = timestamp;
        }
      });
      playerControls.appendChild(pointer);
    }
  }

  function removeAllPointers() {
    const playerControls = document.querySelector(".ytp-chrome-bottom");
    if (playerControls && playerControls instanceof HTMLElement) {
      const existingPointers = playerControls.querySelectorAll(
        ".memotron-clip-pointer"
      );
      existingPointers.forEach((pointer) => pointer.remove());
    }
  }

  const messageListener = (message, sender, sendResponse) => {
    logger.log({
      at: "onMessage - Youtube content script",
      event: message.event
    });
    if (
      message.event === ExtensionEvent.CLICK_FROM_SIDEPANEL &&
      message.data?.clip
    ) {
      const player = document.querySelector("video");
      if (player && message.data.clip?.body?.timestamp) {
        console.log("Seeking to timestamp: ", message.data.clip.body.timestamp);
        player.currentTime = message.data.clip.body.timestamp;
      }
    }
  };

  function onChannelMessage(msg: any) {
    logger.debug({ at: "YoutubeContentScript - channel listener", msg });
  }

  let sizeButtonListener: () => void;
  let fullscreenButtonListener: () => void;
  let attachedElements: {
    sizeButton: Element | null;
    fullscreenButton: Element | null;
  } | null = null;

  function attachPlayerControlListeners() {
    const sizeButton = document.querySelector(".ytp-size-button");
    const fullscreenButton = document.querySelector(".ytp-fullscreen-button");
    if (sizeButton && fullscreenButton) {
      sizeButtonListener = () => {
        setTimeout(() => {
          refreshTimestamps();
        }, 1000);
      };
      fullscreenButtonListener = () => {
        setTimeout(() => {
          refreshTimestamps();
        }, 1000);
      };

      sizeButton.addEventListener("click", sizeButtonListener);
      fullscreenButton.addEventListener("click", fullscreenButtonListener);

      attachedElements = { sizeButton, fullscreenButton };
      return true;
    }
    return false;
  }

  onMount(() => {
    clipCount = 0;
    chrome.runtime.onMessage.addListener(messageListener);
    channel.onMessage.addListener(onChannelMessage);
    if (!attachPlayerControlListeners()) {
      setTimeout(() => {
        attachPlayerControlListeners();
      }, 1000);
    }
    scheduleReconciliation();
    const sub = appEvents.subscribe(async (x) => {
      if (x.event === ClipperExtensionEvent.REFRESH_CLIPS_RENDERING) {
        logger.debug({
          at: "YoutubeContentScript - onMessage - REFRESH_CLIPS_RENDERING",
          event: x.event
        });
        setTimeout(() => {
          refreshTimestamps();
          scheduleReconciliation();
        }, 1000);
      }
    });
    return () => {
      sub();
    };
  });

  onDestroy(() => {
    channel.onMessage.removeListener(onChannelMessage);
    chrome.runtime.onMessage.removeListener(messageListener);
    if (attachedElements && sizeButtonListener && fullscreenButtonListener) {
      attachedElements.sizeButton?.removeEventListener(
        "click",
        sizeButtonListener
      );
      attachedElements.fullscreenButton?.removeEventListener(
        "click",
        fullscreenButtonListener
      );
    }
  });

  function scheduleReconciliation() {
    setTimeout(() => {
      reconcile();
    }, 10000);
  }

  async function onClick() {
    try {
      if (isClipInProgress) return;
      isClipInProgress = true;
      const clipDetails = await clip();
      if (!clipDetails) {
        isClipInProgress = false;
        return;
      }
      const clipItem: IClipCapture = {
        contentType: NodeType.YOUTUBE_BOOKMARK,
        url: clipDetails.videoUrlWithTimestamp,
        body: {
          timestamp: clipDetails.timestamp,
          thumbnail: clipDetails.fileId
        },
        metadata: {}
      };
      await webpage.saveClip(clipItem);
      clipCount++;
      //TODO - show feedback
      isClipInProgress = false;
    } catch (e) {
      logger.error({ at: "YoutubeContentScript - onClick", error: e });
      isClipInProgress = false;
    }
  }

  function reconcile() {
    const playerControls = document.querySelector(".ytp-chrome-bottom");
    if (playerControls && playerControls instanceof HTMLElement) {
      const existingPointers = playerControls.querySelectorAll(
        ".memotron-clip-pointer"
      );
      const renderedPointerCount = existingPointers.length;
      const actualPointerCount = $webpage.clips?.filter(
        (clip) => clip.contentType === NodeType.YOUTUBE_BOOKMARK
      ).length;
      if (renderedPointerCount !== actualPointerCount) {
        console.log({
          at: "Reconciling",
          renderedPointerCount,
          actualPointerCount
        });
        refreshTimestamps();
      }
    }
  }

  function resizeEventListener() {
    setTimeout(() => {
      refreshTimestamps();
    }, 1000);
  }
</script>

<div
  class={cn("flex w-full h-full justify-center items-center px-4 py-2", {
    "ml-24": isRenderedAsOverlay
  })}
>
  <button
    class="flex items-center justify-center rounded-md bg-bgs1 h-8"
    onclick={() => {
      relayToBackgroundScript({
        event: ExtensionEvent.RUN,
        data: { action: ExtensionEvent.TOGGLE_SIDEPANEL }
      });
      refreshTimestamps();
    }}
  >
    <span class="text-b2 shadow-none px-3">
      {clipCount} clips
    </span>
    <button
      onclick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      class="bg-aps3 hover:bg-aps2 border border-aps2 flex w-12 justify-center items-center h-full rounded-r-md"
    >
      <Icon icon={isClipInProgress ? "svg-spinners:3-dots-fade" : "plus"} />
    </button>
  </button>
</div>
<svelte:window onresize={resizeEventListener} />
