import { requireCommandHost } from "@nucleum/stores/commands/command-host";
import { Resource } from "@nucleum/datafn/resource.enum";
import { type IRecordId } from "@nucleum/schema/legacy/data.type";
import type { ITask } from "@nucleum/features/focus/tasks/task.type";
import { ResourceAccessPoint } from "@nucleum/datafn/resource.type";
import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
import type {
  IContextMenu,
  IContextMenuItem
} from "@21n/elements/contextMenu/context-menu.type";
import { appStore } from "@nucleum/stores/app.store";
import { Action } from "@nucleum/client/config/action.enum";
import { get } from "svelte/store";
import view from "@nucleum/stores/view.store";
import { resolveUnixTimestamp } from "@21n/shared-utils/time.utils";
import {
  determineResourceType,
  isTrashedResource,
  isSameResource,
  resolveBulkSelectionAccessPointId,
  resolveResourceActionIcon,
  resolveResourceIcon,
  resourceInList
} from "@nucleum/datafn/resource.utils";
import { activeSession } from "@nucleum/features/focus/session.store";
import { datafn } from "@nucleum/datafn/datafn.store";
import { bulkEditStore } from "@nucleum/stores/resources/bulkedit.store";
import { BulkEditor } from "@nucleum/stores/resources/bulk-editor";
import { Product } from "@nucleum/client/config/product.type";

class TaskActions {
  constructor(
    private task: ITask,
    private accessPoint: ResourceAccessPoint
  ) {}

  focusNow = {
    value: "focusNow",
    label: "Focus now",
    icon: "circle",
    callback: async () => {
      await activeSession.focusTask(
        this.task.id,
        this.task.objectiveId ?? undefined
      );
    }
  };

  toggle() {
    return {
      value: "toggle",
      label: this.task.isChecked ? "Mark as incomplete" : "Mark as complete",
      icon: this.task.isChecked ? "square" : "check-square",
      callback: async () => {
        const isChecked = !this.task.isChecked;
        await datafn.task.mutate({
          operation: "merge",
          id: this.task.id,
          record: {
            id: this.task.id,
            isChecked,
            completedAtUnix: isChecked ? resolveUnixTimestamp() : null
          },
          context: this.accessPoint
        });
      }
    };
  }

  editObjective() {
    return {
      value: "editObjective",
      icon: resolveResourceIcon(Resource.objective),
      label:
        this.accessPoint === ResourceAccessPoint.OBJECTIVE
          ? "Move to another objective"
          : this.task.objectiveId
            ? "Change objective"
            : "Assign objective",
      callback: async () => {
        requireCommandHost().runAction(Action.EDIT_TASK_OBJECTIVE, {
          componentParams: {
            taskId: this.task.id,
            context: this.accessPoint
          }
        });
      }
    };
  }

  openTask() {
    return {
      value: "openTask",
      icon: "pop",
      label: "Open task"
    };
  }

  editDate = {
    value: "editDate",
    icon: "calendar",
    label: "Edit due date"
  };

  select(accessPointId?: IRecordId) {
    const resolvedAccessPointId = resolveBulkSelectionAccessPointId(
      this.accessPoint,
      accessPointId
    );
    const multiSelectContext = {
      resource: determineResourceType(this.task.id),
      accessPoint: this.accessPoint,
      accessPointId: resolvedAccessPointId
    };
    const resolveEditor = () => {
      if (!bulkEditStore.matchesContext(multiSelectContext)) {
        bulkEditStore.activate(multiSelectContext, {
          onAction: (ids, action, data) => {
            const bulkEditor = new BulkEditor(
              multiSelectContext.resource,
              bulkEditStore
            );
            bulkEditor.run(action, data);
          },
          subContext: resolvedAccessPointId?.toString()
        });
      }
    };
    const state = bulkEditStore.getState();
    const selectedItems = state.selectedIds;
    const isSameSelectionContext =
      bulkEditStore.matchesContext(multiSelectContext);
    return {
      label:
        isSameSelectionContext &&
        selectedItems.some(resourceInList(this.task.id))
          ? "Unselect"
          : "Select",
      value: ResourceActionType.SELECT,
      icon: "check-circle",
      callback: async () => {
        resolveEditor();
        const currentState = bulkEditStore.getState();
        const currentSelection = currentState.selectedIds;
        if (currentSelection.some(resourceInList(this.task.id))) {
          bulkEditStore.select(
            currentSelection.filter((y) => !isSameResource(y, this.task.id))
          );
        } else {
          bulkEditStore.select([...currentSelection, this.task.id]);
        }
      }
    };
  }

  trash() {
    const isTrashed = isTrashedResource(this.task);
    return {
      value: isTrashed ? "restore" : "delete",
      icon: resolveResourceActionIcon(
        isTrashed ? ResourceActionType.RESTORE : ResourceActionType.DELETE
      ),
      callback: async () => {
        await datafn.task.mutate({
          operation: isTrashed ? "restore" : "trash",
          id: this.task.id,
          context: this.accessPoint
        } as any);
      }
    };
  }
}

export function resolveTaskContextMenu(
  task: ITask,
  accessPoint: ResourceAccessPoint,
  params?: {
    accessPointId?: IRecordId;
  }
): IContextMenu {
  const taskActions = new TaskActions(task, accessPoint);
  const viewStore = get(view);
  const product = get(appStore).product;
  const isCurrentlyFocusing = activeSession.isCurrentFocusItem(task.id);
  let primaryItems: IContextMenuItem[] = [
    ...(accessPoint !== ResourceAccessPoint.SELF
      ? [taskActions.openTask()]
      : []),
    taskActions.select(params?.accessPointId),
    ...(product === Product.POINTRON || product === Product.NUCLEUM
      ? [taskActions.editObjective()]
      : []),
    ...(viewStore.isConstrainedWidth ? [taskActions.editDate] : []),
    taskActions.toggle(),
    ...(isCurrentlyFocusing ? [] : [taskActions.focusNow])
  ];
  return [
    {
      group: "primary",
      items: [...primaryItems]
    },
    {
      group: "more",
      items: [taskActions.trash()]
    }
  ];
}
