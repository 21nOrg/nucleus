<svelte:options runes={true} />

<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import type { Snippet } from "svelte";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import { onMount } from "svelte";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";

  import { Action } from "@nucleum/client/config/action.enum";
  import Tabs from "@21n/layout/topNav/tabs/Tabs.svelte";
  import { tabs, vTrail } from "@21n/layout/topNav/tabs/tabs.store";
  import TrailLeftIndicator from "@21n/layout/topNav/TrailLeftIndicator.svelte";
  import { fly } from "svelte/transition";
  import { quadIn } from "svelte/easing";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { page } from "$app/stores";
  import TopBarResourceItem from "@21n/layout/topNav/tabs/TopBarResourceItem.svelte";
  import { cn } from "@21n/utils/ui.utils";

  import TopNavLeftMenuItem from "@21n/layout/topNav/TopNavLeftMenuItem.svelte";
  import InlineSyncingFeedback from "@21n/elements/feedback/InlineSyncingFeedback.svelte";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import TopNavLeftLogo from "@21n/layout/topNav/TopNavLeftLogo.svelte";
  import { Embed } from "@nucleum/client/runtime/context.type";
  import context from "@nucleum/stores/context.store";
  import OfflineStatusMessage from "@21n/elements/feedback/OfflineStatusMessage.svelte";
  import { isValidArrayWithData } from "@21n/shared-utils/obj.utils";
  import { toasts } from "@nucleum/stores/notification.store";
  import ToastNotificationContent from "@21n/elements/feedback/ToastNotificationContent.svelte";
  import { bulkEditStore } from "@nucleum/stores/resources/bulkedit.store";
  import BulkEditBar from "@nucleum/application/record/BulkEditBar.svelte";
  import { InputStyle } from "@21n/elements/input/input.type";

  import SearchInput from "@nucleum/application/search/SearchInput.svelte";
  import { searchStore } from "@nucleum/application/search/search.store";
  let { topnav }: { topnav?: Snippet } = $props();
  let pinnedItems = $state<IRecordId[]>(tabs.get() ?? []);
  let bulkEditCount = $state(0);
  let bulkEditContext = $state<any>(null);
  let bulkEditSubContext = $state<string | undefined>(undefined);
  const isDev = import.meta.env.DEV;
  let searchInputRef = $state<SearchInput>();
  let isSearchMode = $state(
    new URLSearchParams(window.location.search).get(AccessMode.MAIN) ===
      Action.SEARCH
  );
  let isShowBackToSearch = $state(
    $vTrail.base === Action.SEARCH &&
      new URLSearchParams(window.location.search).get(AccessMode.POP) !== null
  );
  let currentSearchParams = $state(new URLSearchParams(window.location.search));

  let currentTab = $derived(currentSearchParams.get(AccessMode.TAB));
  let isInterimTab = $derived(
    !!currentTab && !pinnedItems.some((x) => x.toString() === currentTab)
  );

  let isRightOverlayMode = $derived(isValidArrayWithData($toasts));
  let isFullOverlayMode = $derived(bulkEditCount > 0 || isSearchMode);

  onMount(() => {
    const unsubscribe = uiState.subscribe((x) => {
      void x;
      queueMicrotask(() => {
        pinnedItems = tabs.get() ?? [];
      });
    });
    const bulkEditCountUnsub = bulkEditStore.count.subscribe((count) => {
      queueMicrotask(() => {
        bulkEditCount = count;
      });
    });
    const bulkEditContextUnsub = bulkEditStore.context.subscribe((ctx) => {
      queueMicrotask(() => {
        bulkEditContext = ctx;
      });
    });
    const bulkEditSubContextUnsub = bulkEditStore.subContext.subscribe(
      (sub) => {
        queueMicrotask(() => {
          bulkEditSubContext = sub;
        });
      }
    );

    const pageSub = page.subscribe((p) => {
      queueMicrotask(() => {
        currentSearchParams = p?.url?.searchParams ?? new URLSearchParams();
        isSearchMode =
          currentSearchParams.get(AccessMode.MAIN) === Action.SEARCH &&
          !currentSearchParams.get(AccessMode.POP);
        isShowBackToSearch =
          $vTrail.base === Action.SEARCH &&
          currentSearchParams.get(AccessMode.POP) !== null;
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
      if (bulkEditCountUnsub) bulkEditCountUnsub();
      if (bulkEditContextUnsub) bulkEditContextUnsub();
      if (bulkEditSubContextUnsub) bulkEditSubContextUnsub();
      if (pageSub) pageSub();
    };
  });
</script>

<div class="hidden otopl:!block w-full min-h-6 h-6 bg-bgs2"></div>
<div
  class={cn(
    "w-full h-12 max-h-12 min-h-11 bg-bgs2 userdata grid transition-all duration-200",
    {
      "grid-cols-[auto_1fr]": isFullOverlayMode,
      "border-b border-brs3": !$context.experiments?.isEnableRoundedMain
    },
    !isFullOverlayMode && {
      "grid-cols-[auto_auto_1fr_auto]": pinnedItems.length > 0,
      "grid-cols-[auto_1fr_auto]": pinnedItems.length < 1
    }
  )}
>
  {#if $context.embed !== Embed.HANDSET}
    <TopNavLeftLogo action={Action.SETTINGS} />
  {/if}
  <!-- {#if !isFullOverlayMode}
    <div
      class={cn("flex h-full", {
        "border-r border-brs3": isShowBackToSearch
      })}
    >
      <TopNavLeftMenuItem
        action={Action.SEARCH}
        label={isShowBackToSearch ? "Back to search" : undefined}
        icon={isShowBackToSearch ? "back" : "search"}
        isFirstItem={true}
        isPreventDefault={true}
        onClick={() => {
          if (new URLSearchParams(window.location.search).get(AccessMode.POP)) {
            navigation.toggleSearchParam({
              [AccessMode.POP]: null,
              [AccessMode.MAIN]: Action.SEARCH
            });
            return;
          }
          navigation.toggleSearchParam({
            [AccessMode.MAIN]: Action.SEARCH
          });
        }}
      />
    </div>
    {#if pinnedItems.length > 0}
      <div
        class={cn(
          "flex items-center justify-start relative h-full flex-grow overflow-x-auto transition-opacity",
          {
            "opacity-80 hover:opacity-100":
              !isRightOverlayMode && !isFullOverlayMode,
            "opacity-60 hover:opacity-100": isRightOverlayMode
          }
        )}
      >
        <Tabs {pinnedItems} />
        <div
          class="absolute right-0 top-0 bottom-0 flex items-center pointer-events-none"
        >
          <div
            class={cn(
              "h-full flex items-center justify-end bg-gradient-to-r from-transparent via-bgs2 to-bgs2 px-2",
              {
                "w-12": !isRightOverlayMode,
                "w-24": isRightOverlayMode
              }
            )}
          ></div>
        </div>
      </div>
    {/if}
  {/if} -->
  {#if isRightOverlayMode || isFullOverlayMode}
    <!-- TODO - multiple toasts case -->
    <div
      class={cn(
        "text-b2 w-full flex items-center justify-end pr-3 !opacity-100"
      )}
      in:fly={isSearchMode
        ? { duration: 1 }
        : { duration: 200, y: -10, easing: quadIn }}
    >
      {#if isSearchMode}
        <button
          class="flex items-center gap-2 justify-between w-full h-full text-b2 text-fgs2"
        >
          <TopNavLeftMenuItem
            action={Action.SEARCH}
            icon="cross"
            tooltip="Close search"
            isFirstItem={true}
            isPreventDefault={true}
            onClick={() => {
              searchStore.reset();
            }}
          />
          <SearchInput
            bind:this={searchInputRef}
            style={InputStyle.PLAIN}
            isAutoFocus={true}
          />
        </button>
      {:else if $toasts.length > 0}
        <ToastNotificationContent notification={$toasts[$toasts.length - 1]} />
      {:else if bulkEditCount > 0 && bulkEditContext}
        <BulkEditBar
          count={bulkEditCount}
          context={bulkEditContext}
          subContext={bulkEditSubContext}
          onAction={(detail: { action: string; data?: any }) =>
            bulkEditStore.onAction(detail.action, detail.data)}
          onSelectAll={() => bulkEditStore.onSelectAll()}
          onClear={() => bulkEditStore.reset()}
        />
      {/if}
    </div>
  {:else}
    <div class="flex items-center justify-start h-full text-b3 text-fgs3 px-3">
      <!-- Toast, player, status, upcoming message, contextual action suggestions
      area (Default current time) -->
    </div>
    <div
      class="flex items-center justify-end h-full"
      in:fly={{ duration: 200, y: 10, easing: quadIn }}
    >
      {#if isInterimTab && currentTab}
        {#key currentTab}
          <TopBarResourceItem
            item={currentTab}
            onClick={() => {}}
            isInterimTab
            onClose={() => {
              navigation.goBack();
            }}
          />
        {/key}
      {/if}
      <div class="flex items-center px-2">
        <TrailLeftIndicator />
        <OfflineStatusMessage />
        <InlineSyncingFeedback
          resource={Resource.everything}
          isShorter={true}
          text="Syncing..."
        />
      </div>
      {@render topnav?.()}
      <TopNavLeftMenuItem action={Action.CMD} ariaLabel="Command bar" />
      <!-- <TopNavLeftMenuItem
        action={Action.NAVIGATOR}
        label="Navigator"
        isLastItem={true}
      /> -->
      <!-- <TopNavLeftMenuItem action={Action.SETTINGS} isLastItem={true} /> -->
      {#if isDev}
        <TopNavLeftMenuItem
          action={Action.RHOMBUS}
          label="Rhombus"
          tooltip="Rhombus on the side"
          isLastItem={true}
        />
      {/if}
    </div>
  {/if}
</div>
