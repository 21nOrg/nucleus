<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { Control } from "@nucleum/features/focus/elements/controls/control.enum";
  import { SessionState } from "@nucleum/features/focus/sessionState.enum";
  import ControlItem from "@nucleum/features/focus/elements/controls/ControlItem.svelte";
  import { activeSession } from "@nucleum/features/focus/session.store";
  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  import { SessionType } from "@nucleum/features/focus/logs/log.type";

  import { cn } from "@21n/utils/ui.utils";
  import { SessionUIContext } from "@nucleum/features/focus/session.type";

  let { context = SessionUIContext.DEFAULT }: { context?: SessionUIContext } =
    $props();
  let isOperationInProgress = false;
  let controlItemProps = $derived({ context });
  async function controlClickHandler(event: any) {
    if (isOperationInProgress) return;
    isOperationInProgress = true;
    try {
      let control = event.detail.control;
      if (control === Control.START) {
        await activeSession.startSession();
      } else if (control === Control.BREAK) {
        await activeSession.startBreak();
      } else if (control === Control.FINISH) {
        if ($activeSession.state === SessionState.TIME_IS_UP) {
          await activeSession.finishSession();
        } else {
          await activeSession.finishSession();
        }
      } else if (control === Control.RESUME || control === Control.SKIPBREAK) {
        await activeSession.resumeSession();
      } else if (control === Control.EXTEND) {
        await activeSession.extendSession();
      } else if (control === Control.ABANDON) {
        requireCommandHost().runAction(PointronAction.ABANDON_SESSION);
      } else {
        $activeSession.state = SessionState.NOT_STARTED;
      }
    } finally {
      isOperationInProgress = false;
    }
  }
</script>

<div
  class={cn("flex flex-row items-center", {
    "gap-4":
      context === SessionUIContext.FOCUS_PLAYER ||
      context === SessionUIContext.PIP,
    "gap-8 mo:gap-6": context === SessionUIContext.DEFAULT
  })}
>
  {#if $activeSession.state === SessionState.NOT_STARTED}
    <ControlItem
      control={Control.START}
      isProminent={true}
      onClick={controlClickHandler}
      {...controlItemProps}
    />
  {:else if $activeSession.type === SessionType.PREDEFINED_INTERVALS}
    <ControlItem
      control={Control.ABANDON}
      onClick={controlClickHandler}
      {...controlItemProps}
    />
    <ControlItem
      control={Control.FINISH}
      onClick={controlClickHandler}
      {...controlItemProps}
    />
  {:else if $activeSession.state === SessionState.FOCUS_RUNNING}
    <ControlItem
      control={Control.BREAK}
      onClick={controlClickHandler}
      {...controlItemProps}
    />
    <ControlItem
      control={Control.FINISH}
      onClick={controlClickHandler}
      {...controlItemProps}
    />
  {:else if $activeSession.state === SessionState.FOCUS_COMPLETED}
    <ControlItem
      control={Control.SKIPBREAK}
      onClick={controlClickHandler}
      {...controlItemProps}
    />
    <ControlItem
      control={Control.BREAK}
      isProminent={true}
      onClick={controlClickHandler}
      {...controlItemProps}
    />
    <ControlItem
      control={Control.FINISH}
      onClick={controlClickHandler}
      {...controlItemProps}
    />
  {:else if $activeSession.state === SessionState.BREAK_RUNNING}
    <ControlItem
      control={Control.RESUME}
      onClick={controlClickHandler}
      {...controlItemProps}
    />
    <ControlItem
      control={Control.FINISH}
      onClick={controlClickHandler}
      {...controlItemProps}
    />
  {:else if $activeSession.state === SessionState.BREAK_COMPLETED}
    <ControlItem
      control={Control.RESUME}
      isProminent={true}
      onClick={controlClickHandler}
      {...controlItemProps}
    />
    <ControlItem
      control={Control.FINISH}
      onClick={controlClickHandler}
      {...controlItemProps}
    />
  {:else if $activeSession.state === SessionState.TIME_IS_UP}
    <ControlItem
      control={Control.EXTEND}
      onClick={controlClickHandler}
      {...controlItemProps}
    />
    <ControlItem
      control={Control.FINISH}
      isProminent={true}
      onClick={controlClickHandler}
      {...controlItemProps}
    />
  {:else if $activeSession.state === SessionState.TIME_IS_RUNNING_OUT}
    <ControlItem
      control={Control.EXTEND}
      onClick={controlClickHandler}
      {...controlItemProps}
    />
    <ControlItem
      control={Control.BREAK}
      onClick={controlClickHandler}
      {...controlItemProps}
    />
    <ControlItem
      control={Control.FINISH}
      onClick={controlClickHandler}
      {...controlItemProps}
    />
  {/if}
</div>
