<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import Text from "@21n/elements/text/Text.svelte";
  import {
    headingNodeTypes,
    type INodeStructure
  } from "@nucleum/features/memory/node/node.type";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import {
    hierarchyFactorLimit,
    type IActiveNodeStore
  } from "@nucleum/features/memory/node/node.store";

  import {
    deepCopy,
    isValidArrayWithData,
    shallowDiff
  } from "@21n/shared-utils/obj.utils";
  import NodularMarkdown from "@nucleum/features/memory/markdown/NodularMarkdown.svelte";
  import ScrollViewBottomSpacer from "@21n/layout/scrollView/ScrollViewBottomSpacer.svelte";
  import Divider from "@21n/elements/Divider.svelte";
  import { ColorStrength } from "@21n/theme/appearance.type";
  import { formatDatetime } from "@21n/utils/time.utils";
  import { onDestroy, onMount } from "svelte";

  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { setContext, getContext } from "svelte";
  import { BlockAction } from "@nucleum/features/memory/markdown/md.type";
  import { wordCounter } from "@nucleum/features/memory/node/content/word-counter.action";
  import { generateResourceId } from "@nucleum/datafn/id.utils";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import { Size } from "@21n/elements/size.enum";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import view from "@nucleum/stores/view.store";
  import context from "@nucleum/stores/context.store";
  import {
    generateMarkdownText,
    resolveHeadingParent
  } from "@nucleum/features/memory/node/node.utils";
  import {
    determineResourceAccessMode,
    resourceInList
  } from "@nucleum/datafn/resource.utils";
  import { tabs } from "@21n/layout/topNav/tabs/tabs.store";
  import { Context } from "@nucleum/stores/appStore.type";

  type BlockCreateInput = {
    id: IRecordId;
    contentType: NodeType;
    body: any;
    label?: string;
    mdParent?: IRecordId[];
  };

  let {
    node,
    mdId,
    isReadOnlyMode = false
  }: {
    node: IActiveNodeStore;
    mdId: string;
    isReadOnlyMode?: boolean;
  } = $props();
  let previousRootStructure: string[] = [];
  let refreshId = $state<number | undefined>(undefined);
  let markdownRef = $state<any>(undefined);
  let isInitialContentReady = $state(false);
  const dev_isEnableBottomDivider = false;

  const calendarContentContext = getContext<any>(Context.CALENDAR_CONTENT);

  function propagateSavingFeedback(event: string, data: any = {}) {
    if (calendarContentContext?.publish) {
      calendarContentContext.publish(event, data);
    }
  }

  async function handleEvent(event: string, data: any) {
    logger.log({
      at: "node content context",
      event,
      data
    });
    if (!event) return;
    if (event === "mention") {
      if (!data.item || !data.location) return;
      await node.mention(data.location, data.item.id);
    } else if (event === "unmention") {
      if (!data.location || !data.id) return;
      await node.unmention(data.location, data.id);
    }
  }
  const contentContext = {
    publish: handleEvent
  };
  setContext(Context.CONTENT, contentContext);

  let focusEventSub: any;

  onMount(async () => {
    if (
      $node.contentType === NodeType.NODULAR_MARKDOWN &&
      (!Array.isArray($node.mdChildOrder) || $node.mdChildOrder.length < 1)
    ) {
      const id = generateResourceId(Resource.node);
      const createdBlock = await node.createBlock(id, NodeType.SIMPLE_TEXT, {
        body: ""
      });
      if (createdBlock?.[0]) {
        await node.modify(
          {
            mdChildOrder: [createdBlock[0].id]
          },
          {
            isPreventBackPropagation: true
          }
        );
        $node.mdChildOrder = [createdBlock[0].id];
        $node.children = [createdBlock[0]] as unknown as typeof $node.children;
      }
    }
    isInitialContentReady = true;
    if (!node.eventStore?.subscribe) return;
    focusEventSub = node.eventStore.subscribe((x: any) => {
      logger.debug({
        at: "Node content - nodeFocusEvent listener",
        x,
        id: $node.id
      });
      if (!x) return;
      const currentAccessMode = determineResourceAccessMode($node.id);
      const clickedAccessMode = navigation.determineClickAccessMode(x.event);
      if (clickedAccessMode && clickedAccessMode !== currentAccessMode) {
        navigation.openResource(x.id, clickedAccessMode);
        node.eventStore.set(undefined);
        return;
      }
      //TODO - temp direct reload instead of within focus
      temp_Focus(x.id, { currentAccessMode, accessMode: clickedAccessMode });
      node.eventStore.set(undefined);
      return;
    });

    refreshId = Date.now();
  });

  function temp_Focus(
    id: IRecordId,
    params?: {
      accessMode?: AccessMode;
      currentAccessMode?: AccessMode;
    }
  ) {
    if (id === $node.id) return;

    const currentAccessMode =
      params?.currentAccessMode ?? determineResourceAccessMode($node.id);
    if (
      currentAccessMode === AccessMode.TAB &&
      (!params?.accessMode || params?.accessMode === AccessMode.TAB)
    ) {
      tabs.replace(id, $node.id);
      return;
    }
    navigation.openResource(id, currentAccessMode);
  }

  onDestroy(() => {
    if (focusEventSub && typeof focusEventSub === "function") {
      focusEventSub();
    }
  });

  function refreshCounts(e: any) {
    if (!e) return;
    if (Number.isFinite(e.words)) $node.wordCount = e.words;
    if (Number.isFinite(e.characters)) $node.charCount = e.characters;
  }

  function onMarkdownContentChange(e: CustomEvent) {
    logger.log({ at: "NodeContent - onMarkdownContentChange", ...e.detail });
    const block = e.detail.block;
    if (!block.source && !block.id) return;
    const id = block.id ?? block.source;

    propagateSavingFeedback("start");

    if ("body" in block) {
      node.updateBlock(
        id,
        { body: block.body },
        {
          isDebounced: true,
          debounceKey: "body"
        }
      );
      if (e.detail?.childrenWithStructure && e.detail?.md?.blocks) {
        const parent = e.detail.childrenWithStructure.find((x: any) =>
          x.children.some(resourceInList(id))
        );
        const childrenIds = parent?.children ?? e.detail.root;
        if (childrenIds) {
          const childrenNodes: any[] = e.detail.md.blocks.filter((x: any) =>
            childrenIds.some(resourceInList(x.id))
          );
          const mdText = generateMarkdownText(childrenNodes);
          const parentId = parent?.id ?? $node?.id;
          if (parentId) {
            node.updateBlock(
              parentId,
              { text: mdText },
              {
                isDebounced: true,
                debounceKey: "text"
              }
            );
          }
        }
      }
    } else if ("label" in block) {
      node.updateBlock(
        id,
        { label: block.label },
        {
          isDebounced: true,
          debounceKey: "label"
        }
      );
    } else if ("metadata" in block) {
      node.updateBlock(id, { metadata: block.metadata });
    }

    setTimeout(() => {
      propagateSavingFeedback("success");
    }, 600);
  }

  function onReStructure(e: CustomEvent) {
    logger.log({ at: "NodeContent - onReStructure", ...e.detail });
    try {
      const differences = shallowDiff(previousRootStructure, e.detail.root);
      if (isValidArrayWithData(differences)) {
        propagateSavingFeedback("start");

        node.updateBlock(
          $node.id,
          { mdChildOrder: deepCopy(e.detail.root) },
          {
            isDebounced: true,
            debounceKey: "mdChildOrder"
          }
        );

        setTimeout(() => {
          propagateSavingFeedback("success");
        }, 600);
      }
      previousRootStructure = deepCopy(e.detail.root);
      const structure = e.detail.children;
      const scopedParent =
        $node.contentType === NodeType.NODULAR_MARKDOWN
          ? [$node.id]
          : Array.isArray($node.mdParent)
            ? $node.mdParent
            : [];
      if (!structure) return;
      structure.forEach((child: INodeStructure, sortOrder: number) => {
        if (child.factor > hierarchyFactorLimit) {
          node.updateBlock(
            child.id,
            { sortOrder },
            {
              isDebounced: true,
              debounceKey: "structure"
            }
          );
          return;
        }
        const parent = resolveHeadingParent(child.id, structure, scopedParent);
        node.updateBlock(
          child.id,
          {
            mdChildOrder: deepCopy(child.children),
            mdParent: deepCopy(parent),
            sortOrder
          },
          {
            isDebounced: true,
            debounceKey: "structure"
          }
        );
      });
    } catch (e) {
      logger.error({
        at: "NodeContent - onReStructure - error",
        error: e
      });
      propagateSavingFeedback("error");
    }
  }

  /**
   * TODO - disabling direct focus on blocks until all edge cases are handled for node page.
   */
  function onFocus(e: CustomEvent) {
    logger.debug({ at: "NodeContent - onFocus", ...e.detail });
    if (e.detail.id && e.detail.parent) {
      temp_Focus(e.detail.id);
      // node.onFocus(e.detail.id, e.detail.parent);
    }
  }

  function resolveBlockMdParent(detail: {
    mdParent?: IRecordId[];
    parent?: IRecordId[];
  }) {
    if (Array.isArray(detail.mdParent)) return deepCopy(detail.mdParent);
    if (Array.isArray(detail.parent)) return deepCopy(detail.parent);
    return [$node.id];
  }

  function onBlockAction(e: CustomEvent) {
    logger.log({
      at: "NodeContent - onBlockAction",
      action: e.detail.action,
      detail: e.detail
    });
    switch (e.detail.action) {
      case BlockAction.INSERT:
        onInsert(e);
        break;
      case BlockAction.INSERT_MANY:
        onInsertMany(e);
        break;
      case BlockAction.CONVERT:
        onConvert(e);
        break;
      case BlockAction.DUPLICATE:
        onDuplicate(e);
        break;
      case BlockAction.DELETE:
        onDelete(e);
        break;
      case BlockAction.DELETE_MANY:
        onDeleteMany(e);
        break;
    }
    async function onInsert(e: CustomEvent) {
      logger.log({ at: "NodeContent - onInsert", ...e.detail });
      const detail = e.detail;
      if (!detail?.id) return;
      const blockType = detail.blockType ?? NodeType.SIMPLE_TEXT;
      const result = await node.createBlock(detail.id, blockType, {
        body: detail.body ?? (blockType === NodeType.SIMPLE_TEXT ? "" : null),
        mdParent: resolveBlockMdParent(detail)
      });
    }

    async function onInsertMany(e: CustomEvent) {
      logger.log({ at: "NodeContent - onInsertMany", ...e.detail });
      const detail = e.detail;
      if (!detail?.blocks) return;
      const mdParent = resolveBlockMdParent(detail);
      const result = await node.createBlocks(
        detail.blocks.map((block: BlockCreateInput) => ({
          ...block,
          mdParent: block.mdParent ?? mdParent
        }))
      );
    }

    /**
     * TODO - copying text - if converting to and from code - text etc
     * @param e
     */
    function onConvert(e: CustomEvent) {
      logger.log({ at: "NodeContent - onConvert", ...e.detail });
      if (e.detail.source && e.detail.toType) {
        if (headingNodeTypes.includes(e.detail.fromType)) {
          node.updateBlock(e.detail.source, {
            contentType: e.detail.toType,
            mdChildOrder: [],
            body: undefined
          });
        } else {
          node.updateBlock(e.detail.source, {
            contentType: e.detail.toType,
            body: undefined
          });
        }
      }
    }

    async function onDuplicate(e: CustomEvent) {
      logger.log({ at: "NodeContent - onDuplicate", ...e.detail });
      const block = e.detail;
      if (!block.id) return;
      const result = await node.createBlock(block.id, block.contentType, {
        body: block.body,
        mdParent: resolveBlockMdParent(block)
      });
    }

    function onDelete(e: CustomEvent) {
      logger.log({ at: "NodeContent - onDelete", e });
      if (!e.detail.source) return;
      node.deleteBlock(e.detail.source);
    }

    function onDeleteMany(e: CustomEvent) {
      logger.log({ at: "NodeContent - onDeleteMany", ...e.detail });
      if (!e.detail.source) return;
      node.deleteMany(e.detail.source);
    }
  }
</script>

{#if refreshId}
  {#key refreshId}
    <div
      class="flex flex-col h--full grow pt-2"
      use:wordCounter={{ onUpdate: refreshCounts }}
    >
      {#if isInitialContentReady && $node && ($node.contentType === NodeType.NODULAR_MARKDOWN || ($node.contentType === NodeType.NON_NODULAR_MARKDOWN && "body" in $node) || (headingNodeTypes.includes($node.contentType) && "mdChildOrder" in $node))}
        <NodularMarkdown
          node={$node}
          {mdId}
          params={{
            isReadOnly: isReadOnlyMode,
            isPreventFocusOnLoad: $context.isTouchDevice
          }}
          bind:md={$node.md}
          bind:this={markdownRef}
          onChange={onMarkdownContentChange}
          onRestructure={onReStructure}
          {onFocus}
          onAction={onBlockAction}
        />
        {#if !$view.isConstrainedWidth && dev_isEnableBottomDivider}
          <div
            class="flex w-full justify-center items-center mt-32 exclude-from-count"
          >
            <div class="flex flex-col gap-2 ml-12 w-full mo:w--9/10 w--4/5">
              <Divider colorStrength={ColorStrength.Strong} />
              <div class="flex w-full justify-between text-b3 text-fgs3">
                <div>
                  {$node.wordCount} words
                </div>
                <div class="min-w-fit whitespace-nowrap">
                  Modified: {formatDatetime(
                    $userPreferences,
                    new Date($node.updatedAt)
                  )}
                </div>
              </div>
            </div>
          </div>
        {/if}
        <ScrollViewBottomSpacer size={Size.xl} />
      {:else if $node?.contentType === NodeType.WEB_PAGE && $node.clips && $node.clips.length > 0}
        <div class="flex flex-col items-start gap-4">
          <Text content="Clips" style={TextStyle.SECTION_HEADING} />
          <div class="flex flex-col items-start gap-2 overflow-auto">
            {#each $node.clips as clip}
              <div class="bg-bgs2 rounded-md p-2">
                {clip?.body?.text}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/key}
{/if}
