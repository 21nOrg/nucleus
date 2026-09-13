<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { activeSession } from "@nucleum/features/focus/session.store";
  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  import { SessionUIContext } from "@nucleum/features/focus/session.type";
  import {
    SessionCompositionType,
    type SessionComposition
  } from "@nucleum/features/focus/sessionComposition.type";
  import { SessionState } from "@nucleum/features/focus/sessionState.enum";
  import { SessionType } from "@nucleum/features/focus/logs/log.type";
  import { currentTime } from "@nucleum/stores/app.store";
  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import { formatTime } from "@21n/utils/time.utils";
  import { onMount } from "svelte";
  import { cn } from "@21n/utils/ui.utils";
  let {
    label = "start",
    context = SessionUIContext.DEFAULT,
    composition = undefined,
    plannedDuration = undefined,
    sessionType = undefined
  }: {
    label?: "start" | "end";
    context?: SessionUIContext;
    composition?: SessionComposition;
    plannedDuration?: number;
    sessionType?: SessionType;
  } = $props();
  let resolvedComposition = $derived(composition ?? $activeSession.composition);
  let resolvedPlannedDuration = $derived(
    plannedDuration ?? $activeSession.plannedDuration
  );
  let resolvedSessionType = $derived(sessionType ?? $activeSession.type);
  let timeClassList = "";
  let labelClassList = "";
  let labelRef: HTMLElement;
  onMount(() => {
    if (context === SessionUIContext.ZEN_ON_DESKTOP) {
      timeClassList = "text-h4";
    } else if ($activeSession.state === SessionState.NOT_STARTED) {
      timeClassList = "text-base";
    } else {
      timeClassList = "text-base";
    }
    labelClassList =
      context === SessionUIContext.ZEN_ON_DESKTOP
        ? "text-b2"
        : $activeSession.state === SessionState.NOT_STARTED
          ? "text-b4"
          : "text-b3";
  });
</script>

<div
  bind:this={labelRef}
  class={cn("flex flex-col min-w-fit", {
    "relative bottom-2.5": context !== SessionUIContext.PIP,
    "items-start": label === "start",
    "items-end": label === "end"
  })}
>
  {#if label === "start"}
    {#if context !== SessionUIContext.PIP}
      <div class={cn("text-fgs3", labelClassList)}>
        {$activeSession.state === SessionState.NOT_STARTED ? "Now" : "Start"}
      </div>
    {/if}
    <div class={timeClassList}>
      {#if $activeSession.state == SessionState.NOT_STARTED && $currentTime}
        {formatTime($userPreferences, $currentTime)}
      {:else if $activeSession.intervals.length > 0 && $activeSession.start}
        {formatTime($userPreferences, $activeSession.start)}
      {/if}
    </div>
  {:else}
    {#if context !== SessionUIContext.PIP}
      <div class={cn("text-fgs3", labelClassList)}>
        {resolvedComposition?.type === SessionCompositionType.COUNTUP &&
        $activeSession.isSessionRunning
          ? "Now"
          : "End"}
      </div>
    {/if}
    {#if $activeSession.state === SessionState.NOT_STARTED}
      <button
        class=" rounded-md underline-dotted border- border--dotted border--brs3 {resolvedComposition?.type ===
        SessionCompositionType.COUNTUP
          ? 'text--base px--2'
          : 'text--b3 px--2 py--[0.2rem]'}"
        onclick={() =>
          requireCommandHost().runAction(
            PointronAction.COMPOSE_BY_END_TIME_MODAL
          )}
      >
        {#if resolvedComposition?.type === SessionCompositionType.END_TIME_FIXED && $activeSession.end}
          {formatTime($userPreferences, $activeSession.end)}
        {:else if resolvedComposition?.type === SessionCompositionType.COUNTUP}
          <span>&nbsp; ♾️ &nbsp;</span>
        {:else}
          {formatTime(
            $userPreferences,
            new Date($currentTime.getTime() + resolvedPlannedDuration * 1000)
          )}
        {/if}
      </button>
    {:else}
      <div class={timeClassList}>
        {#if resolvedSessionType === SessionType.COUNTUP && $activeSession.state != SessionState.FINISHED}
          {$currentTime ? formatTime($userPreferences, $currentTime) : ""}
        {:else if resolvedSessionType === SessionType.COUNTUP && $activeSession.state === SessionState.FINISHED}
          <!-- {#if $sessionStore.end}
            {formatTime($userPreferences, $sessionStore.end)}
          {:else if $sessionStore.start} -->
          {#if $activeSession.start}
            {formatTime(
              $userPreferences,
              new Date(
                $activeSession.start.getTime() +
                  ($activeSession.totalElapsed + $activeSession.totalIdle) *
                    1000
              )
            )}
          {/if}
          <!-- {/if} -->
          <!-- {:else if $sessionStore.composition?.type === SessionCompositionType.END_TIME_FIXED}
          {$sessionStore.end} -->
          <!-- {:else if $sessionStore.composition?.type === SessionCompositionType.TARGET_FOCUS && $sessionStore.end}
          {formatTime($sessionStore.end)} -->
        {:else if $activeSession.start}
          {#if $activeSession.end}
            {formatTime($userPreferences, $activeSession.end)}
          {:else}
            {formatTime(
              $userPreferences,
              new Date(
                $activeSession.start.getTime() +
                  ($activeSession.plannedDuration + $activeSession.totalIdle) *
                    1000
              )
            )}
          {/if}
        {/if}
      </div>
    {/if}
  {/if}
</div>
