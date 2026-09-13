<svelte:options runes={true} />

<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import BoxButton from "@21n/elements/button/BoxButton.svelte";

  import { Action } from "@nucleum/client/config/action.enum";
  let {
    isInThinMode = false,
    isRounded = false
  }: {
    isInThinMode?: boolean;
    isRounded?: boolean;
  } = $props();
  void isInThinMode;
  void isRounded;
</script>

<div class="w-full h-12">
  <BoxButton
    icon="question"
    tooltip="Help"
    parentBgIndex={2}
    onclick={async () => requireCommandHost().runAction(Action.HELP)}
  />
</div>
