<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import ScrollViewBottomSpacer from "@21n/layout/scrollView/ScrollViewBottomSpacer.svelte";

  import { Arrangement } from "@21n/elements/direction.enum";
  import { type INodeThumb } from "@nucleum/features/memory/node/node.type";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import { cn } from "@21n/utils/ui.utils";
  import NodeThumbnail from "@nucleum/features/memory/node/thumbnail/NodeThumbnail.svelte";
  import { onDestroy, onMount } from "svelte";

  import view from "@nucleum/stores/view.store";

  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import { isSameResource } from "@nucleum/datafn/resource.utils";
  import { hoverable } from "@nucleum/actions/hover.action";
  import { ResourceAccessPoint } from "@nucleum/datafn/resource.type";
  import type { IProperty } from "@nucleum/features/collections/properties/property.type";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import { bulkEditStore } from "@nucleum/stores/resources/bulkedit.store";
  import { BulkEditor } from "@nucleum/stores/resources/bulk-editor";
  import { toasts } from "@nucleum/stores/notification.store";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { resolveFilePreview } from "@nucleum/features/memory/node/node.utils";

  let {
    nodes = [],
    arrangement = Arrangement.LIST,
    density = 1,
    isHidePreview = false,
    isHideTitle = false,
    parentBgIndex = 1,
    isApplyCustomColor = false,
    isDraggable = false,
    accessPointId = undefined,
    accessPoint = undefined,
    visibleProps = [],
    gap = 12
  }: {
    nodes?: INodeThumb[];
    arrangement?: Arrangement;
    density?: number;
    isHidePreview?: boolean;
    isHideTitle?: boolean;
    parentBgIndex?: number;
    isApplyCustomColor?: boolean;
    isDraggable?: boolean;
    accessPointId?: IRecordId | undefined;
    accessPoint?: ResourceAccessPoint | undefined;
    visibleProps?: IProperty[];
    gap?: number;
  } = $props();

  let columns = $derived(
    Math.max(1, Math.floor(($view.width / 500) * density))
  );

  let rowHeight = 4;
  let gridRef: any;
  let hoveredMasonryItem: IRecordId | undefined = undefined;

  let multiSelectContext = $derived({
    resource: Resource.node,
    accessPoint: accessPoint ?? ResourceAccessPoint.BROWSER,
    accessPointId
  });

  function selectAll() {
    return nodes.map((item) => item.id);
  }

  async function handleBulkAction(
    ids: IRecordId[],
    action: string,
    data?: unknown
  ) {
    try {
      const editor = new BulkEditor(Resource.node, bulkEditStore);
      await editor.run(action, data);
    } catch (e) {
      toasts.error("Failed to perform bulk action");
    }
  }

  function resolveBulkEditorInstance() {
    bulkEditStore.activate(multiSelectContext, {
      onAction: handleBulkAction,
      onSelectAll: selectAll,
      subContext: accessPointId?.toString()
    });
  }

  $effect(() => {
    if (arrangement === Arrangement.MASONRY && gridRef) {
      resizeAllMasonryItems();
    }
  });

  $effect(() => {
    multiSelectContext;
    nodes;
    resolveBulkEditorInstance();
  });

  onMount(() => {
    if (arrangement != Arrangement.MASONRY) return;
    resizeAllMasonryItems();
    window.addEventListener("resize", resizeAllMasonryItems);

    return () => {
      window.removeEventListener("resize", resizeAllMasonryItems);
    };
  });

  onDestroy(() => {
    if (bulkEditStore.matchesContext(multiSelectContext)) {
      bulkEditStore.clear();
    }
  });

  function resizeMasonryItem(item: HTMLElement) {
    if (!gridRef) return;
    const itemContentType = item.getAttribute("data-type") as NodeType;
    const hasPicture = item.getAttribute("data-has-picture");
    const contentHeight =
      itemContentType === NodeType.AUDIO && !hasPicture
        ? 180
        : (item.querySelector(".item-content")?.getBoundingClientRect()
            .height ?? 0);
    const rowSpan = Math.ceil((contentHeight + gap) / (rowHeight + gap));
    item.style.gridRowEnd = `span ${rowSpan}`;
    // item.style.height = `calc(${rowSpan} * (${rowHeight}px + ${gap}px) - ${gap}px)`;
    if (
      ![
        NodeType.IMAGE,
        NodeType.WEB_SCREENSHOT,
        NodeType.YOUTUBE_BOOKMARK,
        NodeType.WEB_PAGE,
        NodeType.KINDLE_BOOK,
        NodeType.YOUTUBE_VIDEO,
        NodeType.YOUTUBE_SHORT,
        NodeType.TWITTER_PROFILE,
        NodeType.AUDIO
      ].includes(itemContentType)
    ) {
      const child = item.querySelector(".item-content");
      if (child && child instanceof HTMLElement) {
        child.style.height = "100%";
        // child.style.minHeight = "40px";
      }
    }
  }

  function resizeAllMasonryItems() {
    if (!gridRef) return;
    const allItems = gridRef.getElementsByClassName("grid-item");
    for (let item of allItems) {
      resizeMasonryItem(item as HTMLElement);
    }
  }
  function onClick(e: MouseEvent, item: any) {
    resolveBulkEditorInstance();
    logger.log({ at: "NodeItems onClick", item, multiSelectContext });
    const result = bulkEditStore.clickHandler(item.id);
    if (!result) navigation.resourceClickHandler(e, item.id);
  }
</script>

{#if arrangement === Arrangement.MASONRY}
  <div
    bind:this={gridRef}
    class="w-full h-full grid gap-4"
    style="grid-template-columns: repeat({columns}, minmax(0, 1fr)); grid-auto-rows: {rowHeight}px; gap: {gap}px;"
  >
    {#each nodes as item (item.id)}
      <div
        class="relative grid-item w-full"
        data-id={item.id}
        data-type={item.contentType}
        data-has-picture={resolveFilePreview(item)}
        draggable={isDraggable}
      >
        <button
          class="item-content w-full border rounded-md border-brs2 hover:border-aps2"
          type="button"
          use:hoverable={{
            onHover: (e) => {
              if (e) hoveredMasonryItem = item.id;
              else if (
                e === false &&
                hoveredMasonryItem &&
                isSameResource(hoveredMasonryItem, item.id)
              )
                hoveredMasonryItem = undefined;
            }
          }}
          onclick={(e) => onClick(e, item)}
        >
          <NodeThumbnail
            {item}
            {parentBgIndex}
            {arrangement}
            {isApplyCustomColor}
            {accessPoint}
            accessPointId={accessPointId ?? item.id}
            {isHideTitle}
            {visibleProps}
            onLoad={() => {
              resizeMasonryItem(
                gridRef.querySelector(`[data-id="${item.id}"]`)
              );
            }}
          />
        </button>
      </div>
    {/each}
  </div>
{:else}
  <div class="flex flex-col w-full h-full">
    <div
      class={cn("flex h-full w-full gap-4", {
        "flex-col justify-start":
          arrangement === Arrangement.LIST ||
          arrangement === Arrangement.TIMELINE,
        "flex--row flex--wrap h-full w-full gap-4 grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] content-start":
          arrangement === Arrangement.GRID
      })}
    >
      {#each nodes as item (item.id)}
        <NodeThumbnail
          {item}
          {parentBgIndex}
          {arrangement}
          {isDraggable}
          {accessPoint}
          accessPointId={accessPointId ?? item.id}
          {isHidePreview}
          {visibleProps}
          collectionContext={"board"}
          {isApplyCustomColor}
          onClick={(event) => onClick(event, item)}
        />
      {/each}
    </div>
    <ScrollViewBottomSpacer />
  </div>
{/if}
