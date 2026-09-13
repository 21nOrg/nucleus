<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import ModalFooter from "@21n/elements/modal/ModalFooter.svelte";
  import OptionSelector from "@21n/elements/select/OptionSelector.svelte";
  import {
    spaceInContext,
    spaceStore
  } from "@nucleum/features/spaces/space.store";

  import { Orientation } from "@21n/elements/direction.enum";
  import { GatheryEvent } from "@nucleum/features/spaces/gatheryEvent.enum";
  import { OptionSelectorStyle } from "@21n/elements/select/select.type";
  import { isValidArrayWithData } from "@21n/shared-utils/obj.utils";
  spaceStore.refresh();
  let selected = $spaceInContext?.label ?? undefined;
</script>

<div class="flex flex-col h-full justify-between items-center">
  {#if isValidArrayWithData($spaceStore?.spaces)}
    <OptionSelector
      options={$spaceStore?.spaces.map((space) => ({
        label: space.label,
        value: space.id
      }))}
      iconOrientation={Orientation.Vertical}
      style={OptionSelectorStyle.OUTLINE}
      {selected}
      labelProps={{ label: "Spaces", orientation: Orientation.Vertical }}
      onSelect={(e) => {
        console.log("switch space", e);
        spaceStore.switchToSpace(e.detail);
      }}
    />
  {/if}
  <ModalFooter
    action={GatheryEvent.SPACE_BROWSER}
    secondaryAction={{
      label: "Close"
    }}
    primaryAction={{
      label: "Create Space",
      callback: async () => {
        requireCommandHost().runAction(GatheryEvent.CREATE_SPACE);
        return true;
      }
    }}
  />
</div>
