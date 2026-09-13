<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { onMount } from "svelte";
  import Icon from "@21n/elements/Icon.svelte";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import { Size } from "@21n/elements/size.enum";
  import view from "@nucleum/stores/view.store";
  import SessionLogPage from "@nucleum/features/focus/logs/logPage/SessionLogPage.svelte";
  import BackButton from "@21n/elements/button/BackButton.svelte";
  import { postMessageToParent } from "@nucleum/client/runtime/embed/embed.utils";
  import { EmbedMessage } from "@nucleum/client/runtime/embed/embedMessage.enum";
  import { LoadingAnimationType } from "@21n/elements/feedback/feedback.type";
  import DatePicker from "@21n/elements/datetime/DatePicker.svelte";
  import LogThumbnailItem from "@nucleum/features/focus/logs/LogThumbnailItem.svelte";
  import DaySummaryPart from "@nucleum/features/focus/logs/daySummary/DaySummaryPart.svelte";

  import ScrollView from "@21n/layout/scrollView/ScrollView.svelte";
  import type {
    DaySummary,
    ISessionThumb
  } from "@nucleum/features/focus/logs/log.type";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { resourceInList } from "@nucleum/datafn/resource.utils";
  import { resolveSessionTimeSplit } from "@nucleum/features/focus/composition.utils";
  import { generateSummary } from "@nucleum/features/focus/session.utils";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import { time } from "@datafn/client";
  import { toSvelteStore } from "@datafn/svelte";
  import { resolveExpandedSessionItems } from "@nucleum/features/focus/logs/session-items.utils";

  let {
    date = $bindable(new Date()),
    context = "logs"
  }: {
    date?: Date;
    context?: "journal" | "logs";
  } = $props();
  let selectedId = $state<string | undefined>(undefined);
  const sessionStore = $derived.by(() =>
    toSvelteStore<ISessionThumb[]>(
      datafn.session.signal({
        select: ["*", "items.*#"],
        temporal: time.day("startUnix", date),
        sort: ["startUnix"],
        metadata: {
          includeTrashed: true,
          includeArchived: true
        }
      }),
      { initialData: [] }
    )
  );
  const sessions = $derived.by(() =>
    $sessionStore.data.map((session) => ({
      ...session,
      expandedItems: resolveExpandedSessionItems(session.items),
      splits: resolveSessionTimeSplit(session)
    }))
  );
  const summary: DaySummary = $derived(generateSummary(sessions));
  const isLoading = $derived($sessionStore.loading || $sessionStore.refreshing);

  onMount(() => {
    postMessageToParent(EmbedMessage.SHEET_MOUNTED);
  });
</script>

{#if selectedId}
  <div class="flex flex-col items-start gap-4 h-full">
    <div class="h-10">
      <BackButton
        text="Back to all logs"
        onclick={() => {
          selectedId = undefined;
        }}
      />
    </div>
    <SessionLogPage
      id={selectedId}
      log={sessions.find(resourceInList(selectedId))}
    />
  </div>
{:else}
  <div
    class="relative flex flex-col gap-4 items-center w-full flex-grow overflow-y-auto"
  >
    {#if context === "logs"}
      <div class="flex w-full justify-start items-center gap-8">
        <div class="flex grow justify-between gap-4 px-4">
          <Icon
            icon="chevron-left"
            size={Size.lg}
            onclick={() => {
              let newDate = new Date(date.getTime());
              newDate.setDate(newDate.getDate() - 1);
              date = newDate;
            }}
          />
          <DatePicker
            variant="wide-center"
            bind:date
            onChange={(e) => {
              date = e.detail;
            }}
          />
          <Icon
            icon="chevron-right"
            size={Size.lg}
            onclick={() => {
              let newDate = new Date(date.getTime());
              newDate.setDate(date.getDate() + 1);
              date = newDate;
            }}
          />
        </div>
      </div>
    {/if}
    {#if !isLoading && sessions.length > 0}
      <DaySummaryPart {summary} />
      <ScrollView
        class={{
          "w-full flex flex-col gap-4 flex-grow": true,
          "px-2": $view.isPortrait && context === "logs",
          "px-8": !$view.isPortrait && context === "logs"
        }}
      >
        {#each sessions as session, index}
          <LogThumbnailItem
            {session}
            {context}
            isLast={index === sessions.length - 1}
            onclick={() => {
              if (context === "journal") {
                navigation.openResource(session.id, AccessMode.POP);
                return;
              }
              selectedId = session.id;
            }}
          />
        {/each}
      </ScrollView>
    {:else}
      <EmptyStatusView
        size={Size.sm}
        loadingAnimation={LoadingAnimationType.LOGS_PULSE}
        isSearchContext={true}
        pulseCount={2}
        isLoadingState={isLoading}
        mainText="No sessions found"
        subText="Please select a different date to see focus sessions"
      />
    {/if}
  </div>
{/if}
