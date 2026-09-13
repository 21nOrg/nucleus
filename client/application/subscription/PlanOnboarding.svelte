<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import account from "@nucleum/stores/account.store";
  import { BillingCycle } from "@nucleum/schema/account/subscription";
  import { Action } from "@nucleum/client/config/action.enum";
  import Button from "@21n/elements/button/Button.svelte";
  import Icon from "@21n/elements/Icon.svelte";
  import { ButtonVariant } from "@21n/elements/button/button.type";
  import { Size } from "@21n/elements/size.enum";
  import {
    resolveNextRenewalDate,
    resolvePlanLabel,
    SUBSCRIPTION_PLANS
  } from "@nucleum/application/subscription/userPlan.utils";

  import { parseAndFormatDate } from "@21n/utils/time.utils";
  import { renderMdAsHtml } from "@21n/elements/markdown/markdown.utils";
  import PlanIcon from "@nucleum/application/subscription/elements/PlanIcon.svelte";
  import modalEvent from "@nucleum/stores/overlays/modal.store";

  function resolveRenewalDate() {
    return $account.plan?.plan
      ? resolveNextRenewalDate($account.plan)
      : undefined;
  }

  function resolveCurrentPlanFeatures() {
    if (!$account.plan?.plan) {
      return [];
    }
    return (
      SUBSCRIPTION_PLANS.find((plan) => plan.type === $account.plan?.plan)
        ?.features ?? []
    );
  }
</script>

<div class="w-full my-16 px-8 text-center flex flex-col gap-4 items-center">
  <div class="text-[4rem] mb-4">
    <!-- 🎉 -->
    <PlanIcon type={$account.plan?.plan} />
  </div>

  <h1 class="text-3xl font-semibold text-fgs1 mb-8">
    Welcome to {resolvePlanLabel($account.plan)} 🎉
  </h1>

  <div class="bg-bgs2 p-8 rounded-xl mb-8 w-4/5 text-left">
    {#if $account.plan?.cycle !== BillingCycle.LIFETIME}
      <div class="flex items-center gap-2 mb-4">
        <Icon icon="check-circle" class="text-ags1" />
        <p class="text-h3 text-fgs2">Your subscription is now active.</p>
      </div>
    {/if}

    {#if resolveRenewalDate()}
      <p class="text-sm text-fgs3 mb-8">
        Next payment: {parseAndFormatDate(resolveRenewalDate())}
      </p>
    {/if}

    <div class="text-left">
      <h2 class="text-lg text-fgs1 mb-4">What's included:</h2>
      <ul class="space-y-3">
        {#each resolveCurrentPlanFeatures() as feature}
          <li class="flex items-center gap-2 text-fgs2">
            <Icon icon={feature.icon} size={Size.md} class="text-fgs1" />
            <span>
              {@html renderMdAsHtml(feature.label)}
            </span>
          </li>
        {/each}
      </ul>
    </div>
    <div class="mt-12">
      <Button
        type={ButtonVariant.PRIMARY}
        icon="rocket"
        label="Get started"
        onclick={() => {
          modalEvent.hide(Action.PLAN_ONBOARDING);
          navigation.gotoPath("/");
        }}
      />
    </div>
  </div>
</div>
