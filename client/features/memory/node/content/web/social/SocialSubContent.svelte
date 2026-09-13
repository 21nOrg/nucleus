<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { socialSubNodeTypeList } from "@nucleum/features/memory/node/node.type";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import type { INode } from "@nucleum/features/memory/node/node.type";

  let { node }: { node: INode } = $props();

  let platformDisplay = $derived(
    socialSubNodeTypeList.has(node.contentType)
      ? resolvePlatformInfo(node.contentType)
      : "Social"
  );

  function resolvePlatformInfo(contentType: NodeType) {
    const platformMap: Partial<Record<NodeType, string>> = {
      [NodeType.LINKEDIN_GROUP]: "LinkedIn Group",
      [NodeType.FACEBOOK_GROUP]: "Facebook Group",
      [NodeType.REDDIT_SUB]: "Subreddit"
    };

    return platformMap[contentType] || "Social";
  }

  function resolveUsername() {
    if (!node.url) {
      return node.body?.username || "unknown";
    }

    try {
      const url = new URL(node.url);
      const hostname = url.hostname.toLowerCase();
      const pathname = url.pathname;

      const cleanPath = pathname.split("?")[0].split("#")[0];

      if (hostname.includes("reddit.com")) {
        const match = cleanPath.match(/^\/r\/([^/]+)/);
        return match ? match[1] : "unknown";
      }

      const pathSegments = cleanPath
        .split("/")
        .filter((segment) => segment.length > 0);
      if (pathSegments.length > 0) {
        const username = pathSegments[pathSegments[0] === "profile" ? 1 : 0];
        if (username && username.startsWith("@")) {
          return username.substring(1);
        }
        return username || "unknown";
      }
    } catch (error) {
      console.warn("Failed to parse profile URL:", node.url, error);
    }

    return node.body?.username || "unknown";
  }

  function getDisplayName() {
    return (
      node.label ||
      node.body?.name ||
      node.body?.displayName ||
      node.metadata?.displayName ||
      resolveUsername()
    );
  }

  function getBio() {
    return node.body?.bio || "";
  }
</script>

<div class="flex justify-center items-center h-full w-full">
  <div
    class="flex flex-col items-center gap-6 p-8 border border-fgs4 rounded-md hover:bg-bgs2 max-w-md"
    role="button"
    tabindex="0"
    onclick={() => {
      if (node.url) navigation.openLink(node.url);
    }}
    onkeydown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (node.url) navigation.openLink(node.url);
      }
    }}
  >
    <div class="flex flex-col gap-1 text-center">
      <div class="text-lg font-semibold">{getDisplayName()}</div>
      <div class="text-b3 text-fgs3">@{resolveUsername()}</div>
      <div class="text-b4 text-fgs2">{platformDisplay}</div>
    </div>

    {#if getBio()}
      <div class="text-center text-b3 max-w-xs">{getBio()}</div>
    {/if}
  </div>
</div>
