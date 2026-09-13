import { requireCommandHost } from "@nucleum/stores/commands/command-host";
import { Resource } from "@nucleum/datafn/resource.enum";
import { ActiveResourceStore } from "@nucleum/stores/resources/active-resource.store";
import {
  CollectionLayout,
  CollectionType,
  type IActiveCollection,
  type ICollectionItem,
  type ICollectionView,
  type ICollection,
  type ICollectionExpanded,
  type ICollectionViewCapture
} from "@nucleum/features/collections/collection.type";
import { propertyEditorStore } from "@nucleum/features/collections/properties/property.store";
import { AccessMode, ResourceAccessPoint } from "@nucleum/datafn/resource.type";
import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
import { ResourceActions } from "@nucleum/stores/resources/resource.actions";
import { logger } from "@nucleum/client/runtime/logging/logger";
import type { IRecordId } from "@nucleum/schema/legacy/data.type";
import { generateResourceId } from "@nucleum/datafn/id.utils";
import {
  assignDefaultLabelAsFallback,
  serializePropertyForDatafn
} from "@nucleum/features/collections/properties/property.utils";
import {
  ContextMenuType,
  type IContextMenu,
  type IContextMenuItem
} from "@21n/elements/contextMenu/context-menu.type";
import context from "@nucleum/stores/context.store";
import { get } from "svelte/store";
import { resourceAction } from "@nucleum/datafn/resource.utils";
import { toasts } from "@nucleum/stores/notification.store";

import { Embed } from "@nucleum/client/runtime/context.type";
import { appStore } from "@nucleum/stores/app.store";
import { datafn } from "@nucleum/datafn/datafn.store";
import view from "@nucleum/stores/view.store";
import type { IProperty } from "@nucleum/features/collections/properties/property.type";

const viewDefaults = {
  layout: CollectionLayout.BOARD,
  tabBy: "none",
  groupBy: "none",
  subGroupBy: "none"
};

function pruneUndefined(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  );
}

function relationRefs(ids: IRecordId[]) {
  return ids.map((id, sortOrder) => ({
    $ref: id.toString(),
    sortOrder
  }));
}

/**
 * Creates a collection and its owned property and view records atomically at the workflow level.
 */
export async function createDatafnCollection(input: {
  title?: string;
  description?: string;
  isStarred: boolean;
  isCaptureShortcutEnabled: boolean;
  selectedType: CollectionType;
  selectedView: CollectionLayout;
  resource: Resource;
  properties: IProperty[];
  typeToExtendId?: IRecordId;
  avatar?: any;
  coverPhoto?: any;
  context: string;
}) {
  const collectionId = generateResourceId(Resource.collection);
  const viewId = generateResourceId(Resource.view);
  let propertyRecords =
    input.selectedType === CollectionType.TYPED
      ? input.properties.map(assignDefaultLabelAsFallback)
      : [];
  propertyRecords = propertyRecords.map((property) => ({
    ...property,
    id: property.id ?? generateResourceId(Resource.property)
  }));
  if (propertyRecords.length > 0) {
    await datafn.property.mutate(
      propertyRecords.map((property) => ({
        operation: "insert",
        id: property.id,
        record: serializePropertyForDatafn(property),
        context: input.context
      }))
    );
  }
  await datafn.view.mutate({
    operation: "insert",
    id: viewId,
    record: {
      id: viewId,
      layout: input.selectedView,
      label: "Default",
      tabBy: "none",
      groupBy: "none",
      subGroupBy: "none"
    },
    context: input.context
  });
  const record = {
    id: collectionId,
    label: input.title ?? "",
    description: input.description,
    isStarred: input.isStarred,
    isCaptureShortcutEnabled:
      input.selectedType === CollectionType.TYPED
        ? input.isCaptureShortcutEnabled
        : undefined,
    typeToExtend: input.typeToExtendId ?? null,
    type: input.selectedType,
    resource: input.resource,
    ...(input.avatar
      ? {
          avatar: {
            code: input.avatar.code,
            color: input.avatar.color,
            file: input.avatar.file,
            isFilled: input.avatar.isFilled,
            type: input.avatar.type
          }
        }
      : {}),
    ...(input.coverPhoto ? { cover: input.coverPhoto } : {})
  };
  await datafn.collection.mutate([
    {
      operation: "insert",
      id: collectionId,
      record,
      context: input.context
    },
    {
      operation: "relate",
      id: collectionId,
      relations: {
        views: [{ $ref: viewId, sortOrder: 0 }],
        ...(propertyRecords.length > 0
          ? {
              properties: propertyRecords.map((property, sortOrder) => ({
                $ref: property.id,
                sortOrder
              }))
            }
          : {})
      },
      context: input.context
    }
  ]);
  const created = {
    ...record,
    views: [viewId],
    properties: propertyRecords.map((property) => property.id)
  };
  appStore.addToRecents({
    record: created,
    type: Resource.collection,
    timestamp: new Date()
  });
  return [created];
}

export type IActiveCollectionStore = InstanceType<typeof ActiveCollectionStore>;

export class ActiveCollectionStore extends ActiveResourceStore<
  ICollectionExpanded,
  IActiveCollection
> {
  constructor(collectionId: IRecordId) {
    super(collectionId);
  }

  async modify(
    val: Partial<ICollectionExpanded> & {
      views?: IRecordId[] | IActiveCollection["views"];
    },
    params?: { isPreventBackPropagation?: boolean }
  ) {
    const shouldUpdateActive = !params?.isPreventBackPropagation;
    const previous = shouldUpdateActive ? this.get() : undefined;
    const { views, ...fields } = val;
    if (shouldUpdateActive) {
      this.update((prev) => ({ ...prev, ...val }) as IActiveCollection);
    }
    try {
      const mergeMutation = {
        operation: "merge",
        id: this.id.toString(),
        record: pruneUndefined({
          id: this.id,
          ...fields
        } as Record<string, unknown>)
      } as const;
      if (views !== undefined) {
        const relateMutation = {
          operation: "relate",
          id: this.id.toString(),
          relations: {
            views: relationRefs(
              views.map((item) => (typeof item === "string" ? item : item.id))
            )
          }
        } as const;
        const hasFields = Object.values(fields).some(
          (value) => value !== undefined
        );
        await datafn.collection.mutate(
          hasFields ? [mergeMutation, relateMutation] : relateMutation
        );
      } else {
        await datafn.collection.mutate(mergeMutation);
      }
    } catch (error) {
      if (previous) this.set(previous);
      throw error;
    }
  }

  /**
   * Initialized the collection with local cached data
   */
  async init(accessMode: AccessMode) {
    logger.log({ at: "ActiveCollectionStore.init", id: this.id });
    try {
      this.update((val: IActiveCollection) => {
        if (val) val.isPageLoading = true;
        else val = { isPageLoading: true } as IActiveCollection;
        val.accessMode = accessMode;
        val.isInEditMode ??= false;
        return val;
      });
      let result: IActiveCollection | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        result = (await datafn.collection.select(this.id.toString(), {
          select: ["*", "views.*", "properties.*", "typeToExtend.*"],
          metadata: {
            includeTrashed: true,
            includeArchived: true
          }
        })) as unknown as IActiveCollection | undefined;
        if (result && Array.isArray(result.views)) break;
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }
      logger.log({ at: "ActiveCollectionStore.init - select", result });
      let record = result;
      if (!record) return;
      const views = Array.isArray(record.views) ? record.views : [];
      this.set({
        ...record,
        accessMode,
        isInEditMode: record.isInEditMode ?? false,
        isPageLoading: false,
        properties: record.properties ?? [],
        views: views.map((x: ICollectionView) => {
          return { ...x, data: [] };
        })
      });
      propertyEditorStore.set({
        properties: record.properties ?? [],
        typeToExtend:
          record.typeToExtend && typeof record.typeToExtend === "object"
            ? record.typeToExtend
            : undefined
      });
      appStore.addToRecents({
        record,
        type: Resource.collection,
        timestamp: new Date()
      });
    } catch (e) {
      logger.error({
        at: "ActiveCollectionStore.init",
        id: this.id,
        error: e
      });
    }
  }

  async refreshProperties() {
    logger.log({
      at: "ActiveCollectionStore.refreshProperties",
      id: this.id
    });
    try {
      const result = (await datafn.collection.select(this.id.toString(), {
        select: ["*", "properties.*", "typeToExtend.*"],
        metadata: {
          includeTrashed: true,
          includeArchived: true
        }
      })) as unknown as ICollectionExpanded | undefined;
      if (!result) return;
      this.update((val) => {
        val.properties = result.properties ?? [];
        val.typeToExtend = result.typeToExtend;
        return val;
      });
    } catch (e) {
      logger.error({ at: "ActiveCollectionStore.refreshProperties", e });
    }
  }

  async createView(viewToDuplicate?: IRecordId) {
    let viewToBeDuplicated: ICollectionView | undefined;
    let view: ICollectionViewCapture | undefined;
    if (viewToDuplicate) {
      const collection = this.get();
      viewToBeDuplicated = collection.views.find(
        (v) => v.id == viewToDuplicate
      );
      if (!viewToBeDuplicated) return;
      const {
        id: _id,
        data: _data,
        ...duplicatedView
      } = viewToBeDuplicated as ICollectionView & { data?: unknown };
      view = duplicatedView;
    } else {
      view = {
        label: "New view"
      };
    }
    if (!view) return;
    const viewId = viewToDuplicate
      ? generateResourceId(Resource.view)
      : (view.id ?? generateResourceId(Resource.view));
    const record = {
      ...viewDefaults,
      ...view,
      id: viewId
    };
    await datafn.view.mutate({
      operation: "insert",
      id: viewId,
      record
    });
    const response = [record] as ICollectionView[];
    logger.log({ at: "ActiveCollectionStore.createView", response });
    if (!response || !Array.isArray(response)) return;
    const createdView = response[0];
    if (!createdView || !createdView.id) return;

    this.update((val: IActiveCollection) => {
      val.views.push({ ...createdView, data: [] });
      return val;
    });

    await datafn.collection.mutate({
      operation: "relate",
      id: this.id.toString(),
      relations: {
        views: relationRefs(this.get().views.map((x) => x.id))
      }
    });
    return createdView.id;
  }

  async deleteView(id: string) {
    this.update((val: IActiveCollection) => {
      const viewToBeDeleted = val.views.find((v) => v.id == id);
      if (!viewToBeDeleted) return val;
      viewToBeDeleted.trashedAt = new Date();
      return val;
    });
    return datafn.view.mutate({
      operation: "trash",
      id
    });
  }

  updateView(id: IRecordId, view: Partial<ICollectionView>, key?: string) {
    this.update((val: IActiveCollection) => {
      val.views = val.views.map((v) => {
        if (v.id == id) return { ...v, ...view };
        return v;
      });
      return val;
    });
    datafn.view.mutate({
      operation: "merge",
      id,
      record: {
        id,
        ...view
      },
      debounceKey: key ?? id.toString(),
      debounceMs: 1500
    });
  }

  async updateProperties() {
    const propertiesEditor = propertyEditorStore.get();
    let properties = propertiesEditor.properties;
    properties = properties.map(assignDefaultLabelAsFallback);
    if (!properties) return;
    for (const property of properties) {
      await datafn.property.mutate({
        operation: "merge",
        id: property.id,
        record: serializePropertyForDatafn(property)
      });
    }
    const propertyIds = properties.map((p) => p.id);
    const result = await datafn.collection.mutate([
      {
        operation: "merge",
        id: this.id.toString(),
        record: pruneUndefined({
          id: this.id,
          typeToExtend: propertiesEditor.typeToExtend?.id ?? null
        } as Record<string, unknown>)
      },
      {
        operation: "relate",
        id: this.id.toString(),
        relations: {
          properties: relationRefs(propertyIds)
        }
      }
    ]);
    await this.refreshProperties();
    return result;
  }

  async selectItem(itemId: IRecordId) {
    const resource = itemId.split(":")[0];
    const result = await datafn.table(resource).query({
      select: ["*", "propertyValues.*#"],
      filters: { id: itemId },
      limit: 1,
      metadata: {
        includeTrashed: true,
        includeArchived: true
      }
    } as any);
    return result.data?.[0] as ICollectionItem | undefined;
  }
}

export const collectionLayoutOptions = [
  {
    value: CollectionLayout.BOARD,
    icon: "lucide:layout-dashboard"
  },
  {
    value: CollectionLayout.TABLE,
    icon: "table",

    isDisabled: true
  },
  {
    value: CollectionLayout.CALENDAR,
    icon: "calendar",

    isDisabled: true
  },
  {
    value: CollectionLayout.MAP,
    icon: "map",

    isDisabled: true
  }
];

export function resolveCollectionContextMenu(
  collection: ICollection,
  accessPoint: ResourceAccessPoint,
  params?: {
    accessPointId?: IRecordId;
    accessMode?: AccessMode;
    accessPointContext?: string;
    isConstrainedWidth?: boolean;
  }
): IContextMenu {
  const resourceActions = new ResourceActions(collection, {
    accessPoint,
    accessMode: params?.accessMode
  });
  const ctx = get(context);
  const viewStore = get(view);
  let commonGroups: { group: string; items: IContextMenuItem[] }[] = [];
  const moreGroup = {
    group: "more",
    items: [resourceActions.archive(), resourceActions.trash()]
  };
  if (ctx.isEmbed && ctx.embed === Embed.HANDSET) {
    commonGroups = [moreGroup];
  } else if (
    viewStore.isPortrait &&
    accessPoint === ResourceAccessPoint.SELF &&
    params?.accessMode === AccessMode.INLINE
  ) {
    commonGroups = [
      moreGroup,
      {
        group: "open",
        items: [resourceActions.maximize()]
      }
    ];
  } else {
    commonGroups = [
      {
        group: "open",
        items: [resourceActions.openAsTab(), resourceActions.maximize()]
      },
      moreGroup
    ];
  }
  if (accessPoint != ResourceAccessPoint.SELF) {
    return [
      {
        group: "all",
        items: [
          resourceActions.star(),
          resourceActions.select(accessPoint),

          resourceActions.copyLink()
        ]
      },
      ...commonGroups
    ];
  } else if (collection.type === CollectionType.TYPED) {
    const captureToggle = {
      value: "captureshortcut",
      icon: "command",
      label: "Capture shortcut",
      type: ContextMenuType.SWITCH,
      initialValue: collection.isCaptureShortcutEnabled,
      callback: async (checked: boolean) => {
        const result = await datafn.collection.mutate({
          operation: "merge",
          id: collection.id,
          record: {
            isCaptureShortcutEnabled: checked
          }
        });
        if (result) {
          toasts.success("Capture shortcut updated");
        }
      }
    };
    return [
      {
        group: "all",
        items: [
          resourceActions.star(),
          resourceActions.edit(accessPoint),

          resourceActions.copyLink(),
          ...(!collection.resource || collection.resource === Resource.node
            ? [captureToggle]
            : []),
          {
            value: "editProperties",
            icon: "ph:cube-light",
            label: "Edit properties",
            callback: async () => {
              requireCommandHost().runAction(
                resourceAction(Resource.property, ResourceActionType.EDIT),
                {
                  componentParams: {
                    id: collection?.id
                  }
                }
              );
            }
          }
        ]
      },
      ...commonGroups
    ];
  }
  return [
    {
      group: "all",
      items: [
        resourceActions.star(),
        resourceActions.edit(accessPoint),
        resourceActions.copyLink(),
        {
          value: "convert",
          icon: "convert",
          label: "Convert to Typed",
          callback: async () => {
            const result = await datafn.collection.mutate({
              operation: "merge",
              id: collection.id,
              record: {
                type: CollectionType.TYPED
              }
            });
            if (result) {
              toasts.success("Collection converted to typed");
            }
          }
        }
      ]
    },
    ...commonGroups
  ];
}
