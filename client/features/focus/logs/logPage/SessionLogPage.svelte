<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import Markdown from "@nucleum/features/memory/markdown/Markdown.svelte";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import { Size } from "@21n/elements/size.enum";
  import { isValidMarkdown } from "@nucleum/features/memory/markdown/validation.utils";
  import LogIntervalBar from "@nucleum/features/focus/logs/logPage/LogIntervalBar.svelte";
  import LogTotals from "@nucleum/features/focus/logs/logPage/LogTotals.svelte";
  import PanelSwitcher from "@21n/elements/switcher/PanelSwitcher.svelte";
  import {
    PanelSwitcherActiveItemStrength,
    PanelSwitcherStyle
  } from "@21n/elements/switcher/switcher.enum";
  import Text from "@21n/elements/text/Text.svelte";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import ModalFooter from "@21n/elements/modal/ModalFooter.svelte";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  import FocusItem from "@nucleum/features/focus/elements/focusitem/FocusItem.svelte";

  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import {
    formatDatetime,
    formatTime,
    isSameDateTime
  } from "@21n/utils/time.utils";
  import InlineInfoBanner from "@21n/elements/text/InlineInfoBanner.svelte";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import view from "@nucleum/stores/view.store";
  import {
    SessionType,
    type ISession
  } from "@nucleum/features/focus/logs/log.type";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import Button from "@21n/elements/button/Button.svelte";
  import ModalContentPadded from "@21n/elements/modal/ModalContentPadded.svelte";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import { toSvelteStore } from "@datafn/svelte";
  import type { IMarkdown } from "@nucleum/features/memory/markdown/md.type";
  import { resolveSessionFocusView } from "@nucleum/features/focus/logs/session-items.utils";

  let {
    id,
    log = $bindable(),
    accessMode = AccessMode.POP
  }: {
    id: string;
    log?: any;
    accessMode?: AccessMode;
  } = $props();
  let selectedTab = $state<"Summary" | "Notes">("Summary");
  const sessionStore = $derived.by(() =>
    toSvelteStore<ISession[]>(
      datafn.session.signal({
        select: ["*", "items.*#"],
        filters: { id },
        limit: 1
      }),
      { initialData: [] }
    )
  );
  const currentLog = $derived(($sessionStore.data[0] as ISession) ?? log);
  const sessionFocusView = $derived(resolveSessionFocusView(currentLog?.items));
  const logItems = $derived(sessionFocusView.allFocusItems);
  const focusItems = $derived(sessionFocusView.topLevelFocusItems);
  const objectives = $derived(sessionFocusView.objectives);
  const tasks = $derived(sessionFocusView.tasks);
  const currentNotes = $derived(
    (currentLog?.notes ?? { blocks: [] }) as IMarkdown
  );
  const isLoadingState = $derived(
    $sessionStore.loading || $sessionStore.refreshing
  );

  $effect(() => {
    if ($sessionStore.data[0]) log = $sessionStore.data[0];
  });
</script>

{#if isLoadingState || !currentLog}
  <EmptyStatusView
    {isLoadingState}
    mainText="Session log not found"
    loadingText="Loading..."
  />
{:else}
  <div
    class="flex flex-col gap-6 flex-grow w-full max-w-3xl items-center userdata otop:pt-12"
  >
    <ModalContentPadded
      class="flex flex-col gap-6 flex-grow w-full items-center"
    >
      <div class="flex gap-4 w-full items-center justify-between">
        <Text content="Session details" style={TextStyle.PANEL_HEADING} />
        {#if accessMode === AccessMode.SPLIT || accessMode === AccessMode.FSPLIT || $view.isConstrainedWidth}
          <Button
            icon="cross"
            style={ButtonStyle.OUTLINED}
            tooltip="Close"
            onclick={() => navigation.closeResource({ accessMode })}
          />
        {/if}
      </div>
      <LogIntervalBar log={currentLog} />
      {#if currentLog?.plannedEndUnix && !isSameDateTime( new Date(currentLog.endUnix), new Date(currentLog.plannedEndUnix), { isIgnoreSeconds: true } ) && new Date(currentLog.endUnix).getTime() < new Date(currentLog.plannedEndUnix).getTime()}
        <InlineInfoBanner>
          <span>
            This Session was planned to end at <b>
              {formatTime(
                $userPreferences,
                new Date(currentLog.plannedEndUnix)
              )}</b
            >
            but was finished early at
            <b>{formatTime($userPreferences, new Date(currentLog.endUnix))}.</b>
          </span>
        </InlineInfoBanner>
      {/if}
      {#if currentLog.type === SessionType.MANUAL_ENTRY && currentLog.updatedAt}
        <span class="text-fgs2 text-b2">
          This session was created from a manual entry at
          <b
            >{formatDatetime(
              $userPreferences,
              new Date(currentLog.updatedAt)
            )}</b
          >
        </span>
      {/if}
      <div class="flex flex-col gap-6 w-full flex-grow items-center">
        <div>
          <PanelSwitcher
            items={["Summary", "Notes"]}
            style={PanelSwitcherStyle.TRAIN}
            bind:value={selectedTab}
            activeItemStrength={PanelSwitcherActiveItemStrength.SUBTLE}
          />
        </div>
        {#if selectedTab === "Notes" && isValidMarkdown(currentNotes)}
          <div class="flex flex-col h-full w-full rounded-md overflow-auto">
            <Markdown
              md={currentNotes}
              params={{
                isReadOnly: true,
                actions: ["copy"],
                title: "Think Notes"
              }}
            />
          </div>
        {:else if selectedTab === "Notes"}
          <EmptyStatusView
            size={Size.sm}
            subText="No notes taken during this session"
          />
        {:else}
          <div class="flex flex-col gap-6 overflow-auto w-full flex-grow">
            <LogTotals log={currentLog} />
            <div class="flex flex-col items-start gap-2 w-full">
              <Text content="Focus items" style={TextStyle.SECTION_HEADING} />
              <div class="flex flex-col gap-2 h-full w-full pb-40">
                {#if logItems.length > 0}
                  {#each focusItems as item (item.id)}
                    <FocusItem
                      focusItem={item}
                      {objectives}
                      {tasks}
                      focusItemsList={logItems}
                      intervals={currentLog.blocks}
                      contxt="history"
                    />
                  {/each}
                {:else}
                  <EmptyStatusView
                    size={Size.sm}
                    {isLoadingState}
                    subText="No focus items found"
                  />
                {/if}
              </div>
            </div>
          </div>
        {/if}
      </div>
    </ModalContentPadded>

    <ModalFooter
      action={Resource.session + "-resource"}
      primaryAction={{
        label: "Delete session",
        icon: "trash",
        variant: ButtonVariant.DANGER,
        callback: async () => {
          requireCommandHost().runAction(PointronAction.DELETE_SESSION, {
            componentParams: { id }
          });
        }
      }}
      secondaryAction={{
        label: "Close",
        icon: "cross",
        callback: async () => navigation.closeResource({ accessMode })
      }}
    />
  </div>
{/if}
