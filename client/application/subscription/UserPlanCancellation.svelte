<script lang="ts">
  import { subscription } from "@nucleum/application/subscription/subscription";

  import account from "@nucleum/stores/account.store";
  import Button from "@21n/elements/button/Button.svelte";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import modalEvent from "@nucleum/stores/overlays/modal.store";
  import { Action } from "@nucleum/client/config/action.enum";
  import {
    resolveNextRenewalDate,
    SUBSCRIPTION_PLANS
  } from "@nucleum/application/subscription/userPlan.utils";
  import { parseAndFormatDate } from "@21n/utils/time.utils";
  import PlanFeatureList from "@nucleum/application/subscription/elements/PlanFeatureList.svelte";
  import { toasts } from "@nucleum/stores/notification.store";
  import { PaymentProvider } from "@nucleum/schema/account/payment-provider";
  import { postMessageToParent } from "@nucleum/client/runtime/embed/embed.utils";
  import { EmbedMessage } from "@nucleum/client/runtime/embed/embedMessage.enum";
  import { BillingCycle } from "@nucleum/schema/account/subscription";

  let isCancelInProgress = false;

  function resolveIsFullRefundable() {
    return resolveIfEligibleForFullRefund($account.plan?.paymentDate);
  }

  function resolveCurrentPlanFeatures() {
    return $account.plan
      ? SUBSCRIPTION_PLANS.find((plan) => plan.type === $account.plan?.plan)
          ?.features
      : [];
  }

  async function proceed() {
    if (isCancelInProgress) return;
    if ($account.plan?.provider === PaymentProvider.APPLE) {
      postMessageToParent(EmbedMessage.MODIFY_SUBSCRIPTION);
      return;
    }
    isCancelInProgress = true;
    const response = await subscription.modifySubscription({
      type: "cancel"
    });
    isCancelInProgress = false;
    if (response && response.status === "success") {
      hide();
      toasts.success("Plan cancelled successfully");
    } else {
      toasts.error("Failed to cancel plan. Please try again later.");
    }
  }

  function resolveIfEligibleForFullRefund(paymentDate: Date | undefined) {
    if (!paymentDate || $account.plan?.cycle === BillingCycle.MONTHLY)
      return false;
    const daysUsed = Math.ceil(
      (new Date().getTime() - new Date(paymentDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return daysUsed <= 30;
  }

  function hide() {
    modalEvent.hide(Action.USER_PLAN_CANCELATION);
  }
</script>

<div class="flex flex-col justify-between h-full w-full gap-4 p-4">
  <div class="flex flex-col items-center gap-6">
    <div class="text-h3 text-fgs2">
      Are you sure you want to cancel your plan?
    </div>
    <div class="flex flex-col gap-2">
      <div>You will no longer have access to the following features:</div>
      <PlanFeatureList features={resolveCurrentPlanFeatures()} />
    </div>
  </div>
  <div class="flex flex-col items-center gap-4">
    <div class="text-fgs3 text-b3 text-center">
      {#if $account.plan?.provider === PaymentProvider.APPLE}
        You will be redirected to the Apple App Store to modify your
        subscription.
      {:else if resolveIsFullRefundable()}
        You will receive a full refund and your plan will be cancelled
        immediately.
      {:else if $account.plan}
        {@const nextPaymentDate = resolveNextRenewalDate($account.plan)}
        {#if nextPaymentDate}
          Your plan will expire on {parseAndFormatDate(nextPaymentDate)}.
        {/if}
      {/if}
    </div>
    <div class="flex gap-2 w-full justify-center">
      <Button label="Go back" onclick={hide} />
      <Button
        label={isCancelInProgress ? "Cancelling..." : "Proceed to cancel"}
        isDisabled={isCancelInProgress}
        type={ButtonVariant.DANGER}
        style={ButtonStyle.OUTLINED}
        onclick={proceed}
      />
    </div>
  </div>
</div>
