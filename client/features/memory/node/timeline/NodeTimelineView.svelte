<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import type {
    INode,
    INodeLinkThumb,
    INodeThumb
  } from "@nucleum/features/memory/node/node.type";
  import {
    isSameResource,
    resourceInList
  } from "@nucleum/datafn/resource.utils";
  import { parseAndFormatDate } from "@21n/utils/time.utils";
  import { resolveNodeLabelString } from "@nucleum/features/memory/node/node.utils";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import { Size } from "@21n/elements/size.enum";

  import ScrollViewBottomSpacer from "@21n/layout/scrollView/ScrollViewBottomSpacer.svelte";
  import { linkTagLabelMapper } from "@nucleum/features/memory/linking/link.utils";
  import type { ILinkTag } from "@nucleum/datafn/link.type";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import { toSvelteStore } from "@datafn/svelte";

  let {
    node
  }: {
    node: INode & { links?: INodeLinkThumb[] };
  } = $props();
  const linkTagStore = toSvelteStore<ILinkTag[]>(
    datafn.linkTag.signal({
      select: ["id", "label", "group"]
    }),
    { initialData: [] }
  );
  const linkTags = $derived($linkTagStore.data);

  let tags = $derived(linkTags.map(linkTagLabelMapper) || []);
  const linkedNodeIds = $derived(
    node?.links?.map((link) => link.linkedTo.toString()) ?? []
  );

  const linkedNodesStore = $derived.by(() =>
    toSvelteStore<INodeThumb[]>(
      datafn.node.signal({
        select: [
          "id",
          "label",
          "body",
          "contentType",
          "metadata",
          "url",
          "createdAt",
          "parent.*"
        ],
        filters: {
          id: {
            $in: linkedNodeIds.length
              ? linkedNodeIds
              : ["__datafn_empty_timeline__"]
          }
        },
        sort: ["-createdAt"]
      }),
      { initialData: [] }
    )
  );

  const linkedNodes = $derived(
    [...$linkedNodesStore.data].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  );
  const groups = $derived(groupNodesByDate(linkedNodes));

  function groupNodesByDate(nodes: INodeThumb[]) {
    const groups = new Map<string, INodeThumb[]>();

    nodes.forEach((node) => {
      const date = parseAndFormatDate(new Date(node.createdAt));
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)?.push(node);
    });

    return Array.from(groups.entries()).map(([date, nodes]) => ({
      date,
      nodes
    }));
  }

  function handleNodeClick(nodeId: string, event: MouseEvent) {
    navigation.resourceClickHandlerForGraph(nodeId, event, {
      replaceId: node.id
    });
  }

  function findLink(linkedNode: INodeThumb) {
    return node.links?.find((link) =>
      isSameResource(link.linkedTo, linkedNode)
    );
  }
</script>

<div class="flex flex-col w-full h-full overflow-auto px-4 dp:px-12">
  {#if $linkedNodesStore.loading && linkedNodeIds.length > 0}
    <EmptyStatusView
      size={Size.sm}
      isLoadingState={true}
      mainText="Loading timeline"
      subText="Please wait while we load the timeline data"
    />
  {:else}
    <div class="flex flex-col gap-8 relative pl-6">
      <div class="absolute left-[6px] -top-2 bottom-0 w-[2px] bg-bgs4" />
      {#each groups as group, index}
        {#if index === 0}
          <ScrollViewBottomSpacer size={Size.sm} />
        {/if}
        <div class="flex gap-4 items-start relative">
          <div class="absolute -left-[23px] top-0 flex items-center h-[24px]">
            <div class="w-[8px] h-[8px] rounded-full bg-fgs3" />
          </div>
          <div class="flex flex-col gap-1.5 flex-grow">
            <div
              class="text-b3 text-fgs3 h-[24px] flex items-center tabular-nums"
            >
              {group.date}
            </div>
            <div class="flex flex-col gap-2">
              {#each group.nodes as linkedNode}
                {@const link = findLink(linkedNode)}
                <button
                  class="flex flex-col gap-1 p-3 rounded-md bg-bgs2 hover:bg-bgs3 border border-brs3 text-left w-full userdata"
                  onclick={(e) => handleNodeClick(linkedNode.id.toString(), e)}
                >
                  <div class="text-b2 text-fgs1">
                    {resolveNodeLabelString(linkedNode)}
                  </div>
                  {#if link?.tags?.length}
                    <div class="flex gap-2">
                      {#each link.tags as tag}
                        <span
                          class="text-b3 text-fgs3 bg-bgs3 px-2 py-0.5 rounded"
                        >
                          {tags.find(resourceInList(tag))?.label ?? ""}
                        </span>
                      {/each}
                    </div>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        </div>
        {#if index === groups.length - 1}
          <ScrollViewBottomSpacer size={Size.xl} />
        {/if}
      {/each}
    </div>
  {/if}
</div>
