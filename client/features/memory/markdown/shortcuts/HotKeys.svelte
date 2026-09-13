<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import Table2 from "@21n/elements/table/Table2.svelte";

  import { TableCellType } from "@21n/elements/table/table.type";
  import HotKeyShortcutText from "@nucleum/features/memory/markdown/shortcuts/HotKeyShortcutText.svelte";
  import { keyboardShortcuts } from "@nucleum/stores/keyboard/shortcuts.store";
  const data = keyboardShortcuts
    .fetchKeyMap()
    .filter((x) => x.key !== undefined && x.modifiers === undefined)
    .map((x) => ({
      id: x.action,
      shortcut: x,
      label: requireCommandHost().resolveAction(x.action)?.label
    }))
    .filter((x) => x.label !== undefined);
</script>

<Table2
  columns={[
    { label: "Page / Action", key: "label", width: 3 },
    {
      label: "Shortcut",
      key: "shortcut",
      type: TableCellType.CUSTOM,
      component: HotKeyShortcutText
    }
  ]}
  {data}
/>
