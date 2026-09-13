<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import Button from "@21n/elements/button/Button.svelte";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";

  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { generateSimpleRandomId } from "@21n/shared-utils/crypto.utils";
  import { Size } from "@21n/elements/size.enum";
  let {
    id,
    accessMode,
    parentBgIndex = 1,
    additionalAccessModes = []
  }: {
    id: string;
    accessMode: AccessMode;
    parentBgIndex?: number;
    additionalAccessModes?: AccessMode[];
  } = $props();
  const elementIdSuffix = generateSimpleRandomId();
  const elementId = $derived(`${id}-closeButton-${elementIdSuffix}`);
  const tooltip = $derived(
    accessMode === AccessMode.FULL ? "Close full screen" : "Close"
  );
</script>

{#if accessMode === AccessMode.SPLIT || accessMode === AccessMode.FULL || accessMode === AccessMode.FSPLIT || accessMode === AccessMode.SHEET || additionalAccessModes.includes(accessMode)}
  <div
    class="flex justify-center items-center"
    id={elementId}
    data-accessMode={accessMode}
  >
    <Button
      icon="cross"
      ariaLabel="Close"
      {tooltip}
      style={ButtonStyle.OUTLINED}
      type={ButtonVariant.DANGER}
      {parentBgIndex}
      size={Size.sm}
      onclick={() => {
        if (accessMode === AccessMode.FULL) {
          navigation.toggleFullScreen(accessMode, id);
        } else {
          navigation.closeResource({ id, accessMode });
        }
      }}
    />
  </div>
{/if}
