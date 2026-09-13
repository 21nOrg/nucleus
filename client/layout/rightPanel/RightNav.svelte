<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { Action } from "@nucleum/client/config/action.enum";
  import InlineSyncingFeedback from "@21n/elements/feedback/InlineSyncingFeedback.svelte";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import RightNavMenuItem from "./RightNavMenuItem.svelte";
</script>

<div class="h-full min-w-14 w-14 pt--12 border-l border-brs3 bg-bgs2">
  <div class="flex flex-col justify-between h-full w-full">
    <div>
      <RightNavMenuItem icon="rhombus" tooltip="Rhombus" />
      <RightNavMenuItem icon="calendar" tooltip="Today" />
      <RightNavMenuItem icon="catchup" tooltip="Catchup" />
      <RightNavMenuItem
        icon="terminal-window"
        tooltip="Command"
        shortcut={Action.CMD}
        onClick={() => requireCommandHost().runAction(Action.CMD)}
      />
    </div>
    <div>
      <RightNavMenuItem
        icon="question"
        tooltip="Help"
        onClick={() => requireCommandHost().runAction(Action.HELP)}
      />
      <InlineSyncingFeedback
        resource={Resource.everything}
        isShorter={true}
        text="Syncing..."
      />
    </div>
  </div>
</div>
