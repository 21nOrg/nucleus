<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";
  import { subscription } from "@nucleum/application/subscription/subscription";

  import { Size } from "@21n/elements/size.enum";

  import type { IPlan } from "@nucleum/application/subscription/plan-presentation.type";
  import type { IBillingAddress } from "@nucleum/schema/account/subscription";
  import { BillingCycle } from "@nucleum/schema/account/subscription";
  import PlanCard from "@nucleum/application/subscription/elements/PlanCard.svelte";
  import FullScreenCloseButton from "@21n/elements/button/FullScreenCloseButton.svelte";
  import { Action } from "@nucleum/client/config/action.enum";
  import account from "@nucleum/stores/account.store";
  import { SUBSCRIPTION_PLANS } from "@nucleum/application/subscription/userPlan.utils";
  import BillingAddressCapture from "@nucleum/application/subscription/BillingAddressCapture.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import context from "@nucleum/stores/context.store";
  import { OperatingSystem } from "@nucleum/client/runtime/context.type";
  import { postDataToParent } from "@nucleum/client/runtime/embed/embed.utils";
  import { toasts } from "@nucleum/stores/notification.store";
  import { dispatchCustomEvent } from "@21n/utils/browser.utils";
  import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";
  import { PaymentProvider } from "@nucleum/schema/account/payment-provider";
  import DropDown from "@21n/elements/dropdown/DropDown.svelte";
  import { EmbedDataMessage } from "@nucleum/client/runtime/embed/embedMessage.enum";

  let selectedCycle: BillingCycle = BillingCycle.YEARLY;
  let isBillingAddressCapture = false;
  let selectedPlan: IPlan | null = null;
  let billingAddress: IBillingAddress | undefined = undefined;
  let isRedirecting = false;
  let isSwitching = false;
  const billingPeriods = [
    { value: BillingCycle.MONTHLY, label: "Billed monthly" },
    {
      value: BillingCycle.YEARLY,
      label: "Billed yearly",
      badge: "-20%"
    }
  ];

  function resolveIsAppleContext() {
    return (
      $context.isEmbed &&
      ($context.os === OperatingSystem.IOS ||
        $context.os === OperatingSystem.MACOS)
    );
  }

  function resolveBillingPeriods() {
    const periods = [...billingPeriods];
    if (!resolveIsAppleContext()) {
      periods.push({ value: BillingCycle.LIFETIME, label: "Lifetime" });
    }
    return periods;
  }

  async function onSwitch(plan?: IPlan) {
    selectedPlan = plan || null;
    if (resolveIsAppleContext()) {
      await completePurchaseOnIOS();
      return;
    }
    isBillingAddressCapture = true;
    isSwitching = true;
  }

  async function onSwitchProceed() {
    isRedirecting = true;
    const response = await subscription.modifySubscription({
      type: "switch",
      plan: selectedPlan?.type,
      cycle: selectedCycle,
      billing: billingAddress,
      product: $appStore.product
    });
    if (response?.nonce && response.paymentLink) {
      window.location.href = response.paymentLink;
    } else {
      isRedirecting = false;
      showPurchaseError(response);
    }
  }

  async function onCancel() {
    requireCommandHost().runAction(Action.USER_PLAN_CANCELATION);
  }

  async function onChoose(plan: IPlan) {
    selectedPlan = plan;
    if (resolveIsAppleContext()) {
      await completePurchaseOnIOS();
      return;
    }
    isBillingAddressCapture = true;
  }

  async function completePurchaseOnIOS() {
    const productId = formProductId();
    const response = await subscription.initiateSubscription({
      plan: selectedPlan?.type,
      cycle: selectedCycle,
      billing: billingAddress,
      product: $appStore.product,
      provider: PaymentProvider.APPLE
    });
    if (!response || !response.nonce) {
      showPurchaseError(response);
      return;
    }
    postDataToParent(EmbedDataMessage.PURCHASE, {
      productId,
      nonce: response.nonce
    });
    dispatchCustomEvent(GlobalEvent.APP_LOADING_STATUS, {
      message: `Purchasing the plan...`,
      subMessage: ""
    });
    function formProductId() {
      return `app.${$appStore.product}.${selectedPlan?.type}.${selectedCycle}`;
    }
  }

  async function onProceed() {
    if (!selectedPlan || !billingAddress) {
      return;
    }
    if (isSwitching) {
      await onSwitchProceed();
      return;
    }
    isRedirecting = true;
    const response = await subscription.initiateSubscription({
      plan: selectedPlan?.type,
      cycle: selectedCycle,
      billing: billingAddress,
      product: $appStore.product
    });
    if (response?.nonce && response.paymentLink) {
      window.location.href = response.paymentLink;
    } else {
      isRedirecting = false;
      showPurchaseError(response);
    }
  }

  function showPurchaseError(response: { reason?: string } | undefined) {
    toasts.error(
      response?.reason === "offline"
        ? "Connect to the internet and try again"
        : "Unable to start payment. Please try again."
    );
  }
</script>

{#if isRedirecting}
  <EmptyStatusView
    isLoadingState={true}
    loadingText="Redirecting to payment..."
  />
{:else if isBillingAddressCapture}
  <BillingAddressCapture bind:billingAddress {onProceed} />
{:else}
  <div
    class="flex flex-col gap-8 h-full w-full overflow-auto max-w-4xl mx-auto"
  >
    <div
      class="flex justify-between items-center w-full cw:mb-6 px-4 cw:mt-12 pt-6 dp:pt-8"
    >
      <div class="flex items-center flex-wrap gap-2">
        <div class="cw:text-h3 text-h1 text-fgs2">Choose your plan</div>
        {#if $account.plan?.discount && !resolveIsAppleContext() && selectedCycle !== BillingCycle.MONTHLY}
          <div
            class="cw:text-b3 text-b2 px-2 py-1 rounded-md bg-bgs2 text-ags1 font-medium border border-brs3"
          >
            Early Member - {$account.plan?.discount?.first}% discount applied.
          </div>
        {/if}
      </div>
      <div>
        <DropDown
          items={resolveBillingPeriods()}
          isDisableSearch={true}
          bind:value={selectedCycle}
          size={Size.sm}
          popoverWidth="w-40"
        />
      </div>
    </div>

    <div class="flex-1 px-4 pb-3 dp:pb-12 w-full">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mx-auto h-full">
        {#each SUBSCRIPTION_PLANS as plan}
          <PlanCard
            plans={SUBSCRIPTION_PLANS}
            {plan}
            currentPlan={$account.plan}
            period={selectedCycle}
            isPreventDiscounting={resolveIsAppleContext()}
            onSwitch={() => onSwitch(plan)}
            onChoose={() => onChoose(plan)}
            onCancel={() => onCancel()}
          />
        {/each}
      </div>
    </div>
  </div>
{/if}
<FullScreenCloseButton isFloat={true} path={Action.USER_PLAN} />
