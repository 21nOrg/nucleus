<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import Icon from "@21n/elements/Icon.svelte";
  import {
    BlockAction,
    type IBlock,
    type IEmbedBlockBody
  } from "@nucleum/features/memory/markdown/md.type";
  import {
    headingNodeTypes,
    mediaNodeTypeList,
    structuralNodeTypes,
    webNodeTypeList
  } from "@nucleum/features/memory/node/node.type";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import { onMount } from "svelte";

  import { Size } from "@21n/elements/size.enum";
  import { PopoverTriggerMethod } from "@nucleum/actions/popover.type";
  import {
    ContextMenuType,
    type IContextMenu,
    type IContextMenuItem
  } from "@21n/elements/contextMenu/context-menu.type";
  import { Placement } from "@21n/elements/direction.enum";
  import { cn } from "@21n/utils/ui.utils";
  import FocusRing from "@nucleum/features/memory/markdown/contextMenu/FocusRing.svelte";
  import BlockBrowser from "@nucleum/features/memory/markdown/blockBrowser/BlockBrowser.svelte";

  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";

  import { Action } from "@nucleum/client/config/action.enum";
  import { MemotronEvent } from "@nucleum/client/config/events/memory-event.enum";
  import { dispatchCustomEvent } from "@21n/utils/browser.utils";
  import { tabs } from "@21n/layout/topNav/tabs/tabs.store";
  import { popover, tooltip } from "@nucleum/actions/popover.action";
  import ContextMenu from "@21n/elements/contextMenu/ContextMenu.svelte";
  import { hoverable } from "@nucleum/actions/hover.action";
  import { downloadNode } from "@nucleum/features/memory/node/node.store";
  import { resolveResourceActionIcon } from "@nucleum/datafn/resource.utils";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  let {
    block,
    isFocusing = false,
    isBlockHovering = false,
    isDisableTooltip = false,
    isSoleBlock = false,
    isNodularizable = false,
    onAction = undefined,
    onNodularize = undefined,
    onPopoverVisibility = undefined
  }: {
    block: IBlock;
    isFocusing?: boolean;
    isBlockHovering?: boolean;
    isDisableTooltip?: boolean;
    isSoleBlock?: boolean;
    isNodularizable?: boolean;
    onAction?:
      | ((event: CustomEvent<{ action: BlockAction; data?: any }>) => void)
      | undefined;
    onNodularize?:
      ((event: CustomEvent<{ id: IRecordId }>) => void) | undefined;
    onPopoverVisibility?: ((event: CustomEvent<any>) => void) | undefined;
  } = $props();
  let isHovering: boolean = false;
  let isPopoverVisible: boolean = false;
  let contextMenuRef: any;
  type IContextMenuGroup = {
    group: string;
    items: IContextMenuItem[];
  };

  const isDebugLeftControls = false;

  function emitAction(detail: { action: BlockAction; data?: any }) {
    const event = new CustomEvent<{ action: BlockAction; data?: any }>(
      "action",
      {
        detail
      }
    );
    onAction?.(event);
  }

  function emitNodularize() {
    const event = new CustomEvent<{ id: IRecordId }>("nodularize", {
      detail: { id: block.id }
    });
    onNodularize?.(event);
  }

  function emitPopoverVisibility(detail: any) {
    const event = new CustomEvent("popoverVisibility", { detail });
    onPopoverVisibility?.(event);
  }

  const actions: Record<string, IContextMenuItem> = {
    [BlockAction.CONVERT]: {
      value: BlockAction.CONVERT,
      label: "Turn into",
      icon: resolveResourceActionIcon(ResourceActionType.CONVERT),
      secondStepComponent: {
        component: BlockBrowser,
        props: {
          isSingleColumnMode: true,
          onSelect: async (props?: any) => {
            emitAction({
              action: BlockAction.CONVERT,
              data: {
                toType: props?.type
              }
            });
            hideContextMenu();
          }
        }
      }
    },
    [BlockAction.DUPLICATE]: {
      value: BlockAction.DUPLICATE,
      icon: resolveResourceActionIcon(ResourceActionType.DUPLICATE),
      callback: async () => {
        emitAction({ action: BlockAction.DUPLICATE });
      }
    },
    [BlockAction.LINK]: {
      value: BlockAction.LINK,
      icon: resolveResourceActionIcon(ResourceActionType.LINK),
      callback: async () => {},
      secondStepComponent: {
        component: BlockBrowser
      }
    },
    [BlockAction.COPY_LINK]: {
      value: BlockAction.COPY_LINK,
      icon: resolveResourceActionIcon(ResourceActionType.COPY_LINK),
      callback: async () => {}
    },
    [BlockAction.INSERT]: {
      value: BlockAction.INSERT,
      icon: "insert-down",
      secondStepComponent: {
        component: BlockBrowser,
        props: {
          isSingleColumnMode: true,
          onSelect: async (props?: any) => {
            emitAction({
              action: BlockAction.INSERT,
              data: {
                blockType: props?.type
              }
            });
            hideContextMenu();
          }
        }
      }
    },
    [BlockAction.INSERT_ABOVE]: {
      value: BlockAction.INSERT_ABOVE,
      icon: "arrow-up",
      callback: async () => {}
    },
    [BlockAction.INSERT_BELOW]: {
      value: BlockAction.INSERT_BELOW,
      icon: "arrow-down",
      callback: async () => {}
    },
    [BlockAction.COPY_BLOCK_TEXT]: {
      value: BlockAction.COPY_BLOCK_TEXT,
      icon: resolveResourceActionIcon(ResourceActionType.COPY_CONTENTS),
      callback: async () => {
        emitAction({ action: BlockAction.COPY_BLOCK_TEXT });
      }
    },
    [BlockAction.GO_TO_EXTERNAL_LINK]: {
      value: BlockAction.GO_TO_EXTERNAL_LINK,
      icon: "weblink",
      callback: async () => {
        emitAction({ action: BlockAction.GO_TO_EXTERNAL_LINK });
      }
    },
    [BlockAction.DELETE]: {
      value: BlockAction.DELETE,
      icon: resolveResourceActionIcon(ResourceActionType.DELETE),
      callback: async () => {
        emitAction({ action: BlockAction.DELETE });
      }
    },
    [BlockAction.FOCUS]: {
      value: BlockAction.FOCUS,
      label: "Zoom in to heading",
      icon: "circle",
      callback: async () => {
        emitNodularize();
      }
    },
    [BlockAction.OPEN_AS_SPLIT]: {
      value: BlockAction.OPEN_AS_SPLIT,
      icon: "split",
      callback: async () => {
        navigation.openResource(block.id, AccessMode.FSPLIT);
      }
    },
    [BlockAction.OPEN_IN_FULL_SCREEN]: {
      value: BlockAction.OPEN_IN_FULL_SCREEN,
      icon: "fullscreen",
      callback: async () => {
        navigation.openResource(block.id, AccessMode.FULL);
      }
    },
    [BlockAction.OPEN_AS_TAB]: {
      value: BlockAction.OPEN_AS_TAB,
      icon: "tabs",
      callback: async () => {
        tabs.open(block.id);
      }
    },
    [BlockAction.COLOR]: {
      value: BlockAction.COLOR,
      icon: "palette",
      callback: async () => {},
      secondStepComponent: {
        component: BlockBrowser
      }
    },
    [BlockAction.CALLOUT_SETTINGS]: {
      value: BlockAction.CALLOUT_SETTINGS,
      icon: "bookmark",
      callback: async () => {},
      secondStepComponent: {
        component: BlockBrowser
      }
    },
    [BlockAction.SHORTCUTS]: {
      value: BlockAction.SHORTCUTS,
      icon: "command",
      action: Action.MARKDOWN_SHORTCUTS
    },
    [BlockAction.DOWNLOAD]: {
      value: BlockAction.DOWNLOAD,
      icon: "download",
      callback: async () => {
        const embedBody = resolveEmbedBody(block);
        if (embedBody?.id) {
          downloadNode(embedBody.id);
        }
      }
    }
  };

  function resolveEmbedBody(block: IBlock): IEmbedBlockBody | undefined {
    if (block.contentType !== NodeType.EMBED) return undefined;
    if (typeof block.body === "string") return undefined;
    if (!("subType" in block.body || "id" in block.body)) return undefined;
    return block.body;
  }

  function resolveEmbedPreviewToggleAction() {
    const embedBody = resolveEmbedBody(block);
    return {
      value: BlockAction.EMBED_PREVIEW_TOGGLE,
      icon: "hide",
      label: "Hide preview",
      type: ContextMenuType.SWITCH,
      initialValue: embedBody?.isHidePreview ?? false,
      callback: async (checked: boolean) => {
        emitAction({
          action: BlockAction.EMBED_PREVIEW_TOGGLE,
          data: {
            isHidePreview: checked
          }
        });
        hideContextMenu();
      }
    };
  }

  /**
   *
   *
   * TODO
   * * Resolve state propagation if a heading node is opened as split (Disabled for now)
   *
   *
   * @param block
   */
  function resolveContextMenu(
    block: IBlock,
    isSoleBlock?: boolean
  ): IContextMenu {
    const isStructuralBlock = structuralNodeTypes.includes(block.contentType);
    const isHeadingBlock = headingNodeTypes.includes(block.contentType);
    let items: IContextMenuGroup[] = [];
    if (isHeadingBlock) {
      items = [
        {
          group: "base",
          items: [
            actions[BlockAction.FOCUS],
            actions[BlockAction.CONVERT],
            actions[BlockAction.INSERT],
            // actions[BlockAction.LINK],
            actions[BlockAction.DUPLICATE]
          ]
        },
        {
          group: "more",
          items: [
            // actions[BlockAction.COPY_LINK],
            actions[BlockAction.COPY_BLOCK_TEXT],
            // actions[BlockAction.OPEN_AS_SPLIT],
            actions[BlockAction.OPEN_AS_TAB],
            actions[BlockAction.SHORTCUTS]
          ]
        }
      ];
    } else if (isStructuralBlock) {
      items = [
        {
          group: "base",
          items: [
            actions[BlockAction.CONVERT],
            actions[BlockAction.INSERT],
            actions[BlockAction.DUPLICATE]
          ]
        },
        {
          group: "more",
          items: [actions[BlockAction.SHORTCUTS]]
        }
      ];
    } else {
      items = [
        {
          group: "base",
          items: [
            actions[BlockAction.CONVERT],
            actions[BlockAction.INSERT],
            // block.contentType === NodeType.CALLOUT
            //   ? actions[BlockAction.CALLOUT_SETTINGS]
            //   : actions[BlockAction.COLOR],
            // actions[BlockAction.LINK],
            actions[BlockAction.DUPLICATE]
          ]
        },
        {
          group: "more",
          items: [
            // actions[BlockAction.COPY_LINK],
            actions[BlockAction.COPY_BLOCK_TEXT],
            actions[BlockAction.SHORTCUTS]
          ]
        }
      ];
    }

    if (!isSoleBlock) {
      items.forEach((group) => {
        if (group.group === "more") {
          group.items.push(actions[BlockAction.DELETE]);
        }
      });
    }
    const embedBody = resolveEmbedBody(block);
    if (embedBody) {
      if (
        embedBody.id &&
        embedBody.subType &&
        mediaNodeTypeList.includes(embedBody.subType)
      ) {
        items.forEach((group) => {
          if (group.group === "base") {
            group.items.push(actions[BlockAction.DOWNLOAD]);
          }
        });
      }
      if (
        embedBody.subType === NodeType.WEB_PAGE ||
        embedBody.subType === NodeType.PDF ||
        embedBody.subType === NodeType.GIST ||
        embedBody.subType === NodeType.YOUTUBE_VIDEO ||
        embedBody.subType === NodeType.YOUTUBE_SHORT
      ) {
        items.forEach((group) => {
          if (group.group === "base") {
            group.items.push(resolveEmbedPreviewToggleAction());
          }
        });
      }
      if (embedBody.subType && webNodeTypeList.includes(embedBody.subType)) {
        items.forEach((group) => {
          if (group.group === "base") {
            group.items.push(actions[BlockAction.GO_TO_EXTERNAL_LINK]);
          }
        });
      }
    }
    return items;
  }

  function onNodularizeClick(e?: MouseEvent) {
    emitNodularize();
    e?.stopPropagation();
  }

  onMount(() => {
    window.addEventListener(
      MemotronEvent.BLOCK_HOVER,
      onOtherBlocksHoverListener
    );
    return () => {
      window.removeEventListener(
        MemotronEvent.BLOCK_HOVER,
        onOtherBlocksHoverListener
      );
    };
  });

  /**
   * Disabling this for time being as it is resulting in premature closing of popover when the width of the screen is less and the popover is opening over blocks and when secondary popover is opened on the right, the gap between popovers is getting tiggered as hover event on other blocks.
   * @param e
   */
  function onOtherBlocksHoverListener(e: Event) {
    const detail = (e as CustomEvent<{ id?: string }>).detail;
    if (!detail || detail.id === block.id) return;
    return;
    if (isPopoverVisible) {
      hideContextMenu();
    }
  }
  function hideContextMenu() {
    contextMenuRef.dispatchEvent(new CustomEvent("hide"));
  }

  function onPopoverChange(e: Event) {
    const detail = (e as CustomEvent<{ open?: boolean }>).detail;
    isPopoverVisible = detail?.open ?? false;
    emitPopoverVisibility(isPopoverVisible);
  }
</script>

<div
  class={cn("h-full w-full flex justify-center rounded-l-md border", {
    "bg-bgs3 border-brs2": isHovering,
    "border-transparent": !isHovering
  })}
  use:popover={{
    placement: Placement.Left,
    content: ContextMenu,
    triggerMethod: [PopoverTriggerMethod.CLICK],
    componentProps: {
      menuResolver: () => resolveContextMenu(block, isSoleBlock),
      size: Size.lg,
      heading: "Options",
      bottomRender: "",
      onSelect: () => {
        hideContextMenu();
      }
    },
    id: "leftControls",
    groupId: "leftControlsGroup",
    offsetInPx: 8
  }}
  onchange={onPopoverChange}
  bind:this={contextMenuRef}
  use:hoverable={{
    onHover: (e) => {
      isHovering = e;
      if (isHovering) {
        dispatchCustomEvent(MemotronEvent.BLOCK_HOVER, { id: block.id });
      }
    }
  }}
>
  <button
    class="flex w-full h-full items-center justify-center"
    use:tooltip={{
      disabled: isDisableTooltip || isPopoverVisible,
      text: isNodularizable
        ? "Click ring to zoom in"
        : "Drag to rearrange / Click for options",
      direction: Placement.Bottom,
      delay: 500
    }}
    tabindex="-1"
  >
    {#if isNodularizable && (isBlockHovering || isDebugLeftControls || isPopoverVisible || isHovering || isFocusing)}
      <FocusRing onclick={onNodularizeClick} />
    {:else}
      <span
        class={cn("flex w-full h-full justify-center items-center", {
          "opacity-100":
            isBlockHovering ||
            isDebugLeftControls ||
            isPopoverVisible ||
            isHovering ||
            isFocusing,
          "opacity-0": !(
            isBlockHovering ||
            isDebugLeftControls ||
            isPopoverVisible ||
            isHovering ||
            isFocusing
          )
        })}
      >
        <Icon icon="rearrange" size={Size.lg} class="fill-fgs3" />
      </span>
    {/if}
  </button>
</div>
