<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { Arrangement } from "@21n/elements/direction.enum";
  import { cn } from "@21n/utils/ui.utils";
  import CollectionThumbnail from "@nucleum/features/collections/thumbnail/CollectionThumbnail.svelte";
  import CombinationThumbnail from "@nucleum/features/spaces/combination/thumbnail/CombinationThumbnail.svelte";
  import NodeThumbnail from "@nucleum/features/memory/node/thumbnail/NodeThumbnail.svelte";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import { Size } from "@21n/elements/size.enum";
  import {
    ResourceAccessPoint,
    AccessMode,
    ResourceAccessPointState
  } from "@nucleum/datafn/resource.type";
  import { bulkEditStore } from "@nucleum/stores/resources/bulkedit.store";
  import FileView from "@nucleum/components/files/FileView.svelte";
  import type { INodeThumb } from "@nucleum/features/memory/node/node.type";
  import type {
    ICollection,
    ICollectionThumb
  } from "@nucleum/features/collections/collection.type";
  import type { IProperty } from "@nucleum/features/collections/properties/property.type";
  import type { ISideNavCombination } from "@nucleum/features/spaces/combination/combination.type";
  import type { IFile } from "@nucleum/stores/files/file.type";
  import { determineResourceType } from "@nucleum/datafn/resource.utils";
  import NodeItems from "@nucleum/features/memory/node/NodeRecords.svelte";
  import LibraryLoadingPulse from "@nucleum/application/library/LibraryLoadingPulse.svelte";
  import ObjectiveThumbnail from "@nucleum/features/focus/goals/thumbnail/GoalThumbnail.svelte";
  import TaskThumbnail from "@nucleum/features/focus/tasks/TaskThumbnail.svelte";
  import TaskRecords from "@nucleum/features/focus/tasks/TaskRecords.svelte";
  import EventThumbnail from "@nucleum/features/calendar/events/EventThumbnail.svelte";
  import type { IObjectiveThumb } from "@nucleum/features/focus/goals/goal.type";
  import type { ITaskThumb } from "@nucleum/features/focus/tasks/task.type";
  import type { ICalendarEvent } from "@nucleum/features/calendar/events/event.type";
  import ScrollViewBottomSpacer from "@21n/layout/scrollView/ScrollViewBottomSpacer.svelte";

  import { stringify } from "@21n/shared-utils/json.utils";

  import { datafn } from "@nucleum/datafn/datafn.store";
  import { toSvelteDataStore } from "@datafn/svelte";
  import { datafnHeavyComputedSignalOptions } from "@nucleum/datafn/signalCache";
  type RecordItem =
    | INodeThumb
    | ICollection
    | IFile
    | ISideNavCombination
    | IObjectiveThumb
    | ITaskThumb
    | ICalendarEvent;

  let {
    data = [],
    resource = Resource.node,
    arrangement = Arrangement.LIST,
    defaultAccessMode = AccessMode.POP,
    size = Size.md,
    accessPoint = ResourceAccessPoint.BROWSER,
    accessPointState = ResourceAccessPointState.DEFAULT,
    isPreventDefault = false,
    width = 290,
    isShowLoadingPulseAtTheEnd = false,
    isShowBottomSpacer = false,
    visibleProps = [],
    onClick: onRecordClick = undefined
  }: {
    data?: RecordItem[];
    resource?: Resource;
    arrangement?: Arrangement;
    defaultAccessMode?: AccessMode;
    size?: Size.sm | Size.md;
    accessPoint?: ResourceAccessPoint;
    accessPointState?: ResourceAccessPointState;
    isPreventDefault?: boolean;
    width?: number;
    isShowLoadingPulseAtTheEnd?: boolean;
    isShowBottomSpacer?: boolean;
    visibleProps?: IProperty[];
    onClick?: ((event: CustomEvent<RecordItem>) => void) | undefined;
  } = $props();
  let parentBgIndex = 1;
  let multiSelectContext = $derived({
    resource,
    accessPoint
  });
  const collectionIds = $derived.by(() =>
    data
      .filter((item) =>
        resource === Resource.collection ||
        resource === Resource.everything ||
        resource === Resource.unknown
          ? determineResourceType(item.id) === Resource.collection
          : false
      )
      .map((item) => item.id.toString())
  );
  const collectionCountsStore = $derived.by(() =>
    toSvelteDataStore(
      datafn.relationCountsSignal(
        {
          resource: Resource.collection,
          relation: "items",
          ids: collectionIds,
          targetFilters: {
            isArchived: { $ne: true },
            trashedAt: { $is_null: true },
            isAncestorInactive: { $ne: true }
          }
        },
        datafnHeavyComputedSignalOptions
      ),
      { initialData: {} }
    )
  );

  function asNodeThumb(item: RecordItem): INodeThumb {
    return item as INodeThumb;
  }

  function asCollection(item: RecordItem): ICollectionThumb {
    return item as unknown as ICollectionThumb;
  }

  function asCombination(item: RecordItem): ISideNavCombination {
    return item as ISideNavCombination;
  }

  function asGoal(item: RecordItem): IObjectiveThumb {
    return item as IObjectiveThumb;
  }

  function asTask(item: RecordItem): ITaskThumb {
    return item as ITaskThumb;
  }

  function asFile(item: RecordItem): IFile {
    return item as IFile;
  }

  function asEvent(item: RecordItem): ICalendarEvent {
    return item as ICalendarEvent;
  }

  function asNodeList(items: RecordItem[]): INodeThumb[] {
    return items as INodeThumb[];
  }

  function asTaskList(items: RecordItem[]): ITaskThumb[] {
    return items as ITaskThumb[];
  }

  function resolveMouseEvent(event: MouseEvent | CustomEvent) {
    return event instanceof MouseEvent ? event : undefined;
  }

  function handleClick(e: MouseEvent | CustomEvent, item: RecordItem) {
    if (isPreventDefault) {
      const clickEvent = new CustomEvent<any>("click", { detail: item });
      onRecordClick?.(clickEvent);
      return;
    }
    const state = bulkEditStore.getState();
    const isMatchingContext = state.context
      ? stringify(state.context, { isPreventReplacer: true }) ===
        stringify(multiSelectContext, { isPreventReplacer: true })
      : false;
    const result = isMatchingContext
      ? bulkEditStore.clickHandler(item.id)
      : false;
    if (!result) {
      navigation.resourceClickHandler(resolveMouseEvent(e), item.id, {
        defaultTo: defaultAccessMode,
        origin: accessPoint
      });
    }
  }
</script>

<div class="flex flex-col w-full h-full">
  <!-- <div class={cn("flex h-full w-full gap-4 flex-row flex-wrap content-start")}> -->
  {#if resource === Resource.node && arrangement === Arrangement.MASONRY}
    <NodeItems
      nodes={asNodeList(data)}
      {arrangement}
      density={3}
      {accessPoint}
    />
  {:else if resource === Resource.task && accessPoint === ResourceAccessPoint.LIBRARY}
    <TaskRecords
      data={asTaskList(data)}
      {arrangement}
      {accessPoint}
      {parentBgIndex}
    />
  {:else}
    <div
      style={arrangement === Arrangement.GRID &&
      accessPoint !== ResourceAccessPoint.BROWSER
        ? `--colw: ${width}px`
        : undefined}
      class={cn(
        `h-full w-full content-start`,
        {
          "flex flex-col": arrangement === Arrangement.LIST,
          "grid grid-cols-[repeat(auto-fill,minmax(var(--colw),1fr))]":
            arrangement === Arrangement.GRID &&
            accessPoint !== ResourceAccessPoint.BROWSER,
          "grid grid-cols-2":
            arrangement === Arrangement.GRID &&
            accessPoint === ResourceAccessPoint.BROWSER,
          "cw:gap-3 gap-4": arrangement === Arrangement.GRID
        },
        arrangement === Arrangement.LIST && {
          "gap-2": resource !== Resource.node,
          "gap-6": resource === Resource.node
        }
      )}
    >
      {#each data as item (item)}
        {#if resource === Resource.everything || resource === Resource.unknown}
          {@const resourceType = determineResourceType(item.id)}
          {#if resourceType === Resource.node}
            <NodeThumbnail
              item={asNodeThumb(item)}
              {accessPoint}
              accessPointId={item.id}
              {parentBgIndex}
              {arrangement}
              onClick={(event) => handleClick(event, item)}
            />
          {:else if resourceType === Resource.collection}
            <CollectionThumbnail
              item={asCollection(item)}
              {size}
              {accessPoint}
              {accessPointState}
              {arrangement}
              itemCount={$collectionCountsStore[item.id.toString()]}
              onClick={(e) => handleClick(e, item)}
            />
          {:else if resourceType === Resource.space}
            <CombinationThumbnail
              item={asCombination(item)}
              {size}
              {accessPoint}
              {accessPointState}
              {arrangement}
              onClick={(e) => handleClick(e, item)}
            />
          {:else if resourceType === Resource.objective}
            <ObjectiveThumbnail
              item={asGoal(item)}
              {accessPoint}
              accessPointId={item.id}
              {arrangement}
              {visibleProps}
              onClick={(e) => handleClick(e, item)}
            />
          {:else if resourceType === Resource.task}
            <TaskThumbnail
              item={asTask(item)}
              {accessPoint}
              {arrangement}
              {parentBgIndex}
            />
          {:else if resourceType === Resource.event}
            <EventThumbnail
              item={asEvent(item)}
              {accessPoint}
              {arrangement}
              onClick={(e) => handleClick(e, item)}
            />
          {:else}
            <div
              class="h-72 w-80 border border-brs3 rounded-md hover:border-aps1 grow"
            >
              {item.label ?? "Untitled"}
            </div>
          {/if}
        {:else if resource === Resource.node && arrangement !== Arrangement.MASONRY}
          <NodeThumbnail
            item={asNodeThumb(item)}
            {accessPoint}
            accessPointId={item.id}
            {parentBgIndex}
            {arrangement}
            onClick={(event) => handleClick(event, item)}
          />
        {:else if resource === Resource.objective && arrangement !== Arrangement.MASONRY}
          <ObjectiveThumbnail
            item={asGoal(item)}
            {accessPoint}
            accessPointId={item.id}
            {arrangement}
            {visibleProps}
            onClick={(e) => handleClick(e, item)}
          />
        {:else if resource === Resource.task && arrangement !== Arrangement.MASONRY}
          <TaskThumbnail
            item={asTask(item)}
            {accessPoint}
            {parentBgIndex}
            {arrangement}
            onClick={(e) => handleClick(e, item)}
          />
        {:else if resource === Resource.collection}
          <CollectionThumbnail
            item={asCollection(item)}
            {size}
            {accessPoint}
            {accessPointState}
            {arrangement}
            itemCount={$collectionCountsStore[item.id.toString()]}
            onClick={(e) => handleClick(e, item)}
          />
        {:else if resource === Resource.space}
          <CombinationThumbnail
            item={asCombination(item)}
            {size}
            {accessPoint}
            {accessPointState}
            {arrangement}
            onClick={(e) => handleClick(e, item)}
          />
        {:else if resource === Resource.file}
          <button class="h-40" onclick={(e) => handleClick(e, item)}>
            <FileView
              file={asFile(item)}
              isLazyLoad={true}
              isUseThumbnailIfAvailable={true}
              class={cn("h-full w-full rounded-md object-cover", {})}
            />
          </button>
        {:else if resource === Resource.event}
          <EventThumbnail
            item={asEvent(item)}
            {accessPoint}
            {arrangement}
            onClick={(e) => handleClick(e, item)}
          />
        {/if}
      {/each}
      {#if isShowLoadingPulseAtTheEnd}
        <LibraryLoadingPulse {resource} {arrangement} isTail={true} />
      {/if}
      {#if isShowBottomSpacer}
        <ScrollViewBottomSpacer />
      {/if}
    </div>
  {/if}
</div>
