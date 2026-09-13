<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import account from "@nucleum/stores/account.store";
  import Button from "@21n/elements/button/Button.svelte";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import {
    resolveNextRenewalDate,
    resolvePlanLabel,
    SUBSCRIPTION_PLANS
  } from "@nucleum/application/subscription/userPlan.utils";

  import { parseAndFormatDate } from "@21n/utils/time.utils";
  import PlanFeatureList from "@nucleum/application/subscription/elements/PlanFeatureList.svelte";
  import { Action } from "@nucleum/client/config/action.enum";
  import { BillingCycle, PlanType } from "@nucleum/schema/account/subscription";
  import {
    PlanStatus,
    type IUserPlan
  } from "@nucleum/schema/account/subscription";
  import { UserDataMode } from "@nucleum/client/runtime/account/account.type";
  import { PaymentProvider } from "@nucleum/schema/account/payment-provider";
  import RestorePurchaseAction from "@nucleum/application/subscription/RestorePurchaseAction.svelte";
  import context from "@nucleum/stores/context.store";
  import { OperatingSystem } from "@nucleum/client/runtime/context.type";
  import InlineInfoBanner from "@21n/elements/text/InlineInfoBanner.svelte";
  import { InfoTextType } from "@21n/elements/text/info.type";
  import DiscountBanner from "@nucleum/application/subscription/elements/DiscountBanner.svelte";
  import PoliciesFooter from "@21n/elements/PoliciesFooter.svelte";
  import { Size } from "@21n/elements/size.enum";

  let currentPlanFeatures = $state<Array<{ icon: string; label: string }>>([]);
  const renewalDate = $derived(
    $account.plan ? resolveNextRenewalDate($account.plan) : undefined
  );
  $effect(() => {
    if (!$account.plan) {
      currentPlanFeatures = [];
      return;
    }
    const selectedPlan = SUBSCRIPTION_PLANS.find(
      (p) => p.type === $account.plan?.plan
    );
    currentPlanFeatures = selectedPlan ? selectedPlan.features : [];
  });
  const canCancel = $derived(resolveCanCancel($account.plan));
  const isAppleContext = $derived(
    $context.isEmbed &&
      ($context.os === OperatingSystem.IOS ||
        $context.os === OperatingSystem.MACOS)
  );

  function resolveCanCancel(plan: IUserPlan | undefined) {
    if (!plan) return false;
    if (!plan.provider || plan.provider === PaymentProvider.SELF) {
      if (plan.cycle === BillingCycle.LIFETIME) return false;
      return true;
    }
    if (
      plan.provider === PaymentProvider.APPLE &&
      $context.isEmbed &&
      ($context.os === OperatingSystem.IOS ||
        $context.os === OperatingSystem.MACOS)
    ) {
      return true;
    }
    return false;
  }

  function resolveCannotCancelContent() {
    if ($account.plan?.provider === PaymentProvider.APPLE) {
      return "You have purchased this plan through **Apple App Store**. Kindly visit App store settings to make changes to your subscription.";
    } else if ($account.plan?.provider === PaymentProvider.GOOGLE) {
      return "You have purchased this plan through **Google Play Store**. Kindly visit Play store settings to make changes to your subscription.";
    } else if ($account.plan?.provider === PaymentProvider.MICROSOFT) {
      return "You have purchased this plan through **Microsoft Store**. Kindly visit Microsoft Store settings to make changes to your subscription.";
    } else {
      return "You have purchased this plan through an external provider. Please contact support to cancel your subscription.";
    }
  }

  function resolveProviderLabel(provider: PaymentProvider) {
    switch (provider) {
      case PaymentProvider.APPLE:
        return "Apple App Store";
      case PaymentProvider.GOOGLE:
        return "Google Play Store";
      case PaymentProvider.MICROSOFT:
        return "Microsoft Store";
      default:
        return "External Provider";
    }
  }
</script>

{#if $account.dataMode === UserDataMode.LOCAL}
  <div class="flex w-full rounded-md bg-bgs2 p-4">
    You are using the app in offline mode. Please signup as a cloud user to see
    billing details.
  </div>
{:else}
  <div class="flex flex-col gap-4 items-center w-full h-full">
    <div class="flex flex-col gap-8 bg-bgs2 cw:p-4 p-8 rounded-md w-full">
      <div class="flex flex-col gap-2">
        <p class="text-h3 text-fgs2">{resolvePlanLabel($account.plan)}</p>
        <div class="flex flex-wrap justify-between gap-2">
          <p class="text-sm text-fgs3">
            {#if renewalDate && $account.plan?.status === PlanStatus.ACTIVE}
              Next payment: <b>
                {parseAndFormatDate(renewalDate)}
              </b>
            {:else if renewalDate && $account.plan?.status === PlanStatus.CANCELLED}
              Expires: {parseAndFormatDate(renewalDate)}
            {/if}
          </p>
          {#if $account.plan?.provider && $account.plan?.provider !== PaymentProvider.SELF}
            <p class="text-sm text-fgs3">
              Purchased through: <b>
                {resolveProviderLabel($account.plan?.provider)}
              </b>
            </p>
          {/if}
        </div>
      </div>
      {#if $account.plan?.plan === PlanType.TRIAL}
        <div class="flex flex-col gap-2">
          <div>
            <Button
              icon="sparkle"
              label="Upgrade"
              type={ButtonVariant.PRIMARY}
              onclick={() => {
                requireCommandHost().runAction(Action.USER_PLAN);
              }}
            />
          </div>
          <DiscountBanner isPreventDiscounting={isAppleContext} />
        </div>
      {:else if $account.plan}
        <div class="text-left">
          <h2 class="text-lg text-fgs1 mb-3">What's included:</h2>
          <PlanFeatureList features={currentPlanFeatures} />
        </div>

        <div class="flex gap-2">
          {#if $account.plan.status === PlanStatus.REFUNDED}
            <Button
              icon="reload"
              label="Reactivate"
              type={ButtonVariant.PRIMARY}
              onclick={() => {
                requireCommandHost().runAction(Action.USER_PLAN);
              }}
            />
          {:else if canCancel}
            <Button
              type={ButtonVariant.DANGER}
              style={ButtonStyle.OUTLINED}
              icon="cross"
              label="Cancel Subscription"
              onclick={() => {
                requireCommandHost().runAction(Action.USER_PLAN_CANCELATION);
              }}
            />
          {/if}
        </div>
      {/if}
      {#if !canCancel && $account.plan?.cycle === BillingCycle.LIFETIME && (!$account.plan?.provider || $account.plan?.provider === PaymentProvider.SELF)}
        For cancellation of lifetime plan, please contact us via email.
      {:else if !canCancel}
        <InlineInfoBanner
          content={resolveCannotCancelContent()}
          parentBgIndex={2}
          type={InfoTextType.INFO}
        />
      {:else if $account.plan?.plan === PlanType.TRIAL}
        <InlineInfoBanner
          content="You will need a subscription to continue using **cloud sync**. Sign up as an offline user instead to use the app for free."
          parentBgIndex={2}
          type={InfoTextType.INFO}
          size={Size.sm}
        />
      {/if}
      <div class="flex justify-between flex-wrap gap-2">
        <div class="text-b2 text-fgs2">
          Have questions? Reach us at
          <a href="mailto:hello@21n.org" class="text-aps1 hover:underline"
            >hello@21n.org</a
          >
        </div>
        <RestorePurchaseAction />
      </div>
      <PoliciesFooter pretext="By subscribing, you agree to our" />
    </div>
  </div>
{/if}
