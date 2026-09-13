import { navigation } from "@21n/layout/navigation/navigation";
import { requireCommandHost } from "@nucleum/stores/commands/command-host";
import StorageSettings from "@nucleum/products/pointron/settings/data/StorageSettings.svelte";
import WidgetSettings from "@nucleum/products/pointron/settings/WidgetSettings.svelte";
import TrackingSettings from "@nucleum/products/pointron/settings/targets/TrackingSettings.svelte";
import Focus from "@nucleum/features/focus/Focus.svelte";
import Zen from "@nucleum/features/focus/zen/Zen.svelte";
import FocusPlayer from "@nucleum/features/focus/player/FocusPlayer.svelte";
import {
  ActionType,
  type IAction,
  type IActionFnParams
} from "@nucleum/client/config/action.type";
import ImportAppData from "@nucleum/products/pointron/settings/ImportAppData/ImportAppData.svelte";
import EditPresetView from "@nucleum/features/focus/advanced/presets/EditPresetModal.svelte";
import PointronOnboarding from "@nucleum/products/pointron/base/PointronOnboarding.svelte";
import ComposeByEndTimeModal from "@nucleum/features/focus/advanced/composition/ComposeByEndTimeModal.svelte";
import ComposeModal from "@nucleum/features/focus/advanced/composition/ComposeModal.svelte";
import ComingSoonView from "@21n/elements/ComingSoonView.svelte";
import PresetSaveConfirmationModal from "@nucleum/features/focus/advanced/presets/PresetSaveConfirmationModal.svelte";
import SessionFinishedModal from "@nucleum/features/focus/elements/SessionFinishedModal.svelte";
import Think from "@nucleum/features/focus/Think.svelte";
import BackgroundMusic from "@nucleum/features/focus/backgroundMusic/BackgroundMusic.svelte";
import { Size } from "@21n/elements/size.enum";
import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
import { get } from "svelte/store";
import { Resource } from "@nucleum/datafn/resource.enum";
import {
  toasts,
  confirmationNotification
} from "@nucleum/stores/notification.store";
import FocusItemsModal from "@nucleum/features/focus/advanced/FocusItemsModal.svelte";
import BreakReminderModal from "@nucleum/features/focus/elements/BreakReminderModal.svelte";
import PredefinedIntervalNotifierOverlay from "@nucleum/features/focus/elements/PredefinedIntervalNotifierOverlay.svelte";
import { manualLogStore } from "@nucleum/features/focus/logs/log.store";
import { datafn } from "@nucleum/datafn/datafn.store";
import ControlPanelLogsPane from "@nucleum/features/focus/logs/ControlPanelLogsPane.svelte";
import SessionLogPage from "@nucleum/features/focus/logs/logPage/SessionLogPage.svelte";
import ManualLogPane from "@nucleum/features/focus/logs/manualLog/ManualLogPane.svelte";
import LogsPane from "@nucleum/features/focus/logs/LogsPane.svelte";
import AnalyticsV2 from "@nucleum/features/focus/analytics/AnalyticsV2.svelte";
import { Orientation, Placement } from "@21n/elements/direction.enum";
import PresetSettings from "@nucleum/features/focus/advanced/presets/PresetSettings.svelte";
import { activeSession } from "@nucleum/features/focus/session.store";
import { PointronAction } from "@nucleum/client/config/focus-action.enum";
import { PointronEvent } from "@nucleum/client/config/events/focus-event.enum";
import AnalyticsViewsPageEditMobile from "@nucleum/features/focus/analytics/AnalyticsViewsPageEditMobile.svelte";

import { Embed } from "@nucleum/client/runtime/context.type";
import ImportOnboarding from "@nucleum/products/pointron/settings/data/ImportOnboarding.svelte";
import { Action } from "@nucleum/client/config/action.enum";
import FocusPlayerCommandModeWidget from "@nucleum/features/focus/player/FocusPlayerCommandModeWidget.svelte";
import PointronLibrary from "@nucleum/products/pointron/library/PointronLibrary.svelte";
import ObjectiveSearchResultItem from "@nucleum/features/focus/goals/GoalSearchResultItem.svelte";
import { SessionState } from "@nucleum/features/focus/sessionState.enum";
import {
  isSameResource,
  resolveResourceIcon,
  resourceAction,
  resourceInList
} from "@nucleum/datafn/resource.utils";
import ResourceBrowser from "@nucleum/application/library/resourceBrowser/ResourceBrowser.svelte";
import { AccessMode } from "@nucleum/datafn/resource.type";
import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
import NodeLoadingPulse from "@21n/elements/feedback/animations/NodeLoadingPulse.svelte";
import { appMenuActionLabelsByAction } from "@nucleum/client/config/product-nav.config";

import Task from "@nucleum/features/focus/tasks/Task.svelte";
import CreateTask from "@nucleum/features/focus/tasks/CreateTask.svelte";
import Objective from "@nucleum/features/focus/goals/Goal.svelte";
import ObjectiveTitleLabelPart from "@nucleum/features/focus/goals/GoalTitleLabelPart.svelte";
import { AppSearchParam } from "@nucleum/stores/appStore.type";
import {
  ObjectiveStatus,
  ObjectiveType,
  type IObjective
} from "@nucleum/features/focus/goals/goal.type";
import { updateObjectiveParent } from "@nucleum/features/focus/goals/goal.utils";
import LibraryPanelContentResolver from "@nucleum/application/library/LibraryPanelContentResolver.svelte";
import { generateResourceId } from "@nucleum/datafn/id.utils";

const isSessionRunningPreCondition = () => get(activeSession).isSessionRunning;

function pruneUndefined(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  );
}

async function queryObjectives(
  searchQuery: string,
  filters?: Record<string, unknown>,
  limit = 50
) {
  const baseQuery = {
    select: ["*", "parent.*"],
    search: searchQuery
      ? {
          query: searchQuery,
          fields: ["label"]
        }
      : undefined,
    filters,
    limit
  };
  const [searchResult, labelResult] = await Promise.all([
    datafn.objective.query(baseQuery),
    searchQuery
      ? datafn.objective.query({
          select: ["*", "parent.*"],
          filters: pruneUndefined({
            ...(filters ?? {}),
            label: { $contains: searchQuery }
          }),
          limit
        })
      : Promise.resolve({ data: [] })
  ]);
  return rankObjectiveResults(
    [...(labelResult.data ?? []), ...(searchResult.data ?? [])] as IObjective[],
    searchQuery
  );
}

function rankObjectiveResults(items: IObjective[], searchQuery: string) {
  const query = searchQuery.trim().toLowerCase();
  const seen = new Set<string>();
  const deduped = items.filter((item) => {
    const id = item.id?.toString();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  if (!query) return deduped;
  return deduped.sort((a, b) => {
    const aRank = resolveObjectiveSearchRank(a, query);
    const bRank = resolveObjectiveSearchRank(b, query);
    if (aRank !== bRank) return aRank - bRank;
    return (a.label ?? "").localeCompare(b.label ?? "");
  });
}

function resolveObjectiveSearchRank(item: IObjective, query: string) {
  const label = (item.label ?? "").toLowerCase();
  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  if (label.includes(query)) return 2;
  return 3;
}

async function createObjective(params?: {
  label?: string;
  isQuickFocus?: boolean;
  context?: string;
  isPreventOpenAfterCreate?: boolean;
  linkSearchParam?: string;
}) {
  const objective = {
    id: generateResourceId(Resource.objective),
    label: params?.label ?? "",
    type: ObjectiveType.INDEFINITE,
    status: ObjectiveStatus.NOT_STARTED,
    isPinnedForQuickFocus: params?.isQuickFocus ?? false
  } as IObjective;
  await datafn.objective.mutate({
    operation: "insert",
    id: objective.id.toString(),
    record: objective,
    context:
      params?.context ??
      resourceAction(Resource.objective, ResourceActionType.CREATE)
  });
  toasts.success("New objective created successfully");
  if (params?.isPreventOpenAfterCreate) return objective;
  navigation.openResource(objective.id, AccessMode.POP, {
    searchParams: {
      [AppSearchParam.EDIT]: true,
      [AppSearchParam.LINK]: params?.linkSearchParam ?? null
    }
  });
  return objective;
}

export const pointronActions: IAction[] = [
  {
    action: PointronAction.ANALYTICS_VIEWS_PAGE_EDIT_MOBILE,
    component: AnalyticsViewsPageEditMobile,
    type: ActionType.MODAL,
    modalParams: {
      title: "Edit Pages",
      layout: {
        size: Size.lg,
        primaryAction: {
          label: "Done"
        }
      }
    }
  },
  {
    action: PointronAction.FULL_SCREEN_FOCUS,
    component: Zen,
    icon: "zen",
    type: ActionType.MODAL,
    isMeta: true,
    associatedPlayer: PointronAction.FOCUS_PLAYER,
    modalParams: {
      layout: {
        ignoreSafeArea: true,
        size: Size.full
      }
    }
  },
  {
    action: PointronEvent.SESSION_FINISHED,
    component: SessionFinishedModal,
    type: ActionType.MODAL,
    isMeta: true,
    modalParams: {
      isDismissable: false,
      layout: {
        size: Size.md,
        orientation: Orientation.Vertical,
        primaryAction: {
          label: "Done",
          callback: () => {
            const focus = get(activeSession);
            if (focus.state === SessionState.PRE_FINISHED) {
              return activeSession.finishSession({ isClose: true });
            } else {
              return activeSession.close();
            }
          }
        }
      }
    }
  },
  {
    action: PointronAction.SAVE_PRESET_MODAL,
    component: PresetSaveConfirmationModal,
    type: ActionType.MODAL,
    isMeta: true,
    modalParams: {
      title: "Save as preset",
      layout: {
        isOveriddenFooter: true
      }
    }
  },
  {
    action: Resource.session,
    component: SessionLogPage,
    type: ActionType.RESOURCE,
    isMeta: true,
    modalParams: {
      layout: {
        size: Size.lg,
        isShowCantileverClose: true,
        isShowBackButton: true,
        isOveriddenFooter: true
      }
    }
  },
  {
    action: PointronAction.COMPOSE_BY_END_TIME_MODAL,
    component: ComposeByEndTimeModal,
    type: ActionType.MODAL,
    isMeta: true,
    modalParams: {
      title: "Choose end time",
      layout: {
        secondaryAction: {
          label: "Done"
        }
      }
    }
  },
  {
    action: PointronAction.COMPOSE_TIME_MODAL,
    component: ComposeModal,
    type: ActionType.MODAL,
    isMeta: true,
    modalParams: {
      layout: {
        size: Size.lg,
        primaryAction: {
          label: "Proceed"
        },
        secondaryAction: {
          label: "Cancel"
        }
      }
    }
  },

  {
    action: PointronAction.MANUAL_FOCUS_ENTRY,
    component: ManualLogPane,
    get label() {
      return this.modalParams?.title;
    },
    type: ActionType.MODAL,
    modalParams: {
      title: "Manual time entry",
      isShowAsSheet: false,
      layout: {
        size: Size.xl,
        primaryAction: {
          label: "Save entries",
          style: ButtonStyle.DEFAULT,
          callback: () => manualLogStore.save()
        },
        secondaryAction: {
          label: "Discard",
          callback: () => {
            setTimeout(() => {
              manualLogStore.reset();
            }, 100);
            return Promise.resolve(true);
          }
        }
      }
    }
  },
  {
    action: PointronAction.EDIT_PRESET,
    component: EditPresetView,
    type: ActionType.MODAL,
    label: "Create a new preset",
    modalParams: {
      title: "Edit Preset",
      layout: {
        size: Size.lg,
        isOveriddenFooter: true
      }
    }
  },
  {
    action: PointronEvent.BREAK_REMINDER,
    component: BreakReminderModal,
    type: ActionType.MODAL,
    isMeta: true,
    modalParams: {
      title: "Break Reminder",
      layout: {
        size: Size.lg,
        orientation: Orientation.Vertical,
        secondaryAction: {
          label: "Continue working"
        },
        primaryAction: {
          label: "Take break",
          callback: () => activeSession.startBreak()
        }
      }
    }
  },
  {
    action: PointronAction.PREDEFINED_INTERVAL_NOTIFIER_OVERLAY,
    component: PredefinedIntervalNotifierOverlay,
    type: ActionType.MODAL,
    isMeta: true,
    modalParams: {
      isShowOverlay: false,
      layout: {
        size: Size.xs,
        ignoreSafeArea: true
      }
    }
  },
  {
    action: PointronAction.IMPORT_APP_DATA,
    component: ImportAppData,
    type: ActionType.MODAL,
    modalParams: {
      layout: {
        size: Size.xl,
        orientation: Orientation.Horizontal
      }
    }
  },
  {
    action: PointronAction.LOGS,
    component: LogsPane,
    isMenuHidden: true,
    get label() {
      return this.modalParams?.title;
    },
    cmdLabel: "See Logs",
    type: ActionType.MODAL,
    icon: "history",
    modalParams: {
      title: "Logs",
      isShowAsSheet: true,
      layout: {
        size: Size.lg
      }
    }
  },
  {
    action: "onboarding",
    component: PointronOnboarding,
    isMenuHidden: true,
    label: "Onboarding",
    type: ActionType.PAGE,
    isMeta: true
  },
  {
    action: "cplogs",
    component: ControlPanelLogsPane,
    path: "cp/logs",
    label: "Logs",
    type: ActionType.PAGE,
    isMeta: true,
    icon: "history"
  },
  {
    action: PointronAction.FOCUS_PLAYER,
    type: ActionType.INLINE,
    isMeta: true,
    component: FocusPlayer
  },
  {
    action: PointronAction.FOCUS_PLAYER + Action.CMD,
    type: ActionType.INLINE,
    isMeta: true,
    component: FocusPlayerCommandModeWidget
  },
  {
    action: PointronAction.FOCUS,
    component: Focus,
    icon: "focus",
    type: ActionType.LIVE,
    label: appMenuActionLabelsByAction[PointronAction.FOCUS],
    accessMode: AccessMode.RIGHT,
    liveActionParams: {
      isOpeningBehaviorConfigurable: true
    }
  },
  {
    action: Action.OVERVIEW,
    component: AnalyticsV2,
    type: ActionType.PAGE,

    icon: "overview",
    label: appMenuActionLabelsByAction[Action.OVERVIEW]
  },
  {
    action: "alerts",
    cmdLabel: "Alert Settings",
    label: "Alerts",
    path: "cp/alerts",
    isInactive: true,
    icon: "bell",
    type: ActionType.PAGE,
    component: ComingSoonView
  },
  {
    action: "presets",
    label: "Presets",
    path: "cp/presets",
    icon: "folder",
    type: ActionType.MODAL,
    component: PresetSettings,
    modalParams: {
      title: "Presets",
      layout: {
        size: Size.lg
      }
    }
  },
  {
    action: PointronAction.IMPORT_EXPORT,
    get cmdLabel() {
      return this.modalParams?.title;
    },
    isInactive: true,
    label: "Import / Export",
    path: "cp/importexport",
    icon: "data",
    type: ActionType.MODAL,
    component: StorageSettings,
    modalParams: {
      title: "Import / Export data",
      layout: {
        size: Size.xl,
        orientation: Orientation.Horizontal
      }
    },
    hideContext: [Embed.HANDSET]
  },
  {
    action: PointronAction.IMPORT_ONBOARDING,
    label: "Import onboarding",
    type: ActionType.MODAL,
    isMeta: true,
    component: ImportOnboarding,
    modalParams: {
      layout: {
        size: Size.md,
        primaryAction: {
          label: "I will do it later",
          icon: "clock"
        }
      }
    }
  },
  {
    action: PointronAction.IMPORT_EXPORT_TRIGGER,
    get cmdLabel() {
      return this.modalParams?.title;
    },
    label: "Import / Export",
    path: "cp/importexport",
    icon: "data",
    isMeta: true,
    type: ActionType.FUNCTION,
    fn: async () => {
      requireCommandHost().runAction(PointronAction.IMPORT_EXPORT);
    },
    hideContext: [Embed.HANDSET]
  },
  {
    action: "widgets",
    label: "Widgets",
    path: "cp/widgets",
    icon: "widget",
    type: ActionType.PAGE,
    isInactive: true,
    component: WidgetSettings
  },
  {
    action: PointronAction.SET_TARGETS,
    get cmdLabel() {
      return this.modalParams?.title;
    },
    label: "Targets",
    path: "cp/targets",
    isInactive: true,
    icon: "fire",
    type: ActionType.MODAL,
    component: TrackingSettings,
    modalParams: {
      title: "Target Settings"
    }
  },
  {
    action: PointronAction.BACKGROUND_MUSIC,
    label: "Background music",
    type: ActionType.MODAL,
    isInactive: true,
    preCondition: isSessionRunningPreCondition,
    component: BackgroundMusic,
    modalParams: {
      layout: {
        size: Size.lg,
        primaryAction: {
          label: "Done"
        }
      }
    }
  },
  {
    action: PointronAction.PIN_TO_QUICK_FOCUS,
    label: "Pin an objective to quick focus",
    type: ActionType.SEARCH_CMD,
    searchActionParams: {
      placeholder: "Select an objective to pin",
      searchResultComponent: ObjectiveSearchResultItem,
      searchCallback: async (searchQuery: string) => {
        return queryObjectives(searchQuery, {
          isPinnedForQuickFocus: false
        });
      },
      callback: async (item: any) => {
        try {
          const result = await datafn.objective.mutate({
            operation: "merge",
            id: item.id.toString(),
            record: {
              id: item.id.toString(),
              isPinnedForQuickFocus: true
            },
            context: PointronAction.PIN_TO_QUICK_FOCUS
          });
          if (!(result as { ok?: boolean } | undefined)?.ok) {
            toasts.error("Failed to pin objective to quick focus");
            return;
          }
          toasts.success(`Objective **${item.label}** pinned to quick focus`);
        } catch {
          toasts.error("Failed to pin objective to quick focus");
        }
      }
    }
  },
  {
    action: PointronAction.QUICK_FOCUS,
    label: "Quick focus",
    type: ActionType.SEARCH_CMD,
    searchActionParams: {
      searchResultComponent: ObjectiveSearchResultItem,
      searchCallback: async (searchQuery: string) => {
        return queryObjectives(searchQuery, {
          id: { $ne: "" }
        });
      },
      placeholder: "Select an objective to focus",
      callback: (item: any) => {
        activeSession.quickStart(item.id);
      }
    }
  },
  {
    action: PointronAction.START_FOCUS_SESSION,
    label: "Start a new focus session",
    type: ActionType.FUNCTION,
    fn: async () => {
      activeSession.startSession();
    }
  },
  {
    action: PointronAction.TOGGLE_FOCUS_SESSION,
    isMeta: true,
    type: ActionType.FUNCTION,
    fn: async () => {
      if (isSessionRunningPreCondition()) {
        requireCommandHost().runAction(PointronAction.FINISH_FOCUS_SESSION);
      } else {
        requireCommandHost().runAction(PointronAction.START_FOCUS_SESSION);
      }
    }
  },
  {
    action: PointronAction.FINISH_FOCUS_SESSION,
    label: "Finish the current session",
    fn: async (params?: IActionFnParams) => {
      activeSession.finishSession(params?.componentParams);
    },
    type: ActionType.CONFIRMATION,
    preCondition: isSessionRunningPreCondition,
    confirmation: {
      title: "Finish focus session",
      message: "Are you sure you want to finish this focus session?",
      confirmAction: {
        label: "Finish",
        variant: ButtonVariant.PRIMARY,
        callback: () => {
          return Promise.resolve(activeSession.finishSession());
        }
      }
    }
  },
  {
    action: PointronAction.ABANDON_SESSION,
    label: "Abandon the current session",
    fn: activeSession.close,
    type: ActionType.CONFIRMATION,
    preCondition: isSessionRunningPreCondition,
    confirmation: {
      title: "Abandon focus session",
      message: "Are you sure you want to abandon this focus session?",
      confirmAction: {
        label: "Abandon",
        variant: ButtonVariant.DANGER,
        callback: () => {
          return Promise.resolve(activeSession.close());
        }
      }
    }
  },
  {
    action: PointronAction.THINK_MODE,
    label: "Think mode",
    icon: "think",
    type: ActionType.MODAL,
    preCondition: isSessionRunningPreCondition,
    component: Think,
    modalParams: {
      layout: {
        size: Size.full,
        ignoreSafeArea: true
      }
    }
  },
  {
    action: PointronAction.DELETE_SESSION,
    type: ActionType.FUNCTION,
    fn: async (params?: IActionFnParams) => {
      confirmationNotification.notify({
        title: "Delete session",
        message: "Are you sure you want to delete this session log?",
        confirmAction: {
          label: "Delete",
          icon: "trash",
          variant: ButtonVariant.DANGER,
          callback: async () => {
            const sessionId =
              params?.componentParams?.id ??
              new URLSearchParams(window.location.search).get("r");
            if (sessionId == null) {
              toasts.error("Missing session id. Aborting delete.");
              return false;
            }
            try {
              await datafn.session.mutate({
                operation: "delete",
                id: sessionId,
                context: PointronAction.DELETE_SESSION
              });
              toasts.success("Session log deleted successfully");
              navigation.closeResource({ id: sessionId });
              return true;
            } catch (e) {
              toasts.error("Failed to delete session log");
              return false;
            }
          }
        }
      });
    }
  },
  {
    action: PointronAction.SHOW_FOCUSITEMS_MODAL,
    type: ActionType.MODAL,
    component: FocusItemsModal,
    modalParams: {
      title: "Focus Items",
      isShowAsSheet: false,
      layout: {
        size: Size.lg,
        secondaryAction: {
          label: "Done"
        }
      }
    }
  },
  {
    action: Action.LIBRARY,
    label: appMenuActionLabelsByAction[Action.LIBRARY],
    icon: "library",
    panel: PointronLibrary,
    component: LibraryPanelContentResolver,
    type: ActionType.PAGE,
    componentParams: {
      defaultResource: Resource.objective
    },
    modalParams: {
      layout: {
        size: Size.lg,
        orientation: Orientation.Horizontal
      }
    }
  },
  {
    action: Action.LIBRARY_PORTRAIT,
    label: appMenuActionLabelsByAction[Action.LIBRARY_PORTRAIT],
    icon: "library",
    component: PointronLibrary,
    type: ActionType.PAGE
  },
  {
    action: resourceAction(Resource.objective, ResourceActionType.BROWSE),
    component: ResourceBrowser,
    label: "Objectives",
    icon: resolveResourceIcon(Resource.objective),
    type: ActionType.PAGE,
    componentParams: {
      resource: Resource.objective
    },
    loadingComponent: NodeLoadingPulse
  },
  {
    action: resourceAction(Resource.objective, ResourceActionType.CREATE),
    label: "Create a new objective",
    type: ActionType.FUNCTION,
    fn: async (props?: IActionFnParams) => {
      await createObjective({
        ...props?.componentParams,
        linkSearchParam: props?.searchParams?.[AppSearchParam.LINK]
      });
    }
  },
  {
    action: Resource.objective,
    type: ActionType.MODAL,
    component: Objective,
    resourceLabelRenderer: ObjectiveTitleLabelPart,
    modalParams: {
      layout: {
        size: Size.xxl,
        orientation: Orientation.Horizontal,
        ignoreSafeArea: true,
        isShowCantileverClose: true,
        isShowBackButton: true
      }
    }
  },
  {
    action: Action.EDIT_TASK_OBJECTIVE,
    type: ActionType.SEARCH_CMD,
    cmdLabel: "Edit objective for task",
    isMeta: true,
    searchActionParams: {
      placeholder: "select an objective",
      searchResultComponent: ObjectiveSearchResultItem,
      searchCallback: async (query: string, componentParams?: any) => {
        return queryObjectives(query, undefined, 50);
      },
      callback: async (item: any, componentParams?: any) => {
        await datafn.task.mutate({
          operation: "merge",
          id: componentParams.taskId.toString(),
          record: {
            id: componentParams.taskId.toString(),
            objectiveId: item.id
          },
          context: componentParams?.context
        });
        toasts.success(`Objective updated for task`);
      }
    }
  },
  {
    action: resourceAction(Resource.task, ResourceActionType.CREATE),
    label: "Create a new task",
    type: ActionType.MODAL,
    component: CreateTask,
    modalParams: {
      layout: {
        isDynamicSize: true,
        isOveriddenFooter: true,
        alignment: Placement.TopCenter
      }
    }
  },
  {
    action: PointronAction.CREATE_TASK_INLINE,
    type: ActionType.EVENT
  },
  {
    action: Resource.task,
    isMeta: true,
    type: ActionType.RESOURCE,
    component: Task,
    modalParams: {
      layout: {
        isDynamicSize: true,
        ignoreSafeArea: true
      }
    }
  },
  {
    action: resourceAction(Resource.task, ResourceActionType.BROWSE),
    component: ResourceBrowser,
    label: "Tasks",
    icon: resolveResourceIcon(Resource.task),
    type: ActionType.PAGE,
    componentParams: {
      resource: Resource.task
    },
    loadingComponent: NodeLoadingPulse
  },
  {
    action: PointronAction.SELECT_PARENT_OBJECTIVE,
    isMeta: true,
    cmdLabel: "Select parent objective",
    type: ActionType.SEARCH_CMD,
    searchActionParams: {
      searchResultComponent: ObjectiveSearchResultItem,
      searchCallback: async (searchQuery: string, componentParams?: any) => {
        const result = await queryObjectives(searchQuery, {
          id: { $ne: "" }
        });
        return result.filter(
          (objective: IObjective) =>
            !(
              objective.parent &&
              objective.parent.some(resourceInList(componentParams.src))
            ) && !isSameResource(objective, componentParams.src)
        );
      },
      placeholder: "Select an objective",
      callback: (item: any, componentParams?: any) => {
        if (componentParams.action === PointronAction.CONVERT_TO_SUBOBJECTIVE) {
          updateObjectiveParent(componentParams.src, item);
        } else if (componentParams.action === ResourceActionType.MOVE) {
          updateObjectiveParent(componentParams.src, item);
        }
      }
    }
  }
];
