<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import TextInput from "@21n/elements/input/TextInput.svelte";
  import { Size } from "@21n/elements/size.enum";
  import { InputStyle } from "@21n/elements/input/input.type";
  import Icon from "@21n/elements/Icon.svelte";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import ScrollViewBottomSpacer from "@21n/layout/scrollView/ScrollViewBottomSpacer.svelte";
  import { removeDuplicatesFilter } from "@nucleum/datafn/resource.utils";
  import { appStore } from "@nucleum/stores/app.store";
  import { persistenceInstance } from "@nucleum/persistence/persistence";
  import { safeRequestIdleCallback } from "@21n/utils/browser.utils";

  let {
    onSelect = undefined
  }: {
    onSelect?: ((event: CustomEvent<string>) => void) | undefined;
  } = $props();
  let searchQuery = "";
  let images: any[] = [];
  let isLoading = false;
  let page = 1;
  let hasMore = true;
  const PER_PAGE = 20;

  async function searchImages(query: string, isNewSearch = true) {
    if (isNewSearch) {
      page = 1;
      images = [];
      hasMore = true;
    }

    if (!hasMore || isLoading) return;

    isLoading = true;
    try {
      const data = await persistenceInstance.browseUnsplash({
        query,
        page,
        perPage: PER_PAGE
      });
      const newImages = query ? data.results : data;

      if (newImages.length < PER_PAGE) {
        hasMore = false;
      }

      const _images = isNewSearch ? newImages : [...images, ...newImages];
      images = _images.filter(removeDuplicatesFilter);
      page++;
    } catch (error) {
      console.error("Error fetching images from Unsplash:", error);
    } finally {
      isLoading = false;
    }
  }

  function handleScroll(e: Event) {
    const target = e.target as HTMLElement;
    const bottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 50;

    if (bottom && !isLoading && hasMore) {
      searchImages(searchQuery, false);
    }
  }

  async function handleImageSelect(image: any) {
    onSelect?.(
      new CustomEvent("select", {
        detail: `unsplash_${image.urls.raw}`
      })
    );
    safeRequestIdleCallback(async () => {
      await persistenceInstance.triggerUnsplashDownload({
        url: image.links.download_location
      });
    });
  }

  function handleImageKeyDown(event: KeyboardEvent, image: any) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void handleImageSelect(image);
    }
  }

  searchImages("");
</script>

<div class="flex flex-col gap-4 flex-1 overflow-y-auto">
  <div class="flex items-center gap-2">
    <TextInput
      bind:value={searchQuery}
      style={InputStyle.BORDERED}
      size={Size.sm}
      placeholder="Search Unsplash photos..."
      onDebouncedChange={() => searchImages(searchQuery)}
    />
    {#if isLoading}
      <Icon icon="svg-spinners:90-ring-with-bg" class="stroke-fgs1" />
    {/if}
  </div>

  {#if images.length === 0 && !isLoading}
    <div class="flex-1 flex items-center justify-center">
      <EmptyStatusView subText="No images found" />
    </div>
  {:else}
    <div
      class="grid mo:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 overflow-y-auto min-h-0 flex-1 p-2"
      onscroll={handleScroll}
    >
      {#each images as image (image.id)}
        <div
          class="relative mo:h-32 h-52 group overflow-hidden rounded-md notouch:hover:opacity-90 touch:flex touch:flex-col transition-opacity"
          role="button"
          tabindex="0"
          onclick={() => handleImageSelect(image)}
          onkeydown={(event) => handleImageKeyDown(event, image)}
        >
          <img
            src={image.urls.small}
            alt={image.alt_description || "Unsplash photo"}
            class="w-full notouch:h-full touch:flex-1 touch:min-h-0 object-cover"
          />
          <button
            type="button"
            class="notouch:absolute bottom-0 inset-x-0 p-2 notouch:bg-bgs2 text-fgs2 text-b3 notouch:opacity-0 notouch:group-hover:opacity-100 notouch:transition-opacity notouch:hover:underline touch:underline truncate"
            onclick={(event) => {
              event.stopPropagation();
              const url =
                image.user.links.html +
                `?utm_source=${$appStore.product ?? "21n"}&utm_medium=referral`;
              navigation.openLink(url);
            }}
          >
            by {image.user.name}
          </button>
        </div>
      {/each}
      <ScrollViewBottomSpacer />
    </div>
  {/if}
</div>
