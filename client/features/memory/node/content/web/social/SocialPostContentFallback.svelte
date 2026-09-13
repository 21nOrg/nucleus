<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { retrieveUrlData } from "@nucleum/features/memory/capture/url-data";

  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import { formatDatetime } from "@21n/utils/time.utils";
  import { getContext, onMount } from "svelte";
  import { resolveContentPreview } from "@nucleum/features/memory/node/node.utils";
  import {
    socialPostNodeTypeList,
    socialProfileWithImageUnavailable
  } from "@nucleum/features/memory/node/node.type";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import type { INode } from "@nucleum/features/memory/node/node.type";

  import { ResourceAccessPoint } from "@nucleum/datafn/resource.type";

  import { parse } from "@21n/shared-utils/json.utils";
  import Button from "@21n/elements/button/Button.svelte";
  import { ButtonStyle } from "@21n/elements/button/button.type";
  import { Size } from "@21n/elements/size.enum";
  import { toasts } from "@nucleum/stores/notification.store";
  import { Context } from "@nucleum/stores/appStore.type";

  let {
    node,
    accessPoint = ResourceAccessPoint.SELF,
    onViewEmbed = undefined
  }: {
    node: INode;
    accessPoint?: ResourceAccessPoint;
    onViewEmbed?: (() => void) | undefined;
  } = $props();
  const nodeContext = getContext<any>(Context.NODE);
  let parent = $state<any>(undefined);
  let parentUsername = $state("");
  let oembedHtml: string | null = null;
  let platformInfo = $derived(
    socialPostNodeTypeList.has(node.contentType)
      ? resolvePlatformInfo(node.contentType)
      : { name: "", display: "" }
  );
  let platformName = $derived(platformInfo.name);
  let platformDisplay = $derived(platformInfo.display);

  function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  function hasStringProperty<K extends string>(
    value: unknown,
    key: K
  ): value is Record<K, string> {
    return isObject(value) && typeof value[key] === "string";
  }

  function resolveParentUrl() {
    if (isObject(node.parent) && hasStringProperty(node.parent, "url")) {
      return node.parent.url;
    }
    return undefined;
  }

  let contentPreview = $derived(resolveContentPreview(node));
  void accessPoint;

  onMount(async () => {
    resolveParentUsername();
    await resolveParent();
  });

  function resolvePlatformInfo(contentType: NodeType) {
    const platformMap: Partial<
      Record<NodeType, { name: string; display: string }>
    > = {
      [NodeType.TWEET]: { name: "twitter", display: "X" },
      [NodeType.MASTODON_POST]: { name: "mastodon", display: "Mastodon" },
      [NodeType.BLUESKY_POST]: { name: "bluesky", display: "Bluesky" },
      [NodeType.THREADS_POST]: { name: "threads", display: "Threads" },
      [NodeType.LINKEDIN_POST]: { name: "linkedin", display: "LinkedIn" },
      [NodeType.INSTAGRAM_POST]: { name: "instagram", display: "Instagram" },
      [NodeType.INSTAGRAM_REEL]: { name: "instagram", display: "Instagram" },
      [NodeType.FACEBOOK_POST]: { name: "facebook", display: "Facebook" },
      [NodeType.REDDIT_POST]: { name: "reddit", display: "Reddit" }
    };

    return platformMap[contentType] ?? { name: "", display: "" };
  }

  function resolveParentUsername() {
    const prefixes = [
      "twitterProfile_",
      "mastodonProfile_",
      "blueskyProfile_",
      "threadsProfile_",
      "linkedinProfile_",
      "instagramProfile_",
      "facebookProfile_",
      "redditProfile_"
    ];

    for (const prefix of prefixes) {
      const username = node.parent?.toString().split(prefix)[1];
      if (username) {
        parentUsername = username;
        return;
      }
    }

    const urlPatterns = [
      { domain: "x.com", split: "x.com/" },
      { domain: "twitter.com", split: "twitter.com/" },
      { domain: "bsky.app", split: "bsky.app/profile/" },
      { domain: "threads.net", split: "threads.net/@" },
      { domain: "linkedin.com", split: "linkedin.com/in/" },
      { domain: "instagram.com", split: "instagram.com/" },
      { domain: "facebook.com", split: "facebook.com/" },
      { domain: "reddit.com", split: "reddit.com/u/" }
    ];

    for (const pattern of urlPatterns) {
      const parentUrl = resolveParentUrl();
      if (parentUrl?.includes(pattern.domain)) {
        const username = parentUrl.split(pattern.split)[1];
        if (username) {
          parentUsername = username.split("/")[0];
          return;
        }
      }
    }

    const parentUrl = resolveParentUrl();
    if (parentUrl && node.contentType === NodeType.MASTODON_POST) {
      const mastodonMatch = parentUrl.match(/\/@([^/]+)/);
      if (mastodonMatch) {
        parentUsername = mastodonMatch[1];
        return;
      }
    }

    if (hasStringProperty(node.metadata, "username")) {
      parentUsername = node.metadata.username;
    }
  }

  async function resolveParent() {
    if (nodeContext?.parent) parent = nodeContext.parent;
  }

  async function resolveOembedHtml() {
    if (node.contentType !== NodeType.TWEET) return;

    const oEmbedUrl = `https://publish.twitter.com/oembed?url=${node.url}`;
    const urlData = await retrieveUrlData(oEmbedUrl, {
      isReturnRawData: true
    });
    const parsed = parse(urlData.text);
    oembedHtml =
      isObject(parsed) && hasStringProperty(parsed, "html")
        ? parsed.html
        : null;
  }

  function getPostedAtTime() {
    if ("postedAt" in node.body && node.body.postedAt) {
      return formatDatetime($userPreferences, node.body.postedAt);
    }
    return "Unknown";
  }

  async function copyTextContent() {
    if (contentPreview) {
      await navigator.clipboard.writeText(contentPreview);
      toasts.success("Text copied to clipboard");
    }
  }
</script>

<div
  class="w-full h-full mo:p-4 flex flex-col gap-6 justify-center items-center"
>
  <button
    class="flex flex-col gap-5 p-4 hover:bg-bgs2 border border-fgs4 rounded-md mo:w-full w-3/4"
    onclick={(event) => {
      event.stopPropagation();
      if (node.url) {
        navigation.openLink(node.url);
      }
    }}
  >
    {#if parent}
      <div class="flex gap-2">
        <div>
          {#if !socialProfileWithImageUnavailable.has(node.contentType)}
            <img
              class="w-10 h-10 rounded-full"
              src={parent.body?.profileImageUrl}
              alt="Profile"
            />
          {/if}
        </div>
        <div class="flex flex-col items-start">
          <div class="text-b2">
            {parent.label ?? parent.body?.name ?? parent.body?.displayName}
          </div>
          <div class="text-b4 text-fgs3">
            @{parentUsername}
          </div>
        </div>
      </div>
    {/if}
    <div class="text-left overflow-y-auto max-h-80">
      {contentPreview}
    </div>
    <div class="text-b3 text-fgs3 text-right">
      Posted on {platformDisplay}:
      {getPostedAtTime()}
    </div>
  </button>
  {#if contentPreview}
    <div class="flex justify-center items-center w-full gap-4">
      <Button
        style={ButtonStyle.PLAIN}
        label="Copy content"
        isUnderlined={true}
        size={Size.sm}
        onclick={(e) => {
          e.stopPropagation();
          copyTextContent();
        }}
      />
      <Button
        style={ButtonStyle.PLAIN}
        label="View as embed"
        isUnderlined={true}
        size={Size.sm}
        onclick={(e) => {
          e.stopPropagation();
          onViewEmbed?.();
        }}
      />
    </div>
  {/if}
</div>
