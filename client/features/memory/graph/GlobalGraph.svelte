<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import {
    flushSync,
    mount,
    unmount,
    type Component,
    type Snippet
  } from "svelte";
  import GlobalGraphUsingG6 from "@nucleum/features/memory/graph/GlobalGraphUsingG6.svelte";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import { rootNodeTypeList } from "@nucleum/features/memory/node/node.type";
  import { removeDuplicatesFilter } from "@nucleum/datafn/resource.utils";

  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { resolveNodeLabelString } from "@nucleum/features/memory/node/node.utils";
  import NodeTitleLabelPart from "@nucleum/features/memory/node/title/NodeTitleLabelPart.svelte";
  import SwitchInput from "@21n/elements/toggle/SwitchInput.svelte";
  import { Size } from "@21n/elements/size.enum";
  import Divider from "@21n/elements/Divider.svelte";
  import { Orientation } from "@21n/elements/direction.enum";
  import { ColorStrength } from "@21n/theme/appearance.type";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import { toSvelteStore } from "@datafn/svelte";
  import { browser } from "$app/environment";

  let {
    layout: Layout
  }: {
    layout: Component<{
      isConstrainedWidth?: boolean;
      right?: Snippet;
      children?: Snippet;
    }>;
  } = $props();

  let isRendered = $state(false);
  let isHideOrphans = $state(false);
  let graphRef = $state<GlobalGraphUsingG6>();
  let splitResource = $state<IRecordId | undefined>(undefined);
  let isConstrainedWidth = $state(false);
  const relationRowsStore = toSvelteStore<
    Array<{ links?: Record<string, any>[] }>
  >(
    datafn.node.signal({
      select: ["id", "links.#"],
      metadata: {
        includeTrashed: true,
        includeArchived: true
      }
    }),
    { initialData: [] }
  );
  const rootNodesStore = toSvelteStore(
    datafn.node.signal({
      select: ["id", "label", "body", "contentType", "parent.*"],
      filters: {
        contentType: { $in: [...rootNodeTypeList] },
        creationContext: { $is_empty: true },
        metaType: { $is_empty: true }
      }
    }),
    { initialData: [] }
  );
  const relationRows = $derived(
    $relationRowsStore.data.flatMap((record) => record.links ?? [])
  );
  const graphEdges = $derived(resolveGraphEdges(relationRows));
  const linkedNodeIds = $derived(
    Array.from(
      new Set(graphEdges.map((link: any) => [link.source, link.target]).flat())
    ) as string[]
  );
  const linkedNodesStore = $derived.by(() =>
    toSvelteStore(
      datafn.node.signal({
        select: ["id", "label", "body", "contentType", "parent.*"],
        filters: {
          id: {
            $in: linkedNodeIds.length
              ? linkedNodeIds
              : ["__datafn_empty_global_graph__"]
          }
        }
      }),
      { initialData: [] }
    )
  );
  const graphNodes = $derived(
    resolveGraphNodes([...$linkedNodesStore.data, ...$rootNodesStore.data])
  );
  const unfilteredData = $derived({
    nodes: graphNodes,
    edges: graphEdges
      .filter((x: any) => {
        return (
          x.source &&
          x.target &&
          graphNodes.some((y) => y.id === x.source) &&
          graphNodes.some((y) => y.id === x.target)
        );
      })
      .filter(removeDuplicatesFilter)
  });
  const data = $derived(resolveFilteredData(unfilteredData, isHideOrphans));
  const isLoading = $derived(
    $relationRowsStore.loading ||
      $rootNodesStore.loading ||
      $linkedNodesStore.loading
  );

  $effect(() => {
    data;
    setTimeout(() => {
      graphRef?.rerender();
    }, 100);
  });

  function resolveGraphEdges(links: Record<string, any>[]) {
    return links
      .filter(
        (link: any) =>
          link.from &&
          link.to &&
          link.from.toString().includes("node") &&
          link.to.toString().includes("node")
      )
      .map((link: any) => ({
        source: link.from.toString(),
        target: link.to.toString(),
        id: `${link.from}|${link.to}`
      }));
  }

  function resolveFilteredData(
    input: { nodes: any[]; edges: any[] },
    isFilterOrphans: boolean
  ) {
    if (isFilterOrphans) {
      const nodes = input.nodes.filter((node) => {
        return input.edges.some(
          (edge) => edge.source === node.id || edge.target === node.id
        );
      });
      return {
        nodes,
        edges: input.edges
      };
    }
    return input;
  }

  function resolveGraphNodes(nodes: any[]) {
    return nodes
      .map((node: any) => {
        const nodeLabel = resolveNodeLabelString(node) || "";
        return {
          id: node.id.toString(),
          label: nodeLabel,
          innerHTML: renderComponentToString(node),
          innerHTMLTest: `<div>${node.label || "Untitled"}</div>`,
          type: "circle"
        };
      })
      .filter(removeDuplicatesFilter);
  }

  function renderComponentToString(node: any) {
    if (!browser) return `<div>${node.label || "Untitled"}</div>`;
    const target = document.createElement("div");
    const component = mount(NodeTitleLabelPart, {
      target,
      props: {
        item: node
      }
    });
    flushSync();
    const html = target.innerHTML;
    void unmount(component);
    return html;
  }

  function onRender() {
    isRendered = true;
  }

  function onNodeSelect(event: any) {
    const newResource = event.target.id;
    logger.log({
      at: "globalGraph - onNodeSelect",
      event,
      newResource,
      splitResource
    });
    if (!newResource) return;
    if (splitResource === newResource) {
      closeSplitResource();
      return;
    }
    splitResource = newResource;
    navigation.resourceClickHandlerForGraph(newResource, event);
  }
  function closeSplitResource() {
    if (!splitResource) return;
    navigation.closeResource({ id: splitResource });
    splitResource = undefined;
  }

  function onCanvasClick() {
    navigation.closeResource({ accessMode: AccessMode.SPLIT });
  }
</script>

<Layout bind:isConstrainedWidth>
  {#snippet right()}
    <span class="flex items-center gap-3 text-fgs3 text-b3 h-full">
      {#if !isConstrainedWidth && data.nodes.length > 0}
        <span>
          {data.nodes.length} nodes
        </span>
        <span>
          {data.edges.length} connections
        </span>
        <Divider
          orientation={Orientation.Vertical}
          colorStrength={ColorStrength.Strong}
        />
      {/if}
      <SwitchInput
        label={{ label: "Hide orphans" }}
        size={Size.sm}
        bind:checked={isHideOrphans}
        onChange={() => {
          setTimeout(() => {
            graphRef?.rerender();
          }, 100);
        }}
      />
    </span>
  {/snippet}
  {#if !isRendered}
    <div
      class="absolute z-10 inset-0 w-full h-full flex justify-center items-center bg-bgs1"
    >
      <EmptyStatusView isLoadingState={isLoading} mainText="Not enough data." />
    </div>
  {/if}
  {#if data.nodes.length > 0}
    <GlobalGraphUsingG6
      bind:this={graphRef}
      {data}
      {onRender}
      onSelect={onNodeSelect}
      {onCanvasClick}
      layout="d3-force"
    />
  {/if}
</Layout>
