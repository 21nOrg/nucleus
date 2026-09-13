<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import {
    isSameResource,
    removeDuplicatesFilter,
    resourceInList
  } from "@nucleum/datafn/resource.utils";
  import ComingSoonView from "@21n/elements/ComingSoonView.svelte";
  import DropDown from "@21n/elements/dropdown/DropDown.svelte";
  import PanelSwitcher from "@21n/elements/switcher/PanelSwitcher.svelte";

  import { Size } from "@21n/elements/size.enum";
  import {
    PanelSwitcherActiveItemStrength,
    PanelSwitcherStyle
  } from "@21n/elements/switcher/switcher.enum";
  import NodeGraph from "@nucleum/features/memory/graph/NodeGraph.svelte";
  import { linkTagLabelMapper } from "@nucleum/features/memory/linking/link.utils";
  import { type IActiveNodeStore } from "@nucleum/features/memory/node/node.store";
  import {
    NodeView,
    webNodeTypeList,
    type INode,
    type INodeLinkThumb,
    type INodeThumb
  } from "@nucleum/features/memory/node/node.type";
  import { ResourcePanelType } from "@nucleum/stores/resources/resource-panel.type";
  import type { DropdownItem } from "@21n/elements/dropdown/dropdownItem.type";
  import { LinkType, type ILinkTag } from "@nucleum/datafn/link.type";
  import { enumToString } from "@21n/shared-utils/text.utils";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import view from "@nucleum/stores/view.store";
  import { InputStyle } from "@21n/elements/input/input.type";
  import {
    resolveNodeFavicon,
    resolveNodeGraphFill,
    resolveNodeLabelString
  } from "@nucleum/features/memory/node/node.utils";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import NodeRightPaneContent from "@nucleum/features/memory/node/rightPanel/NodeRightPaneContent.svelte";
  import Toggle from "@21n/elements/toggle/Toggle.svelte";
  import NodeTimelineView from "@nucleum/features/memory/node/timeline/NodeTimelineView.svelte";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import { NodeBirdViewMode } from "@nucleum/features/memory/node/birdView/birdView.type";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  import { page } from "$app/stores";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import { toSvelteStore } from "@datafn/svelte";
  let { node }: { node: IActiveNodeStore } = $props();
  let selectedView = $state(NodeBirdViewMode.Graph);
  let depth = $state(
    $page.url?.searchParams?.get(AppSearchParam.DEPTH)
      ? parseInt($page.url?.searchParams?.get(AppSearchParam.DEPTH) ?? "1")
      : 1
  );
  let graphRef = $state<NodeGraph>();
  let isAutoGrouping = $state(true);
  let isTraverseMode = $state(
    $page.url?.searchParams?.get(AppSearchParam.TRAVERSE) === "true"
  );
  type GraphNode = {
    id: string;
    label: string;
    type?: string;
    combo?: string;
    badge?: string | number;
    icon?: string;
    fill?: string;
  };
  type GraphEdge = {
    source: string;
    target: string;
    id?: IRecordId;
    linkType?: LinkType | string;
  };
  type GraphCombo = {
    id: string;
    label: string;
  };
  let splitResource = $state<IRecordId | undefined>(undefined);
  const depthOptions = [
    {
      label: "Depth: 1",
      value: 1
    },
    {
      label: "Depth: 2",
      value: 2
    }
    // {
    //   label: "Depth: 3",
    //   value: 3
    // },
    // {
    //   label: "Depth: 4",
    //   value: 4
    // }
  ];
  let groupOptions = $state<DropdownItem[]>([]);
  let subgroupOptions = $state<DropdownItem[]>([]);
  const linkTagStore = toSvelteStore<ILinkTag[]>(
    datafn.linkTag.signal({
      select: ["id", "label", "group"]
    }),
    { initialData: [] }
  );
  const linkTags = $derived($linkTagStore.data);
  let tags = $state<ILinkTag[]>([]);
  let tagGroups = $state<string[]>([]);
  const linkedNodeIds = $derived(
    $node.links?.map((link) => link.linkedTo.toString()) ?? []
  );
  const linkedNodeStore = $derived.by(() =>
    toSvelteStore<INode[]>(
      datafn.node.signal({
        select: [
          "id",
          "label",
          "body",
          "contentType",
          "metadata",
          "url",
          "parent.*"
        ],
        filters: {
          id: {
            $in: linkedNodeIds.length
              ? linkedNodeIds
              : ["__datafn_empty_bird_view__"]
          }
        },
        metadata: {
          includeTrashed: true,
          includeArchived: true
        }
      }),
      { initialData: [] }
    )
  );
  const linkedNodes = $derived($linkedNodeStore.data);
  const depthSourceRowsStore = $derived.by(() =>
    toSvelteStore<Array<{ links?: Record<string, any>[] }>>(
      datafn.node.signal({
        select: ["id", "links.#"],
        filters: {
          id: {
            $in:
              depth > 1 && linkedNodeIds.length
                ? linkedNodeIds
                : ["__datafn_empty_bird_view__"]
          }
        },
        metadata: {
          includeTrashed: true,
          includeArchived: true
        }
      }),
      { initialData: [] }
    )
  );
  const allRelationRowsStore = $derived.by(() =>
    toSvelteStore<Array<{ links?: Record<string, any>[] }>>(
      datafn.node.signal({
        select: ["id", "links.#"],
        filters:
          depth > 1
            ? undefined
            : {
                id: "__datafn_empty_bird_view__"
              },
        metadata: {
          includeTrashed: true,
          includeArchived: true
        }
      }),
      { initialData: [] }
    )
  );
  const depthRows = $derived(
    buildDepthRows(
      $node,
      linkedNodeIds,
      flattenRelationRows($depthSourceRowsStore.data),
      flattenRelationRows($allRelationRowsStore.data)
    )
  );
  const depthNodeIds = $derived(
    Array.from(
      new Set(
        depthRows
          .map((edge) => [edge.source, edge.target])
          .flat()
          .filter(Boolean)
      )
    )
  );
  const depthNodeStore = $derived.by(() =>
    toSvelteStore<INodeThumb[]>(
      datafn.node.signal({
        select: ["id", "label", "body", "contentType", "parent.*"],
        filters: {
          id: {
            $in:
              depth > 1 && depthNodeIds.length
                ? depthNodeIds
                : ["__datafn_empty_bird_view__"]
          }
        },
        metadata: {
          includeTrashed: true,
          includeArchived: true
        }
      }),
      { initialData: [] }
    )
  );
  const graphData = $derived(
    buildGraphData(
      $node,
      $node.links ?? [],
      linkedNodes,
      tags,
      depth,
      depthRows,
      $depthNodeStore.data
    )
  );

  $effect(() => {
    initializeConfig();
  });

  $effect(() => {
    graphData;
    depth;
    isTraverseMode;
    setTimeout(() => {
      graphRef?.rerender();
    }, 100);
  });

  function initializeConfig() {
    try {
      const nextTags =
        linkTags
          .filter((x) =>
            $node.links?.some((y) => y.tags?.some(resourceInList(x)))
          )
          ?.map(linkTagLabelMapper) ?? [];
      const nextTagGroups = Array.from(
        new Set(nextTags?.map((x) => x.group ?? "No group"))
      );
      tags = nextTags;
      tagGroups = nextTagGroups;

      let commonGroupOptions = [
        { label: "Link tags", value: "linktags" },
        { label: "Link types", value: "linktypes" },
        ...(nextTagGroups?.map((x) => ({
          label: x,
          value: x,
          groupId: "Link tag groups"
        })) ?? [])
      ];

      groupOptions = [
        { label: "Group by: None", value: "none" },
        ...commonGroupOptions
      ];
      subgroupOptions = [
        { label: "Subgroup by: None", value: "none" },
        ...commonGroupOptions
      ];
    } catch (error) {
      logger.error({ at: "initializeConfig", error });
    }
  }

  function flattenRelationRows(
    records: Array<{ links?: Record<string, any>[] }>
  ) {
    return records.flatMap((record) => record.links ?? []);
  }

  function buildDepthRows(
    activeNode: INode,
    sourceIds: string[],
    inLinks: Record<string, any>[],
    allRelationRows: Record<string, any>[]
  ) {
    const targetIds = new Set(sourceIds);
    const outLinks = allRelationRows.filter((link) =>
      targetIds.has(link.to?.toString())
    );
    return [...inLinks, ...outLinks]
      .filter(
        (link: any) =>
          link.from &&
          link.to &&
          link.from.toString().includes("node") &&
          link.to.toString().includes("node") &&
          !isSameResource(link.from, activeNode) &&
          !isSameResource(link.to, activeNode)
      )
      .map((link: any) => ({
        source: link.from.toString(),
        target: link.to.toString(),
        id: `${link.from}|${link.to}`,
        linkType: link.linkType
      }));
  }

  function normalizeEdges(edges: GraphEdge[], nodes: GraphNode[]) {
    return edges
      .map((x) => {
        return {
          ...x,
          linkType:
            x.linkType === LinkType.DIRECT
              ? undefined
              : enumToString(x.linkType)
        };
      })
      .filter(removeDuplicatesFilter)
      .filter((x, index) => {
        return (
          x.source &&
          x.target &&
          nodes.some((y) => y.id === x.source) &&
          nodes.some((y) => y.id === x.target) &&
          edges.findIndex(
            (y) => y.source === x.source && y.target === x.target
          ) === index
        );
      });
  }

  function buildGraphData(
    activeNode: INode,
    activeLinks: INodeLinkThumb[],
    directLinkedNodes: INode[],
    activeTags: ILinkTag[],
    graphDepth: number,
    depthEdges: GraphEdge[],
    depthNodes: INodeThumb[]
  ) {
    if (activeLinks.length === 0 || !isAutoGrouping) {
      return { nodes: [], edges: [], combos: [] };
    }
    let linkTagsInUse = new Set<string>();
    let nodes: GraphNode[] = directLinkedNodes.map((linkedNode: INode) => {
      const link = activeLinks.find((l) =>
        isSameResource(l.linkedTo, linkedNode)
      );
      let combo = null;
      if (link?.tags?.length) {
        const linkTags = activeTags.filter((x) =>
          link?.tags?.some(resourceInList(x))
        );
        if (linkTags.length === 1) {
          combo = linkTags[0].label;
        } else if (linkTags.length > 1) {
          combo = linkTags.map((x) => x.label).join(", ");
        }
      }
      if (combo) {
        linkTagsInUse.add(combo);
      }
      return {
        id: linkedNode.id.toString(),
        label: resolveNodeLabelString(linkedNode as INodeThumb),
        icon: webNodeTypeList.includes(linkedNode.contentType)
          ? resolveNodeFavicon(linkedNode)
          : undefined,
        fill: resolveNodeGraphFill(linkedNode),
        combo: combo ?? undefined
      };
    });
    nodes.push({
      id: activeNode.id.toString(),
      type: "hexagon",
      badge: activeLinks.length,
      label: resolveNodeLabelString(activeNode as INodeThumb),
      icon: webNodeTypeList.includes(activeNode.contentType)
        ? resolveNodeFavicon(activeNode)
        : undefined,
      fill: resolveNodeGraphFill(activeNode),
      combo: undefined
    });
    let edges: GraphEdge[] = activeLinks.map((l) => {
      return {
        source: activeNode.id.toString(),
        target: l.linkedTo.toString(),
        id: l.links?.[0]?.id,
        linkType: l.linkType
      };
    });
    const combos: GraphCombo[] = Array.from(linkTagsInUse)
      .map((x) => {
        return {
          id: x,
          label: x
        };
      })
      .filter(Boolean);
    if (graphDepth > 1 && depthEdges.length > 0) {
      edges.push(...depthEdges);
      nodes.push(
        ...depthNodes.map((node) => ({
          id: node.id.toString(),
          label: resolveNodeLabelString(node)
        }))
      );
      nodes = nodes.filter(removeDuplicatesFilter).map((x) => {
        return {
          ...x,
          combo: undefined
        };
      });
    }
    return {
      nodes,
      edges: normalizeEdges(edges, nodes),
      combos: graphDepth === 1 ? combos : []
    };
  }

  async function onNodeSelect(e: CustomEvent) {
    const event = e.detail;
    const newResource = event.target.id;
    logger.log({ at: "onNodeSelect", event, newResource, splitResource });
    if (!newResource) return;

    if (
      isTraverseMode &&
      !event.altKey &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      navigation.resourceClickHandler(undefined, newResource, {
        replaceId: $node.id.toString(),
        searchParams: {
          [navigation.resolveRecordSpecificSearchParam(
            newResource,
            AppSearchParam.NODE_VIEW
          )]: NodeView.BIRD,
          [AppSearchParam.DEPTH]: depth,
          [AppSearchParam.TRAVERSE]: isTraverseMode
        }
      });
      return;
    }

    if (newResource === $node.id.toString()) {
      if ($node.panel === ResourcePanelType.LINKS)
        node.switchPanel(ResourcePanelType.DEFAULT);
      else node.switchPanel(ResourcePanelType.LINKS);
      return;
    }
    if (splitResource === newResource) {
      closeSplitResource();
      return;
    }
    splitResource = newResource;
    navigation.resourceClickHandlerForGraph(newResource, event, {
      replaceId: $node.id
    });
  }

  function closeSplitResource() {
    if (!splitResource) return;
    navigation.closeResource({ id: splitResource });
    splitResource = undefined;
  }
</script>

<div class="flex flex-col gap-3 w-full flex-grow">
  <div class="flex w-full justify-between bg-bgs2 p-2">
    <div class="flex items-center gap-4">
      {#if $view.isConstrainedWidth}
        <div class="w-32">
          <DropDown
            items={[
              {
                value: NodeBirdViewMode.Graph,
                label: "Graph",
                icon: "graph"
              },
              {
                value: NodeBirdViewMode.Timeline,
                label: "Timeline",
                icon: "mynaui:git-merge"
              },
              {
                value: NodeBirdViewMode.Serendipity,
                label: "Serendipity",
                icon: "sparkle"
              }
            ]}
            bind:value={selectedView}
            style={InputStyle.PLAIN}
            isDisableSearch={true}
          />
        </div>
      {:else}
        <PanelSwitcher
          items={[
            {
              value: NodeBirdViewMode.Graph,
              label: "Graph",
              icon: "graph"
            },
            {
              value: NodeBirdViewMode.Timeline,
              label: "Timeline",
              icon: "mynaui:git-merge"
            }
            // {
            //   value: NodeBirdViewMode.Serendipity,
            //   label: "Serendipity",
            //   icon: "sparkle"
            // }
          ]}
          style={PanelSwitcherStyle.TRAIN}
          activeItemStrength={PanelSwitcherActiveItemStrength.STRONG}
          bind:value={selectedView}
        />
      {/if}
    </div>
    <div class="flex tp:gap-6 2k:gap-8 items-center">
      <div class="flex gap-4 items-center">
        {#if !isAutoGrouping}
          <!-- <span class="text-b3 text-fgs3">
            Manual grouping will be available soon.</span
          > -->
          <!-- <div class="w-48">
            <DropDown
              items={groupOptions}
              isDisableSearch={true}
              isShowDividerForGroup={true}
              size={Size.sm}
              groups={[
                {
                  id: "Link tag groups",
                  label: "Link tag groups",
                  order: 0
                }
              ]}
            />
          </div>
          <div class="w-48">
            <DropDown
              items={subgroupOptions}
              isDisableSearch={true}
              isShowDividerForGroup={true}
              size={Size.sm}
              groups={[
                {
                  id: "Link tag groups",
                  label: "Link tag groups",
                  order: 0
                }
              ]}
            />
          </div> -->
        {/if}
        <!-- <div
          class="flex gap-2 items-center text-fgs2 text-b2 whitespace-nowrap"
        >
          <span>Manual</span>
          <Switch size={Size.sm} bind:on={isAutoGrouping} />
          <span>Auto grouping</span>
        </div> -->
      </div>
      {#if selectedView === NodeBirdViewMode.Graph}
        <div class="min-w-fit">
          <DropDown
            items={depthOptions}
            isDisableSearch={true}
            value={depth}
            size={Size.sm}
            onSelect={(e) => {
              depth = e.detail;
              navigation.toggleSearchParam({
                [AppSearchParam.DEPTH]: depth
              });
              setTimeout(() => {
                graphRef?.rerender();
              }, 100);
            }}
          />
        </div>
      {/if}
      <div class="flex gap-2 items-center">
        {#if selectedView === NodeBirdViewMode.Graph}
          <Toggle
            icon="traverse"
            tooltip={isTraverseMode
              ? "Switch to normal mode"
              : "Switch to traverse mode"}
            parentBgIndex={2}
            on={isTraverseMode}
            onChange={(e) => {
              isTraverseMode = e.detail;
              navigation.toggleSearchParam({
                [AppSearchParam.TRAVERSE]: isTraverseMode
              });
              setTimeout(() => {
                graphRef?.rerender();
              }, 100);
            }}
          />
        {/if}
        <Toggle
          icon="link"
          tooltip="See all links"
          parentBgIndex={2}
          onChange={(e) => {
            if (e.detail) {
              node.switchPanel(ResourcePanelType.LINKS);
            } else if ($node.panel === ResourcePanelType.LINKS) {
              node.switchPanel(ResourcePanelType.DEFAULT);
            }
          }}
        />
      </div>
    </div>
  </div>
  <div class="flex w-full flex-1 min-h-0">
    <div class="flex-1 h-full min-w-0">
      {#if selectedView === NodeBirdViewMode.Graph}
        {#if $linkedNodeStore.loading && linkedNodeIds.length > 0}
          <div class="flex-1 h-full min-w-0">
            <EmptyStatusView isLoadingState={true} />
          </div>
        {:else}
          <NodeGraph
            bind:this={graphRef}
            layout={depth === 1 && !isTraverseMode
              ? "dendrogram-1"
              : "radial-2"}
            data={graphData}
            nodeId={$node.id.toString()}
            onSelect={onNodeSelect}
            onCanvasClick={closeSplitResource}
          />
        {/if}
      {:else if selectedView === NodeBirdViewMode.Timeline}
        <NodeTimelineView node={$node} />
      {:else}
        <ComingSoonView
          mainText="Coming soon"
          subText="Serendipity shows unlinked nodes relevant to the current node."
        />
      {/if}
    </div>
    {#if $node.panel && $node.panel !== ResourcePanelType.NONE}
      <div
        class="flex gap-2 h-full overflow-auto min-w-96 max-w-96 border-l border-brs3"
      >
        <NodeRightPaneContent {node} />
      </div>
    {/if}
  </div>
</div>
