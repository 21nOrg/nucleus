<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import Button from "@21n/elements/button/Button.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import { Size } from "@21n/elements/size.enum";
  let {
    context
  }: {
    context: "Roadmap" | "Changelog" | "Board";
  } = $props();
  const baseUrl = $derived(
    $appStore?.appData?.urls?.supahub ??
      `https://${$appStore.product}.supahub.com`
  );

  const url = $derived(
    context === "Roadmap" && $appStore?.appData?.urls?.roadmapEmbed
      ? $appStore?.appData?.urls?.roadmapEmbed
      : `${baseUrl}/${context.toLocaleLowerCase()}`
  );
</script>

<!-- <SupaHubEmbedCode {context} /> -->
<div class="realtive w-full h-full rounded-md">
  <iframe
    title="Supahub"
    class="rounded-md"
    src={url}
    width="100%"
    height="100%"
    frameBorder="0"
  ></iframe>

  <div class="absolute bottom-0 left-0 m-2 flex gap-2 items-center">
    <Button
      label="Open in browser"
      icon="weblink"
      size={Size.sm}
      type={ButtonVariant.PRIMARY}
      style={ButtonStyle.OUTLINED}
      onclick={() => {
        navigation.openLink(baseUrl);
      }}
    />
  </div>
</div>
