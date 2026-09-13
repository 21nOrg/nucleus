<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import PageError from "@nucleum/application/error/PageError.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import { Product } from "@nucleum/client/config/product.type";
  import { Action } from "@nucleum/client/config/action.enum";
  import { ButtonVariant } from "@21n/elements/button/button.type";
  function resolveMessage(product: Product) {
    if (product === Product.NUCLEUM) {
      return "You don't have access to Nucleum. Please upgrade to a Nucleum plan to continue.";
    }
    return "You don't have access to this page.";
  }

  function resolveActions(product: Product) {
    if (product === Product.NUCLEUM) {
      return [
        {
          label: "Upgrade now",
          icon: "sparkle",
          variant: ButtonVariant.PRIMARY,
          callback: async () => {
            requireCommandHost().runAction(Action.USER_PLAN);
          }
        }
      ];
    }
    return [];
  }
</script>

<PageError message={resolveMessage($appStore.product)} />
