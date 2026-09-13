<svelte:options runes={true} />

<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { cn } from "@21n/utils/ui.utils";

  import { Action } from "@nucleum/client/config/action.enum";
  import account from "@nucleum/stores/account.store";
  import { PlanType } from "@nucleum/schema/account/subscription";
  import { resolveTrialDaysLeft } from "@nucleum/application/subscription/userPlan.utils";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  import { Orientation } from "@21n/elements/direction.enum";
  let {
    orientation = Orientation.Horizontal
  }: {
    orientation?: Orientation;
  } = $props();

  let trialDaysLeft = $derived(
    $account.plan?.plan === PlanType.TRIAL
      ? resolveTrialDaysLeft($account.plan)
      : undefined
  );
</script>

{#if trialDaysLeft !== undefined && trialDaysLeft !== null && trialDaysLeft < 15}
  {@const isTrialExpired = trialDaysLeft <= 0}
  <button
    class={cn(
      "flex gap-1 justify-center items-center border border-dashed rounded-md  mx-1.5 whitespace-nowrap",
      {
        "flex-col p-1.5": orientation === Orientation.Vertical,
        "px-1.5 py-0.5": orientation === Orientation.Horizontal,
        "bg-ars2 border-ars1": isTrialExpired,
        "hover:bg-ass2/10 border-ass1/50 text-ass1": !isTrialExpired
      }
    )}
    onclick={() =>
      requireCommandHost().runAction(Action.SETTINGS, {
        searchParams: {
          [AppSearchParam.SETTING]: Action.USER_BILLING
        }
      })}
  >
    {#if orientation === Orientation.Vertical}
      <span class="text-b2"> Trial </span>
    {/if}
    <span
      class={cn({
        "text-b4": orientation == Orientation.Vertical,
        "text-b3": orientation == Orientation.Horizontal
      })}
    >
      {#if !isTrialExpired}
        {trialDaysLeft}
        {trialDaysLeft === 1 ? "day" : "days"}
        {orientation === Orientation.Horizontal ? "trial" : ""} left
      {:else}
        Trial expired
      {/if}
    </span>
  </button>
{/if}
