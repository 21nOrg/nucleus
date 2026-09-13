<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import type { Snippet } from "svelte";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import PanelSwitcher from "@21n/elements/switcher/PanelSwitcher.svelte";
  import Toggle from "@21n/elements/toggle/Toggle.svelte";
  import { Size } from "@21n/elements/size.enum";
  import { PanelSwitcherStyle } from "@21n/elements/switcher/switcher.enum";
  import { recentsStore } from "@nucleum/stores/resources/recent.store";
  import { onMount, onDestroy } from "svelte";
  import { isValidString, properCase } from "@21n/shared-utils/text.utils";
  import Button from "@21n/elements/button/Button.svelte";
  import { ButtonStyle } from "@21n/elements/button/button.type";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import SearchResultsPopover from "@21n/elements/input/SearchResultsPopover.svelte";
  import LinkSearchResultItem from "@nucleum/features/memory/common/linkbox/LinkSearchResultItem.svelte";
  import GroupedSearchResults from "@nucleum/products/memotron/library/search/GroupedSearchResults.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import view from "@nucleum/stores/view.store";
  import {
    resolveProductResources,
    resolveResourceIcon
  } from "@nucleum/datafn/resource.utils";
  import {
    KeyboardKey,
    ModifierKey
  } from "@21n/elements/keyboard/keyboard.type";
  import ShortcutText from "@21n/elements/text/ShortcutText.svelte";
  import { cn } from "@21n/utils/ui.utils";
  import context from "@nucleum/stores/context.store";
  import { Embed } from "@nucleum/client/runtime/context.type";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { Action } from "@nucleum/client/config/action.enum";
  import { searchStore } from "@nucleum/application/search/index";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import {
    highlightSearchQuery,
    searchSort
  } from "@nucleum/features/memory/linking/search-results.utils";
  import { contentTypeSort } from "@nucleum/features/memory/node/node.utils";
  import { activeResourceFilter, debouncer } from "@21n/utils/utils";

  let {
    children,
    isGlobalSearchModal = false,
    isInline = false,
    isExpanded = isGlobalSearchModal,
    parentBgIndex = 1,
    onClose = undefined
  }: {
    children?: Snippet;
    isGlobalSearchModal?: boolean;
    isInline?: boolean;
    isExpanded?: boolean;
    parentBgIndex?: number;
    onClose?: ((event: CustomEvent<void>) => void) | undefined;
  } = $props();

  let isFiltersVisible = $state(false);
  let data = $state<any[]>([]);
  let recents = $state<any[]>([]);
  let isRefreshing = $state(false);
  let searchResultsPopover = $state<SearchResultsPopover | undefined>(
    undefined
  );
  let groupedSearchRef = $state<GroupedSearchResults | undefined>(undefined);
  let lastSearchSignature = $state("");
  const resources = $derived(
    resolveProductResources($appStore.product, "search")
  );
  const switchItems = $derived([
    {
      label: "Everything",
      value: Resource.everything,
      icon: "asterisk"
    },
    ...(resources ?? []).map((x) => ({
      label: properCase(x) + "s",
      value: x,
      icon: resolveResourceIcon(x)
    }))
  ]);
  const isGroupedResultsMode = $derived(
    !$view.isConstrainedWidth &&
      $searchStore.resourceType === Resource.everything
  );

  const resolveSearchPriority = (item: any) => {
    if (isValidString(item?.labelSearch)) return 0;
    if (isValidString(item?.bodySearch)) return 1;
    return 2;
  };

  const combinedSearchSort = (a: any, b: any) => {
    const priorityDiff = resolveSearchPriority(a) - resolveSearchPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    const contentTypeDiff = contentTypeSort(a, b);
    if (contentTypeDiff !== 0) return contentTypeDiff;
    return searchSort(a, b);
  };

  function resolveSearchFields(resource: Resource) {
    switch (resource) {
      case Resource.node:
        return ["label", "text", "notes"];
      case Resource.event:
        return ["label", "event"];
      default:
        return ["label"];
    }
  }

  onMount(async () => {
    searchStore.setKeyboardHandlers({
      keyup: (event) => keyup(event),
      keydown: (event) => keydown(event)
    });

    if (isExpanded) {
      searchResultsPopover?.search();
      groupedSearchRef?.search();
    }
  });

  onDestroy(() => {
    searchStore.clearKeyboardHandlers();
  });

  const debouncedStoreSearch = debouncer((query: string) => {
    search(query);
  }, 250);

  $effect(() => {
    if (!isExpanded) return;
    const query = $searchStore.query ?? "";
    const signature = [
      isGroupedResultsMode ? "grouped" : "single",
      $searchStore.resourceType,
      query
    ].join(":");
    if (signature === lastSearchSignature) return;
    lastSearchSignature = signature;
    debouncedStoreSearch(query);
  });

  export function search(query = $searchStore.query) {
    if (isGroupedResultsMode) {
      groupedSearchRef?.search(query);
    } else {
      searchResultsPopover?.search(query);
    }
  }

  export function keydown(event: KeyboardEvent) {
    if (isGroupedResultsMode) {
      groupedSearchRef?.keydown(event);
    } else {
      searchResultsPopover?.keydown(event);
    }
  }

  export function keyup(event: KeyboardEvent) {
    if (isGroupedResultsMode) {
      groupedSearchRef?.keyup(event);
    } else {
      searchResultsPopover?.keyup(event);
    }
  }

  async function refresh(searchQuery?: string, resourceType?: Resource) {
    try {
      if (isValidString(searchQuery)) {
        const query = (searchQuery ?? "").trim();
        isRefreshing = true;
        const selectedResource = resourceType ?? $searchStore.resourceType;
        const searchResources =
          selectedResource === Resource.everything
            ? (resources ?? [])
            : [selectedResource];
        const result = await datafn.search({
          query,
          resources: searchResources,
          fields:
            selectedResource === Resource.everything
              ? undefined
              : resolveSearchFields(selectedResource),
          limit: 150,
          limitPerResource: 150,
          source: "local",
          prefix: true,
          fuzzy: 0.2
        });
        data = (result.results?.map((entry: any) => entry.data) ?? []).filter(
          activeResourceFilter
        );
        data = highlightSearchQuery(data, query);
        data = data
          .filter((x) => x.labelSearch || x.bodySearch)
          .sort(combinedSearchSort);
      } else {
        data = [];
        recents = recentsStore.resolve({
          type: resourceType ?? $searchStore.resourceType
        });
        return recents;
      }
      return data;
    } catch (e) {
      logger.error({ at: "ResourceSearchModal.refresh", error: e });
    } finally {
      isRefreshing = false;
    }
  }

  /**
   * Defaulting to FULL access mode for portrait - since in this layout - tab bar isn't available
   * @param e
   */
  function onSelect(
    e: CustomEvent<{ item: any; event: MouseEvent | undefined; group?: any }>
  ) {
    const item = e.detail.item;
    if (!item || !item?.id) {
      if ($searchStore.resourceType === Resource.everything) {
        const group = e.detail.group;
        if (group) {
          expandGroup(group.value);
        }
      }
      return;
    }
    if ($view.isPortrait) {
      navigation.openResource(item.id, AccessMode.FULL);
      return;
    }
    navigation.toggleSearchParam([AccessMode.MAIN]);
    navigation.resourceClickHandler(e.detail.event, item.id, {
      origin: Action.SEARCH
    });
  }

  function expandGroup(resourceType: Resource) {
    searchStore.setResourceType(resourceType);
    setTimeout(() => {
      searchResultsPopover?.search($searchStore.query);
    }, 100);
  }
</script>

<div
  class={cn("flex flex-col w-full h-full", {
    "otop:pt-12": isGlobalSearchModal
  })}
>
  <header class={"flex flex-col w-full"}>
    <div
      class={cn("flex gap-1", {
        "py-3": isGlobalSearchModal && !isInline
      })}
    >
      <span class="min-w-0 flex-1">
        {@render children?.()}
      </span>
      {#if isExpanded}
        <div class="flex h-full items-center gap-2 pr-4">
          {#if !isGlobalSearchModal}
            <Button
              icon="cross"
              size={Size.lg}
              style={ButtonStyle.OUTLINED}
              onclick={() => {
                searchStore.reset();
                onClose?.(new CustomEvent("close"));
              }}
            />
          {/if}
          {#if isFiltersVisible}
            <Button
              icon="funnel"
              style={ButtonStyle.OUTLINED}
              size={Size.sm}
              label="Filters"
            />
            <Button
              icon="bars-center-left"
              style={ButtonStyle.OUTLINED}
              size={Size.sm}
              label="Sort"
            />
            <span class="flex gap-2 items-center">
              <Toggle
                icon="adjustments-vertical"
                size={Size.sm}
                bind:on={isFiltersVisible}
              />
            </span>
          {/if}
        </div>
      {/if}
    </div>
    {#if isExpanded}
      <PanelSwitcher
        items={switchItems}
        value={$searchStore.resourceType}
        style={PanelSwitcherStyle.BAR}
        isExpandToFullWidth={true}
        {parentBgIndex}
        size={Size.sm}
        onSwitch={(e) => {
          searchStore.setResourceType(e.detail);
          setTimeout(() => {
            if (isGroupedResultsMode) {
              groupedSearchRef?.search($searchStore.query);
            } else {
              searchResultsPopover?.search($searchStore.query);
            }
          }, 100);
        }}
      />
    {/if}
  </header>
  {#if isExpanded}
    <main class="flex overflow-auto flex-1 min-h-0">
      <!-- {#if data.length > 0 || searchQuery}
      <div class="flex flex-col w-full h-full">
        {#if data.length > 0}
          <SearchResults items={data} />
        {:else}
          <div class="w-full h-full">
            <EmptyStatusView
              isSearchContext={true}
              isLoadingState={isRefreshing}
            />
          </div>
        {/if}
      </div>
    {:else}
      <div class="flex flex-col w-full items-start">
        <span class="flex px-4">
          <Text style={TextStyle.SECTION_HEADING} content="Recents" />
        </span>
        <SearchResults items={recents} />
      </div>
    {/if} -->
      {#if isGroupedResultsMode}
        <div class="flex flex-col justify-between w-full h-full">
          <div class="flex flex-grow w-full">
            <GroupedSearchResults
              bind:this={groupedSearchRef}
              searchCallback={(query, resourceType) => {
                return refresh(query, resourceType);
              }}
              isDefaultState={!$searchStore.query}
              groups={switchItems.filter(
                (x) => x.value !== Resource.everything
              )}
              onExpand={(e) => {
                const resourceType = e.detail?.group?.value;
                if (!resourceType) return;
                expandGroup(resourceType);
              }}
              {onSelect}
            />
          </div>
        </div>
      {:else}
        <SearchResultsPopover
          bind:this={searchResultsPopover}
          searchCallback={refresh}
          emptyStateLabel="No results found"
          searchResultComponent={LinkSearchResultItem}
          isInlineContext={true}
          isAlwaysShowSearchFeedback={true}
          {onSelect}
        />
      {/if}
    </main>
    {#if $context.embed !== Embed.HANDSET}
      <div
        class="flex w-full h-8 min-h-[2rem] bg-bgs2 justify-between items-center text-b3 text-fgs3 px-4 rounded-b-md"
      >
        <span class="inline-flex items-center gap-1">
          Press
          <ShortcutText
            shortcut={Action.SEARCH}
            parentBgIndex={2}
            isAlwaysShown={true}
          />
          to toggle global search
        </span>
        {#if isGroupedResultsMode}
          <span class="inline-flex items-center gap-1">
            Press
            <ShortcutText
              shortcut={{
                key: KeyboardKey.ARROW_RIGHT,
                modifiers: [ModifierKey.META, ModifierKey.SHIFT]
              }}
              parentBgIndex={2}
              isAlwaysShown={true}
            /> to switch between result groups
          </span>
        {/if}
      </div>
    {/if}
  {/if}
</div>
