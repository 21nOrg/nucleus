<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { Resource } from "@nucleum/datafn/resource.enum";
  import { Size } from "@21n/elements/size.enum";
  import {
    TableCellDefaultAction,
    TableCellType,
    type TableColumn
  } from "@21n/elements/table/table.type";
  import { enumToString, isValidString } from "@21n/shared-utils/text.utils";
  import { generateResourceId } from "@nucleum/datafn/id.utils";

  import {
    manualPropertyTypes,
    PropertyType,
    propertyTypesWithUserConfiguration,
    selectOptionsPropertyTypes,
    UniversalPropertyType,
    type IProperty
  } from "@nucleum/features/collections/properties/property.type";
  import { propertyEditorStore } from "@nucleum/features/collections/properties/property.store";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import {
    ActiveCollectionStore,
    type IActiveCollectionStore
  } from "../collection.store";
  import ModalFooter from "@21n/elements/modal/ModalFooter.svelte";
  import {
    AccessMode,
    type OmitForCaptureWithId
  } from "@nucleum/datafn/resource.type";
  import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import { onDestroy, onMount } from "svelte";
  import Text from "@21n/elements/text/Text.svelte";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import SwitchInput from "@21n/elements/toggle/SwitchInput.svelte";
  import { Orientation } from "@21n/elements/direction.enum";
  import SearchSingleSelect from "@21n/elements/select/SearchSingleSelect.svelte";
  import {
    CollectionType,
    type ICollection
  } from "@nucleum/features/collections/collection.type";
  import { confirmationNotification } from "@nucleum/stores/notification.store";
  import { AlertType } from "@nucleum/stores/notifications/notification.type";
  import Button from "@21n/elements/button/Button.svelte";
  import { ButtonStyle } from "@21n/elements/button/button.type";
  import { acquireDnDPage, appStore } from "@nucleum/stores/app.store";
  import modalEvent from "@nucleum/stores/overlays/modal.store";
  import PropertyTypeSelector from "@nucleum/features/collections/properties/propertyTypeSelector/PropertyTypeSelector.svelte";
  import {
    isSameResource,
    resourceAction,
    resourceInList
  } from "@nucleum/datafn/resource.utils";
  import { resolvePropertyDefaultConfig } from "@nucleum/features/collections/properties/property.utils";
  import { objIsEmpty } from "@21n/shared-utils/obj.utils";
  import CollectionTitleLabelPart from "@nucleum/features/collections/thumbnail/CollectionThumbnailLabel.svelte";
  import { Product } from "@nucleum/client/config/product.type";
  import Table3 from "@21n/elements/table/Table3.svelte";
  import ModalContentPadded from "@21n/elements/modal/ModalContentPadded.svelte";

  let { id = undefined }: { id?: IRecordId | undefined } = $props();
  const collection = $derived<IActiveCollectionStore | undefined>(
    id ? ActiveCollectionStore.resolve(id) : undefined
  );
  let derivedCollections = $state<ICollection[]>([]);
  let properties = $state<IProperty[]>([]);
  let tableId = "properties-table";
  const propertiesEditAction = resourceAction(
    Resource.property,
    ResourceActionType.EDIT
  );
  let columns: TableColumn[] = [
    {
      label: "Type of property",
      key: "propertyType",
      width: 0.65,
      type: TableCellType.CUSTOM,
      component: PropertyTypeSelector,
      componentProps: {
        onChange: onPropertyTypeChange
      }
    },
    {
      label: "Label",
      key: "label",
      width: 0.65,
      type: TableCellType.TEXT_INPUT,
      placeholder: (row: any) => {
        return enumToString(row.type);
      }
    },
    {
      label: "Configuration",
      key: "config",
      type: TableCellType.CUSTOM,
      component: "propertyConfig"
    },
    {
      label: "Always visible",
      key: "isShowOnNodePage",
      width: 0.5,
      type: TableCellType.TOGGLE,
      tooltip: {
        body: "Selecting this will make the property always visible on the node/objective page. Otherwise, it will be present in properties panel.",
        size: Size.xs
      }
    }
  ];
  if (
    $appStore.product === Product.MEMOTRON ||
    $appStore.product === Product.NUCLEUM
  ) {
    columns.push({
      label: "Capture",
      key: "isShowOnCapture",
      width: 0.4,
      type: TableCellType.TOGGLE,
      tooltip: {
        body: "Selecting this will show the property during capture or clipping if an item is added to this typed collection. Using this will make capturing essential properties easier at source.",
        size: Size.xs
      },
      disabledCriteria: (row: any) => !manualPropertyTypes.includes(row.type)
    });
  }
  let isTypeExtension = $state(false);
  async function onAdd() {
    const newProperty: OmitForCaptureWithId<IProperty> = {
      id: generateResourceId(Resource.property),
      label: "",
      isShowOnNodePage: false,
      isShowOnCapture: false,
      type: PropertyType.TEXT,
      order: properties.length
    };
    properties = [...properties, newProperty];
  }

  let releaseDnDPage: (() => void) | undefined;

  onMount(async () => {
    releaseDnDPage = acquireDnDPage();
    if (collection && (!$collection || !$collection.label)) {
      await collection.init(AccessMode.POP);
    } else if (collection) {
      await collection.refreshProperties();
      propertyEditorStore.set({
        properties: $collection?.properties ?? [],
        typeToExtend: $collection?.typeToExtend
      });
    }
    properties = propertyEditorStore.get()?.properties ?? [];
    if (collection) {
      const result = await datafn.collection.query({
        filters: {
          typeToExtend: collection.id.toString()
        }
      });
      derivedCollections = result.data as ICollection[];
    }
  });

  onDestroy(() => {
    releaseDnDPage?.();
  });

  $effect(() => {
    propertyEditorStore.set({
      ...(propertyEditorStore.get() ?? { typeToExtend: undefined }),
      properties
    });
  });

  $effect(() => {
    isTypeExtension = Boolean($propertyEditorStore?.typeToExtend);
  });

  function onPropertyTypeChange(e: { id: IRecordId; type: PropertyType }) {
    const existing = properties.find(resourceInList(e));
    if (!existing) return;

    if (
      !propertyTypesWithUserConfiguration.includes(existing.type) ||
      (selectOptionsPropertyTypes.includes(existing.type) &&
        selectOptionsPropertyTypes.includes(e.type) &&
        e.type !== PropertyType.UNIVERSAL)
    ) {
      convert();
    } else {
      confirmationNotification.notify({
        message: `You are about to change the property type of **${isValidString(existing.label) ? existing.label : "Untitled"}** from **${enumToString(existing.type)}** to **${enumToString(e.type)}**. This will delete existing configuration for this property. Are you sure you want to proceed?`,
        title: "Change property type",
        type: AlertType.WARNING,
        confirmAction: {
          label: "Confirm",
          callback: async () => {
            convert(true);
          }
        }
      });
    }

    function convert(isResetConfig: boolean = false) {
      properties = properties.map((property) =>
        isSameResource(property, e)
          ? {
              ...property,
              type: e.type,
              config:
                isResetConfig || !property.config || objIsEmpty(property.config)
                  ? resolvePropertyDefaultConfig(e.type)
                  : property.config
            }
          : property
      );
    }
  }

  function resolveTitle(collection: IActiveCollectionStore | undefined) {
    return collection
      ? ($collection?.label ?? "Untitled") + " - edit properties"
      : "Edit properties";
  }

  function onReorder(
    event: CustomEvent<{ from: number; to: number; listId: string }>
  ) {
    logger.log({ at: "PropertiesEditor.onReorder", event });
    const { from, to, listId } = event.detail;
    if (!listId || listId !== tableId) return;
    const nextProperties = [...properties];
    const [movedItem] = nextProperties.splice(from, 1);
    nextProperties.splice(to, 0, movedItem);
    properties = nextProperties;
  }

  async function onTypeExtensionChange(e: CustomEvent) {
    if (e.detail && collection) {
      if (derivedCollections.length > 0) {
        confirmationNotification.notify({
          message: `**${derivedCollections.length} collection(s)** are derived from this collection. This collection cannot extend another collection.`,
          title: "Cannot extend collection",
          type: AlertType.ERROR
        });
        isTypeExtension = false;
      }
    } else if (e.detail === false) {
      $propertyEditorStore.typeToExtend = undefined;
    }
  }

  function searchForTypeExtension(searchQuery: string) {
    return datafn.collection
      .query({
        filters: {
          type: CollectionType.TYPED
        },
        search: {
          query: searchQuery,
          fields: ["label"]
        }
      } as any)
      .then((result) => (result as { data?: ICollection[] }).data ?? []);
  }

  function onGotoBase() {
    if (!$propertyEditorStore.typeToExtend?.id) return;
    onGoto(
      $propertyEditorStore.typeToExtend.id,
      $propertyEditorStore.typeToExtend.label
    );
  }

  function onGoto(id: IRecordId, label?: string) {
    confirmationNotification.notify({
      message: `You are about to redirect to **${label ?? "Untitled"}** collection. Please save your changes before proceeding.`,
      title: "Save changes",
      type: AlertType.WARNING,
      confirmAction: {
        label: "Save & proceed",
        callback: async () => {
          await onSave();
          modalEvent.hide(propertiesEditAction);
          navigation.openResource(id, AccessMode.POP);
          return true;
        }
      }
    });
  }

  async function onSave() {
    if (
      properties.some(
        (p) =>
          p.type === PropertyType.UNIVERSAL &&
          (!p.config?.type || p.config?.type === UniversalPropertyType.NONE)
      )
    ) {
      return {
        error: `Please select a sub type for all Universal properties`
      };
    }
    propertyEditorStore.set({
      properties,
      typeToExtend: $propertyEditorStore.typeToExtend
    });
    const result = await collection?.updateProperties();
    return result;
  }
</script>

<div class="flex flex-col justify-between gap-4 w-full h-full text-b2">
  <ModalContentPadded class="flex flex-col gap-8 flex-grow">
    <Text content={resolveTitle(collection)} style={TextStyle.PANEL_HEADING} />
    <div class="flex flex-col items-start w-full flex-grow gap-6">
      <div class="flex flex-col items-start w-full gap-3">
        <SwitchInput
          label={{
            label: "Extend an existing collection",
            orientation: Orientation.Horizontal,
            tooltip: {
              body: "You can extend an existing collection by adding additional properties on top. Editing the properties on base collection will reflect in all extended collections.",
              actionText: "Learn more about advanced filter query",
              action: "/kb/advanced-filter-query"
            }
          }}
          isExpanded={true}
          bind:checked={isTypeExtension}
          onChange={onTypeExtensionChange}
        />
        {#if isTypeExtension}
          <div class="flex flex-col items-start w-full gap-2">
            <SearchSingleSelect
              bind:selected={$propertyEditorStore.typeToExtend}
              searchCallback={searchForTypeExtension}
              onSelect={onTypeExtensionChange}
              placeholder="Search for a collection to extend"
            />
            <div class="flex items-center gap-2">
              <div class="text-b2 text-fgs3">
                Inherited properties: {$propertyEditorStore.typeToExtend
                  ?.properties?.length ?? 0}
              </div>
              {#if $propertyEditorStore.typeToExtend?.properties && $propertyEditorStore.typeToExtend?.properties?.length > 0}
                <Button
                  label={`Go to ${$propertyEditorStore.typeToExtend?.label}`}
                  size={Size.xs}
                  isUnderlined={true}
                  style={ButtonStyle.PLAIN}
                  onclick={onGotoBase}
                />
              {/if}
            </div>
          </div>
        {/if}
        {#if derivedCollections.length > 0}
          <div class="flex flex-col items-start w-full gap-2">
            <Text
              content="Derived collections"
              style={TextStyle.SECTION_HEADING}
            />
            <div class="flex items-center flex-wrap w-full gap-2">
              {#each derivedCollections as collection}
                <button
                  class="flex items-center gap-2 hover:text-aps1 px-2 py-0.5 border border-brs3 hover:border-aps1 rounded-md"
                  onclick={() => {
                    onGoto(collection.id, collection.label);
                  }}
                >
                  <CollectionTitleLabelPart item={collection} />
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      <div class="flex flex-col items-start w-full gap-2 flex-grow">
        <Text content="Properties" style={TextStyle.SECTION_HEADING} />
        <Table3
          id={tableId}
          isStyled={true}
          width="min-w-[60rem]"
          addAction="add property"
          actions={[
            { action: TableCellDefaultAction.REMOVE, index: 0 },
            { action: TableCellDefaultAction.REORDER, index: 1 }
          ]}
          {columns}
          bind:data={properties}
          {onAdd}
          {onReorder}
        />
      </div>
    </div>
  </ModalContentPadded>
  <ModalFooter
    action={propertiesEditAction}
    primaryAction={collection
      ? {
          label: "Save",
          callback: onSave
        }
      : {
          label: "Done"
        }}
    secondaryAction={collection
      ? {
          label: "Cancel"
        }
      : undefined}
  />
</div>
