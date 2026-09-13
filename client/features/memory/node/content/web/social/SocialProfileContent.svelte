<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import Icon from "@21n/elements/Icon.svelte";

  import { Size } from "@21n/elements/size.enum";
  import {
    socialProfileNodeTypeList,
    socialProfileWithImageUnavailable,
    type ILinkedInProfileMetadata
  } from "@nucleum/features/memory/node/node.type";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import type { INode } from "@nucleum/features/memory/node/node.type";
  import { resolveNodeIcon } from "@nucleum/features/memory/node/node.utils";

  let { node }: { node: INode } = $props();

  let platformDisplay = $derived(
    socialProfileNodeTypeList.has(node.contentType)
      ? resolvePlatformInfo(node.contentType)
      : "Social"
  );

  function isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object";
  }

  function hasStringProperty<K extends string>(
    value: unknown,
    key: K
  ): value is Record<K, string> {
    return isObject(value) && typeof value[key] === "string";
  }

  function hasLinkedInMetadata(
    metadata: unknown
  ): metadata is ILinkedInProfileMetadata {
    return isObject(metadata);
  }

  function resolvePlatformInfo(contentType: NodeType) {
    const platformMap: Partial<Record<NodeType, string>> = {
      [NodeType.TWITTER_PROFILE]: "X",
      [NodeType.MASTODON_PROFILE]: "Mastodon",
      [NodeType.BLUESKY_PROFILE]: "Bluesky",
      [NodeType.THREADS_PROFILE]: "Threads",
      [NodeType.LINKEDIN_PROFILE]: "LinkedIn",
      [NodeType.INSTAGRAM_PROFILE]: "Instagram",
      [NodeType.FACEBOOK_PROFILE]: "Facebook",
      [NodeType.REDDIT_PROFILE]: "Reddit"
    };

    return platformMap[contentType] || "Social";
  }

  function resolveUsername() {
    if (!node.url) {
      return hasStringProperty(node.body, "username")
        ? node.body.username
        : "unknown";
    }

    try {
      const url = new URL(node.url);
      const hostname = url.hostname.toLowerCase();
      const pathname = url.pathname;

      // Remove query parameters and hash fragments
      const cleanPath = pathname.split("?")[0].split("#")[0];

      // Handle different social platforms
      if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
        const match = cleanPath.match(/^\/([^/]+)/);
        return match ? match[1] : "unknown";
      }

      if (hostname.includes("bsky.app")) {
        const match = cleanPath.match(/^\/profile\/([^/]+)/);
        return match ? match[1] : "unknown";
      }

      if (hostname.includes("threads.")) {
        const match = cleanPath.match(/^\/@([^/]+)/);
        return match ? match[1] : "unknown";
      }

      if (hostname.includes("linkedin.com")) {
        const match = cleanPath.match(/^\/in\/([^/]+)/);
        return match ? match[1] : "unknown";
      }

      if (hostname.includes("instagram.com")) {
        const match = cleanPath.match(/^\/([^/]+)/);
        return match ? match[1] : "unknown";
      }

      if (hostname.includes("facebook.com")) {
        const match = cleanPath.match(/^\/([^/]+)/);
        return match ? match[1] : "unknown";
      }

      if (hostname.includes("reddit.com")) {
        const match = cleanPath.match(/^\/u(?:ser)?\/([^/]+)/);
        return match ? match[1] : "unknown";
      }

      // Handle Mastodon instances (various domains)
      if (node.contentType === NodeType.MASTODON_PROFILE) {
        const match = cleanPath.match(/^\/@([^/]+)/);
        return match ? match[1] : "unknown";
      }

      // Fallback: try to extract username from path
      const pathSegments = cleanPath
        .split("/")
        .filter((segment) => segment.length > 0);
      if (pathSegments.length > 0) {
        // Remove common prefixes and get the first meaningful segment
        const username = pathSegments[pathSegments[0] === "profile" ? 1 : 0];
        if (username && username.startsWith("@")) {
          return username.substring(1);
        }
        return username || "unknown";
      }
    } catch (error) {
      console.warn("Failed to parse profile URL:", node.url, error);
    }

    // Final fallback to body username
    return hasStringProperty(node.body, "username")
      ? node.body.username
      : "unknown";
  }

  function getDisplayName() {
    return (
      node.label ||
      (hasStringProperty(node.body, "name") ? node.body.name : undefined) ||
      (hasStringProperty(node.body, "displayName")
        ? node.body.displayName
        : undefined) ||
      (hasStringProperty(node.metadata, "displayName")
        ? node.metadata.displayName
        : undefined) ||
      resolveUsername()
    );
  }

  function getBio() {
    return hasStringProperty(node.body, "bio") ? node.body.bio : "";
  }

  function getProfileImageUrl() {
    return hasStringProperty(node.body, "profileImageUrl")
      ? node.body.profileImageUrl
      : "";
  }

  function getFollowersCount() {
    return node.metadata?.followersCount;
  }

  function getFollowingCount() {
    return node.metadata?.followingCount;
  }

  function getPostsCount() {
    return node.metadata?.postsCount;
  }

  function isVerified() {
    return node.metadata?.isVerified || false;
  }

  function getWebsiteUrl() {
    return node.metadata?.websiteUrl;
  }

  function getBannerImageUrl() {
    return node.metadata?.bannerImageUrl;
  }

  function getAdditionalInfo() {
    const info: string[] = [];

    if (
      node.contentType === NodeType.LINKEDIN_PROFILE &&
      hasLinkedInMetadata(node.metadata)
    ) {
      if (node.metadata.currentPosition) {
        info.push(node.metadata.currentPosition);
      }
      if (node.metadata.currentCompany) {
        info.push(`at ${node.metadata.currentCompany}`);
      }
      if (node.metadata.location) {
        info.push(node.metadata.location);
      }
    }

    return info;
  }

  function formatCount(count: string | number | undefined): string {
    if (!count) return "";
    const num = typeof count === "string" ? parseInt(count) : count;
    if (isNaN(num)) return count.toString();

    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
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
    {#if getBannerImageUrl()}
      <div
        class="w-full h-20 rounded-md bg-cover bg-center mb-2"
        style="background-image: url({getBannerImageUrl()})"
      ></div>
    {/if}

    <div class="relative">
      {#if socialProfileWithImageUnavailable.has(node.contentType)}
        <Icon icon={resolveNodeIcon(node.contentType)} size={Size.lg} />
      {:else}
        <img
          src={getProfileImageUrl()}
          alt="Profile"
          class="w-20 h-20 rounded-full"
        />
      {/if}
      {#if isVerified()}
        <div
          class="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center"
        >
          <span class="text-white text-xs">✓</span>
        </div>
      {/if}
    </div>

    <div class="flex flex-col gap-1 text-center">
      <div class="text-lg font-semibold">{getDisplayName()}</div>
      <div class="text-b3 text-fgs3">@{resolveUsername()}</div>
      <div class="text-b4 text-fgs2">{platformDisplay} Profile</div>
    </div>

    {#if getBio()}
      <div class="text-center text-b3 max-w-xs">{getBio()}</div>
    {/if}

    {#if getAdditionalInfo().length > 0}
      <div class="text-center text-b4 text-fgs3">
        {getAdditionalInfo().join(" ")}
      </div>
    {/if}

    {#if getWebsiteUrl()}
      <button
        type="button"
        class="text-center text-b4 text-blue-500 hover:underline"
        onclick={(event) => {
          event.stopPropagation();
          const websiteUrl = getWebsiteUrl();
          if (websiteUrl) navigation.openLink(websiteUrl);
        }}
      >
        {getWebsiteUrl()}
      </button>
    {/if}

    {#if getFollowersCount() || getFollowingCount() || getPostsCount()}
      <div class="flex gap-4 text-b4 text-fgs3">
        {#if getFollowersCount()}
          <span
            ><strong class="text-fgs1"
              >{formatCount(getFollowersCount())}</strong
            > Followers</span
          >
        {/if}
        {#if getFollowingCount()}
          <span
            ><strong class="text-fgs1"
              >{formatCount(getFollowingCount())}</strong
            > Following</span
          >
        {/if}
        {#if getPostsCount()}
          <span
            ><strong class="text-fgs1">{formatCount(getPostsCount())}</strong> Posts</span
          >
        {/if}
      </div>
    {/if}
  </div>
</div>
