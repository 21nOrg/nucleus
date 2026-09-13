<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { tick } from "svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import view from "@nucleum/stores/view.store";
  import type { IAction } from "@nucleum/client/config/action.type";
  import { ActionType } from "@nucleum/client/config/action.type";
  import { Action } from "@nucleum/client/config/action.enum";

  import { isValidArrayWithData } from "@21n/shared-utils/obj.utils";
  import CmdResultItem from "@nucleum/application/commandBar/CmdResultItem.svelte";
  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import type { ICommandAction } from "@nucleum/application/commandBar/cmd.type";
  let {
    search = "",
    onClose = void 0,
    onSearchAction = void 0
  }: {
    search?: string;
    onClose?: () => void;
    onSearchAction?: (action: ICommandAction) => void;
  } = $props();
  let selectedActionState = $state<ICommandAction | null>(null);
  const allActions = $derived.by(() => loadAllActions($appStore.actions));
  const filteredActions = $derived.by(() => {
    if (search) {
      return allActions.filter((x) =>
        x.cmdLabel.toLowerCase().includes(search.toLowerCase())
      );
    }
    return loadDefaultFilteredActions(allActions);
  });
  const selectedAction = $derived.by(() => {
    if (!filteredActions.length) return null;
    if (!selectedActionState) return filteredActions[0];
    return (
      filteredActions.find(findInList(selectedActionState)) ??
      filteredActions[0]
    );
  });
  export function moveSelection(direction: "up" | "down") {
    const currentIndex = filteredActions.findIndex(findInList(selectedAction));
    if (currentIndex === -1 || filteredActions.length === 0) return;
    let nextIndex = currentIndex;
    if (direction === "down") {
      nextIndex =
        currentIndex + 1 >= filteredActions.length ? 0 : currentIndex + 1;
    } else if (direction === "up") {
      nextIndex =
        currentIndex - 1 < 0 ? filteredActions.length - 1 : currentIndex - 1;
    }
    selectedActionState = filteredActions[nextIndex];
  }
  export async function select() {
    const resolvedAction =
      (selectedAction && filteredActions.find(findInList(selectedAction))) ??
      filteredActions[0];
    if (resolvedAction) {
      if (resolvedAction.type === ActionType.SEARCH_CMD) {
        onSearchAction?.(resolvedAction);
      } else {
        onClose?.();
        await tick();
        requireCommandHost().runAction(resolvedAction.action, {
          componentParams: {
            isCmdBarLaunch: true
          }
        });
      }
      let recentCommands = isValidArrayWithData(
        $userPreferences.recentCommands
      );
      if (recentCommands) {
        if (recentCommands.some(findInList(resolvedAction))) {
          recentCommands = recentCommands.filter(
            (x) => !findInList(resolvedAction)(x)
          );
        }
        recentCommands.unshift({
          action: resolvedAction.action,
          variant: resolvedAction.variant
        });
        recentCommands = recentCommands.slice(0, 5);
      } else {
        recentCommands = [
          {
            action: resolvedAction.action,
            variant: resolvedAction.variant
          }
        ];
      }
      userPreferences.setRecentCommands(recentCommands);
    }
  }

  function loadAllActions(rawActions: IAction[]) {
    const actions: ICommandAction[] = [];
    const isPortraitLibraryAvailable = rawActions.some(
      (action) => action.action === Action.LIBRARY_PORTRAIT
    );
    const primitive = rawActions.filter(
      (action) =>
        action.label &&
        !action.isInactive &&
        !action.isMeta &&
        !(!$view.isPortrait && action.action === Action.LIBRARY_PORTRAIT) &&
        !(
          $view.isPortrait &&
          isPortraitLibraryAvailable &&
          action.action === Action.LIBRARY
        ) &&
        (action.preCondition ? action.preCondition() : true)
    );
    primitive.forEach((action) => {
      const rawCmdLabel = action.cmdLabel ?? action.label;
      if (typeof rawCmdLabel === "string") {
        actions.push({
          ...action,
          cmdLabel: rawCmdLabel
        });
      } else if (Array.isArray(rawCmdLabel) && rawCmdLabel.length > 0) {
        actions.push(
          ...rawCmdLabel.map((x) => {
            return {
              ...action,
              variant: x.variant,
              cmdLabel: x.label
            };
          })
        );
      }
    });
    return actions;
  }
  function loadDefaultFilteredActions(allActions: ICommandAction[]) {
    const recentCommands = isValidArrayWithData(
      $userPreferences.recentCommands
    );
    if (recentCommands) {
      let filteredActions = allActions.filter(
        (x) => !recentCommands.some(findInList(x))
      );
      const recentActions = recentCommands
        .map((x) => allActions.find(findInList(x)))
        .filter(isCommandAction);
      return [...recentActions, ...filteredActions];
    }
    return allActions;
  }

  function isCommandAction(
    action: ICommandAction | undefined
  ): action is ICommandAction {
    return Boolean(action);
  }

  function isSameAction(toCheck: ICommandAction | null, item: ICommandAction) {
    if (
      !toCheck ||
      typeof toCheck !== "object" ||
      !item ||
      typeof item !== "object"
    )
      return false;
    if (toCheck.variant) {
      return item.action === toCheck.action && item.variant === toCheck.variant;
    }
    return item.action === toCheck.action;
  }

  function findInList(toCheck: ICommandAction | null) {
    if (!toCheck) return () => false;
    return (item: ICommandAction) => {
      return isSameAction(toCheck, item);
    };
  }
</script>

{#each filteredActions as action, index}
  <CmdResultItem
    {search}
    {action}
    {index}
    isActive={isSameAction(selectedAction, action)}
    onclick={() => {
      selectedActionState = action;
      select();
    }}
  />
{/each}
