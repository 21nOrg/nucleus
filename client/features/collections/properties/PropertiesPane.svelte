<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import ScrollViewBottomSpacer from "@21n/layout/scrollView/ScrollViewBottomSpacer.svelte";

  import PropertiesListView from "@nucleum/features/collections/properties/PropertiesListView.svelte";
  import type { IActiveNodeStore } from "@nucleum/features/memory/node/node.store";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import { Size } from "@21n/elements/size.enum";
  import {
    removeDuplicatesFilter,
    resourceAction,
    resourceInList
  } from "@nucleum/datafn/resource.utils";
  import {
    CollectionType,
    type ICollectionExpanded,
    type ICollectionItem
  } from "@nucleum/features/collections/collection.type";
  import OptionSelector from "@21n/elements/select/OptionSelector.svelte";
  import Button from "@21n/elements/button/Button.svelte";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import ResourceStatusBanner from "@nucleum/components/records/RecordStatusBanner.svelte";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
  import { cn } from "@21n/utils/ui.utils";
  import type { IActiveObjectiveStore } from "@nucleum/features/focus/goals/goal.store";
  import type { IActiveObjective } from "@nucleum/features/focus/goals/goal.type";
  import type { IActiveNode } from "@nucleum/features/memory/node/node.type";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import { toSvelteStore } from "@datafn/svelte";
  import type { IProperty } from "@nucleum/features/collections/properties/property.type";

  type CollectionRelation = string | ICollectionExpanded;
  type CollectionItemWithCollections = ICollectionItem & {
    collections?: CollectionRelation[];
  };
  type RecordReference =
    | string
    | { id?: string | number | { toString(): string } }
    | undefined
    | null;

  let {
    item,
    resource,
    isVisibleProps = false,
    parentBgIndex = 1,
    onShowAll = undefined
  }: {
    item: IActiveNodeStore | IActiveObjectiveStore;
    resource: Resource;
    isVisibleProps?: boolean;
    parentBgIndex?: number;
    onShowAll?: (() => void) | undefined;
  } = $props();
  let selectedTypeId = $state<string | undefined>(undefined);
  const itemStore = $derived.by(() => {
    const itemId = item.id?.toString();
    if (!itemId || resource === Resource.unknown) return undefined;
    return toSvelteStore<ICollectionItem[]>(
      datafn.table(resource).signal({
        select: ["id", "updatedAt", "collections.*", "propertyValues.*#"],
        filters: {
          id: itemId
        },
        metadata: {
          includeTrashed: true,
          includeArchived: true
        }
      }),
      { initialData: [] }
    );
  });
  const signaledItem = $derived(itemStore ? $itemStore!.data[0] : undefined);
  const typeIds = $derived(resolveTypeIds(signaledItem, $item.types));
  const typeStore = $derived.by(() => {
    if (typeIds.length === 0) return undefined;
    return toSvelteStore<ICollectionExpanded[]>(
      datafn.collection.signal({
        select: ["*", "properties.*"],
        filters: {
          id: { $in: typeIds }
        }
      }),
      { initialData: [] }
    );
  });
  const typeRecords = $derived(typeStore ? $typeStore!.data : []);
  const extensionTypeIds = $derived(resolveExtensionTypeIds(typeRecords));
  const extensionTypeStore = $derived.by(() => {
    if (extensionTypeIds.length === 0) return undefined;
    return toSvelteStore<ICollectionExpanded[]>(
      datafn.collection.signal({
        select: ["*", "properties.*"],
        filters: {
          id: { $in: extensionTypeIds }
        }
      }),
      { initialData: [] }
    );
  });
  const resolvedTypes = $derived(
    isVisibleProps
      ? ($item.types ?? [])
      : resolveExpandedTypes(
          typeRecords.length > 0 ? typeRecords : ($item.types ?? []),
          extensionTypeStore ? $extensionTypeStore!.data : []
        )
  );
  const paneTypes = $derived(resolvePaneTypes(resolvedTypes));
  const multipleTypesList = $derived(paneTypes.multipleTypesList);
  const _types = $derived(resolveSelectedTypes(paneTypes));
  const propertyValues = $derived(
    signaledItem?.propertyValues ?? $item.propertyValues ?? []
  );

  $effect(() => {
    if (multipleTypesList.length === 0) {
      selectedTypeId = undefined;
      return;
    }
    if (
      !selectedTypeId ||
      !multipleTypesList.some((x) => x.id.toString() === selectedTypeId)
    ) {
      selectedTypeId = multipleTypesList[0]?.id.toString();
    }
  });

  function asCollectionItem(
    item: IActiveNode | IActiveObjective
  ): ICollectionItem {
    return item as ICollectionItem;
  }

  let isReadOnlyMode = $derived.by(
    () =>
      $item.isInReadOnlyMode ||
      ("isLocked" in $item ? Boolean($item.isLocked) : false) ||
      Boolean($item.isArchived) ||
      $item.trashedAt != null
  );

  async function propagateChanges(e: CustomEvent) {
    if (!e.detail || !e.detail?.id || e.detail?.value === undefined) return;
    item.updateProperty({
      id: e.detail.id,
      value: e.detail.value,
      collectionId: e.detail.collectionId
    });
  }

  function resolvePaneTypes(types: ICollectionExpanded[]) {
    let renderedTypes: ICollectionExpanded[] | null = null;
    let multipleTypesList: ICollectionExpanded[] = [];
    if (types?.length === 1) {
      const type = {
        ...types[0],
        properties: types[0].properties?.filter((x) => x),
        extendProperties: types[0].extendProperties?.filter((x) => x)
      };
      if (
        type.properties &&
        type.properties.length === 0 &&
        type.extendProperties &&
        type.extendProperties?.length > 0
      ) {
        renderedTypes = [
          {
            ...type,
            properties: type.extendProperties
          }
        ];
      } else if (
        type.properties &&
        type.properties.length > 0 &&
        type.extendProperties &&
        type.extendProperties?.length > 0
      ) {
        multipleTypesList = [
          type,
          {
            ...type.typeToExtend,
            properties: type.extendProperties
          } as unknown as ICollectionExpanded
        ];
      } else if (type.properties && type.properties.length > 0) {
        renderedTypes = [type];
      }
    } else {
      const allTypes = types ?? [];
      const extendedTypes: ICollectionExpanded[] = allTypes
        ?.map((x) => {
          if (x.typeToExtend) {
            return {
              ...x.typeToExtend,
              properties: x.extendProperties
            } as unknown as ICollectionExpanded;
          }
          return x;
        })
        .filter((x) => x) as ICollectionExpanded[];
      multipleTypesList = [...allTypes, ...extendedTypes];
      multipleTypesList = multipleTypesList.filter(removeDuplicatesFilter);
    }
    return { renderedTypes, multipleTypesList };
  }

  function resolveSelectedTypes(paneTypes: {
    renderedTypes: ICollectionExpanded[] | null;
    multipleTypesList: ICollectionExpanded[];
  }) {
    if (isVisibleProps) return resolvedTypes;
    if (paneTypes.multipleTypesList.length === 0) {
      return paneTypes.renderedTypes;
    }
    const selectedType =
      paneTypes.multipleTypesList.find(
        (x) => x.id.toString() === selectedTypeId
      ) ?? paneTypes.multipleTypesList[0];
    return selectedType ? [selectedType] : null;
  }

  function resolveTypeIds(
    signaledItem: CollectionItemWithCollections | undefined,
    activeTypes: ICollectionExpanded[] | undefined
  ) {
    const collections = signaledItem?.collections ?? activeTypes ?? [];
    return collections
      .map((collection) =>
        typeof collection === "string" ? collection : collection.id?.toString()
      )
      .filter((id: string | undefined): id is string => Boolean(id));
  }

  function resolveRecordId(value: RecordReference) {
    if (!value) return undefined;
    return typeof value === "string" ? value : value.id?.toString();
  }

  function isProperty(value: IProperty | undefined): value is IProperty {
    return Boolean(value);
  }

  function resolveExtensionTypeIds(types: ICollectionExpanded[]) {
    return [
      ...new Set(
        types
          .map((type) => resolveRecordId(type.typeToExtend))
          .filter((id): id is string => Boolean(id))
      )
    ];
  }

  function resolveExpandedTypes(
    types: ICollectionExpanded[],
    extensionTypes: ICollectionExpanded[]
  ) {
    return types
      .filter((type) => type.type === CollectionType.TYPED)
      .map((type) => {
        const extensionTypeId = resolveRecordId(type.typeToExtend);
        const extensionType =
          (extensionTypeId
            ? extensionTypes.find(resourceInList(extensionTypeId))
            : undefined) ??
          (typeof type.typeToExtend === "object"
            ? type.typeToExtend
            : undefined);
        const extensionProperties =
          extensionType?.properties?.filter(isProperty) ??
          type.extendProperties ??
          [];
        return {
          ...type,
          typeToExtend: extensionType,
          extendProperties: extensionProperties.filter(isProperty)
        };
      });
  }

  function handleTypeChange(e: CustomEvent) {
    const type = multipleTypesList.find((x) => x.id.toString() === e.detail);
    if (type) {
      selectedTypeId = type.id.toString();
    }
  }

  function onEditProperties() {
    requireCommandHost().runAction(
      resourceAction(Resource.property, ResourceActionType.EDIT),
      {
        componentParams: {
          id: _types?.[0]?.id ?? $item.types?.[0]?.id ?? ""
        }
      }
    );
  }
</script>

<div
  class={cn("flex flex-col gap-6 w-full", {
    "flex-grow": !isVisibleProps
  })}
>
  {#if !isVisibleProps && multipleTypesList.length > 0}
    <OptionSelector
      options={multipleTypesList.map((x) => ({
        label: x.label,
        value: x.id.toString(),
        icon: x.avatar
      }))}
      size={Size.sm}
      isShowExpandFeedbackOnActive={true}
      selected={selectedTypeId}
      onSelect={handleTypeChange}
    />
  {/if}
  <div class="flex flex-col gap-6 w-full h-full overflow-auto">
    {#if !isVisibleProps}
      <ResourceStatusBanner resource={item} />
    {/if}
    {#if _types && _types.length > 0}
      <PropertiesListView
        values={propertyValues}
        types={_types}
        {resource}
        context={isVisibleProps ? "mainpanel" : "rightpanel"}
        isIncludeExtendedProperties={isVisibleProps}
        {isReadOnlyMode}
        item={asCollectionItem($item)}
        {parentBgIndex}
        onChange={propagateChanges}
        {onShowAll}
      />
      {#if !isVisibleProps && !isReadOnlyMode && _types.length === 1}
        <div class="flex justify-center">
          <Button
            label="Edit"
            style={ButtonStyle.OUTLINED}
            type={ButtonVariant.SECONDARY}
            size={Size.xs}
            icon="edit"
            isPreventMinWidth={true}
            onclick={onEditProperties}
          />
        </div>
      {/if}
    {:else if !isVisibleProps}
      {@const typesPresent = typeIds.length > 0}
      <div class="flex w-full h-full items-center justify-center">
        <EmptyStatusView
          size={Size.sm}
          mainText="No properties found."
          subText={typesPresent
            ? "Please edit properties to see them here."
            : "Add this node to a typed collection to see properties."}
          actionText={typesPresent ? "Edit properties" : undefined}
          onclick={onEditProperties}
        />
      </div>
    {/if}
    {#if !isVisibleProps}
      <ScrollViewBottomSpacer />
    {/if}
  </div>
</div>
