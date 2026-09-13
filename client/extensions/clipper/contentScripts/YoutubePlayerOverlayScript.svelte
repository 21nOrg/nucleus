<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { createClipPointer } from "@nucleum/extensions/clipper/clipper.utils";
  import { ExtensionEvent } from "@nucleum/extensions/extension.type";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import { ClipperExtensionEvent } from "@nucleum/client/config/events/clipper-event.type";
  import { webpage } from "@nucleum/extensions/clipper/contentScripts/store";
  import { appEvents } from "@nucleum/stores/events/app-events.store";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { relayToBackgroundScript } from "@21n/utils/extension.utils";
  import Icon from "@21n/elements/Icon.svelte";
  import { cn } from "@21n/utils/ui.utils";
  import { checkIfAdPlaying } from "@nucleum/extensions/clipper/parsers/shared/video.utils";
  let {
    isRenderedAsOverlay = false
  }: {
    isRenderedAsOverlay?: boolean;
  } = $props();
  let clipCount = 0;
  let isClipInProgress = false;
  let _isAdPlaying = false;

  function refreshTimestamps() {
    if (_isAdPlaying) return;
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

  /**
   * Places pointer at the timestamp location above the progress bar.
   */
  function placePointerOnPlayer(timestamp: number) {
    const playerControls = document.querySelector(".ytp-chrome-bottom");
    if (playerControls && playerControls instanceof HTMLElement) {
      const pointer = createClipPointer();
      const duration = document.querySelector("video").duration;
      const position = (timestamp / duration) * playerControls.offsetWidth;
      pointer.style.left = `${position - 5}px`;
      pointer.addEventListener("click", function () {
        const player = document.querySelector("video");
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
        player.currentTime = message.data.clip.body.timestamp;
      }
    }
  };

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

  function updateVideoMetadata() {
    const isAdPlayingNewVal = checkIfAdPlaying();
    if (isAdPlayingNewVal !== _isAdPlaying) {
      _isAdPlaying = isAdPlayingNewVal;
      refreshTimestamps();
    }
  }

  onMount(() => {
    clipCount = 0;
    updateVideoMetadata();
    const timeInterval = setInterval(updateVideoMetadata, 1000);
    chrome.runtime.onMessage.addListener(messageListener);
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
      clearInterval(timeInterval);
      sub();
    };
  });

  onDestroy(() => {
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
      if (isClipInProgress || _isAdPlaying) return;
      isClipInProgress = true;
      const promises = webpage.saveVideoBookmark(NodeType.YOUTUBE_VIDEO);
      const result = await promises[0];
      if (result) {
        isClipInProgress = false;
        setTimeout(() => {
          refreshTimestamps();
        }, 500);
        promises[1].then((response) => {
          const thumbnail =
            response && typeof response === "object" && "id" in response
              ? response.id
              : "";
          if (thumbnail) {
            webpage.updateClipBody(result.id, { thumbnail });
          }
        });
      }
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
    {#if _isAdPlaying}
      <span class="text-b2 shadow-none px-3"> Ad... </span>
    {:else}
      <span class="text-b2 shadow-none px-3">
        {#if clipCount > 0}
          {clipCount} bookmark{clipCount > 1 ? "s" : ""}
        {:else}
          No bookmarks found.
        {/if}
      </span>
      <button
        onclick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        class="bg-aps3 hover:bg-aps2 border border-aps2 flex w-12 justify-center items-center h-full rounded-r-md"
      >
        <Icon
          icon={isClipInProgress
            ? "svg-spinners:3-dots-fade"
            : "mynaui:plus-hexagon"}
        />
      </button>
    {/if}
  </button>
</div>
<svelte:window onresize={resizeEventListener} />
