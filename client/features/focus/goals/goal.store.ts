import { requireCommandHost } from "@nucleum/stores/commands/command-host";
import { Resource } from "@nucleum/datafn/resource.enum";
import { ActiveResourceStore } from "@nucleum/stores/resources/active-resource.store";
import { PanelSwitcherMixin } from "@nucleum/stores/resources/panelSwitcher.mixin";
import { ResourcePanelType } from "@nucleum/stores/resources/resource-panel.type";
import { type IRecordId } from "@nucleum/schema/legacy/data.type";
import { logger } from "@nucleum/client/runtime/logging/logger";
import type {
  IActiveObjective,
  IObjective,
  IObjectiveThumb
} from "@nucleum/features/focus/goals/goal.type";
import { ObjectiveType } from "@nucleum/features/focus/goals/goal.type";
import { updateObjectiveParent } from "@nucleum/features/focus/goals/goal.utils";
import {
  AccessMode,
  ResourceAccessPoint,
  type IResourceMutationParams
} from "@nucleum/datafn/resource.type";
import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
import { ResourceActions } from "@nucleum/stores/resources/resource.actions";
import {
  ContextMenuType,
  type IContextMenu,
  type IContextMenuItem
} from "@21n/elements/contextMenu/context-menu.type";
import { CollectibleStore } from "@nucleum/features/collections/collectible.store";
import { activeSession } from "@nucleum/features/focus/session.store";
import { get } from "svelte/store";
import { appStore } from "@nucleum/stores/app.store";
import context from "@nucleum/stores/context.store";
import { Embed } from "@nucleum/client/runtime/context.type";
import view from "@nucleum/stores/view.store";
import { resolveCollectionTypes } from "@nucleum/features/collections/collection.utils";
import type { ICollectionExpanded } from "@nucleum/features/collections/collection.type";
import { resolveResourceIcon } from "@nucleum/datafn/resource.utils";
import { PointronAction } from "@nucleum/client/config/focus-action.enum";
import { datafn } from "@nucleum/datafn/datafn.store";

function pruneUndefined(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  );
}

export class ActiveObjectiveStore extends CollectibleStore<
  IObjective,
  IActiveObjective
> {
  constructor(objectiveId: IRecordId) {
    super(objectiveId);
  }

  async modify(val: Partial<IObjective>, params?: IResourceMutationParams) {
    const shouldUpdateActive = !params?.isPreventBackPropagation;
    const previous = shouldUpdateActive ? this.get() : undefined;
    if (shouldUpdateActive) {
      this.update((prev) => ({ ...prev, ...val }));
    }
    try {
      await datafn.objective.mutate({
        operation: "merge",
        id: this.id.toString(),
        record: pruneUndefined({
          id: this.id.toString(),
          ...val
        } as Record<string, unknown>),
        context: params?.context,
        debounceKey: params?.debounceKey,
        debounceMs: params?.isDebounced ? 1500 : undefined,
        system: params?.isModifyAsSystem
      });
    } catch (error) {
      if (previous) this.set(previous);
      throw error;
    }
  }

  async init(
    accessMode: AccessMode,
    params?: {
      isInEditMode?: boolean;
      linkSearchParam?: string;
      panel?: string;
    }
  ) {
    logger.log({ at: "ActiveObjectiveStore.init", id: this.id, params });
    try {
      const result = (await datafn.objective.select(this.id.toString(), {
        select: ["*", "children.*", "parent.*", "collections"],
        metadata: {
          includeTrashed: true,
          includeArchived: true
        }
      })) as IObjective | undefined;
      if (!result) {
        this.set({
          id: this.id,
          label: "",
          type: ObjectiveType.INDEFINITE,
          updatedAt: new Date(),
          createdAt: new Date(),
          accessMode,
          panel: params?.panel ?? ResourcePanelType.DEFAULT,
          defaultPanel: ResourcePanelType.DEFAULT,
          switchPanel: () => {},
          closeEditMode: () => {},
          ...(params?.isInEditMode && { isInEditMode: true }),
          isPageLoading: false
        } as IActiveObjective);
        return;
      }
      let types: ICollectionExpanded[] = [];
      if (result.collections && result.collections.length > 0)
        types = await resolveCollectionTypes(result.collections);

      this.set({
        ...result,
        types,
        isPageLoading: false,
        accessMode,
        panel: params?.panel ?? ResourcePanelType.DEFAULT,
        defaultPanel: ResourcePanelType.DEFAULT,
        switchPanel: () => {},
        closeEditMode: () => {},
        ...(params?.isInEditMode && { isInEditMode: true })
      });

      appStore.addToRecents({
        record: result,
        type: Resource.objective,
        timestamp: new Date()
      });
      if (params?.linkSearchParam) {
        this.linkCollection(params.linkSearchParam);
      }
    } catch (e) {
      logger.error({
        at: "ActiveObjectiveStore.init",
        id: this.id,
        error: e
      });
    }
  }

  async afterInit() {
    const taskCount = await datafn.task.query({
      count: true,
      select: ["id"],
      filters: {
        objectiveId: this.id.toString()
      }
    });
    if (typeof taskCount?.count !== "number") return;
    this.update((state) => {
      return {
        ...state,
        taskCount: taskCount.count
      };
    });
  }

  switchPanel!: (panel: string) => void;

  static resolve<T extends ActiveResourceStore<any, any>>(
    this: new (id: IRecordId) => T,
    id: IRecordId
  ): T {
    if (!ActiveObjectiveStore.prototype.switchPanel) {
      ActiveObjectiveStore.prototype.switchPanel =
        PanelSwitcherMixin.switchPanel;
    }

    const instance = super.resolve.call(this, id) as T & {
      switchPanel?: (panel: string) => void;
    };

    if (!instance.switchPanel) {
      instance.switchPanel = PanelSwitcherMixin.switchPanel;
    }

    return instance as T;
  }
}

export type IActiveObjectiveStore = InstanceType<typeof ActiveObjectiveStore>;

const objectiveStaticPanelActions = {
  infoPane: {
    value: ResourcePanelType.DEFAULT,
    icon: "info",
    label: "Info",
    tooltip: "Show info"
  },
  subObjectivesPane: {
    value: ResourcePanelType.SUB,
    icon: resolveResourceIcon(Resource.objective),
    label: "Sub objectives",
    tooltip: "Show sub objectives"
  },
  tasksPane: {
    value: ResourcePanelType.TASKS,
    icon: resolveResourceIcon(Resource.task),
    label: "Tasks",
    tooltip: "Show tasks"
  },
  analyticsPane: {
    value: ResourcePanelType.ANALYTICS,
    icon: "chart",
    label: "Analytics",
    tooltip: "Show analytics"
  },
  activityPane: {
    value: ResourcePanelType.ACTIVITY,
    icon: "activity",
    label: "Activity",
    tooltip: "Show activity"
  },
  propertiesPane: {
    value: ResourcePanelType.PROPERTIES,
    icon: "shapes",
    label: "Properties",
    tooltip: "Show properties"
  },
  linksPane: {
    value: ResourcePanelType.LINKS,
    icon: "link",
    label: "Links",
    tooltip: "Show links"
  }
};

class ObjectiveActions {
  constructor(
    private objective: IObjectiveThumb,
    private accessPoint: ResourceAccessPoint
  ) {}

  share = {
    value: "share",
    icon: "share",
    callback: async () => {}
  };

  focusNow = {
    value: "focusNow",
    label: "Focus now",
    icon: "circle",
    callback: async () => {
      await activeSession.focusObjective(this.objective.id);
    }
  };

  convertToSubObjective = {
    value: PointronAction.CONVERT_TO_SUBOBJECTIVE,
    label: "Convert to sub objective",
    icon: "to-sub",
    callback: async () => {
      requireCommandHost().runAction(PointronAction.SELECT_PARENT_OBJECTIVE, {
        componentParams: {
          src: this.objective,
          action: PointronAction.CONVERT_TO_SUBOBJECTIVE
        }
      });
    }
  };

  moveObjective = {
    value: ResourceActionType.MOVE,
    label: "Move",
    icon: "move",
    callback: async () => {
      requireCommandHost().runAction(PointronAction.SELECT_PARENT_OBJECTIVE, {
        componentParams: {
          src: this.objective,
          action: ResourceActionType.MOVE
        }
      });
    }
  };

  convertToRootObjective = {
    value: PointronAction.CONVERT_TO_ROOT_OBJECTIVE,
    label: "Convert to top level objective",
    icon: "level-up",
    callback: async () => {
      await updateObjectiveParent(this.objective);
    }
  };

  pinToQuickFocus() {
    return {
      value: "pinToQuickFocus",
      label: "Pin to quick focus",
      icon: "circle",
      type: ContextMenuType.SWITCH,
      initialValue: this.objective.isPinnedForQuickFocus,
      callback: async (checked: boolean) => {
        await datafn.objective.mutate({
          operation: "merge",
          id: this.objective.id.toString(),
          record: {
            id: this.objective.id.toString(),
            isPinnedForQuickFocus: checked
          },
          context: this.accessPoint
        });
      }
    };
  }
}

export function resolvePanelOptions(
  objective: IActiveObjective,
  params?: {
    isConstrainedWidth?: boolean;
    isThreeColumned?: boolean;
  }
) {
  const overview = {
    value: ResourcePanelType.OVERVIEW,
    label: "Overview",
    icon: "overview",
    tooltip: "Show overview"
  };

  let items = [
    objectiveStaticPanelActions.analyticsPane,
    objectiveStaticPanelActions.linksPane,
    objectiveStaticPanelActions.activityPane
  ];

  if (params?.isConstrainedWidth) {
    items.unshift(objectiveStaticPanelActions.tasksPane);
    items.unshift(objectiveStaticPanelActions.subObjectivesPane);
    items.unshift(objectiveStaticPanelActions.infoPane);
  } else if (params?.isThreeColumned === false) {
    items.unshift(objectiveStaticPanelActions.tasksPane);
    items.unshift(objectiveStaticPanelActions.infoPane);
  } else {
    items.unshift(overview);
  }

  return items;
}

export function resolveObjectiveContextMenu(
  objective: IObjectiveThumb,
  accessPoint: ResourceAccessPoint,
  params?: {
    accessPointId?: IRecordId;
  }
): IContextMenu {
  const resourceActions = new ResourceActions(
    objective as unknown as IObjective,
    {
      accessPoint
    }
  );
  const objectiveActions = new ObjectiveActions(objective, accessPoint);

  let primaryItems: IContextMenuItem[] = [];

  if (accessPoint === ResourceAccessPoint.SELF) {
    primaryItems = [
      resourceActions.star(),
      resourceActions.edit(accessPoint),
      resourceActions.copyLink()
    ];
  } else if (
    accessPoint === ResourceAccessPoint.COLLECTION &&
    params?.accessPointId
  ) {
    primaryItems = [
      resourceActions.unlink(params?.accessPointId),
      resourceActions.select(accessPoint, params?.accessPointId),
      resourceActions.star(),
      resourceActions.edit(accessPoint),
      resourceActions.copyLink()
    ];
  } else {
    primaryItems = [
      resourceActions.select(accessPoint, params?.accessPointId),
      resourceActions.star(),
      resourceActions.addToCollection(),
      resourceActions.edit(accessPoint),
      resourceActions.copyLink()
    ];
  }
  const isRootObjective =
    !objective.parentId &&
    (!objective.parent ||
      (Array.isArray(objective.parent) && objective.parent?.length === 0));
  if (isRootObjective) {
    primaryItems.push(objectiveActions.convertToSubObjective);
  } else {
    primaryItems.push(
      objectiveActions.convertToRootObjective,
      objectiveActions.moveObjective
    );
  }
  const openingActionGroup = {
    group: "open",
    items: [
      resourceActions.openAsTab(),
      ...(accessPoint !== ResourceAccessPoint.SELF
        ? [resourceActions.openAsSplit()]
        : []),
      resourceActions.maximize()
    ]
  };
  const ctx = get(context);
  const viewStore = get(view);
  const isCurrentlyFocusing = activeSession.isCurrentFocusItem(objective.id);
  const focusGroup = {
    group: "focus",
    items: [
      ...(isCurrentlyFocusing ? [] : [objectiveActions.focusNow]),
      objectiveActions.pinToQuickFocus()
    ]
  };
  return [
    {
      group: "primary",
      items: [...primaryItems]
    },
    focusGroup,
    ...((ctx.isEmbed && ctx.embed === Embed.HANDSET) ||
    viewStore.isConstrainedWidth
      ? []
      : [openingActionGroup]),
    {
      group: "more",
      items: [resourceActions.archive(), resourceActions.trash()]
    }
  ];
}
