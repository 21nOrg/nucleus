<script lang="ts">
  import {
    changeColor,
    highlight,
    removeHighlights
  } from "@nucleum/extensions/clipper/contentScripts/highlightV4";
  import InlineTextToolbar from "@nucleum/extensions/clipper/InlineTextToolbar.svelte";
  import {
    elementFromQuery,
    getQuery
  } from "@nucleum/extensions/clipper/contentScripts/getQuery";
  import { onMount } from "svelte";
  import { ClipperExtensionEvent } from "@nucleum/client/config/events/clipper-event.type";
  import {
    type IClipCapture,
    type ITextClip
  } from "@nucleum/features/memory/node/node.type";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import { ExtensionEvent } from "@nucleum/extensions/extension.type";
  import { webpage } from "@nucleum/extensions/clipper/contentScripts/store";
  import { appEvents } from "@nucleum/stores/events/app-events.store";
  import { AlertType } from "@nucleum/stores/notifications/notification.type";
  import type { IHighlighter } from "@nucleum/features/memory/common/highlighters/highlight.type";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { highlightStore } from "@nucleum/features/memory/common/highlighters/highlight.store";

  import { activeResourceFilter } from "@21n/utils/utils";
  import { isRecordId } from "@nucleum/datafn/resource.utils";
  import InlineFeedbackText from "@nucleum/extensions/clipper/InlineFeedbackText.svelte";

  let isShowInlineToolbar: boolean = false;
  let popoverPosition: { top: number; left: number } = { top: 0, left: 0 };
  let activeHighlighter: IHighlighter | null = null;
  let selectedClip: { highlighterId: string; id: string } | null = null;
  let selectedClipId: string = "";
  let inlineToolbarFeedback: { message: string; type: AlertType } | string = "";
  let renderedHighlights: string[] = [];
  let isShowInProgress: boolean = false;
  onMount(() => {
    chrome.runtime.onMessage.addListener(messageListener);
    const sub = appEvents.subscribe((x) => {
      if (x.event === ClipperExtensionEvent.REFRESH_CLIPS_RENDERING) {
        logger.log({ at: "onMessage - text clipper", event: x.event });
        refreshPageClips();
      }
    });
    return () => {
      sub();
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  });
  async function handleTextSelection() {
    const selection = window.getSelection();
    let rect: DOMRect;
    if (selection?.focusNode && selection.anchorNode) {
      const focusNodeHasClass =
        selection.focusNode?.classList?.contains("memotron-clipped");
      const anchorNodeHasClass =
        selection.anchorNode?.classList?.contains("memotron-clipped");
      if (focusNodeHasClass && anchorNodeHasClass) {
        selectedClip = {
          highlighterId:
            selection.focusNode?.dataset?.highlighterId ??
            selection.focusNode?.style?.backgroundColor ??
            "",
          id: selection.focusNode?.dataset?.highlightId ?? ""
        };
        setTimeout(() => {
          let highlightId = selectedClip?.id;
          let focusElement = document.querySelector(
            `.memotron-clipped[data-highlight-id="${highlightId}"]`
          );
          if (focusElement) {
            rect = focusElement.getBoundingClientRect();
          }
          if (rect) {
            popoverPosition = {
              top: rect.top - 50,
              left: rect.left - 50
            };
            isShowInlineToolbar = true;
          }
        }, 100);
      } else {
        selectedClip = null;
      }
    }
    if (selection?.focusNode && !selectedClip) {
      const range = document.createRange();
      range.setStart(selection.focusNode, selection.focusOffset);
      range.setEnd(selection.focusNode, selection.focusOffset);
      rect = range.getBoundingClientRect();
      const isUpwards = selection.anchorOffset > selection.focusOffset;
      popoverPosition = {
        top: rect.top + (isUpwards ? -50 : 30),
        left: rect.left + (isUpwards ? -50 : -50)
      };
      if (selection?.toString().length > 0) {
        if (activeHighlighter) {
          isShowInProgress = true;
          await highlightSelectedText(selection, activeHighlighter);
          selectedClip = {
            id: selectedClipId,
            highlighterId: activeHighlighter.id ?? ""
          };
          isShowInProgress = false;
        }
        isShowInlineToolbar = true;
      } else {
        isShowInlineToolbar = false;
      }
    } else if (!selection?.focusNode) {
      isShowInlineToolbar = false;
    }
  }

  async function saveSelectedText(
    selectedText,
    container,
    selection,
    highlighterId: string
  ) {
    const anchorOffset = selection.anchorOffset;
    const focusOffset = selection.focusOffset;
    try {
      const data: IClipCapture = {
        contentType: NodeType.WEB_TEXT_BOOKMARK,
        body: {
          text: selectedText,
          highlighterId
        },
        text: selectedText,
        metadata: {
          container: getQuery(container),
          anchorNode: getQuery(selection.anchorNode),
          anchorOffset: anchorOffset,
          focusNode: getQuery(selection.focusNode),
          focusOffset: focusOffset
        }
      };
      return webpage.saveClip(data);
    } catch (e) {
      console.error("ERROR", e);
    }
  }

  async function highlightSelectedText(selection, highlighter: IHighlighter) {
    let selectedText = selection.toString();
    if (selectedText.length <= 0 || selectedText.trim().length === 0) return;
    let container = selection.getRangeAt(0).commonAncestorContainer;
    while (!container.innerHTML) {
      container = container.parentNode;
    }
    let textColor = "white";
    const result = await saveSelectedText(
      selectedText,
      container,
      selection,
      highlighter.id
    );
    if (!result?.id) {
      inlineToolbarFeedback = {
        message: "Clip not saved! Please try again.",
        type: AlertType.ERROR
      };
      return;
    }
    inlineToolbarFeedback = { message: "Clip saved!", type: AlertType.SUCCESS };
    selectedClipId = result.id;
    highlight(
      selectedText,
      container,
      selection,
      highlighter,
      textColor,
      result.id,
      highlightClickCallback
    );
    //selection.removeAllRanges();

    // Save the selected text and current URL to the database.
    // chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
    //     let link = tabs[0].url;
    // });
  }

  /**
   * removeAllHighlights() is causing unexpected behaviour.
   */
  export async function refreshPageClips() {
    try {
      // removeAllHighlights();
      const clips: ITextClip[] = $webpage.clips
        ?.filter((clip) => clip.contentType === NodeType.WEB_TEXT_BOOKMARK)
        ?.filter(activeResourceFilter) as ITextClip[];
      logger.debug({ at: "refreshPageClips", clips });
      const removedHighlights = renderedHighlights.filter(
        (x) => !clips.find((y) => y.id.toString() === x)
      );
      if (removedHighlights.length > 0) {
        removeHighlights(removedHighlights);
      }
      for (const record of clips) {
        const selection = {
          anchorNode: elementFromQuery(record.metadata?.anchorNode),
          anchorOffset: record.metadata?.anchorOffset,
          focusNode: elementFromQuery(record.metadata?.focusNode),
          focusOffset: record.metadata?.focusOffset
        };
        const container = elementFromQuery(record.metadata?.container);

        let textColor = "white";
        const highlighter = $highlightStore.highlighters.find(
          (x) => x.id === record.body.highlighterId
        );
        if (selection.anchorNode && selection.focusNode && container) {
          highlight(
            record.text ?? record.body.text,
            container,
            selection,
            highlighter,
            textColor,
            record.id,
            highlightClickCallback
          );
        }
      }
      renderedHighlights = clips.map((x) => x.id.toString());
      return false;
    } catch (e) {
      logger.error({ at: "refreshPageClips", error: e });
    }
  }

  const messageListener = (message, sender, sendResponse) => {
    logger.log({
      at: "onMessage - Text clipper",
      message,
      sender
    });
    if (message.event === ExtensionEvent.CLICK_FROM_SIDEPANEL) {
      if (message.data?.clip?.id) scrollToHighlight(message.data.clip.id);
    } else if (
      message.event === ClipperExtensionEvent.RESOLVE_TEXT_HIGHLIGHTS_ORDER
    ) {
      const elements = document.querySelectorAll("span.memotron-clipped");
      const data = Array.from(elements).map((element, index) => {
        return {
          id: element.getAttribute("data-highlight-id"),
          order: index
        };
      });
      const clipsOrder = data.filter(
        (v, i, a) => a.findIndex((t) => t.id === v.id) === i
      );
      sendResponse(clipsOrder);
    }
  };

  function scrollToHighlight(clipId: string) {
    const element = document.querySelector(`[data-highlight-id="${clipId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  export function onActivateColor(
    value: CustomEvent<IHighlighter | number> | IHighlighter | number
  ) {
    logger.log({ at: "onActivateColor", value });
    const detail =
      typeof value === "object" && value && "detail" in value
        ? value.detail
        : value;
    if (detail === 0) {
      activeHighlighter = null;
    } else if (typeof detail !== "number") {
      activeHighlighter = detail;
    }
  }
  async function onInlineColorSelection(highlighter: IHighlighter, clip?: any) {
    logger.log({ at: "onInlineColorSelection", detail: highlighter });
    try {
      const selection = window.getSelection();
      console.log({ selection, clip, highlighter });
      if (clip && isRecordId(clip.id)) {
        webpage.updateTextClipColor(clip.id, highlighter.id);
        changeColor(clip.id.toString(), highlighter);
        return;
      }
      if (selection && selection.toString().length > 0) {
        console.log("Selected text: ", selection.toString());
        inlineToolbarFeedback = "saving...";
        await highlightSelectedText(selection, highlighter);
        selectedClip = {
          highlighterId: highlighter.id,
          id: selectedClipId
        };
      }
    } catch (e) {
      logger.error({ at: "color selection", e });
    }
  }
  function highlightClickCallback(e: any) {
    logger.log({ at: "highlightClickCallback", e });
    if (!e?.id) return;

    selectedClip = {
      id: e.id,
      highlighterId: e.highlighterId
    };
    selectedClipId = e.id;
    handleTextSelection();
  }

  function onmouseup(e: MouseEvent) {
    //console.log("onmouseup", e);
    if (
      e.target instanceof HTMLElement &&
      e.target.nodeName === "PLASMO-CSUI"
    ) {
      return;
    }
    handleTextSelection();
  }
  function onscroll(e: Event) {
    // console.log("onscroll", e);
    handleTextSelection();
  }
  function onclick(e: MouseEvent) {
    console.log("onclick", e);
    handleTextSelection();
  }
</script>

{#if isShowInlineToolbar || isShowInProgress}
  <div
    style="position:fixed; top:{popoverPosition.top}px; left:{popoverPosition.left}px"
  >
    {#if isShowInlineToolbar}
      <InlineTextToolbar
        onColor={(highlighter) => {
          onInlineColorSelection(highlighter, selectedClip);
        }}
        bind:feedback={inlineToolbarFeedback}
        selectedHighlighterId={selectedClip?.highlighterId ?? ""}
        id={selectedClip?.id}
      />
    {:else if isShowInProgress}
      <div class="p-3 rounded-md bg-bgs1 border border-brs3">
        <InlineFeedbackText
          feedback={{ message: "Clipping...", type: AlertType.PROGRESS }}
          isRenderEmptyHeight={true}
        />
      </div>
    {/if}
  </div>
{/if}

<svelte:window {onscroll} {onmouseup} />
