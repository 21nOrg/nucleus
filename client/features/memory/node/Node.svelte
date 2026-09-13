<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import NodeLoadingPulse from "@21n/elements/feedback/animations/NodeLoadingPulse.svelte";
  import { ActiveNodeStore } from "@nucleum/features/memory/node/node.store";
  import {
    AccessMode,
    ResourceAccessPoint
  } from "@nucleum/datafn/resource.type";
  import {
    mediaNodeTypeList,
    NodeView,
    webNodeTypeList
  } from "@nucleum/features/memory/node/node.type";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import MediaNode from "@nucleum/features/memory/node/base/MediaNode.svelte";
  import NonMediaNode from "@nucleum/features/memory/node/base/NonMediaNode.svelte";
  import { onDestroy, onMount, setContext, untrack } from "svelte";

  import { debouncer } from "@21n/utils/utils";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { acquireDnDPage } from "@nucleum/stores/app.store";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import { page } from "$app/stores";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  import ComponentEmbedLayer from "@21n/layout/layers/ComponentEmbedLayer.svelte";
  import context from "@nucleum/stores/context.store";
  import NodePanelSwitcher from "./floatingBar/NodePanelSwitcher.svelte";
  import { fly } from "svelte/transition";
  import { resolvePanelParam } from "@nucleum/stores/resources/panelParam.mixin";
  import { ResourcePanelType } from "@nucleum/stores/resources/resource-panel.type";
  import { Context } from "@nucleum/stores/appStore.type";
  import { getContext } from "svelte";
  import { get, readable, type Writable } from "svelte/store";
  import type { IContainer } from "@21n/layout/layout.type";
  import { resolveMinWidth } from "@21n/layout/layout.utils";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import { toSvelteStore } from "@datafn/svelte";

  const container =
    getContext<Writable<IContainer | undefined>>(Context.CONTAINER) ||
    readable(undefined);

  let {
    id,
    accessMode,
    isFromSplitView = false
  }: {
    id: string;
    accessMode: AccessMode;
    isFromSplitView?: boolean;
  } = $props();
  let view = $state<NodeView>(NodeView.CONTENT);
  let isShowFloatingBar = $state(true);

  let nodeViewParam = $derived(
    navigation.resolveRecordSpecificSearchParam(id, AppSearchParam.NODE_VIEW)
  );
  $effect(() => {
    const currentView = $page.url?.searchParams?.get(nodeViewParam);
    if (currentView) {
      view = currentView as NodeView;
    }
  });
  let isRenderSplitView = false;
  let node = $derived(ActiveNodeStore.resolve(id));
  let isConstrainedWidth = $derived(
    (($container &&
      $container.width <
        resolveMinWidth(
          $node?.contentType === NodeType.NODULAR_MARKDOWN ? 3 : 2
        )) ??
      false) as boolean
  );

  let isLoading = $state(false);
  let error = $state<any>(undefined);
  $effect(() => {
    if (id && (isFromSplitView || !isRenderSplitView)) {
      initialize();
    }
  });
  navigation.clearAllTooltips();

  async function initialize(ctx?: string) {
    logger.log({ at: "Node.initialize", id, ctx });
    isLoading = true;
    const panel = resolvePanelParam(id, get(page)?.url, "Node.svelte");
    const result = await node.init({
      accessMode,
      accessPoint: ResourceAccessPoint.SELF,
      panel: (panel as ResourcePanelType | undefined) ?? undefined
    });
    if (result && "error" in result) {
      error = result.error;
      isLoading = false;
      return;
    }
    nodeContext.parent = $node?.parent;
    nodeContext.contentType = $node?.contentType;
    isLoading = false;
    await node.afterInit();
  }

  function contextEventListener(message: any) {}
  const nodeContext = {
    id,
    contentType: $node?.contentType,
    parent: $node?.parent,
    publish: contextEventListener
  };

  setContext(Context.NODE, nodeContext);

  let releaseDnDPage: (() => void) | undefined;

  onMount(() => {
    releaseDnDPage = acquireDnDPage();
  });

  onDestroy(() => {
    releaseDnDPage?.();
    ActiveNodeStore.destroy(id, accessMode);
  });

  const debouncedInitialize = debouncer(initialize, 1500);
  let hasReceivedInitialPropertySignal = false;

  const propertyStore = toSvelteStore(
    datafn.property.signal({
      limit: 1,
      sort: ["-updatedAt"],
      metadata: {
        includeTrashed: true,
        includeArchived: true
      }
    })
  );

  $effect(() => {
    $propertyStore.data;
    untrack(() => {
      if (!hasReceivedInitialPropertySignal) {
        hasReceivedInitialPropertySignal = true;
        return;
      }
      debouncedInitialize();
    });
  });
</script>

{#if error}
  <EmptyStatusView mainText={error} isSearchContext={true} />
{:else if $node && !isLoading}
  <div class="w-full h-full relative">
    {#if [...mediaNodeTypeList, ...webNodeTypeList].includes($node.contentType)}
      <MediaNode {node} nodeView={view} {isConstrainedWidth} />
    {:else}
      <NonMediaNode
        {node}
        bind:isShowFloatingBar
        selectedView={view}
        {isConstrainedWidth}
      />
    {/if}
    {#if isShowFloatingBar}
      <div transition:fly={{ y: 50 }}>
        <NodePanelSwitcher {node} {isConstrainedWidth} />
      </div>
    {/if}
  </div>
{:else}
  <div class="w-full h-full otop:pt-12 pt-4 mo:px-4 px-20">
    <NodeLoadingPulse />
  </div>
{/if}
{#if $context.isEmbed && accessMode !== AccessMode.POP && !isFromSplitView}
  <ComponentEmbedLayer isBackNavigable={true} />
{/if}
