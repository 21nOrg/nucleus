<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import view from "@nucleum/stores/view.store";
  import Button from "@21n/elements/button/Button.svelte";
  import Icon from "@21n/elements/Icon.svelte";
  import PlanExpired from "@21n/illustrations/PlanExpired.svelte";
  import account from "@nucleum/stores/account.store";
  import { appStore } from "@nucleum/stores/app.store";
  import { Action } from "@nucleum/client/config/action.enum";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import { Size } from "@21n/elements/size.enum";
  import { parseAndFormatDate } from "@21n/utils/time.utils";
  import { properCase } from "@21n/shared-utils/text.utils";
  import modalEvent from "@nucleum/stores/overlays/modal.store";
  import RestorePurchaseAction from "@nucleum/application/subscription/RestorePurchaseAction.svelte";
  import { PlanType } from "@nucleum/schema/account/subscription";

  function resolveTrialExpiry() {
    return $account.plan?.plan === PlanType.TRIAL &&
      $account.plan?.trialPlan?.expiry
      ? new Date($account.plan.trialPlan.expiry)
      : null;
  }

  function resolveIsTrialExpired() {
    const trialExpiry = resolveTrialExpiry();
    return trialExpiry ? new Date() > trialExpiry : false;
  }

  function resolveIsBillingIssue() {
    return (
      ($account.plan?.plan === PlanType.CLOUD_SYNC ||
        $account.plan?.plan === PlanType.NUCLEUS) &&
      $account.plan?.billingErrors
    );
  }

  if (window.location.href.includes("/pay?")) {
    modalEvent.hide(Action.INACTIVE_PLAN);
  }

  const primeFeatures: { icon: string; label: string }[] = [
    {
      icon: "arrows-left-right",
      label: "Unlimited cloud sync across all your devices"
    },
    {
      icon: "sparkle",
      label: "Priority support and early access to new features"
    },
    {
      icon: "heart",
      label: "Support independent team"
    }
  ];
</script>

<div
  class="flex flex-col items-center justify-center gap-6 h-full w-full overflow-auto p-6 text-center"
>
  <div class="flex flex-col gap-4 max-w-lg">
    <div class="flex justify-center">
      <PlanExpired />
    </div>
    <div class="flex flex-col gap-2">
      <h1 class="text-h1 font-bold text-ars1">
        {#if resolveIsTrialExpired()}
          Your free trial has expired
        {:else if resolveIsBillingIssue()}
          Your billing information is incorrect
        {:else}
          Your plan is inactive
        {/if}
      </h1>

      <p class="text-fgs2">
        {#if resolveTrialExpiry()}
          {#if resolveIsTrialExpired()}
            Your free trial ended on <b>
              {parseAndFormatDate(resolveTrialExpiry())}.
            </b>
            Upgrade now to continue using all features.
          {:else}
            Your free trial will expire on {parseAndFormatDate(
              resolveTrialExpiry()
            )}. Upgrade now to ensure uninterrupted access.
          {/if}
        {:else if resolveIsBillingIssue()}
          Please update your billing information to continue using sync
          features.
        {:else}
          Please upgrade your plan to continue using {properCase(
            $appStore.product
          )}'s premium features.
        {/if}
      </p>
    </div>
    {#if !resolveIsBillingIssue()}
      <div
        class="flex flex-col gap-4 p-6 bg-bgs2 rounded-lg border border-brs3"
      >
        <h2 class="text-lg font-semibold text-fgs1 text-left">Why upgrade?</h2>
        <ul class="flex flex-col gap-3 text-left">
          {#each primeFeatures as feature}
            <li class="flex items-start gap-2">
              <Icon icon={feature.icon} />
              <span class="text-fgs2">{feature.label}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
    <div class="flex justify-center gap-8">
      {#if !$view.isConstrainedWidth}
        <RestorePurchaseAction />
      {/if}
      <Button
        label="Chat with us"
        icon="chat-three"
        size={Size.sm}
        style={ButtonStyle.PLAIN}
        onclick={async () => {
          requireCommandHost().runAction("chat");
        }}
      />
      <Button
        label="Logout"
        icon="log-out"
        size={Size.sm}
        style={ButtonStyle.PLAIN}
        type={ButtonVariant.DANGER}
        onclick={async () => {
          await account.signOut();
        }}
      />
    </div>
  </div>
</div>
