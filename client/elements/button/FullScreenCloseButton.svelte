<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { tooltip } from "@nucleum/actions/popover.action";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import modalEvent from "@nucleum/stores/overlays/modal.store";

  import view from "@nucleum/stores/view.store";
  import { ButtonVariant } from "@21n/elements/button/button.type";
  import { Placement } from "@21n/elements/direction.enum";
  import { cn } from "@21n/utils/ui.utils";
  import Icon from "@21n/elements/Icon.svelte";
  let {
    path = undefined,
    accessMode = AccessMode.FULL,
    isFloat = false,
    style = ButtonVariant.SECONDARY
  }: {
    path?: string | undefined;
    accessMode?: AccessMode;
    isFloat?: boolean;
    style?: ButtonVariant;
  } = $props();

  /**
   * If true, the button will be fully rounded and floating with a margin from the edges. Otherwise, it will stick to the top right corner.
   */
</script>

<!-- TODO - watch - changing z-[1000] to z-40 as this is showing close button on top of resource modal when something is in split screen inline -->
<button
  class={cn(
    "absolute w-10 h-10 bg-ars1 opacity-70 hover:opacity-100 flex justify-center items-center z-40 top-0 right-0 cw:mt-12",
    {
      "rounded-full m-3": isFloat,
      "m-0 rounded-bl-md": !isFloat,
      "bg-bgs2 border border-brs3": style === ButtonVariant.SECONDARY,
      "bg-ars1": style === ButtonVariant.DANGER
    }
  )}
  use:tooltip={{ text: "Close", direction: Placement.Left }}
  onclick={() => {
    if ($view.isConstrainedWidth && !path) navigation.goBack();
    navigation.closeResource({ accessMode });
    if (path) modalEvent.hide(path, "ModalCloseButton.svelte");
  }}
>
  <Icon
    icon="cross"
    class={cn({
      "stroke-bgs1": style === ButtonVariant.DANGER,
      "stroke-fgs1": style === ButtonVariant.SECONDARY
    })}
  />
</button>
