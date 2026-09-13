<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import type { ITwitterProfile } from "@nucleum/features/memory/node/node.type";

  let { node }: { node: ITwitterProfile } = $props();

  function resolveUsername() {
    return node.url.split("x.com/")[1];
  }
</script>

<div class="flex justify-center items-center h-full w-full">
  <div
    class="flex flex-col items-center gap-6 p-8 border border-fgs4 rounded-md hover:bg-bgs2"
    role="button"
    tabindex="0"
    onclick={() => {
      navigation.openLink(node.url);
    }}
    onkeydown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        navigation.openLink(node.url);
      }
    }}
  >
    <div>
      <img
        src={node.body.profileImageUrl}
        alt="Profile"
        class="w-20 h-20 rounded-full"
      />
    </div>
    <div class="flex flex-col gap-1">
      <div>{node.label ?? node.body.name}</div>
      <div class="text-b3 text-fgs3">@{resolveUsername()}</div>
    </div>
    {#if node.body.bio}
      <div>{node.body.bio}</div>
    {/if}
  </div>
</div>
