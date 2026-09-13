<svelte:options runes={true} />

<script lang="ts">
  import { appMenuStore } from "@21n/layout/navigation/app-menu.store";
  import { acquireDnDPage, appStore } from "@nucleum/stores/app.store";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import Icon from "@21n/elements/Icon.svelte";
  import { Size } from "@21n/elements/size.enum";
  import {
    reorderList,
    type DragDropEvent
  } from "@nucleum/actions/rearrange.action";
  import {
    resolveProductResources,
    shiftResourceInArray
  } from "@nucleum/datafn/resource.utils";
  import { cn } from "@21n/utils/ui.utils";
  import SwitchInput from "@21n/elements/toggle/SwitchInput.svelte";
  import Text from "@21n/elements/text/Text.svelte";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import { UIState, UIStateScope } from "@nucleum/stores/uiState/uiState.type";
  import { properCase } from "@21n/shared-utils/text.utils";
  import InlineInfoBanner from "@21n/elements/text/InlineInfoBanner.svelte";
  import { InfoTextType } from "@21n/elements/text/info.type";
  import { onDestroy, onMount } from "svelte";
  let { onUpdate }: { onUpdate?: () => void } = $props();

  interface ResourceItem {
    id: Resource;
    name: string;
    isPinned: boolean;
  }

  let resources = $state<ResourceItem[]>([]);
  let userPinnedItems: string[] = [];
  let hideMenuLabels = $state(
    uiState.getState(UIState.hideLeftNavMenuLabels, {
      scope: UIStateScope.DAP
    }) || false
  );

  initResources();

  function initResources(): void {
    const app = $appStore.product;
    const resourceList = resolveProductResources(app);
    userPinnedItems = appMenuStore.get()[app]?.user || [];
    resources = (resourceList ?? []).map((resource) => {
      const isPinned = userPinnedItems.includes(resource);
      return {
        id: resource,
        name: properCase(resource) + "s",
        isPinned
      };
    });
  }

  function persistChanges(): void {
    userPinnedItems = resources.filter((r) => r.isPinned).map((r) => r.id);
    appMenuStore.setUserMenuItems(userPinnedItems);
    onUpdate?.();
  }

  function handleReorder(e: DragDropEvent): void {
    const { fromId, toId } = e;
    if (!fromId || !toId) return;
    resources = shiftResourceInArray(resources, fromId, toId);
    persistChanges();
  }

  function handleToggleMenuLabels(e: CustomEvent): void {
    hideMenuLabels = e.detail;
    uiState.setState(UIState.hideLeftNavMenuLabels, hideMenuLabels, {
      scope: UIStateScope.DAP
    });
    onUpdate?.();
  }

  let releaseDnDPage: (() => void) | undefined;

  onMount(() => {
    releaseDnDPage = acquireDnDPage();
  });

  onDestroy(() => {
    releaseDnDPage?.();
  });
</script>

<div class="w-96 bg-bgs1 p-3 flex flex-col gap-6 border border-brs2 rounded-md">
  <Text content="Menu settings" style={TextStyle.PANEL_HEADING_SMALL} />
  <SwitchInput
    label={{ label: "Hide menu labels" }}
    isExpanded={true}
    checked={hideMenuLabels}
    onChange={handleToggleMenuLabels}
  />
  <div class="flex flex-col gap-2">
    <Text content="Pin resources" style={TextStyle.SECTION_HEADING} />
    {#if resources.length > 0}
      <div
        class="flex flex-col gap-2"
        use:reorderList={{
          listId: "library-resources",
          draggedOverClass: "bg-bgs3",
          onDrop: handleReorder
        }}
      >
        {#each resources as resource, index (resource.id)}
          <div
            class="flex items-center justify-between py-1 px-1 hover:bg-bgs2 rounded transition-colors"
            draggable="true"
            data-index={index}
            data-id={resource.id}
            data-testid="leftnav-pin-resource"
          >
            <div class="flex items-center gap-2">
              <span
                class="cursor-grab text-fgs3 flex items-center justify-center"
              >
                <Icon icon="rearrange" size={Size.sm} />
              </span>
              <span class="text-fgs2">{resource.name}</span>
            </div>
            <label class="relative inline-block w-10 h-5 cursor-pointer">
              <input
                type="checkbox"
                class="opacity-0 w-0 h-0"
                checked={resource.isPinned}
                onchange={() => {
                  resource.isPinned = !resource.isPinned;
                  persistChanges();
                }}
              />
              <span
                class={cn(
                  "absolute cursor-pointer inset-0 rounded-full transition-colors duration-200",
                  {
                    "bg-aps1": resource.isPinned,
                    "bg-bgs4": !resource.isPinned
                  }
                )}
              >
                <span
                  class={cn(
                    "absolute left-0.5 bottom-0.5 w-4 h-4 rounded-full transition-transform duration-200",
                    {
                      "transform translate-x-5 bg-bgs1": resource.isPinned,
                      "bg-fgs3": !resource.isPinned
                    }
                  )}
                ></span>
              </span>
            </label>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-fgs3">No resources available</p>
    {/if}
    <div class="mt-3">
      <InlineInfoBanner
        content="Use hot key Q to show/hide labels"
        type={InfoTextType.TIP}
      />
    </div>
  </div>
</div>
