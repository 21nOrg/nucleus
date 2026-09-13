<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import Button from "@21n/elements/button/Button.svelte";
  import { PointronAction } from "@nucleum/client/config/focus-action.enum";

  import { ImportSource } from "@nucleum/products/pointron/settings/data/data.type";

  let { isIncludeSelf = true }: { isIncludeSelf?: boolean } = $props();
  const baseImportSources = [
    {
      label: "Atracker",
      id: ImportSource.ATRACKER
    },
    {
      label: "Session",
      id: ImportSource.SESSION
    },
    {
      label: "Toggl track",
      id: ImportSource.TOGGL_TRACK
    },
    {
      label: "Timemator",
      id: ImportSource.TIMEMATOR
    }
  ];
  let importSources = $derived.by(() => {
    const sources = [...baseImportSources];
    if (isIncludeSelf)
      sources.push({ label: "Pointron", id: ImportSource.SELF });
    return sources;
  });

  function onImportButtonClick(id: string) {
    requireCommandHost().runAction(PointronAction.IMPORT_APP_DATA, {
      componentParams: { importSource: id }
    });
  }
</script>

<div class="flex flex-col gap-3">
  <div class="text-left mo:text-b2 text-fgs2">
    Pick an app to import your time tracking data
  </div>
  <div
    class="protrait:grid portrait:grid-cols-2 portrait:gap-3 flex gap-4 flex-wrap"
  >
    {#each importSources as { label, id }}
      <Button onclick={() => onImportButtonClick(id)} {label} />
    {/each}
  </div>
</div>
