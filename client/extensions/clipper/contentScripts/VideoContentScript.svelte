<script lang="ts">
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import { onMount } from "svelte";
  import { webpage } from "@nucleum/extensions/clipper/contentScripts/store";
  import Icon from "@21n/elements/Icon.svelte";
  import { formatSeconds } from "@21n/utils/time.utils";
  import { TimeFormat } from "@21n/utils/time.type";
  import { appEvents } from "@nucleum/stores/events/app-events.store";
  import { ClipperExtensionEvent } from "@nucleum/client/config/events/clipper-event.type";
  import InlineErrorMessage from "@21n/elements/text/InlineErrorMessage.svelte";
  import {
    seekToTimestamp,
    getVideoPlayData
  } from "@nucleum/extensions/clipper/parsers/shared/video.utils";
  import {
    relayToBackgroundScript,
    resolveAppPath
  } from "@21n/utils/extension.utils";
  import { ExtensionEvent } from "@nucleum/extensions/extension.type";
  import { Size } from "@21n/elements/size.enum";
  import VideoTimelineClipItem from "@nucleum/extensions/clipper/contentScripts/parts/VideoTimelineClipItem.svelte";

  let { contentType }: { contentType: NodeType } = $props();

  let clips: any[] = [];
  let isBookmarking = false;
  let error: string | null;
  let currentVideoTime = 0;
  let clipElements: { [key: string]: VideoTimelineClipItem } = {};
  let isMouseOverTimeline = false;
  let isSeeking = false;
  let isSeekingTo: number | undefined = undefined;
  let isRefreshingBookmarks: boolean = true;
  let isAdPlaying = false;
  let timelineElement: HTMLElement;
  let isUserScrolling = false;
  let userScrollTimeout: NodeJS.Timeout;

  async function onBookmarkClick() {
    if (isBookmarking) return;
    if (isAdPlaying) {
      error = "Cannot bookmark video while an ad is playing";
      return;
    }
    try {
      isBookmarking = true;
      logger.log({ at: "Creating video bookmark..." });
      const promises = webpage.saveVideoBookmark(contentType);
      const result = await promises[0];
      if (result) {
        isBookmarking = false;
        logger.log({ result });
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
            refreshTimestamps();
          }
        });
      }
    } catch (err) {
      logger.error({ at: "Failed to create video bookmark:", err });
      error = err instanceof Error ? err.message : "Unknown error";
    } finally {
      isBookmarking = false;
    }
  }

  function refreshTimestamps() {
    isRefreshingBookmarks = true;
    const allClips = $webpage.clips;
    logger.debug({ at: "refreshTimestamps", allClips });
    if (allClips && allClips.length > 0) {
      const timestamps = allClips.filter(
        (clip) =>
          clip.contentType === NodeType.YOUTUBE_BOOKMARK ||
          clip.contentType === NodeType.WEB_VIDEO_BOOKMARK
      );
      clips = timestamps.sort((a, b) => a.body.timestamp - b.body.timestamp);
    } else {
      clips = [];
    }
    isRefreshingBookmarks = false;
  }

  function updateVideoMetadata() {
    const metadata = getVideoPlayData();
    isAdPlaying = metadata.isAdPlaying;
    if (isAdPlaying) return;
    if (metadata.currentTime !== null) currentVideoTime = metadata.currentTime;
    if (metadata.currentTime !== null && !metadata.isVideoPaused) {
      scrollToCurrentClip();
    }
  }

  function scrollToCurrentClip() {
    if (
      !timelineElement ||
      clips.length === 0 ||
      isMouseOverTimeline ||
      isUserScrolling
    )
      return;
    const currentClipIndex = clips.findIndex(
      (clip) => clip.body.timestamp > currentVideoTime
    );
    const targetIndex =
      currentClipIndex === -1
        ? clips.length - 1
        : Math.max(0, currentClipIndex - 1);

    const targetClip = clips[targetIndex];
    if (targetClip && clipElements[targetClip.id]) {
      clipElements[targetClip.id].scrollIntoView(timelineElement);
    }
  }

  onMount(() => {
    refreshTimestamps();
    updateVideoMetadata();

    const timeInterval = setInterval(updateVideoMetadata, 1000);
    function handlePageScroll() {
      isUserScrolling = true;
      clearTimeout(userScrollTimeout);
      userScrollTimeout = setTimeout(() => {
        isUserScrolling = false;
      }, 1000);
    }

    window.addEventListener("scroll", handlePageScroll, { passive: true });
    window.addEventListener("wheel", handlePageScroll, { passive: true });
    window.addEventListener("touchmove", handlePageScroll, { passive: true });

    const sub = appEvents.subscribe(async (x) => {
      if (x.event === ClipperExtensionEvent.REFRESH_CLIPS_RENDERING) {
        logger.debug({
          at: "YoutubeContentScript - onMessage - REFRESH_CLIPS_RENDERING",
          event: x.event
        });
        setTimeout(() => {
          refreshTimestamps();
        }, 1000);
      }
    });

    return () => {
      clearInterval(timeInterval);
      clearTimeout(userScrollTimeout);
      window.removeEventListener("scroll", handlePageScroll);
      window.removeEventListener("wheel", handlePageScroll);
      window.removeEventListener("touchmove", handlePageScroll);
      sub();
    };
  });

  function seek(timestamp: number) {
    isSeeking = true;
    isSeekingTo = timestamp;
    seekToTimestamp(timestamp);
    setTimeout(() => {
      isSeeking = false;
      isSeekingTo = undefined;
    }, 1000);
  }
</script>

<div class="flex flex-col rounded-md border border-brs3 my-4 bg-bgs1">
  <div class="flex w-full h-20 items-center">
    <button
      class="flex justify-center items-center px-3 h-full hover:bg-bgs2 border-r border-r-brs2 rounded-l-md"
      onclick={onBookmarkClick}
      title="Bookmark current timestamp"
      disabled={isBookmarking}
    >
      <Icon
        icon={isBookmarking
          ? "svg-spinners:3-dots-fade"
          : "mynaui:plus-hexagon"}
      />
    </button>
    <div
      class="timeline relative flex items-center overflow-x-auto w-full h-full"
      bind:this={timelineElement}
      onmouseenter={() => (isMouseOverTimeline = true)}
      onmouseleave={() => (isMouseOverTimeline = false)}
      role="search"
    >
      {#if clips && clips.length > 0 && !isAdPlaying}
        {#each clips as clip, index (clip.id)}
          <VideoTimelineClipItem
            bind:this={clipElements[clip.id]}
            {clip}
            {index}
            {currentVideoTime}
            {seek}
          />
        {/each}
      {/if}
      <div class="flex items-center justify-center w-full text-b2 text-fgs3">
        {#if isRefreshingBookmarks}
          <Icon icon="svg-spinners:3-dots-fade" />
        {:else if isAdPlaying}
          Bookmarks are not available when Ad is playing.
        {:else if clips.length === 0}
          Press&nbsp;
          <Icon icon="mynaui:plus-hexagon" class="text-fgs3" size={Size.sm} />
          &nbsp;on right to bookmark.
        {/if}
      </div>
      <!-- TODO - not changing when the width is dynamically updated, when the edge item is hovered - bg color issue -->
      <!-- <div
        class={cn(
          "absolute right-0 h-full rounded-r-md bg-gradient-to-l  to-transparent from-bgs1 via-bgs1 pl-10"
        )}
      ></div>
      <div
        class={cn(
          "absolute left-0 h-full rounded-l-md bg-gradient-to-r  to-transparent from-bgs1 via-bgs1 pr-10"
        )}
      ></div> -->
    </div>
  </div>
  <div
    class="w-full bg-bgs2 h-fit flex flex-col border-t border-t-brs2 rounded-b-md"
  >
    {#if error}
      <div class="flex w-full justify-center">
        <InlineErrorMessage bind:error />
      </div>
    {/if}
    <div class="grid grid-cols-3 w-full text-b3 text-fgs3">
      <div class="flex items-center gap-2">
        <div class="py-1 pl-2 tabular-nums transition-all duration-300">
          {#if isAdPlaying}
            Ad is running...
          {:else if isSeeking && isSeekingTo}
            Seeking to
            {formatSeconds(isSeekingTo, TimeFormat.CLOCK)}
          {:else}
            {formatSeconds(currentVideoTime, TimeFormat.CLOCK)}
          {/if}
        </div>
        <div class="w-1 h-1 rounded-full bg-fgs4" />
        <div class="whitespace-nowrap">
          {#if clips && clips.length > 0}
            {clips.length} bookmark{clips.length > 1 ? "s" : ""}
          {:else}
            No bookmarks found.
          {/if}
        </div>
      </div>
      <div class="flex items-center justify-center py-1">Memotron</div>
      <div class="flex items-center justify-end">
        <button
          class="flex justify-center items-center px-3 border-l border-l-brs2 h-full hover:bg-bgs3"
          title="Open side panel"
          onclick={() =>
            relayToBackgroundScript({
              event: ExtensionEvent.RUN,
              data: { action: ExtensionEvent.TOGGLE_SIDEPANEL }
            })}
        >
          <Icon icon="hugeicons:sidebar-right" size={Size.sm} />
        </button>
        <a
          class="flex justify-center items-center px-3 rounded-br-md h-full hover:bg-bgs3 border-l border-l-brs2"
          title="Open in app"
          href={resolveAppPath(`library?pop=${$webpage.id}`)}
          target="_blank"
        >
          <Icon icon="weblink-two" size={Size.sm} />
        </a>
      </div>
    </div>
  </div>
</div>
