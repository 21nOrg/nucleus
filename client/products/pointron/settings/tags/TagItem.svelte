<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { PointronAction } from "@nucleum/client/config/focus-action.enum";

  let {
    label = undefined,
    id = undefined,
    isAddNew = false
  }: {
    label?: string;
    id?: string;
    isAddNew?: boolean;
  } = $props();

  function onClick() {
    if (isAddNew) {
      requireCommandHost().runAction(PointronAction.ADD_TAG);
    } else {
      requireCommandHost().runAction(PointronAction.EDIT_TAG, {
        componentParams: { id }
      });
    }
  }
</script>

<button
  class="px-2 py-1 rounded-md border border-brs3 hover:bg-bgs2"
  onclick={onClick}
>
  {#if label}
    {label}
  {:else if isAddNew}
    <span class="text-aps1"> + Add new tag</span>
  {/if}
</button>
