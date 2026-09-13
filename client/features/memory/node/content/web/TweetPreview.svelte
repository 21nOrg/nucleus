<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { retrieveUrlData } from "@nucleum/features/memory/capture/url-data";

  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import { formatDatetime } from "@21n/utils/time.utils";
  import { getContext, onMount } from "svelte";
  import { resolveContentPreview } from "@nucleum/features/memory/node/node.utils";
  import type { ITweet } from "@nucleum/features/memory/node/node.type";
  import InlineInfoBanner from "@21n/elements/text/InlineInfoBanner.svelte";
  import { ResourceAccessPoint } from "@nucleum/datafn/resource.type";
  import TweetPreviewUsingWidget from "@nucleum/features/memory/node/content/web/social/TweetPreviewUsingWidget.svelte";
  import account from "@nucleum/stores/account.store";
  import { InfoTextType } from "@21n/elements/text/info.type";
  import { parse } from "@21n/shared-utils/json.utils";
  import { Context } from "@nucleum/stores/appStore.type";
  let {
    node,
    accessPoint = ResourceAccessPoint.SELF
  }: {
    node: ITweet;
    accessPoint?: ResourceAccessPoint;
  } = $props();
  const nodeContext = getContext<any>(Context.NODE);

  let parent: any;
  let parentUsername: string;
  let oembedHtml: string | null = null;
  const contentPreview = resolveContentPreview(node);

  onMount(async () => {
    parentUsername = node.parent?.toString().split("twitterProfile_")[1] ?? "";
    if (!parentUsername) {
      parentUsername = node.parent?.url?.split("x.com/")[1] ?? "";
    }
    await resolveParent();
  });

  async function resolveParent() {
    if (nodeContext?.parent) parent = nodeContext.parent;
  }

  async function resolveOembedHtml() {
    const oEmbedUrl = `https://publish.twitter.com/oembed?url=${node.url}`;
    const urlData = await retrieveUrlData(oEmbedUrl, {
      isReturnRawData: true
    });
    const parsed = parse(urlData.text);
    oembedHtml = parsed.html;
  }
</script>

{#if oembedHtml}
  {@html oembedHtml}
{:else if account.isCloudUserAndOnline()}
  <button
    class="w-full h-full px-4 flex justify-center items-center overflow-y-auto"
    onclick={() => {
      navigation.openLink(node.url);
    }}
  >
    <TweetPreviewUsingWidget tweetUrl={node.url} />
  </button>
{:else}
  <div
    class="w-full h-full mo:p-4 flex flex-col gap-6 justify-center items-center"
  >
    <button
      class="flex flex-col gap-5 p-4 hover:bg-bgs2 border border-fgs4 rounded-md mo:w-full w-3/4"
      onclick={(event) => {
        event.stopPropagation();
        navigation.openLink(node.url);
      }}
    >
      {#if parent}
        <div class="flex gap-2">
          <div>
            <img
              class="w-10 h-10 rounded-full"
              src={parent.body?.profileImageUrl}
              alt="Profile"
            />
          </div>
          <div class="flex flex-col items-start">
            <div class="text-b2">
              {parent.label ?? parent.body?.name}
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
        Posted:
        {formatDatetime($userPreferences, node.body.postedAt)}
      </div>
    </button>
    {#if accessPoint === ResourceAccessPoint.SELF}
      <div class="mo:w-full w-3/4">
        <InlineInfoBanner
          content="Tweets that contain images are not supported during offline mode."
          type={InfoTextType.WARNING}
        />
      </div>
    {/if}
  </div>
{/if}
