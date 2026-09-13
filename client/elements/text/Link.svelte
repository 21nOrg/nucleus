<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import context from "@nucleum/stores/context.store";
  import { LinkVariant } from "@21n/elements/button/button.type";
  import { cn } from "@21n/utils/ui.utils";
  import { goto } from "@21n/utils/browser.utils";
  import { isValidEmail } from "@21n/shared-utils/text.utils";
  import { isUrlMatchPattern } from "@21n/shared-utils/utils";

  let {
    href = undefined,
    label,
    variant = LinkVariant.DOTTED,
    isEnforeHttpIfMatchPattern = false,
    onclick = undefined
  }: {
    href?: string | undefined;
    label: string;
    variant?: LinkVariant;
    isEnforeHttpIfMatchPattern?: boolean;
    onclick?: ((event: MouseEvent) => void) | undefined;
  } = $props();

  function handleClick(event: MouseEvent) {
    if (!href) return;
    if (href.includes("http")) navigation.openLink(href);
    else if (isEnforeHttpIfMatchPattern && isUrlMatchPattern(href))
      navigation.openLink(`https://${href}`);
    else if (isValidEmail(href)) goto(`mailto:${href}`);
    else if (href) requireCommandHost().runAction(href);
    onclick?.(event);
  }
</script>

{#if href && !$context.isEmbed && href?.includes("http")}
  <a
    class={cn("relative hover:text-aps1 whitespace-nowrap min-w-fit", {
      "underline-dotted hover:underline-dotted-hover":
        variant === LinkVariant.DOTTED
    })}
    {href}
    target="_blank"
    rel="noopener noreferrer"
    >{label}
  </a>
{:else}
  <button
    onclick={handleClick}
    class={cn("hover:text-aps1 whitespace-nowrap min-w-fit", {
      "underline-dotted hover:underline-dotted-hover":
        variant === LinkVariant.DOTTED
    })}
  >
    {label}
  </button>
{/if}
