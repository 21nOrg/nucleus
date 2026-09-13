<svelte:options runes={true} />

<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import type { Snippet } from "svelte";
  import { page } from "$app/stores";
  import { resolveAuthSession } from "@nucleum/client/runtime/account/auth";
  import AppLoadingView from "@21n/layout/paint/AppLoadingView.svelte";
  import Button from "@21n/elements/button/Button.svelte";

  import { productData } from "@nucleum/products/product.resolver";
  import AuthGuard from "@21n/layout/layers/AuthGuard.svelte";
  import { postMessageToParent } from "@nucleum/client/runtime/embed/embed.utils";
  import { EmbedMessage } from "@nucleum/client/runtime/embed/embedMessage.enum";
  import { onMount } from "svelte";
  import AccountDebugInfo from "./AccountDebugInfo.svelte";
  let { children: pageChildren }: { children?: Snippet } = $props();
  let isEmbedTokenPresent = $state(false);
  const dev_isDebugAccountMode = false;
  onMount(() => {
    postMessageToParent(EmbedMessage.MOUNT);
    const token = localStorage.getItem("embedToken");
    isEmbedTokenPresent = token ? true : false;
  });

  type RouteAuthState =
    "authenticated" | "expired" | "signed-out" | "unavailable";

  async function resolveRouteAuthState(): Promise<RouteAuthState> {
    if ($page.url.searchParams.has("token")) return "authenticated";
    const resolution = await resolveAuthSession();
    if (
      resolution.status === "authenticated" ||
      resolution.status === "offline-only" ||
      resolution.status === "cached-cloud"
    ) {
      return "authenticated";
    }
    if (resolution.status === "expired") return "expired";
    if (resolution.status === "unavailable") return "unavailable";
    return "signed-out";
  }

  function goToAuthRoute(authState: RouteAuthState) {
    if (authState === "unavailable") {
      window.location.reload();
      return;
    }
    navigation.gotoPath("/account/login", {
      queryParams: authState === "expired" ? { msg: "expired" } : undefined
    });
  }
</script>

{#await resolveRouteAuthState()}
  <AppLoadingView />
{:then authState}
  {#if authState === "authenticated"}
    {#if dev_isDebugAccountMode}
      <AccountDebugInfo />
    {:else}
      <AuthGuard>
        {#snippet children(isLoggedIn)}
          {#if isLoggedIn}
            {@const ProductBase = productData.base}
            <ProductBase>
              {@render pageChildren?.()}
            </ProductBase>
          {/if}
        {/snippet}
      </AuthGuard>
    {/if}
  {:else}
    <div class="h-full flex flex-col justify-center items-center">
      {#if authState === "expired"}
        <div class="text-ass1 text-b2 mb-4">
          Your session has expired. Please login again.
        </div>
      {:else if authState === "unavailable"}
        <div class="text-ass1 text-b2 mb-4">
          Account service is unavailable. Please try again once it is running.
        </div>
      {/if}
      <div>Embed token: {isEmbedTokenPresent}</div>
      <Button
        label={authState === "unavailable" ? "Retry" : "Login/Signup"}
        onclick={() => {
          goToAuthRoute(authState);
        }}
      />
    </div>
  {/if}
{:catch error}
  <div class="h-full flex flex-col justify-center items-center">
    <div class="text-ass1 text-b2 mb-4">Authentication error</div>
    <Button
      label="Login/Signup"
      onclick={() => {
        navigation.gotoPath("/account/login");
      }}
    />
  </div>
{/await}
