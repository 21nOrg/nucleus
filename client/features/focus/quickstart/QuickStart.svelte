<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { onMount } from "svelte";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import { Size } from "@21n/elements/size.enum";
  import { Layout } from "@21n/layout/layout-mode.type";
  import { PointronAction } from "@nucleum/client/config/focus-action.enum";

  import Button from "@21n/elements/button/Button.svelte";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import { UIState, UIStateScope } from "@nucleum/stores/uiState/uiState.type";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import InlineSearchBar from "@21n/elements/InlineSearchBar.svelte";
  import context from "@nucleum/stores/context.store";
  import { Embed } from "@nucleum/client/runtime/context.type";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import type { IObjectiveThumb } from "@nucleum/features/focus/goals/goal.type";
  import { isValidArray } from "@21n/shared-utils/obj.utils";
  import {
    isSameResource,
    resourceAction
  } from "@nucleum/datafn/resource.utils";
  import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
  import { resolveObjectiveColor } from "@nucleum/features/focus/goals/goal.utils";
  import { LoadingAnimationType } from "@21n/elements/feedback/feedback.type";
  import ScrollViewBottomSpacer from "@21n/layout/scrollView/ScrollViewBottomSpacer.svelte";
  import QuickStartThumbnailList from "@nucleum/features/focus/quickstart/QuickStartThumbnailList.svelte";
  import view from "@nucleum/stores/view.store";
  import QuickStartLayoutToggle from "@nucleum/features/focus/quickstart/actions/QuickStartLayoutToggle.svelte";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import { toSvelteStore } from "@datafn/svelte";
  import { time } from "@datafn/client";
  import type { ISessionLog } from "@nucleum/features/focus/logs/log.type";

  let isLoadingState = $state(false);
  let searchQuery = $state("");
  let layout = $state(Layout.LIST);
  let isInEditMode = $state(false);
  restoreLayoutState();
  let searchPinnedItems = $state<IObjectiveThumb[]>([]);
  let searchUnpinnedItems = $state<IObjectiveThumb[]>([]);
  const pinnedObjectiveStore = toSvelteStore<IObjectiveThumb[]>(
    datafn.objective.signal({
      select: ["*", "parent.*"],
      filters: {
        id: { $ne: "" },
        isPinnedForQuickFocus: true
      },
      metadata: {
        includeTrashed: true,
        includeArchived: true
      }
    }),
    { initialData: [] }
  );
  const currentDayLogStore = toSvelteStore<ISessionLog[]>(
    datafn.sessionLog.signal({
      select: ["id", "objectiveId", "focus", "breakTime", "startUnix"],
      temporal: time.day("startUnix", new Date())
    }),
    { initialData: [] }
  );
  const items = $derived(
    resolvePinnedItems($pinnedObjectiveStore.data, $currentDayLogStore.data)
  );
  const isLoading = $derived(
    isLoadingState ||
      (!searchQuery &&
        ($pinnedObjectiveStore.loading || $currentDayLogStore.loading))
  );

  onMount(() => {
    const sub = uiState.subscribe((x) => {
      restoreLayoutState();
    });
    return () => {
      sub();
    };
  });

  function restoreLayoutState() {
    const layoutState = uiState.getState(UIState.quickFocusLayout, {
      scope: UIStateScope.DEVICE
    });
    layout = layoutState ?? Layout.LIST;
  }

  function resolvePinnedItems(
    objectives: IObjectiveThumb[],
    logs: ISessionLog[]
  ) {
    return objectives
      .map((objective: IObjectiveThumb) => ({
        ...objective,
        color: resolveObjectiveColor(objective),
        focus: logs
          .filter((log) =>
            log.objectiveId
              ? isSameResource(log.objectiveId, objective.id)
              : false
          )
          .reduce((total, log) => total + (log.focus ?? 0), 0)
      }))
      .sort((a: IObjectiveThumb, b: IObjectiveThumb) => {
        if (a.color === b.color) {
          return (a.label ?? "").localeCompare(b.label ?? "");
        }
        if (a.color === undefined) return 1;
        if (b.color === undefined) return -1;
        return a.color - b.color;
      });
  }

  async function onSearch(val: string) {
    if (!val) {
      searchQuery = "";
      searchPinnedItems = [];
      searchUnpinnedItems = [];
      return;
    }
    isLoadingState = true;
    searchQuery = val;
    const result = await datafn.objective.query({
      select: ["*", "parent.*"],
      search: searchQuery
        ? { query: searchQuery, fields: ["label"] }
        : undefined,
      filters: {
        id: { $ne: "" }
      }
    });
    if (isValidArray(result.data)) {
      const allItems = result.data.map((x: any) => ({
        ...x,
        color: resolveObjectiveColor(x)
      }));
      searchPinnedItems = allItems.filter((x: any) => x.isPinnedForQuickFocus);
      searchUnpinnedItems = allItems.filter(
        (x: any) => !x.isPinnedForQuickFocus
      );
    }
    isLoadingState = false;
  }

  function handleUnpin(event: CustomEvent<string>) {
    searchPinnedItems = searchPinnedItems.filter(
      (x) => x.id?.toString() !== event.detail?.toString()
    );
    searchUnpinnedItems = searchUnpinnedItems.filter(
      (x) => x.id?.toString() !== event.detail?.toString()
    );
  }

  function createNewGoal(isPreventOpenAfterCreate: boolean = true) {
    requireCommandHost().runAction(
      resourceAction(Resource.objective, ResourceActionType.CREATE),
      {
        componentParams: {
          isQuickFocus: true,
          context: PointronAction.PIN_TO_QUICK_FOCUS,
          label: searchQuery,
          isPreventOpenAfterCreate
        }
      }
    );
  }
</script>

<div
  class="flex flex-col flex-grow gap-4 w-full"
  data-testid="quick-focus-panel"
>
  <InlineSearchBar
    query={searchQuery}
    isPadded={true}
    {onSearch}
    placeholder="Search an objective to quick focus"
    testId="quick-focus-search"
    onEnter={() => createNewGoal()}
    padding={$context.embed === Embed.HANDSET || $view.isConstrainedWidth
      ? "pl-4 pr-2"
      : undefined}
  >
    {#if $context.embed === Embed.HANDSET || $view.isConstrainedWidth}
      <div class="flex justify-center shrink-0">
        <QuickStartLayoutToggle />
      </div>
    {/if}
  </InlineSearchBar>
  {#if !isLoading && ((items.length > 0 && !searchQuery) || (searchQuery && (searchPinnedItems.length > 0 || searchUnpinnedItems.length > 0)))}
    {#if searchQuery}
      <div class="flex flex-col gap-12">
        <QuickStartThumbnailList
          items={searchPinnedItems}
          {layout}
          {isInEditMode}
          title="Pinned"
          emptyStatusText={`No pinned objectives found with "${searchQuery}"`}
          onUnpin={handleUnpin}
        />
        <QuickStartThumbnailList
          items={searchUnpinnedItems}
          {layout}
          {isInEditMode}
          title="Other objectives"
          emptyStatusText={`No other objectives found with "${searchQuery}"`}
          onUnpin={handleUnpin}
        />
      </div>
    {:else}
      <QuickStartThumbnailList
        {items}
        {layout}
        {isInEditMode}
        onUnpin={handleUnpin}
      />
    {/if}
    <div class="flex flex--col gap-2 w-full justify-center items-center">
      {#if isInEditMode}
        <Button
          label="Pin another objective"
          size={Size.sm}
          type={ButtonVariant.PRIMARY}
          style={ButtonStyle.OUTLINED}
          onclick={() => {
            requireCommandHost().runAction(PointronAction.PIN_TO_QUICK_FOCUS);
          }}
        />
      {/if}
      <Button
        label={isInEditMode ? "Close editor" : "Edit"}
        size={Size.sm}
        style={ButtonStyle.OUTLINED}
        isPreventMinWidth={true}
        onclick={() => (isInEditMode = !isInEditMode)}
      />
    </div>
    <ScrollViewBottomSpacer />
  {:else}
    <EmptyStatusView
      size={Size.sm}
      isLoadingState={isLoading}
      isSearchContext={true}
      loadingAnimation={layout !== Layout.LIST
        ? LoadingAnimationType.QUICK_FOCUS_ITEMS_GRID_PULSE
        : LoadingAnimationType.FOCUS_ITEMS_PULSE}
      mainText={searchQuery
        ? `No objectives found for "${searchQuery}"`
        : "No pinned objectives found"}
      subText={searchQuery
        ? "Press **Enter** to create a new objective & pin it here"
        : "Please create a new objective or pin an existing one"}
      actionText={"Create new objective"}
      secondaryActionText="Pin existing"
      onclick={() => createNewGoal(false)}
      onSecondaryClick={() => {
        requireCommandHost().runAction(PointronAction.PIN_TO_QUICK_FOCUS);
      }}
    />
  {/if}
</div>
