<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import InlineMarkdownTextInput from "@nucleum/features/memory/markdown/content/InlineMarkdownTextInput.svelte";
  import NodeLoadingPulse from "@21n/elements/feedback/animations/NodeLoadingPulse.svelte";
  import type { IActiveNodeStore } from "@nucleum/features/memory/node/node.store";
  import { updateActiveResource } from "@nucleum/stores/resources/active-resource.store";
  import NodeRightPane from "@nucleum/features/memory/node/rightPanel/NodeRightPane.svelte";
  import BottomFloat from "@21n/elements/BottomFloat.svelte";
  import NodeTitleBreadcrumbs from "@nucleum/features/memory/node/title/NodeTitleBreadcrumbs.svelte";
  import Icon from "@21n/elements/Icon.svelte";
  import NodeContent from "@nucleum/features/memory/node/content/NodeContent.svelte";
  import { Size } from "@21n/elements/size.enum";
  import ResourceStatusBanner from "@nucleum/components/records/RecordStatusBanner.svelte";
  import TextInput from "@21n/elements/input/TextInput.svelte";
  import { InputStyle } from "@21n/elements/input/input.type";
  import { cn } from "@21n/utils/ui.utils";
  import NodeAvatar from "@nucleum/features/memory/node/avatar/NodeAvatar.svelte";
  import CollectionsLane from "@nucleum/features/memory/node/floatingBar/CollectionsLane.svelte";
  import {
    headingNodeTypes,
    NodeView
  } from "@nucleum/features/memory/node/node.type";
  import { ResourcePanelType } from "@nucleum/stores/resources/resource-panel.type";
  import PropertiesPane from "@nucleum/features/collections/properties/PropertiesPane.svelte";
  import NodeRightPaneContent from "@nucleum/features/memory/node/rightPanel/NodeRightPaneContent.svelte";
  import NodeBirdView from "@nucleum/features/memory/node/birdView/NodeBirdView.svelte";
  import {
    AccessMode,
    ResourceAccessPoint
  } from "@nucleum/datafn/resource.type";
  import FullScreenCloseButton from "@21n/elements/button/FullScreenCloseButton.svelte";
  import { getMdStore } from "@nucleum/features/memory/markdown/markdown.store";
  import TableOfContents from "@nucleum/features/memory/markdown/TableOfContents.svelte";
  import { generateSimpleRandomId } from "@21n/shared-utils/crypto.utils";
  import context from "@nucleum/stores/context.store";
  import { Embed } from "@nucleum/client/runtime/context.type";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";

  import CoverPicker from "@21n/elements/coverPicker/CoverPicker.svelte";
  import CoverRenderer from "@21n/elements/coverPicker/CoverRenderer.svelte";
  import { hoverable } from "@nucleum/actions/hover.action";
  import Button from "@21n/elements/button/Button.svelte";
  import { ButtonVariant } from "@21n/elements/button/button.type";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";

  let {
    node,
    selectedView = NodeView.CONTENT,
    isConstrainedWidth = false,
    isShowFloatingBar = $bindable(true)
  }: {
    node: IActiveNodeStore;
    selectedView?: NodeView;
    isConstrainedWidth?: boolean;
    isShowFloatingBar?: boolean;
  } = $props();
  let lastScrollTop = 0;
  let mdId = generateSimpleRandomId();
  let isStickied = false;
  let refreshId: number = new Date().getTime();
  let scrollTimeout: NodeJS.Timeout;
  let isCoverPickerHovered = false;
  let dev_isShowFallbackFloatingBar = false;
  let mdStore = $derived(getMdStore(mdId));
  let cover = $derived($node.cover);
  let isWidened = $derived($node.config?.isWidened ?? false);

  let isReadOnlyMode = $derived(
    $node.isInReadOnlyMode ||
      $node.isLocked ||
      $node.isArchived ||
      $node.trashedAt != null
  );

  function onScroll(e: any) {
    const st = e.target?.scrollTop;
    if (st === 0 || st < 50) {
      isShowFloatingBar = true;
    } else if (st > lastScrollTop) {
      isShowFloatingBar = false;
    } else if (st < lastScrollTop) {
      isShowFloatingBar = true;
    }
    lastScrollTop = st;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const elementTarget = document.querySelector(".node-title.sticky");
      const rect = elementTarget?.getBoundingClientRect();
      if (!rect) return;
      const currentlyStickied = isStickied;
      const shouldBeStickied = currentlyStickied
        ? rect.top <= 85
        : rect.top <= 50;
      if (currentlyStickied !== shouldBeStickied) {
        isStickied = shouldBeStickied;
      }
    }, 10);

    const headingElements = document.querySelectorAll("[data-type*='HEADING']");
    const visibleHeadings = Array.from(headingElements).filter((element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <=
          (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <=
          (window.innerWidth || document.documentElement.clientWidth)
      );
    });
    $mdStore.headingsInView = visibleHeadings.map((x) => x.id);
  }
  async function onLabelChange(e: any) {
    if ($node.label) await node.modify({ label: $node.label });
  }

  async function onViewSwitch(e: CustomEvent<NodeView>) {
    selectedView = e.detail;
    navigation.toggleSearchParamRecordSpecific($node.id, {
      [AppSearchParam.NODE_VIEW]: selectedView
    });
    if (selectedView === NodeView.CONTENT) {
      await node.init({
        accessMode: $node.accessMode,
        accessPoint: ResourceAccessPoint.SELF
      });
      refreshId = new Date().getTime();
      await node.afterInit();
    }
  }

  async function handleCoverPhotoChange(e: CustomEvent) {
    await node.modify({
      cover: e.detail
    });
  }

  async function closeCoverPicker() {
    node.toggleCoverPicker(false);
  }

  async function removeCoverPhoto(e: MouseEvent) {
    e.stopPropagation();
    await node.modify({
      cover: ""
    });
    node.toggleCoverPicker(false);
  }
</script>

<div
  class="relative w-full h-full flex flex-col bg-bgs1 rounded-md"
  id="mdcontainer-{mdId}"
>
  {#if $node}
    {#if selectedView === NodeView.CONTENT}
      {@const isRenderCover =
        $node.contentType === NodeType.NODULAR_MARKDOWN &&
        cover &&
        !$node.focusedBlock}
      {#key refreshId}
        <div
          class={cn("h-full w-full flex mo:gap-0 cw:gap-0 gap-4", {
            "px-4 otop:pt-12": !isRenderCover,
            "justify-center": !isWidened,
            "dp:grid dp:grid-cols-[1fr_auto_1fr] dp:gap-2":
              !isWidened && !isConstrainedWidth,
            "px-0":
              isConstrainedWidth && $node.panel !== ResourcePanelType.DEFAULT
          })}
        >
          {#if !isConstrainedWidth || (isConstrainedWidth && ($node.panel === ResourcePanelType.DEFAULT || $node.panel === ResourcePanelType.CONTENT || $node.panel === ResourcePanelType.NONE))}
            <div class="min-w-0" />
            <div
              class={cn("flex flex-col justify-center items-center h-full", {
                "flex-grow": isWidened,
                "flex-grow max-w-[50rem] overflow-auto": !isWidened,
                "dp:min-w-[50rem]": !isWidened && !isConstrainedWidth
              })}
            >
              {#if isRenderCover}
                <div
                  class="relative flex w-full cw:h-32 h-72 justify-center items-center"
                  use:hoverable={{
                    onHover: (e) => {
                      isCoverPickerHovered = e;
                    }
                  }}
                >
                  <CoverRenderer {cover} class="w-full h-full object-cover" />
                  {#if isCoverPickerHovered && !isReadOnlyMode}
                    <div
                      class="absolute top-0 left-0 w-full h-full flex gap-4 items-center justify-center bg-bgs2 bg-opacity-70"
                    >
                      <Button
                        label="Replace"
                        icon="reset"
                        size={Size.sm}
                        onclick={() => {
                          node.toggleCoverPicker(true);
                        }}
                      />
                      <Button
                        label="Remove"
                        icon="trash"
                        type={ButtonVariant.DANGER}
                        size={Size.sm}
                        onclick={removeCoverPhoto}
                      />
                    </div>
                  {/if}
                </div>
              {/if}
              {#if headingNodeTypes.includes($node.contentType)}
                {#key $node.mdParent?.map((x) => x.toString())?.join(".")}
                  <header class="flex w-full px-12 py-4">
                    <NodeTitleBreadcrumbs
                      id={$node.id}
                      mdParent={$node.mdParent}
                      currentLabel={$node.label}
                      onClick={(event) => {
                        node.eventStore.set({
                          event: event.detail.event,
                          id: event.detail.item.resourceId
                        });
                      }}
                    />
                  </header>
                {/key}
              {/if}
              {#if $node.contentType === NodeType.NODULAR_MARKDOWN && $node.isShowCoverPicker}
                <div class="h-full w-full overflow-auto">
                  <CoverPicker
                    value={cover}
                    onClose={closeCoverPicker}
                    onChange={handleCoverPhotoChange}
                    onSelect={handleCoverPhotoChange}
                  />
                </div>
              {:else}
                <main
                  class={cn(
                    "relative flex flex-col gap-6 mo:pr-0 h-full w-full overflow-auto",
                    {
                      "cw:px-4": isRenderCover
                    }
                  )}
                  onscroll={onScroll}
                >
                  {#if !$node.focusedBlock}
                    <div class="min-h-20" />
                    {#if $node.types && $node.types.length > 0}
                      <span
                        class={cn("flex mo:mx-0 mx-12 -mb-6", {
                          "opacity-0": isStickied,
                          "opacity-100": !isStickied
                        })}
                      >
                        <NodeAvatar
                          node={$node}
                          accessPoint={ResourceAccessPoint.SELF}
                          isExpandedContext={true}
                        />
                      </span>
                    {/if}
                    <span
                      class={cn(
                        "node-title flex gap-3 font-medium text-start sticky top-0 mo:ml-0 cw:ml-0 ml-12 py-3 userdata",
                        {
                          "text-h4 bg-bgs1 z-10": isStickied,
                          "text-h2 bg-bgs1 z-0": !isStickied
                        }
                      )}
                    >
                      {#if isStickied && $node.types && $node.types.length > 0}
                        <NodeAvatar
                          node={$node}
                          accessPoint={ResourceAccessPoint.SELF}
                        />
                      {/if}
                      {#if !isReadOnlyMode}
                        <TextInput
                          id={`title-${$node.id}`}
                          size={Size.xl}
                          bind:value={$node.label}
                          inlineEditor={InlineMarkdownTextInput}
                          style={InputStyle.PLAIN}
                          placeholder="Node title"
                          width="w-full"
                          onDebouncedChange={onLabelChange}
                          onKeydown={(e) => {
                            const event = e.detail;
                            if (event.key === "ArrowDown") {
                              event.preventDefault();
                              if ($mdStore.blocks[0].id)
                                mdStore.focus.set({
                                  id: $mdStore.blocks[0].id
                                });
                            }
                          }}
                        />
                      {:else}
                        {$node.label ?? $node.body ?? ""}
                      {/if}
                    </span>
                    <div class="w-full flex mo:px-0 cw:px-0 px-12 -mt-4">
                      <CollectionsLane {node} {isReadOnlyMode} />
                    </div>
                  {/if}
                  <div class="cw:px-0 px-12">
                    <ResourceStatusBanner resource={node} />
                  </div>
                  {#if $node.types && $node.types.length > 0 && !$node.focusedBlock}
                    <!-- TODO - later - show properties of focused node if the focused blocks is associated with a type collection -->
                    <PropertiesPane
                      item={node}
                      resource={Resource.node}
                      isVisibleProps={true}
                      onShowAll={() => {
                        node.switchPanel(ResourcePanelType.PROPERTIES);
                      }}
                    />
                  {/if}
                  <NodeContent {node} {mdId} {isReadOnlyMode} />
                </main>
              {/if}
            </div>
          {:else if isConstrainedWidth && $node.panel !== ResourcePanelType.CONTENT}
            <NodeRightPaneContent {node} {mdId} />
          {/if}

          {#if !$node.isInFocusMode && $node.panel && $node.panel !== ResourcePanelType.CONTENT && $node.panel !== ResourcePanelType.DEFAULT}
            <NodeRightPane {node} {mdId} />
          {:else}
            <div class="flex max-w-sm px-1">
              <TableOfContents
                {mdId}
                isHideEmptyPlaceholder={true}
                isExpandOnHover={isConstrainedWidth}
              />
            </div>
          {/if}
        </div>
      {/key}
    {:else}
      <NodeBirdView {node} />
    {/if}
    {#if dev_isShowFallbackFloatingBar && $node.isInFocusMode && isConstrainedWidth}
      <BottomFloat margin={$context.embed === Embed.HANDSET ? "mb-8" : "mb-4"}>
        <button
          class="flex justify-center items-center gap-2 bg-bgs2 border border-brs3 rounded-md px-4 py-2 shadow-sm hover:bg-bgs3"
          onclick={() => {
            updateActiveResource($node.id, { isInFocusMode: false });
          }}
        >
          <Icon icon="cross" />
          <span class="text-b2"> Close focus mode </span>
        </button>
      </BottomFloat>
    {/if}
  {:else}
    <div class="w-full h-full pt-4 px-20 otop:pt-12">
      <NodeLoadingPulse />
    </div>
  {/if}
  {#if ($node.accessMode === AccessMode.SPLIT || $node.accessMode === AccessMode.FSPLIT) && (!$node.panel || $node.panel === ResourcePanelType.NONE)}
    <FullScreenCloseButton accessMode={$node.accessMode} isFloat={true} />
  {/if}
</div>
