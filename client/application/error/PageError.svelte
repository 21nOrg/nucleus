<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { page } from "$app/stores";
  import Button from "@21n/elements/button/Button.svelte";
  import PageNotFoundIllustration from "@21n/illustrations/PageNotFoundIllustration.svelte";

  import {
    ButtonStyle,
    ButtonVariant,
    type IButtonParams
  } from "@21n/elements/button/button.type";
  import { Size } from "@21n/elements/size.enum";
  import { renderMdAsHtml } from "@21n/elements/markdown/markdown.utils";
  import SystemStatus from "@nucleum/application/settings/about/SystemStatus.svelte";
  let {
    message = undefined,
    actions = [],
    isNotFoundPage = false
  }: {
    message?: string | undefined;
    actions?: IButtonParams[];
    isNotFoundPage?: boolean;
  } = $props();
  const is404 = $derived(
    isNotFoundPage ||
      $page?.url.pathname === "/404" ||
      $page?.url.pathname === "/404/"
  );
  const erroredPath = $derived($page?.url?.searchParams?.get("path"));
  const errorParam = $derived($page?.url?.searchParams?.get("error"));
  const titles = ["Yikes", "Uh-oh", "Oops", "Oh no", "Whoops", "Dang", "Shoot"];
</script>

<div class="flex flex-col h-full w-full justify-between p-8">
  <main class="flex flex-col w-full justify-center items-center gap-4 p-4 grow">
    <h1 class="font-medium text-title text-bgs4">
      <!-- {#if is404}
      <PageNotFoundIllustration />
    {:else} -->
      {is404 ? "404" : titles[Math.floor(Math.random() * titles.length)] + "!"}
      <!-- {/if} -->
    </h1>
    {#if !message}
      <div class="text-b3 text-center text-ars1">
        {$page?.error?.message ?? errorParam ?? "Something went wrong."}
      </div>
    {/if}
    <span>
      {@html renderMdAsHtml(
        message ??
          (is404
            ? `Oops! The page **${erroredPath ?? " "}** you're looking for doesn't exist.`
            : "We would never want you to see this page. Please chat with us or try again.")
      )}
    </span>
    <div class="flex gap-2">
      {#if actions.length > 0}
        {#each actions as action}
          <Button
            {...action}
            type={action.variant}
            onclick={() => action.callback?.()}
          />
        {/each}
      {:else}
        <Button
          size={Size.sm}
          style={ButtonStyle.OUTLINED}
          label={is404 ? "Go back home" : "Try again"}
          onclick={() => {
            navigation.gotoPath("/");
          }}
        />
        {#if !is404}
          <Button
            size={Size.sm}
            type={ButtonVariant.PRIMARY}
            label="Chat with us"
            onclick={() => {
              requireCommandHost().runAction("discord");
            }}
          />
        {/if}
      {/if}
    </div>
  </main>
  <footer class="flex flex-col justify-center items-center text-b3 text-fgs3">
    <SystemStatus />
  </footer>
</div>
