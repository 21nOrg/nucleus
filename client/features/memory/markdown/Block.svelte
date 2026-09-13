<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import {
    BlockAction,
    type IBlock,
    type IBlockBody,
    type IListBlockBody,
    type INonSimpleTextBlockBody
  } from "@nucleum/features/memory/markdown/md.type";
  import { getContext, onMount, tick } from "svelte";
  import { get } from "svelte/store";
  import BlockContent from "@nucleum/features/memory/markdown/content/BlockContent.svelte";
  import LeftControls from "@nucleum/features/memory/markdown/contextMenu/LeftControls.svelte";
  import type { MdStoreType } from "@nucleum/features/memory/markdown/markdown.store";
  import {
    embedNodeTypeList,
    headingNodeTypes,
    mediaNodeTypeList,
    type StructuralNodeType,
    structuralNodeTypes,
    simpleTextNodeTypeList,
    webNodeTypeList,
    nonSimpleTextNodeTypeList,
    listNodeTypes
  } from "@nucleum/features/memory/node/node.type";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import { cn } from "@21n/utils/ui.utils";
  import { setContext } from "svelte";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { copyToClipboard } from "@21n/utils/utils";
  import {
    confirmationNotification,
    toasts
  } from "@nucleum/stores/notification.store";
  import { dispatchCustomEvent } from "@21n/utils/browser.utils";
  import { MemotronEvent } from "@nucleum/client/config/events/memory-event.enum";
  import { hoverable } from "@nucleum/actions/hover.action";
  import view from "@nucleum/stores/view.store";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import { isSameResource } from "@nucleum/datafn/resource.utils";
  import {
    resolveDefaultBodyForBlock,
    textToMdBlocks
  } from "@nucleum/features/memory/markdown/markdown.utils";
  import {
    resolvePlainOffsetForMdEnd,
    resolvePlainText,
    splitMarkdownAtPlainOffset
  } from "@21n/elements/markdown/markdown.utils";
  import { isValidString } from "@21n/shared-utils/text.utils";
  import Icon from "@21n/elements/Icon.svelte";
  import { fileDrop } from "@nucleum/actions/fileDrop.action";
  import { MAX_FILE_SIZE_MB } from "@nucleum/stores/files/file.constants";
  import { resolveFileUploadErrorMessage } from "@nucleum/features/memory/capture/upload-error.utils";
  import { generateResourceId } from "@nucleum/datafn/id.utils";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import {
    resolveMultipleFilesData,
    resolvePasteContents
  } from "@nucleum/features/memory/capture/capture.utils";
  import Button from "@21n/elements/button/Button.svelte";
  import { Size } from "@21n/elements/size.enum";

  import account from "@nucleum/stores/account.store";

  import { wait } from "@21n/shared-utils/wait";

  import type { IMultiFileCaptureData } from "@nucleum/features/memory/capture/capture.type";
  import { AlertType } from "@nucleum/stores/notifications/notification.type";
  import FocusRing from "@nucleum/features/memory/markdown/contextMenu/FocusRing.svelte";
  import { tooltip } from "@nucleum/actions/popover.action";
  import { Placement } from "@21n/elements/direction.enum";
  import { observeAttributes } from "@nucleum/actions/observe.action";
  import context from "@nucleum/stores/context.store";

  import { rightswipe } from "@nucleum/actions/gestures.action";
  import {
    ActiveCaptureStore,
    type IActiveCaptureStore
  } from "@nucleum/features/memory/capture/capture.store";

  import { Context } from "@nucleum/stores/appStore.type";
  import { datafn } from "@nucleum/datafn/datafn.store";

  let {
    block = $bindable(),
    mdStore,
    index,
    isSelected = false,
    isRearrangeBlockInSelectionMode = false,
    isInSelectionMode = false,
    onNodularize = undefined,
    onPopoverVisibility = undefined,
    onSelect = undefined
  }: {
    block: IBlock;
    mdStore: MdStoreType;
    index: number;
    isSelected?: boolean;
    isRearrangeBlockInSelectionMode?: boolean;
    isInSelectionMode?: boolean;
    onNodularize?:
      ((event: CustomEvent<{ id: IRecordId }>) => void) | undefined;
    onPopoverVisibility?: ((event: CustomEvent<any>) => void) | undefined;
    onSelect?: ((event: CustomEvent<void>) => void) | undefined;
  } = $props();
  let isHovering = $state(false);
  let isFocusing = $state(false);
  let contentRefreshId = $state(new Date().getTime());
  let isDragging = $state(false);
  let progressState = $state<string | undefined>();
  const uploadProgressElementId = "node-embed-upload-progress";
  const isNodularizable = $derived(
    $mdStore.params?.isNodular && headingNodeTypes.includes(block.contentType)
  );
  const isLeftControlsEnabled = $derived(
    $mdStore.params?.isNodular && !$view.isConstrainedWidth
  );
  const isSoleBlock = $derived(
    isSameResource($mdStore.blocks[0], block) && $mdStore.blocks.length === 1
  );

  const markdownContext = getContext<any>(Context.MARKDOWN);
  const nodeContext = getContext<any>(Context.NODE);
  const contentContext = getContext<any>(Context.CONTENT);
  const captureContext = getContext<any>(Context.CAPTURE);
  let captureStore = $state<IActiveCaptureStore | undefined>();
  $effect(() => {
    if (nodeContext?.id || captureContext?.id) {
      const id = nodeContext?.id
        ? nodeContext?.id + "capture"
        : captureContext?.id;
      captureStore = ActiveCaptureStore.resolve(id);
      return;
    }
    captureStore = undefined;
  });

  const blockContext = {
    publish: blockEvent
  };
  setContext(Context.BLOCK, blockContext);

  function emitNodularize(detail: { id: IRecordId }) {
    const event = new CustomEvent<{ id: IRecordId }>("nodularize", { detail });
    onNodularize?.(event);
  }

  function emitPopoverVisibility(detail: any) {
    const event = new CustomEvent("popoverVisibility", { detail });
    onPopoverVisibility?.(event);
  }

  function emitSelect() {
    const event = new CustomEvent<void>("select");
    onSelect?.(event);
  }

  function propagate(event: string, data: any) {
    markdownContext({
      event,
      data: {
        ...data,
        source: block.id
      }
    });
  }
  function propagateAsAction(action: string, data: any) {
    markdownContext({
      event: "action",
      data: {
        ...data,
        source: block.id,
        action
      }
    });
  }

  function refresh() {
    contentRefreshId = new Date().getTime();
  }

  onMount(() => {
    const unsubscribe = mdStore?.alter?.subscribe((x) => {
      if (!x?.action) return;
      if (
        x.action !== BlockAction.CHANGE &&
        x.blockId &&
        isSameResource(x.blockId, block.id)
      ) {
        blockEvent(x.action, x?.data);
        return;
      }
      const b = x?.block;
      if (b && isSameResource(b, block.id)) {
        block = b;
        if (headingNodeTypes.includes(b.contentType)) {
          propagate(BlockAction.CHANGE, { label: b.label });
        } else {
          propagate(BlockAction.CHANGE, { body: b.body });
        }
        refresh();
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  });

  function blockEvent(action: BlockAction, data: any) {
    logger.log({ at: "blockContextEventListener", action, data, block });
    if (!action) return;

    switch (action) {
      case BlockAction.CONVERT:
        handleConvertAction(data);
        break;

      case BlockAction.DELETE:
        deleteBlock();
        break;

      case BlockAction.INSERT:
        handleInsertAction(data);
        break;

      case BlockAction.PASTE:
        handlePaste(data);
        break;

      case BlockAction.MOVEUP:
      case BlockAction.MOVEDOWN:
        const changedBlocks = mdStore.move(block.id, action);
        if (changedBlocks && changedBlocks.length > 0) {
          changedBlocks.forEach((b) => {
            propagate(BlockAction.CHANGE, { id: b.id, body: b.body });
          });
        }
        propagateAsAction(action, data);
        break;

      case BlockAction.DUPLICATE: {
        const newBlock = mdStore.duplicate(block.id);
        propagateAsAction(action, newBlock);
        break;
      }

      case BlockAction.TAB:
      case BlockAction.SHIFT_TAB:
        handleTabAction(action);
        break;

      case BlockAction.COPY_BLOCK_TEXT:
        const text = resolveBodyText();
        if (!text) return;
        copyToClipboard(text);
        toasts.success("Block copied to clipboard");
        break;

      case BlockAction.EMBED_PREVIEW_TOGGLE:
        if (block.contentType === NodeType.EMBED) {
          block.body.isHidePreview = data.isHidePreview;
          propagate(BlockAction.CHANGE, {
            body: {
              ...block.body,
              isHidePreview: data.isHidePreview
            }
          });
        }
        break;

      case BlockAction.BACKSPACE_WITH_CONTENT:
        handleBackspaceWithContent();
        break;

      case BlockAction.GO_TO_EXTERNAL_LINK:
        handleGoToExternalLink();
        break;

      default:
        propagate(action, data);
        break;
    }
  }

  function deleteBlock() {
    mdStore.deleteBlock(block.id);
    propagateAsAction(BlockAction.DELETE, {});
  }

  async function handleGoToExternalLink() {
    if (!block.body || typeof block.body !== "object" || !("id" in block.body))
      return;
    const result = await datafn.node.query({
      select: ["id", "url"],
      filters: { id: (block.body as any).id },
      limit: 1,
      metadata: {
        includeTrashed: true,
        includeArchived: true
      }
    });
    const node = result.data?.[0];
    if (!node || !node.url) return;
    navigation.openLink(node.url);
  }

  function handleBackspaceWithContent() {
    const currentBlockText = resolveBodyText();
    const previousBlock = mdStore.getPreviousSibling(block.id);
    const previousBlockText = resolveBodyText(previousBlock);
    const offset = resolvePlainOffsetForMdEnd(previousBlockText ?? "");
    if (
      !currentBlockText ||
      !previousBlock ||
      ![
        ...simpleTextNodeTypeList,
        ...nonSimpleTextNodeTypeList,
        ...headingNodeTypes
      ].includes(previousBlock.contentType)
    ) {
      return;
    }
    const modifiedPreviousBlockText = editBlockText(
      previousBlock,
      currentBlockText,
      { isAppend: true }
    );
    if (headingNodeTypes.includes(previousBlock.contentType)) {
      previousBlock.label = modifiedPreviousBlockText as string;
    } else {
      previousBlock.body = modifiedPreviousBlockText;
    }
    mdStore.alterBlock({ action: BlockAction.CHANGE, block: previousBlock });
    mdStore.focusBlock(previousBlock.id, { xOffset: offset });
    mdStore.deleteBlock(block.id, { isPreventFocus: true });
    propagateAsAction(BlockAction.DELETE, {});
  }

  function handleConvertAction(data: any) {
    const fromType = block.contentType;
    if (
      [...mediaNodeTypeList, ...webNodeTypeList, ...embedNodeTypeList].includes(
        data.toType
      )
    ) {
      const subType = data.toType;
      data.toType = NodeType.EMBED;
      data.body = { subType };
    } else if (simpleTextNodeTypeList.includes(data.toType)) {
      const text = data.bodyText ?? resolveBodyText() ?? "";
      data.body = text;
    } else if (nonSimpleTextNodeTypeList.includes(data.toType)) {
      const text: string = data.bodyText ?? resolveBodyText() ?? "";
      let body = resolveDefaultBodyForBlock(data.toType, text);
      if (
        data.params?.indentLevel ||
        data.params?.listOrder ||
        data.params?.isChecked
      ) {
        body = body as IListBlockBody;
        body = {
          ...body,
          indent: data.params?.indentLevel ?? 0,
          order: data.params?.listOrder ?? 0,
          checked: data.params?.isChecked ?? false
        };
      }
      data.body = body;
    } else if (headingNodeTypes.includes(data.toType)) {
      const text: string = data.bodyText ?? resolveBodyText() ?? "";
      Reflect.deleteProperty(block, "body");
      data.label = text;
    } else if (data.toType === NodeType.EMBED) {
      data.body = { subType: NodeType.UNKNOWN };
    }
    block.contentType = data.toType;
    if (data.body) block.body = data.body;
    logger.log({ at: "handleConvertAction - data", data, fromType });
    propagateAsAction(BlockAction.CONVERT, { ...data, fromType });
    if (data.body !== undefined) {
      block.body = data.body;
      propagate(BlockAction.CHANGE, { body: data.body });
    }
    if (data.label !== undefined) {
      block.label = data.label;
      propagate(BlockAction.CHANGE, { label: data.label });
    }
    block = { ...block };
    refresh();
    insertBufferBlockIfRequired(block.id, data.toType);
    const blockId = block.id;
    void tick().then(() => {
      const focusTarget = get(mdStore.focus);
      if (focusTarget?.id && !isSameResource(focusTarget.id, blockId)) return;
      mdStore.focusBlock(blockId, { isBottom: true });
    });
  }

  /**
   * Resolves body text for simple text and non simple text node types
   */
  function resolveBodyText(blockParam?: IBlock): string | undefined {
    const blockObj = blockParam ?? block;
    if (simpleTextNodeTypeList.includes(blockObj.contentType))
      return blockObj.body as string;
    else if (nonSimpleTextNodeTypeList.includes(blockObj.contentType))
      return (blockObj.body as INonSimpleTextBlockBody).text;
    else if (headingNodeTypes.includes(blockObj.contentType)) {
      return (
        blockObj.label ??
        (typeof blockObj.body === "string" ? blockObj.body : undefined)
      );
    }
  }

  /**
   * Handles insert action for block
   *
   * If data.blockType is not present, checks whether the caret position is in the middle of text and moves the text after the caret to the newly inserted block.
   * @param data
   */
  function handleInsertAction(data: any) {
    let newBlockId;
    let newText = "";
    if (data?.blockType) {
      if (
        mediaNodeTypeList.includes(data.blockType) ||
        webNodeTypeList.includes(data.blockType) ||
        embedNodeTypeList.includes(data.blockType)
      ) {
        const subType = data.blockType;
        data.blockType = NodeType.EMBED;
        data.body = { subType };
      } else if (nonSimpleTextNodeTypeList.includes(data.blockType)) {
        data.body = resolveDefaultBodyForBlock(data.blockType, "");
      } else if (simpleTextNodeTypeList.includes(data.blockType)) {
        data.body = "";
      } else if (headingNodeTypes.includes(data.blockType)) {
        data.label = "";
      } else if (data.blockType === NodeType.EMBED) {
        data.body = { subType: NodeType.UNKNOWN };
      }
    } else {
      if (!data) data = {};
      data.blockType = NodeType.SIMPLE_TEXT;
      const currentBlockText = resolveBodyText();
      const plainText = resolvePlainText(currentBlockText ?? "");
      if (
        currentBlockText &&
        plainText &&
        data?.caretPosition &&
        typeof data.caretPosition.totalOffset === "number" &&
        data.caretPosition.totalOffset >= 0 &&
        data.caretPosition.totalOffset < plainText.length
      ) {
        let preText = "";
        if (data.caretPosition.totalOffset === 0) {
          newText = currentBlockText;
          preText = "";
        } else {
          const { before, after } = splitMarkdownAtPlainOffset(
            currentBlockText,
            data.caretPosition.totalOffset
          );
          newText = after;
          preText = before;
        }
        const modifiedBody = editBlockText(block, preText);
        if (headingNodeTypes.includes(block.contentType)) {
          block.label = modifiedBody as string;
          propagate(BlockAction.CHANGE, {
            label: modifiedBody as string
          });
        } else {
          block.body = modifiedBody;
          propagate(BlockAction.CHANGE, {
            body: modifiedBody
          });
        }
        refresh();
      }
      data.body = newText;
    }

    if (
      listNodeTypes.includes(block.contentType) &&
      (data.blockType === NodeType.SIMPLE_TEXT ||
        listNodeTypes.includes(data.blockType))
    ) {
      const currentBody = block.body as IListBlockBody;
      if (data.blockType === NodeType.SIMPLE_TEXT)
        data.blockType = block.contentType;
      data.body = {
        indent:
          Number.isNaN(currentBody.indent) || !currentBody.indent
            ? 0
            : currentBody.indent,
        text: newText,
        order: currentBody.order !== undefined ? currentBody.order + 1 : 1
      };
    }

    if (structuralNodeTypes.includes(data.blockType)) {
      newBlockId = mdStore.insertStructualBlock(
        block.id,
        data.blockType as StructuralNodeType
      );
    } else newBlockId = mdStore.insert({ source: block.id, ...data });

    if (!newBlockId) return;
    propagateAsAction(BlockAction.INSERT, { ...data, id: newBlockId });
    insertBufferBlockIfRequired(newBlockId, data.blockType);
  }

  function insertBufferBlockIfRequired(
    newBlockId: IRecordId,
    newBlockType: NodeType
  ) {
    if (
      ![
        ...mediaNodeTypeList,
        ...structuralNodeTypes,
        NodeType.CODE,
        NodeType.EMBED
      ].includes(newBlockType)
    )
      return;
    const isCurrentIsLastBlock = mdStore.isLastBlock(newBlockId);
    if (!isCurrentIsLastBlock) return;
    const bufferBlock = {
      blockType: NodeType.SIMPLE_TEXT,
      body: ""
    };
    const bufferBlockId = mdStore.insert({
      source: newBlockId,
      ...bufferBlock
    });
    propagateAsAction(BlockAction.INSERT, {
      ...bufferBlock,
      id: bufferBlockId
    });
  }

  function handleTabAction(action: BlockAction.TAB | BlockAction.SHIFT_TAB) {
    if (!listNodeTypes.includes(block.contentType)) return;

    const currentBody = block.body as IListBlockBody;
    const previousSibling = mdStore?.getPreviousSibling(block.id);
    if (
      !previousSibling ||
      !listNodeTypes.includes(previousSibling.contentType)
    )
      return;
    if (action === BlockAction.TAB) {
      currentBody.indent += 1;
    } else if (action === BlockAction.SHIFT_TAB) {
      if (currentBody.indent === 0) return;
      currentBody.indent -= 1;
    }
    let currentOrder = currentBody.order;
    if (
      block.contentType === NodeType.ORDERED_LIST &&
      previousSibling &&
      previousSibling.contentType === NodeType.ORDERED_LIST
    ) {
      const previousSiblingBody = previousSibling?.body as IListBlockBody;

      if (previousSiblingBody.indent === currentBody.indent) {
        currentBody.order = (previousSiblingBody.order ?? 0) + 1;
      } else if (previousSiblingBody.indent > currentBody.indent) {
        const previousListParent = mdStore?.getListParentOrdered(
          previousSibling.id,
          currentBody.indent
        );
        if (previousListParent) {
          currentBody.order =
            ((previousListParent.body as IListBlockBody)?.order ?? 0) + 1;
        } else {
          currentBody.order = 1;
        }
      } else {
        currentBody.order = 1;
      }
    }
    block.body = currentBody;
    if (block.contentType === NodeType.ORDERED_LIST) {
      const changedBlocks = mdStore.reconcileOrderedList(
        block.id,
        currentBody,
        action,
        currentOrder ?? 0
      );
      if (changedBlocks && changedBlocks.length > 0) {
        changedBlocks.forEach((b) => {
          propagate(BlockAction.CHANGE, {
            id: b.id,
            body: b.body
          });
        });
      }
    }
    propagate(BlockAction.CHANGE, {
      body: {
        ...currentBody,
        indent: currentBody.indent,
        order: currentBody.order
      }
    });
  }

  function editBlockText(
    block: IBlock,
    newText: string,
    params?: { isAppend?: boolean }
  ) {
    switch (block.contentType) {
      case NodeType.LIST:
      case NodeType.ORDERED_LIST:
      case NodeType.CHECKLIST:
        return {
          ...(block.body as IListBlockBody),
          text: appendIfRequired(block.body.text, newText)
        };
      case NodeType.CODE:
      case NodeType.CALLOUT:
        return {
          ...(block.body as INonSimpleTextBlockBody),
          text: appendIfRequired(block.body.text, newText)
        };
      case NodeType.SIMPLE_TEXT:
      case NodeType.QUOTE:
        return appendIfRequired(block.body, newText);
      case NodeType.HEADING1:
      case NodeType.HEADING2:
      case NodeType.HEADING3:
      case NodeType.HEADING4:
      case NodeType.HEADING5:
        return appendIfRequired(block.label ?? "", newText);
      default:
        return newText;
    }

    function appendIfRequired(text: string, newText: string) {
      if (params?.isAppend) return text + newText;
      return newText;
    }
  }

  function onContextMenuAction(
    e: CustomEvent<{
      action: BlockAction;
      data?: any;
    }>
  ) {
    blockEvent(e.detail.action, e.detail.data);
  }

  function onBlockUpdate(e: CustomEvent<any>) {
    const detail: Partial<IBlockBody> = e?.detail;
    logger.log({ at: "onBlockUpdate", detail, block });
    if (detail === undefined || detail === null) return;
    if (
      headingNodeTypes.includes(block.contentType) &&
      typeof detail === "string"
    ) {
      block.label = detail;
      block = { ...block };
      propagate(BlockAction.CHANGE, { label: detail });
      return;
    }

    if (block.body !== undefined && block.body !== null) {
      if (
        typeof detail === "object" &&
        detail !== null &&
        typeof block.body === "object" &&
        block.body !== null
      ) {
        block.body = {
          ...block.body,
          ...detail
        };
      } else {
        block.body = detail as IBlockBody;
      }
    } else {
      block.body = detail as IBlockBody;
    }
    block = { ...block };
    propagate(BlockAction.CHANGE, { body: block.body });
  }

  /**
   * Handles paste event.
   * @param event
   */
  async function handlePaste(event: ClipboardEvent) {
    try {
      if (!(event instanceof ClipboardEvent)) return;
      event.preventDefault();
      progressState = "Pasting";
      const data = await resolvePasteContents(event, {
        maxFileSizeInMb: MAX_FILE_SIZE_MB
      });
      if (!data || data.error) {
        throw new Error(data?.error ?? "Failed to paste. Please try again.");
      }
      if (data.multipleFiles) {
        progressState = "Uploading";
        await insertMultipleFiles(data.multipleFiles);
        progressState = undefined;
        return;
      }
      let newBlock: Pick<IBlock, "contentType" | "body"> | undefined;
      let fileEmbed: any;
      if (data.file) {
        progressState = "Uploading";
        fileEmbed = await captureStore?.saveFile(data.file, data.contentType, {
          isEmbedContext: true,
          creationContext: nodeContext?.id ?? undefined
        });
        if (!fileEmbed || fileEmbed.error || !("id" in fileEmbed)) {
          throw new Error("captureStore.saveFile failed");
        }
        newBlock = {
          contentType: NodeType.EMBED,
          body: {
            id: fileEmbed.id,
            subType: fileEmbed.contentType
          }
        };
        processPasteOrDrop(newBlock, fileEmbed);
        progressState = undefined;
        return;
      }

      if (!data.text) return;
      if (data.textMetadata?.isMultiBlockText) {
        const blocks = textToMdBlocks(data.text, nodeContext?.contentType);
        mdStore.insertMany(block.id, blocks);
        propagateAsAction(BlockAction.INSERT_MANY, { blocks });
        progressState = undefined;
        return;
      }
      if (
        data.textMetadata?.isEmbed ||
        (data.contentType &&
          [NodeType.YOUTUBE_VIDEO, NodeType.YOUTUBE_SHORT].includes(
            data.contentType
          ))
      ) {
        const webpageNode = await captureStore?.saveWebpage(data.text, {
          contentType: data.contentType,
          isEmbedContext: true,
          creationContext: nodeContext?.id ?? undefined
        });
        const hasWebpageNodeError =
          typeof webpageNode === "object" &&
          webpageNode !== null &&
          "error" in webpageNode &&
          Boolean(webpageNode.error);
        if (!webpageNode || hasWebpageNodeError) return;
        newBlock = {
          contentType: NodeType.EMBED,
          body: {
            id: webpageNode.id,
            subType: webpageNode.contentType
          }
        };
        processPasteOrDrop(newBlock, webpageNode);
        progressState = undefined;
        return;
      }
      if (data.contentType === NodeType.CODE) {
        newBlock = {
          contentType: NodeType.CODE,
          body: {
            text: data.text,
            language: data.textMetadata?.codeLanguage
          }
        };
        processPasteOrDrop(newBlock);
        progressState = undefined;
        return;
      }
      progressState = undefined;
    } catch (e) {
      logger.error({ at: "handlePaste", error: e });
      toasts.error(
        (e as Error).message ?? "Failed to paste. Please try again."
      );
      progressState = undefined;
    }
  }

  /**
   * Processes paste or drop event - inserts new block if the current block is not empty or converts to new block type
   * @param newBlock
   * @param fileEmbed
   */
  function processPasteOrDrop(
    newBlock: Pick<IBlock, "contentType" | "body">,
    fileEmbed?: any
  ) {
    if (!newBlock) return;
    if (
      block.contentType === NodeType.SIMPLE_TEXT &&
      !isValidString(block.body)
    ) {
      convert(newBlock, fileEmbed);
      return;
    }
    insert(newBlock, fileEmbed);

    function convert(
      newBlock: Pick<IBlock, "contentType" | "body">,
      fileEmbed?: any
    ) {
      block.contentType = newBlock.contentType;
      propagateAsAction(BlockAction.CONVERT, {
        fromType: block.contentType,
        toType: newBlock.contentType
      });
      block.body = newBlock.body;
      propagate(BlockAction.CHANGE, {
        body: newBlock.body
      });
      insertBufferBlockIfRequired(block.id, newBlock.contentType);
      if (fileEmbed) {
        addMention(fileEmbed, block.id);
      }
    }

    function insert(
      newBlock: Pick<IBlock, "contentType" | "body">,
      fileEmbed?: any
    ) {
      //TODO - case of pasting link for inline links
      let data = {
        blockType: newBlock?.contentType,
        body: newBlock?.body
      };
      const newBlockId = mdStore.insert({ source: block.id, ...data });
      if (!newBlockId) {
        throw new Error("mdStore.insert failed");
      }
      propagateAsAction(BlockAction.INSERT, { ...data, id: newBlockId });
      insertBufferBlockIfRequired(newBlockId, data.blockType);
      if (fileEmbed) {
        addMention(fileEmbed, newBlockId);
      }
    }
  }

  function addMention(fileEmbed: any, location: IRecordId) {
    contentContext.publish("mention", {
      location,
      item: fileEmbed
    });
  }

  async function handleFileDrop(
    all: File[],
    valid: File[],
    errors: { file: File; type: string }[]
  ) {
    try {
      if (account.isCloudUserAndOffline()) {
        confirmationNotification.notify({
          title: "Offline",
          message:
            "You seem to be offline. File upload is not yet available in offline mode.",
          type: AlertType.ERROR
        });
        return;
      }
      if (block.contentType === NodeType.EMBED && !block.body.id) {
        return;
      }
      const hasInvalidFiles = all.some(
        (file) => !isValidString(file.type) || file.size === 0
      );
      if (hasInvalidFiles) {
        toasts.error("Invalid files detected");
        return;
      }

      if (errors && errors.length > 0) {
        let error = resolveFileUploadErrorMessage(errors, {
          maxFileSizeMB: MAX_FILE_SIZE_MB
        });
        toasts.error(error);
        return;
      }
      if (all.length === 0) return;
      progressState = "Uploading";
      if (all.length !== 1) {
        await handleMultiFileDrop(all);
        return;
      }
      let file = all[0];
      const fileEmbed = await captureStore?.saveFile(file, undefined, {
        isEmbedContext: true,
        creationContext: nodeContext?.id ?? undefined
      });
      if (!fileEmbed || fileEmbed.error || !("id" in fileEmbed)) {
        throw new Error("captureStore.saveFile failed");
      }
      let newBlock: Pick<IBlock, "contentType" | "body"> = {
        contentType: NodeType.EMBED,
        body: {
          id: fileEmbed.id,
          subType: fileEmbed.contentType
        }
      };
      processPasteOrDrop(newBlock, fileEmbed);
    } catch (e) {
      logger.error({ at: "handleFileDrop", error: e });
      toasts.error("Failed to upload. Please try again.");
    } finally {
      progressState = undefined;
    }
  }

  /**
   * Added wait so that progress element is present in DOM before the progress is being updated in captureStore.saveMultipleFiles
   * @param files
   */
  async function handleMultiFileDrop(files: File[]) {
    logger.log({ at: "insertMultipleFiles", files });
    if (!files || files.length === 0) return;
    const multipleFilesData = resolveMultipleFilesData(files, MAX_FILE_SIZE_MB);
    if (multipleFilesData && multipleFilesData.sizeExceededCount > 0) {
      const error = `${multipleFilesData.sizeExceededCount} files exceed the maximum size of ${MAX_FILE_SIZE_MB} MB.`;
      toasts.error(error);
      return;
    }
    return insertMultipleFiles(multipleFilesData);
  }

  async function insertMultipleFiles(multipleFilesData: IMultiFileCaptureData) {
    await wait(10);
    const result = await captureStore?.saveMultipleFiles(
      multipleFilesData.files,
      {
        isEmbedContext: true,
        creationContext: nodeContext?.id,
        uploadProgressId: uploadProgressElementId
      }
    );
    if (!result) {
      throw new Error("captureStore.saveMultipleFiles failed");
    }
    const blocks: IBlock[] = result.map((x) => ({
      id: generateResourceId(Resource.node),
      contentType: NodeType.EMBED,
      body: {
        id: x.id,
        subType: x.contentType
      }
    }));
    mdStore.insertMany(block.id, blocks);
    propagateAsAction(BlockAction.INSERT_MANY, { blocks });
    insertBufferBlockIfRequired(
      blocks[blocks.length - 1].id,
      blocks[blocks.length - 1].contentType
    );
    result.forEach((x, index) => {
      addMention(x, blocks[index].id);
    });
  }

  function resolveHeadingText(contentType: NodeType) {
    switch (contentType) {
      case NodeType.HEADING1:
        return "H1";
      case NodeType.HEADING2:
        return "H2";
      case NodeType.HEADING3:
        return "H3";
      case NodeType.HEADING4:
        return "H4";
      case NodeType.HEADING5:
        return "H5";
      default:
        return "";
    }
  }

  function onGestureAction() {
    isSelected = !isSelected;
    emitSelect();
  }
</script>

<!--TODO -  Note - when reenabling drag and drag to rearrange - make sure it is not interfering with text selection or media grid space slider -->
<div
  class={cn(
    "relative flex w-full min-h-fit h-8 items-center gap-2 rounded-md border border-transparent",
    {
      "grid grid-cols-[2.5rem_1fr_2.5rem]": isLeftControlsEnabled,
      dragging: isDragging,
      "prevent-reorder-feedback-for-files":
        block.contentType === NodeType.EMBED && !block.body.id,
      "bg-bgs2": $context.isTouchDevice && block.contentType === NodeType.EMBED,
      "mt-3 mb-1": headingNodeTypes.includes(block.contentType)
    },
    $mdStore.params?.isNodular &&
      !$mdStore.params?.isReadOnly && {
        "bg-bgs2 !border-brs1": isHovering && !isFocusing && !isSelected,
        "bg-bgs2 !border-bgs1": isSelected
      }
  )}
  draggable={!$mdStore.params?.isReadOnly &&
    !isFocusing &&
    (!isInSelectionMode || isRearrangeBlockInSelectionMode)}
  data-index={index}
  id={`md-block-${block.id}`}
  data-id={block.id}
  data-content={block.contentType}
  data-node={block.id}
  ondragstart={() => (isDragging = true)}
  ondragend={() => (isDragging = false)}
  role="listitem"
  use:rightswipe={{
    callback: onGestureAction
  }}
  use:hoverable={{
    onHover: (e) => {
      isHovering = e;
      if (isHovering) {
        dispatchCustomEvent(MemotronEvent.BLOCK_HOVER, { id: block.id });
      }
    }
  }}
  use:fileDrop={{
    multiple: false,
    maxSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    onDrop: handleFileDrop,
    isPreventClickToBrowse: true
  }}
  use:observeAttributes={{
    attributes: ["index"],
    callback: () => {
      if (isDragging) {
        refresh();
      }
    }
  }}
>
  {#if isLeftControlsEnabled}
    {#if isInSelectionMode}
      <button
        class="flex items-center justify-center"
        onclick={() => {
          emitSelect();
        }}
      >
        {#if isRearrangeBlockInSelectionMode}
          <div
            class="flex"
            use:tooltip={{
              text: "Drag to rearrange selected blocks",
              direction: Placement.Bottom,
              delay: 500
            }}
          >
            <Icon icon="grab" />
          </div>
        {:else}
          <Icon
            icon={isSelected ? "check-circle" : "circle"}
            class={isSelected ? "" : "text-fgs4/50"}
            isFilled={isSelected}
          />
        {/if}
      </button>
    {:else if $mdStore.params?.isReadOnly}
      {#if isNodularizable}
        <div
          class="flex items-center justify-end"
          use:tooltip={{
            text: "Click ring to zoom in",
            direction: Placement.Bottom,
            delay: 500
          }}
        >
          <FocusRing
            onclick={() => {
              emitNodularize({ id: block.id });
            }}
          />
        </div>
      {:else}
        <span />
      {/if}
    {:else}
      <LeftControls
        {isSoleBlock}
        {block}
        {isFocusing}
        {isNodularizable}
        isDisableTooltip={isDragging}
        isBlockHovering={isHovering}
        onNodularize={(event) => emitNodularize(event.detail)}
        onAction={onContextMenuAction}
        onPopoverVisibility={(event) => emitPopoverVisibility(event.detail)}
      />
    {/if}
  {/if}

  <div class="relative flex-1">
    {#key contentRefreshId}
      <BlockContent
        {block}
        {mdStore}
        {isHovering}
        bind:isFocusing
        onBlur={() => {
          isHovering = false;
        }}
        onUpdate={onBlockUpdate}
        onDelete={deleteBlock}
      />
    {/key}
    {#if progressState}
      <div
        class="absolute inset-0 bg-gradient-to-r from-transparent via-bgs2 to-transparent rounded-md flex gap-2 items-center justify-center"
      >
        <Icon icon="svg-spinners:3-dots-fade" />
        <span class="text-fgs3 text-b2">{progressState}</span>
        <span id={uploadProgressElementId} class="text-fgs3 text-b3"></span>
      </div>
    {/if}
  </div>
  {#if !$mdStore.params?.isReadOnly && $mdStore.params?.isNodular && !isInSelectionMode}
    <div class="flex items-center justify-center">
      {#if isHovering && !isFocusing && !isSoleBlock && [...simpleTextNodeTypeList, ...headingNodeTypes, ...listNodeTypes, NodeType.DIVIDER, NodeType.DOUBLE_DIVIDER].includes(block.contentType)}
        <Button
          icon="trash"
          size={Size.md}
          tooltip="Delete block"
          onclick={deleteBlock}
        />
      {/if}
    </div>
  {/if}
</div>
