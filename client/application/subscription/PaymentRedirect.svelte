<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";
  import { subscription } from "@nucleum/application/subscription/subscription";

  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import ErrorStatusPane from "@21n/elements/feedback/ErrorStatusPane.svelte";
  import account from "@nucleum/stores/account.store";

  import { Action } from "@nucleum/client/config/action.enum";
  import { onMount } from "svelte";

  let nonce: string | null;
  let statusUrlParam: string | null = null;
  let error: string | null = null;
  let errorSubText: string = "";

  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    nonce = urlParams.get("nonce");
    statusUrlParam = urlParams.get("status");
    if (nonce?.includes("?")) {
      nonce = nonce.split("?")[0];
    }
    checkPaymentStatus();
  });

  function resolveErrorSubText() {
    switch (statusUrlParam) {
      case "processing":
        errorSubText =
          "Please come back in a few minutes to check the status of your payment. You will receive a refund if the transaction fails.";
        break;
      default:
        errorSubText =
          "Please try again after sometime. You will receive a refund if an amount is deducted from your account.";
        break;
    }
  }

  async function checkPaymentStatus() {
    if (!nonce) return;
    const response = await subscription.verifyPayment(nonce);
    if (response?.status === "success") {
      requireCommandHost().runAction(Action.PLAN_ONBOARDING);
    } else if (response?.status === "unavailable") {
      error =
        response.reason === "offline"
          ? "You're offline"
          : "Payment verification is unavailable";
      errorSubText =
        response.reason === "offline"
          ? "Connect to the internet and reload this page."
          : "Please reload this page and try again.";
    } else {
      if (statusUrlParam) {
        switch (statusUrlParam) {
          case "processing":
            error = "Payment is pending";
            break;
          case "canceled":
            error = "Payment was canceled";
            break;
          case "failed":
            error = "Payment failed";
            break;
          default:
            error = "Something went wrong";
            break;
        }
      } else {
        error = "Payment failed";
      }
      resolveErrorSubText();
    }
  }
</script>

{#if error}
  <ErrorStatusPane {error} subText={errorSubText} />
{:else}
  <EmptyStatusView isLoadingState={true} loadingText="Confirming payment..." />
{/if}
