<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import Presets from "@nucleum/features/focus/advanced/presets/Presets.svelte";

  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  function handleEdit(event: any) {
    if (!event.detail?.id) return;
    requireCommandHost().runAction(PointronAction.EDIT_PRESET, {
      componentParams: { id: event.detail.id }
    });
  }
</script>

<div class="w-full h-full overflow-y-auto flex flex-col gap-2 dp:gap-3">
  <Presets isInEditMode={true} onEdit={handleEdit} isSettingsContext={true} />
</div>
