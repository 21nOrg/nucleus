<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import {
    ActiveCollectionStore,
    type IActiveCollectionStore
  } from "./collection.store";
  import Cover from "@nucleum/features/collections/Cover.svelte";
  import CollectionTitleBar from "@nucleum/features/collections/CollectionTitleBar.svelte";
  import View from "@nucleum/features/collections/View.svelte";
  import { acquireDnDPage, appStore } from "@nucleum/stores/app.store";
  import ViewSettingsBar from "@nucleum/features/collections/ViewSettingsBar.svelte";
  import PageLoadingPulse from "@21n/elements/feedback/animations/PageLoadingPulse.svelte";
  import { bg, cn } from "@21n/utils/ui.utils";
  import ViewTabSwitcher from "@nucleum/features/collections/tabSwitcher/ViewTabSwitcher.svelte";
  import PanelSwitcher from "@21n/elements/switcher/PanelSwitcher.svelte";
  import {
    BarStyle,
    PanelSwitcherStyle
  } from "@21n/elements/switcher/switcher.enum";
  import { Size } from "@21n/elements/size.enum";
  import { ButtonStyle } from "@21n/elements/button/button.type";
  import { type IProperty } from "@nucleum/features/collections/properties/property.type";
  import { activeResourceFilter } from "@21n/utils/utils";
  import { onDestroy, onMount, untrack } from "svelte";
  import type { DropdownItem } from "@21n/elements/dropdown/dropdownItem.type";
  import type {
    ISelectItem,
    ISelectValue
  } from "@21n/elements/select/select.type";
  import {
    AccessMode,
    ResourceAccessPoint
  } from "@nucleum/datafn/resource.type";
  import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
  import { isValidString } from "@21n/shared-utils/text.utils";
  import {
    CollectionLayout,
    type ICollectionItem,
    type ICollectionViewWithData
  } from "@nucleum/features/collections/collection.type";
  import ResourceStatusBanner from "@nucleum/components/records/RecordStatusBanner.svelte";
  import {
    Arrangement,
    Orientation,
    Placement
  } from "@21n/elements/direction.enum";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import CoverPicker from "@21n/elements/coverPicker/CoverPicker.svelte";
  import OptionSelector from "@21n/elements/select/OptionSelector.svelte";
  import { isValidArrayWithData } from "@21n/shared-utils/obj.utils";
  import ArrangementSelector from "@nucleum/features/collections/arrangementSelector/ArrangementSelector.svelte";

  import AddResourceAction from "@nucleum/features/collections/AddResourceAction.svelte";

  import {
    isNoneResource,
    resourceInList
  } from "@nucleum/datafn/resource.utils";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import view from "@nucleum/stores/view.store";

  import {
    resolvePropertyIcon,
    tabAndGroupableProperties
  } from "@nucleum/features/collections/properties/property.utils";

  import { InputStyle } from "@21n/elements/input/input.type";
  import { resizeListener } from "@nucleum/actions/resize.action";
  import { Action } from "@nucleum/client/config/action.enum";
  import InlineSearchBar from "@21n/elements/InlineSearchBar.svelte";
  import Icon from "@21n/elements/Icon.svelte";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  import ComponentEmbedLayer from "@21n/layout/layers/ComponentEmbedLayer.svelte";
  import { Product } from "@nucleum/client/config/product.type";
  import { MemotronAction } from "@nucleum/features/memory/memory-action.enum";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import { toSvelteStore } from "@datafn/svelte";

  let {
    id = "",
    accessPoint = ResourceAccessPoint.SELF,
    parentBgIndex = 1,
    accessMode = AccessMode.POP
  }: {
    id?: string;
    accessPoint?: ResourceAccessPoint;
    parentBgIndex?: number;
    accessMode?: AccessMode;
  } = $props();

  function resolveParentLabel(parent: unknown) {
    if (Array.isArray(parent)) {
      return parent
        .map((entry) =>
          entry && typeof entry === "object" && "label" in entry
            ? String((entry as { label?: unknown }).label ?? "")
            : ""
        )
        .join(" ");
    }
    if (parent && typeof parent === "object" && "label" in parent) {
      return String((parent as { label?: unknown }).label ?? "");
    }
    return "";
  }

  function resolveSearchHaystack(item: ICollectionItem) {
    const values = [item.label];
    if ("body" in item && item.body) {
      values.push(item.body.toString());
    }
    if ("text" in item && typeof item.text === "string") {
      values.push(item.text);
    }
    if ("parent" in item) {
      values.push(resolveParentLabel(item.parent));
    }
    return values
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .toLowerCase();
  }

  let collection: IActiveCollectionStore = $derived(
    ActiveCollectionStore.resolve(id)
  );
  let activeView = $state<ICollectionViewWithData | null>(null);
  let selectedViewId = $state<string>("");
  let selectedTab = $state<ISelectValue | undefined>(undefined);
  let dev_isRoundedCover = false;
  let isStickied = $state(false);
  let triggerItemEdit = $state("");
  let viewRightButtonOptions: {
    size: Size.sm;
    style: ButtonStyle;
    isPreventMinWidth: boolean;
  } = {
    style: ButtonStyle.PLAIN,
    size: Size.sm,
    isPreventMinWidth: true
  };
  let properties = $state<DropdownItem[]>([]);
  let viewsForSwitcher = $state<ISelectItem[]>([]);
  let isReady = $state(false);
  let isInitializing = $state(false);
  let isCoverPickerOpen = $state(false);
  let isShowMetaViews = $state(false);
  let isSingleViewMode = $state(true);
  let searchQuery = $state("");
  let containerWidth = $state(0);
  let initializedKey = $state("");
  let releaseDnDPage: (() => void) | undefined;
  let itemResource = $state<Resource | undefined>(undefined);
  const itemRecordsStore = $derived.by(() => {
    const collectionId = id.toString();
    if (!collectionId || !itemResource) return undefined;
    if (!itemResource || itemResource === Resource.node) {
      return toSvelteStore(
        datafn.node.signal({
          filters: {
            collections: { $any: { id: collectionId } }
          },
          sort: ["-updatedAt"],
          select: ["*", "parent.*", "file.*", "propertyValues.*#"]
        }),
        { initialData: [] }
      );
    }
    if (itemResource === Resource.objective) {
      return toSvelteStore(
        datafn.objective.signal({
          filters: {
            collections: { $any: { id: collectionId } }
          },
          sort: ["-updatedAt"],
          select: [
            "*",
            "parent.*",
            "children.*",
            "tasks.*",
            "propertyValues.*#"
          ]
        }),
        { initialData: [] }
      );
    }
    return undefined;
  });
  const itemRecords = $derived(
    itemRecordsStore
      ? (
          ($itemRecordsStore!.data ?? []) as unknown as ICollectionItem[]
        ).filter(activeResourceFilter)
      : []
  );
  const totalItemCount = $derived(itemRecords.length);
  const viewData = $derived(resolveViewData(itemRecords));
  const _filtered = $derived(resolveFilteredViewData(viewData));
  const isViewDataLoading = $derived(
    Boolean(itemRecordsStore && $itemRecordsStore!.loading)
  );

  $effect(() => {
    if (!$collection || $collection.totalItemCount === totalItemCount) return;
    collection.update((val) => {
      if (!val) return val;
      val.totalItemCount = totalItemCount;
      return val;
    });
  });

  let isConstrainedWidth = $derived(
    $view.isConstrainedWidth ||
      $view.isPortrait ||
      $collection?.accessMode === AccessMode.SPLIT ||
      $collection?.accessMode === AccessMode.FSPLIT ||
      (containerWidth < 1000 &&
        ($collection?.coverLayout?.placement === Placement.Right ||
          $collection?.coverLayout?.placement === Placement.Left))
  );

  let coverPlacement = $derived(
    $collection?.coverLayout?.placement === Placement.Top ||
      !$collection?.coverLayout?.placement ||
      isConstrainedWidth
      ? Placement.Top
      : $collection?.coverLayout?.placement
  );

  let isBoardContext = $derived.by(() => {
    const currentView = activeView;
    if (!currentView) return false;
    return (
      currentView.layout === CollectionLayout.BOARD &&
      !isNoneResource(currentView.groupBy)
    );
  });

  $effect(() => {
    const nextKey = id ? `${id}:${accessMode}` : "";
    if (!nextKey || initializedKey === nextKey) return;
    initializedKey = nextKey;
    itemResource = undefined;
    untrack(() => {
      initialize();
    });
  });

  onMount(() => {
    releaseDnDPage = acquireDnDPage();
  });

  onDestroy(() => {
    releaseDnDPage?.();
    ActiveCollectionStore.destroy(id, accessMode);
  });

  async function initialize() {
    if (!id || isInitializing) return;
    isInitializing = true;
    isReady = false;
    activeView = null;
    selectedTab = undefined;
    try {
      const viewQueryParam = new URLSearchParams(location.search).get(
        AppSearchParam.VIEW
      );
      selectedViewId = viewQueryParam ?? "";
      await collection.init(accessMode);
      itemResource = $collection?.resource ?? Resource.node;
      loadActiveView();
      if (!activeView) {
        activeView = $collection?.views
          ? $collection.views.filter(activeResourceFilter)?.[0]
          : null;
        selectedViewId = activeView?.id?.toString() ?? "";
      }
      properties = await resolvePropertyList();
      refreshViewsLane();
      refresh();
    } catch (error) {
      logger.error({ at: "Collection.initialize", error, id, accessMode });
    } finally {
      isInitializing = false;
      isReady = true;
    }
  }

  async function resolvePropertyList() {
    const noneOption = {
      label: "None",
      value: "property:none",
      icon: "circle-dashed"
    };
    return $collection?.properties
      ? [
          noneOption,
          ...($collection?.properties
            ? $collection?.properties
                .filter(activeResourceFilter)
                .filter((x) => tabAndGroupableProperties.includes(x.type))
                .map((x: IProperty) => {
                  return {
                    label: x.label,
                    value: x.id?.toString(),
                    icon: resolvePropertyIcon(x)
                  };
                })
            : [])
          // ...metaPropertyOptions
        ]
      : [
          noneOption
          // ...metaPropertyOptions
        ];
  }

  function onViewRemove(e: CustomEvent) {
    if (e.detail) collection.deleteView(e.detail);
    refreshViewsLane();
  }

  async function onViewAdd(e: CustomEvent) {
    const id = await collection.createView();
    if (!id) return;
    selectedViewId = id.toString();
    refreshViewsLane();
    onViewSwitch();
    triggerItemEdit = id.toString();
  }

  function onViewSettingsChange(e: CustomEvent) {
    logger.log({ at: "onViewSettingsChange", activeView, e });
    if (!activeView) return;
    const key = e.detail.key;
    let value = e.detail.value;
    if (!key) return;
    activeView = {
      ...activeView,
      [key]: value
    } as ICollectionViewWithData;
    collection.updateView(
      activeView.id,
      {
        [key]: value
      },
      "settings"
    );
  }

  function onArrangementChange(e: CustomEvent) {
    if (!activeView) return;
    activeView.arrangement = e.detail;
    activeView.density = activeView.density ? activeView.density : 1;
    collection.updateView(
      activeView.id,
      {
        arrangement: activeView.arrangement,
        density: activeView.density
      },
      "arrangement"
    );
  }

  function onDensityChange(e: CustomEvent) {
    if (!activeView) return;
    activeView.density = e.detail;
    collection.updateView(
      activeView.id,
      {
        density: activeView.density
      },
      "density"
    );
  }

  function onPreviewSettingChange(e: CustomEvent) {
    if (!activeView) return;
    activeView.isHideThumbnailPreview = e.detail;
    collection.updateView(
      activeView.id,
      {
        isHideThumbnailPreview: activeView.isHideThumbnailPreview
      },
      "isHideThumbnailPreview"
    );
  }

  function onTitleSettingChange(e: CustomEvent) {
    if (!activeView) return;
    activeView.isHideThumbnailTitle = e.detail;
    collection.updateView(
      activeView.id,
      {
        isHideThumbnailTitle: activeView.isHideThumbnailTitle
      },
      "isHideThumbnailTitle"
    );
  }

  let positionFromTop = $state<number | undefined>(undefined);
  function onScroll() {
    const elementTarget = document.querySelector(".stickyheader");
    positionFromTop = elementTarget?.getBoundingClientRect().top;
    isStickied = positionFromTop !== undefined ? positionFromTop <= 0 : false;
  }

  async function closeEditMode() {
    const label = $collection.label?.trim();
    if (label) {
      await collection.modify({ label });
    }
    collection.toggleEditMode(false);
  }

  async function onViewSwitch() {
    logger.log({ at: "onViewSwitch", selectedViewId });
    resetViewSelections();
    const view = loadActiveView();
    if (!view) return;
    refresh();
  }

  function resetViewSelections() {
    selectedTab = undefined;
  }

  function onViewLabelChange(e: CustomEvent) {
    if (!e.detail.value || !e.detail.label) return;
    collection.updateView(e.detail.value, { label: e.detail.label }, "label");
  }

  function onViewRearrange(e: CustomEvent) {
    if (e.detail && isValidArrayWithData(e.detail)) {
      collection.modify(
        { views: e.detail },
        { isPreventBackPropagation: true }
      );
    }
  }

  function refreshViewsLane() {
    viewsForSwitcher = $collection?.views
      ? $collection.views.filter(activeResourceFilter).map((x) => {
          return { label: x.label ?? "Default", value: x.id?.toString() };
        })
      : [];
    isSingleViewMode = viewsForSwitcher?.length === 1;
  }

  function loadActiveView() {
    logger.log({ at: "loadActiveView", selectedViewId });
    if (!selectedViewId || !$collection?.views) return;
    const view =
      $collection.views.find((x) => x.id.toString() === selectedViewId) ?? null;
    if (!view) return;
    activeView = view;
    return view;
  }

  function refresh() {
    loadActiveView();
  }

  function resolveViewData(items: ICollectionItem[]) {
    if (!activeView) return [];
    const tabBy = activeView.tabBy;
    if (!tabBy || (tabBy && selectedTab === "all")) {
      return items;
    }
    if (tabBy && selectedTab !== undefined) {
      return items.filter((x) => {
        const prop = x.propertyValues?.find(resourceInList(tabBy))?.value;
        const selectedTabValue = selectedTab?.toString();
        if (!selectedTabValue) return false;
        return Array.isArray(prop)
          ? prop.some((value) => value?.toString() === selectedTabValue)
          : prop?.toString() === selectedTabValue;
      });
    }
    return items;
  }

  function resolveFilteredViewData(items: ICollectionItem[]) {
    if (!searchQuery) return items;
    const searchTerm = searchQuery.toLowerCase();
    return items.filter((x) => resolveSearchHaystack(x).includes(searchTerm));
  }

  function onSearch() {}

  function onTabSwitch(e: CustomEvent) {
    refresh();
  }

  function applyCover(nextCover: string | undefined) {
    collection.update((val) => {
      if (!val) return val;
      val.cover = nextCover;
      return val;
    });
  }

  function onCoverChange(e: CustomEvent) {
    logger.log({ at: "Collection.onCoverChange", detail: e.detail });
    applyCover(e.detail);
  }

  function persistCoverChange(e: CustomEvent) {
    logger.log({ at: "Collection.persistCoverChange", detail: e.detail });
    applyCover(e.detail);
    collection.modify({ cover: e.detail });
  }

  function onPlacementChange(e: CustomEvent) {
    logger.log({ at: "onPlacementChange", e });
    collection.modify({
      coverLayout: {
        ...$collection.coverLayout,
        placement: e.detail
      }
    });
  }

  function onCoverReposition(e: CustomEvent) {
    logger.log({ at: "onCoverReposition", e });
    const result = resolveCoverPosition(e);
    if (result && $collection.isInEditMode) {
      $collection.coverLayout = result;
    }
  }

  function resolveCoverPosition(e: CustomEvent) {
    if (
      (coverPlacement === Placement.Top &&
        $collection.coverLayout?.position?.y === e.detail) ||
      (coverPlacement !== Placement.Top &&
        $collection.coverLayout?.position?.x === e.detail)
    )
      return;
    return {
      ...$collection.coverLayout,
      position:
        coverPlacement === Placement.Top
          ? { y: e.detail, x: $collection.coverLayout?.position?.x }
          : { x: e.detail, y: $collection.coverLayout?.position?.y }
    };
  }

  function onCoverRepositionDebounced(e: CustomEvent) {
    logger.log({ at: "onCoverRepositionDebounced", e });
    if ($collection.isInEditMode) {
      collection.modify({ coverLayout: $collection.coverLayout });
    }
  }

  function onCoverResize(e: CustomEvent) {
    logger.log({ at: "onCoverResize", e });
    $collection.coverLayout = resolveCoverResized(e);
  }

  function resolveCoverResized(e: CustomEvent) {
    return {
      ...$collection.coverLayout,
      size:
        coverPlacement === Placement.Top
          ? {
              height: e.detail.height,
              width: $collection.coverLayout?.size?.width
            }
          : {
              width: e.detail.width,
              height: $collection.coverLayout?.size?.height
            }
    };
  }

  function onCoverResizeDebounced(e: CustomEvent) {
    logger.log({ at: "onCoverResizeDebounced", e });
    collection.modify({ coverLayout: resolveCoverResized(e) });
  }

  function onAddResource(e: CustomEvent) {
    if (e.detail === "addExisting") {
      requireCommandHost().runAction(Action.ADD_ITEM_TO_COLLECTION, {
        componentParams: {
          label: `Add to &nbsp; **${$collection.label}**`,
          id: $collection.id,
          resource: $collection.resource
        }
      });
    } else if (e.detail === "createNew" || e.detail === "createMultiple") {
      let params = {};
      if (e.detail === "createMultiple") {
        params = {
          [AppSearchParam.LINK]: $collection.id.toString(),
          [AppSearchParam.BULK]: true
        };
      } else {
        params = {
          [AppSearchParam.LINK]: $collection.id.toString()
        };
      }
      setTimeout(() => {
        const resource = $collection.resource ?? Resource.node;
        const isSecondaryNodeCaptureContext =
          resource === Resource.node &&
          [Product.MEMOTRON, Product.NUCLEUM].includes($appStore.product);
        if (isSecondaryNodeCaptureContext) {
          requireCommandHost().runAction(MemotronAction.CAPTURE_SECONDARY, {
            searchParams: params
          });
          return;
        }
        requireCommandHost().runResourceAction(
          resource,
          ResourceActionType.CREATE,
          {
            searchParams: params
          }
        );
      }, 10);
    }
  }

  function onCaptureShortcutChange(e: CustomEvent) {
    collection.modify({ isCaptureShortcutEnabled: e.detail });
  }

  function onTypeExtensionChange(e: CustomEvent) {
    if (e.detail.id) {
      collection.modify(
        { typeToExtend: e.detail.id },
        { isPreventBackPropagation: true }
      );
    } else if (e.detail === false) {
      collection.modify({ typeToExtend: null });
    }
  }
</script>

{#if !$collection || $collection.isPageLoading || !isReady || isInitializing}
  <div class="w-full h-full p-4 otop:pt-12">
    <PageLoadingPulse />
  </div>
{:else if $collection}
  <div
    class={cn("relative flex w-full h-full", {
      "flex-col overflow-auto": coverPlacement === Placement.Top
    })}
    onscroll={onScroll}
    use:resizeListener={(e) => {
      containerWidth = e.width;
    }}
  >
    {#if accessPoint === ResourceAccessPoint.SELF && coverPlacement !== Placement.Right}
      <Cover
        cover={$collection.cover}
        isInEditMode={$collection.isInEditMode}
        placement={coverPlacement}
        position={$collection.coverLayout?.position}
        size={$collection.coverLayout?.size}
        {dev_isRoundedCover}
        {isConstrainedWidth}
        bind:isCoverPickerOpen
        onChange={onCoverChange}
        onPlacement={onPlacementChange}
        onReposition={onCoverReposition}
        onRepositionDebounced={onCoverRepositionDebounced}
        onResize={onCoverResize}
        onResizeDebounced={onCoverResizeDebounced}
      />
    {/if}
    {#if isCoverPickerOpen}
      <div
        class={cn("flex-1 overflow-auto", {
          "w-full": coverPlacement === Placement.Top,
          "h-full": coverPlacement === Placement.Right
        })}
      >
        <CoverPicker
          value={$collection.cover}
          onChange={onCoverChange}
          onSelect={persistCoverChange}
          orientation={coverPlacement === Placement.Top && !isConstrainedWidth
            ? Orientation.Horizontal
            : Orientation.Vertical}
          onClose={() => (isCoverPickerOpen = false)}
        />
      </div>
    {:else}
      <div
        class={cn("flex flex-col flex-1", {
          "mo:gap-4 gap-6": !isSingleViewMode || isShowMetaViews,
          "h-full overflow-auto": coverPlacement !== Placement.Top,
          "w-full": coverPlacement === Placement.Top
        })}
        onscroll={onScroll}
      >
        {#if $collection.isInEditMode && !isCoverPickerOpen}
          <button
            class="w-full min-h-12 bg-ass1 text-abg flex gap-2 items-center justify-center"
            onclick={closeEditMode}
          >
            <Icon icon="cross" size={Size.sm} class="text-abg" />
            <span> Close edit mode </span>
          </button>
        {/if}
        <div
          class={cn("px-4 stickyheader transition-all duration-300", {
            "sticky top-0": isSingleViewMode,
            [bg(parentBgIndex - 1)]: isSingleViewMode,
            // When in edit mode, interfering with view settings dropdown when the dropdown opens on top if z-20 is set
            "z-20": isSingleViewMode && !$collection.isInEditMode,
            "pb-8": isSingleViewMode && !isShowMetaViews && !isConstrainedWidth,
            "pt-4": !isConstrainedWidth,
            "p-2": isConstrainedWidth,
            "otop:pt-12": !$collection.cover || positionFromTop === 0,
            "max-w-full overflow-x-auto":
              accessPoint === ResourceAccessPoint.MARKDOWN_EMBED
          })}
        >
          <CollectionTitleBar
            {collection}
            {accessPoint}
            {isSingleViewMode}
            {isConstrainedWidth}
            bind:searchQuery
            bind:isShowMetaViews
            {onSearch}
            onAdd={onAddResource}
          >
            {#snippet additionalContent()}
              <span class="flex items-center gap-2">
                {#if isSingleViewMode && !$collection.isInEditMode}
                  <ArrangementSelector
                    {isBoardContext}
                    resource={$collection.resource}
                    arrangement={activeView?.arrangement ?? Arrangement.LIST}
                    density={activeView?.density}
                    isHideThumbnailPreview={activeView?.isHideThumbnailPreview}
                    isHideThumbnailTitle={activeView?.isHideThumbnailTitle}
                    {onArrangementChange}
                    {onDensityChange}
                    {onPreviewSettingChange}
                    {onTitleSettingChange}
                  />
                {/if}
              </span>
            {/snippet}
          </CollectionTitleBar>
        </div>
        {#if isConstrainedWidth && !$collection.isInEditMode}
          <div
            class={cn("flex flex-col px-4", {
              "pb-3": isSingleViewMode,
              "-mt-3": !isSingleViewMode
            })}
          >
            <!-- {#if $collection.description}
              <div class="text-fgs3 text-b3 py-2">
                {$collection.description}
              </div>
            {/if} -->
            <div class="flex items-center justify-center gap-1.5">
              <InlineSearchBar
                bind:query={searchQuery}
                style={InputStyle.FILLED}
                {onSearch}
                placeholder={$collection.totalItemCount
                  ? `Search this collection (${$collection.totalItemCount ?? 0} items)`
                  : "No items found"}
              />
              {#if !$collection.isInEditMode}
                <AddResourceAction onAdd={onAddResource} variant="minimal" />
              {/if}
            </div>
          </div>
        {/if}
        {#if isShowMetaViews}
          <div class="px-4">
            <OptionSelector
              size={Size.sm}
              selected={""}
              options={[
                {
                  value: "birdView",
                  icon: "bird",
                  label: "Bird view"
                },
                {
                  value: "flashcards",
                  icon: "ph:cards-three-light",
                  label: "Run Flashcards"
                },
                {
                  value: "slideshow",
                  icon: "ph:slideshow-light",
                  label: "Start slideshow"
                },
                {
                  value: "timemachine",
                  icon: "history",
                  label: "Time machine"
                }
              ]}
            />
          </div>
        {/if}
        {#if (activeView && isValidString(activeView.tabBy)) || $collection.isInEditMode || !isSingleViewMode}
          <header
            class={cn(
              "sticky top-0 z-10 flex flex-col gap-6 w-full transition-all duration-300",
              bg(parentBgIndex - 1),
              {
                "pt-4 otop:pt-12": isStickied
              }
            )}
          >
            {#if !isSingleViewMode || $collection.isInEditMode}
              <PanelSwitcher
                addText={"Add view"}
                items={viewsForSwitcher}
                isEnableAnimationForTitle={true}
                style={PanelSwitcherStyle.BAR}
                title={isStickied ? $collection.label : ""}
                isExpandToFullWidth={true}
                barStyle={BarStyle.EXACT}
                isInEditMode={$collection.isInEditMode}
                {parentBgIndex}
                bind:triggerItemEdit
                onRemove={onViewRemove}
                onAdd={onViewAdd}
                bind:value={selectedViewId}
                onSwitch={() => onViewSwitch()}
                onChange={onViewLabelChange}
                onRearrange={onViewRearrange}
              >
                {#snippet right()}
                  <span class="flex items-center gap-4 mo:pr-0 pr-4">
                    <ArrangementSelector
                      {isBoardContext}
                      resource={$collection.resource}
                      arrangement={activeView?.arrangement ?? Arrangement.LIST}
                      density={activeView?.density}
                      isHideThumbnailPreview={activeView?.isHideThumbnailPreview}
                      isHideThumbnailTitle={activeView?.isHideThumbnailTitle}
                      {onArrangementChange}
                      {onDensityChange}
                      {onPreviewSettingChange}
                      {onTitleSettingChange}
                    />
                    {#if !$collection.isInEditMode && !isConstrainedWidth}
                      <AddResourceAction
                        variant="strong"
                        onAdd={onAddResource}
                      />
                    {/if}
                  </span>
                {/snippet}
              </PanelSwitcher>
            {/if}
            {#if activeView && ($collection.isInEditMode || !isNoneResource(activeView.tabBy))}
              <div class="px-4 pb-4 flex flex-col gap-6">
                {#if $collection.isInEditMode}
                  {#if isConstrainedWidth}
                    <span class="text-fgs3 text-b3">
                      Currently, advanced view editing is only available on
                      Desktop. Sorry for the inconvenience.
                    </span>
                  {:else}
                    <ViewSettingsBar
                      view={activeView}
                      {properties}
                      onChange={onViewSettingsChange}
                    />
                  {/if}
                {/if}
                {#if activeView.tabBy}
                  <ViewTabSwitcher
                    view={activeView}
                    data={itemRecords}
                    bind:value={selectedTab}
                    properties={$collection?.properties}
                    onSelect={onTabSwitch}
                  />
                {/if}
              </div>
            {/if}
          </header>
        {/if}
        <main
          class={cn("w-full grow flex flex-col gap-2 items-center px-4", {
            "overflow-auto": isSingleViewMode
          })}
        >
          <ResourceStatusBanner resource={collection} />
          {#if isViewDataLoading}
            <PageLoadingPulse />
          {:else if !isViewDataLoading && activeView}
            <View
              {collection}
              bind:view={activeView}
              data={_filtered}
              isBoardOverflow={isStickied}
            />
          {:else}
            content
          {/if}
        </main>
      </div>
    {/if}
    {#if accessPoint === ResourceAccessPoint.SELF && coverPlacement === Placement.Right}
      <Cover
        cover={$collection.cover}
        isInEditMode={$collection.isInEditMode}
        placement={coverPlacement}
        position={$collection.coverLayout?.position}
        size={$collection.coverLayout?.size}
        {dev_isRoundedCover}
        {isConstrainedWidth}
        bind:isCoverPickerOpen
        onChange={onCoverChange}
        onPlacement={onPlacementChange}
        onReposition={onCoverReposition}
        onRepositionDebounced={onCoverRepositionDebounced}
        onResize={onCoverResize}
        onResizeDebounced={onCoverResizeDebounced}
      />
    {/if}
  </div>
{/if}
<ComponentEmbedLayer isBackNavigable={true} />
