<script lang="ts">
  import { subscription } from "@nucleum/application/subscription/subscription";

  import Button from "@21n/elements/button/Button.svelte";
  import { ButtonStyle } from "@21n/elements/button/button.type";

  import { Size } from "@21n/elements/size.enum";
  import { toasts } from "@nucleum/stores/notification.store";
  import context from "@nucleum/stores/context.store";
  import { OperatingSystem } from "@nucleum/client/runtime/context.type";
  import { EmbedMessage } from "@nucleum/client/runtime/embed/embedMessage.enum";
  import { postMessageToParent } from "@nucleum/client/runtime/embed/embed.utils";
  const isAppleContext = $derived(
    $context.isEmbed &&
      ($context.os === OperatingSystem.IOS ||
        $context.os === OperatingSystem.MACOS)
  );

  async function restore() {
    if (isAppleContext) {
      postMessageToParent(EmbedMessage.RESTORE_PURCHASE);
      // postMessageToParent(EmbedMessage.CHECK_SUBSCRIPTION);
      return;
    }
    toasts.showProgress("restorePlan", "Restoring purchase...");
    const response = await subscription.restorePurchase();
    if (response.status === "multiple_valid_transactions") {
      toasts.error("Please contact us via Discord or email.", {
        title: "Multiple valid plans found."
      });
    } else if (
      response.status === "no_valid_transaction" ||
      response.status === "no_transactions"
    ) {
      toasts.error("No valid plan found");
    } else if (response.status === "success") {
      toasts.success("Purchase restored");
    } else if (response.status === "unavailable") {
      toasts.error(
        response.reason === "offline"
          ? "Connect to the internet and try again"
          : "Purchase restoration is unavailable. Try again later."
      );
    }
    toasts.closeProgress("restorePlan");
  }
</script>

<div class="flex justify-center gap-2">
  <Button
    label="Restore purchase"
    icon="restore"
    style={ButtonStyle.PLAIN}
    size={Size.sm}
    onclick={restore}
  />
</div>
