<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import {
    reorderList,
    type DragDropEvent
  } from "@nucleum/actions/rearrange.action";
  import Button from "@21n/elements/button/Button.svelte";
  import InlineInfoBanner from "@21n/elements/text/InlineInfoBanner.svelte";
  import Text from "@21n/elements/text/Text.svelte";

  import { ButtonStyle } from "@21n/elements/button/button.type";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import { Size } from "@21n/elements/size.enum";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import { cn } from "@21n/utils/ui.utils";
  import {
    activeResourceFilterIgnoreAncestorInactive,
    archivedResourceFilter
  } from "@21n/utils/utils";
  import { isValidArrayWithData } from "@21n/shared-utils/obj.utils";
  import { datafn } from "@nucleum/datafn/datafn.store";

  import {
    resourceInList,
    shiftResourceInArray
  } from "@nucleum/datafn/resource.utils";
  import NestedList from "@nucleum/components/nestedList/NestedList.svelte";
  import { NestedListStyle } from "@nucleum/components/nestedList/nestedList.type";
  import type { IActiveObjectiveStore } from "@nucleum/features/focus/goals/goal.store";
  import {
    ObjectiveStatus,
    SubObjectivesLayout,
    type IObjective,
    ObjectiveType
  } from "@nucleum/features/focus/goals/goal.type";
  import { resolveObjectiveStatusIcon } from "@nucleum/features/focus/goals/goal.utils";
  import SubObjectiveItem from "@nucleum/features/focus/goals/sub/SubGoalItem.svelte";
  import SubObjectivesLayoutSwitcher from "@nucleum/features/focus/goals/sub/SubGoalsLayoutSwitcher.svelte";
  import { generateResourceId } from "@nucleum/datafn/id.utils";
  import { Resource } from "@nucleum/datafn/resource.enum";

  type IAddSubObjectiveItem = {
    label?: string;
    type: "add";
  };

  type IRenderedSubObjective = IObjective & {
    icon: string;
    isIconFilled: boolean;
  };

  type ISubObjectiveListItem = IRenderedSubObjective | IAddSubObjectiveItem;

  let {
    objective,
    isActiveResource = true
  }: {
    objective: IActiveObjectiveStore;
    isActiveResource?: boolean;
  } = $props();

  let isExpandArchiveSubObjectives = $state(false);
  let isHideCompleted = $state($objective.uiState?.isHideCompleted ?? false);

  function isSavedSubObjective(
    item: ISubObjectiveListItem
  ): item is IRenderedSubObjective {
    return "id" in item;
  }

  const _subObjectives = $derived([
    ...($objective.children
      ? $objective.children
          .filter(activeResourceFilterIgnoreAncestorInactive)
          .filter(
            isHideCompleted
              ? (t: IObjective) => t.status !== ObjectiveStatus.COMPLETED
              : (t: IObjective) => t
          )
          .map(
            (t: IObjective) =>
              ({
                ...t,
                icon: resolveObjectiveStatusIcon(t.status),
                isIconFilled: t.status === ObjectiveStatus.COMPLETED
              }) as IRenderedSubObjective
          )
      : []),
    ...($objective.subObjectivesLayout === SubObjectivesLayout.STEPS &&
    isActiveResource
      ? [
          {
            label: undefined,
            type: "add"
          } as IAddSubObjectiveItem
        ]
      : [])
  ]);

  const archivedSubObjectivesCount = $derived(
    $objective.children?.filter(archivedResourceFilter).length
  );

  const completedSubObjectivesCount = $derived(
    $objective.children?.filter(
      (t: IObjective) => t.status === ObjectiveStatus.COMPLETED
    ).length
  );

  function onSubObjectiveClick(id: IRecordId, event?: MouseEvent) {
    navigation.resourceClickHandler(event, id, {
      replaceId: $objective.id
    });
  }

  function resolveAddSubObjectiveLabel(
    payload: { label?: string } | CustomEvent<{ label: string }>
  ) {
    return payload instanceof CustomEvent
      ? payload.detail.label
      : payload.label;
  }

  function resolveObjectiveParentPath(
    parent?: Pick<IObjective, "id" | "parentPath">
  ) {
    if (!parent?.id) return "";
    return parent.parentPath
      ? `${parent.parentPath}-${parent.id}`
      : parent.id.toString();
  }

  async function createSubObjective(label: string, parent: IObjective) {
    const newObjective = {
      id: generateResourceId(Resource.objective),
      label,
      type: ObjectiveType.INDEFINITE,
      status: ObjectiveStatus.NOT_STARTED,
      isPinnedForQuickFocus: false,
      parentId: parent.id,
      parentPath: resolveObjectiveParentPath(parent),
      sortOrder: parent.children?.length ?? 0
    } as IObjective;
    await datafn.objective.mutate({
      operation: "insert",
      id: newObjective.id.toString(),
      record: newObjective
    });
    return newObjective;
  }

  async function onAddSubObjective(
    payload: { label?: string } | CustomEvent<{ label: string }>
  ) {
    const label = resolveAddSubObjectiveLabel(payload);
    const newObjective = await createSubObjective(label ?? "", $objective);
    $objective.children = [...($objective.children || []), newObjective];
  }

  async function onAddSubObjectiveFromNestedList({
    id,
    label
  }: {
    id: IRecordId;
    label?: string;
  }) {
    const parentResult = await datafn.objective.query({
      select: ["*", "children.*"],
      filters: {
        id: id.toString()
      },
      limit: 1
    });
    const parent = parentResult.data[0] as IObjective | undefined;
    if (parent) await createSubObjective(label ?? "", parent);
  }

  async function resolveSubObjectives(id: IRecordId) {
    const result = await datafn.objective.query({
      select: ["children.*"],
      filters: {
        id: id.toString()
      }
    });
    if (!isValidArrayWithData(result.data)) return [];
    const children = (result.data[0] as IObjective | undefined)?.children;
    if (children)
      return (
        children
          ?.filter(activeResourceFilterIgnoreAncestorInactive)
          ?.map((t: IObjective) => t.id) ?? []
      );
    else return [];
  }

  async function resolveContent(id: IRecordId) {
    const item = _subObjectives.find(
      (subObjective): subObjective is IRenderedSubObjective =>
        isSavedSubObjective(subObjective) && resourceInList(id)(subObjective)
    );
    if (item)
      return {
        label: item.label ?? "",
        childrenCount: item.children?.length ?? 0,
        color: item.color,
        icon: item.icon,
        isIconFilled: item.isIconFilled
      };
    const result = await datafn.objective.query({
      filters: {
        id: id.toString()
      },
      limit: 1
    });
    const objective = result.data[0] as IObjective | undefined;
    if (objective)
      return {
        label: objective.label ?? "",
        childrenCount: objective.children?.length ?? 0,
        color: objective.color,
        icon: resolveObjectiveStatusIcon(objective.status),
        isIconFilled: objective.status === ObjectiveStatus.COMPLETED
      };
    return {
      label: "",
      childrenCount: 0,
      icon: resolveObjectiveStatusIcon(ObjectiveStatus.NOT_STARTED),
      isIconFilled: false
    };
  }

  async function onReorderSubObjectives(event: DragDropEvent) {
    const { fromId, toId } = event;
    if (!fromId || !toId || fromId === toId || !$objective.children) return;
    $objective.children = shiftResourceInArray(
      $objective.children,
      fromId,
      toId
    );
    const reorderedSubObjectives = shiftResourceInArray(
      _subObjectives,
      fromId,
      toId
    );
    const subObjectives = reorderedSubObjectives
      .filter(isSavedSubObjective)
      .map((t) => t.id)
      .filter((id): id is IRecordId => Boolean(id));
    await Promise.all(
      subObjectives.map((id, sortOrder) =>
        datafn.objective.mutate({
          operation: "merge",
          id: id.toString(),
          record: {
            id: id.toString(),
            sortOrder
          }
        })
      )
    );
  }

  function onSubObjectivesMethodChange(e: any) {
    void e;
    objective.modify({
      subObjectivesLayout: $objective.subObjectivesLayout
    });
  }

  function onHideCompletedChange(e: any) {
    isHideCompleted = !isHideCompleted;
    objective.modify({
      uiState: {
        ...($objective.uiState ?? {}),
        isHideCompleted
      }
    });
  }
</script>

{#if !isActiveResource}
  <div class="flex w-full pt-2 pb-4 justify-center">
    <InlineInfoBanner
      content="You can't add sub-objectives to this objective when it is archived/deleted/inactive."
      icon="warning"
    />
  </div>
{/if}
{#if _subObjectives}
  <div class="flex items-center justify-end gap-4 w-full px-3">
    {#if $objective.subObjectivesLayout !== SubObjectivesLayout.STEPS && completedSubObjectivesCount}
      <Button
        icon={isHideCompleted ? "show" : "hide"}
        tooltip={`${isHideCompleted ? "Show" : "Hide"} completed (${completedSubObjectivesCount})`}
        size={Size.sm}
        style={ButtonStyle.PLAIN}
        onclick={onHideCompletedChange}
      />
    {/if}
    <SubObjectivesLayoutSwitcher
      bind:layout={$objective.subObjectivesLayout}
      onSelect={onSubObjectivesMethodChange}
    />
  </div>
  <div
    class={cn("flex flex-col cw:px-2 userdata text-b2", {
      "gap-6": $objective.subObjectivesLayout === SubObjectivesLayout.STEPS,
      "gap-2": $objective.subObjectivesLayout === SubObjectivesLayout.DEFAULT
    })}
    use:reorderList={{
      listId: "subObjectives",
      draggedOverClass: "!border-ccs1",
      onDrop: onReorderSubObjectives,
      dragImage: "dragimage"
    }}
  >
    {#if !$objective.subObjectivesLayout || $objective.subObjectivesLayout === SubObjectivesLayout.DEFAULT}
      <NestedList
        items={_subObjectives.filter(isSavedSubObjective).map((t) => t.id)}
        contentCallback={resolveContent}
        childrenCallback={resolveSubObjectives}
        style={NestedListStyle.DEFAULT}
        isShowAddTextInput={isActiveResource}
        onClick={({ id, event }) => {
          onSubObjectiveClick(id, event);
        }}
        onAddAction={onAddSubObjective}
        onAddSub={onAddSubObjectiveFromNestedList}
        addPlaceholder="Add new sub-objective"
      />
    {:else}
      {#each _subObjectives as subObjective, index (isSavedSubObjective(subObjective) ? subObjective.id : subObjective.type)}
        <SubObjectiveItem
          {subObjective}
          {index}
          totalLength={_subObjectives.length}
          method={$objective.subObjectivesLayout}
          onClick={(e) => {
            if (isSavedSubObjective(subObjective)) {
              onSubObjectiveClick(subObjective.id, e);
            }
          }}
          onAdd={onAddSubObjective}
        />
      {/each}
    {/if}
  </div>
{/if}
{#if archivedSubObjectivesCount}
  <div class="flex w-full justify-center">
    <button
      class={cn(
        "flex items-center justify-center gap-2 text-b3 text-fgs3 rounded-md p-2",
        {
          "notouch:hover:bg-bgs2 active:bg-bgs2": !isExpandArchiveSubObjectives,
          "bg-bgs2": isExpandArchiveSubObjectives
        }
      )}
      onclick={() => {
        isExpandArchiveSubObjectives = !isExpandArchiveSubObjectives;
      }}
    >
      + {archivedSubObjectivesCount} archived sub-objectives
    </button>
  </div>

  {#if isExpandArchiveSubObjectives}
    {@const archiveSubObjectives = $objective.children?.filter(
      archivedResourceFilter
    )}
    {#if archiveSubObjectives && isValidArrayWithData(archiveSubObjectives)}
      <div class="flex flex-col gap-2 p-4">
        <Text
          content="Archived sub-objectives"
          style={TextStyle.SECTION_HEADING}
        />
        <div class="flex flex-col userdata">
          {#each archiveSubObjectives as child, index}
            <SubObjectiveItem
              subObjective={child}
              {index}
              totalLength={archiveSubObjectives.length}
              onClick={(e) => {
                onSubObjectiveClick(child.id, e);
              }}
            />
          {/each}
        </div>
      </div>
    {/if}
  {/if}
{/if}
