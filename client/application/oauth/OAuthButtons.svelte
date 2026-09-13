<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import Button from "@21n/elements/button/Button.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import { Size } from "@21n/elements/size.enum";
  import { isValidArrayWithData } from "@21n/shared-utils/obj.utils";
  import { properCase } from "@21n/shared-utils/text.utils";
  import { authClient } from "@nucleum/client/runtime/account/auth";
  import type { AuthFnSocialProviderId } from "@authfn/client";
  let {
    currentProgress = $bindable()
  }: {
    currentProgress?: string | undefined;
  } = $props();

  function resolveAuthFnProvider(
    slug: string
  ): AuthFnSocialProviderId | undefined {
    if (slug === "google" || slug === "apple") return slug;
    return undefined;
  }

  const authFnProviders = $derived(
    ($appStore?.appData?.oAuthConfig ?? []).filter((provider) =>
      Boolean(resolveAuthFnProvider(provider.oauth_slug))
    )
  );
</script>

<svelte:head>
  <!-- <meta name="appleid-signin-client-id" content="[CLIENT_ID]" />
  <meta name="appleid-signin-scope" content="[SCOPES]" />
  <meta name="appleid-signin-redirect-uri" content="[REDIRECT_URI]" />
  <meta name="appleid-signin-state" content="[STATE]" />
  <meta name="appleid-signin-nonce" content="[NONCE]" />
  <meta name="appleid-signin-use-popup" content="true" /> -->
  <!-- <script
    type="text/javascript"
    src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"
  ></script> -->
</svelte:head>

<div class="flex flex-col w-full gap-4">
  {#if isValidArrayWithData(authFnProviders)}
    {#each authFnProviders as provider}
      <Button
        size={Size.lg}
        id={provider.oauth_slug === "apple"
          ? "appleid-disabled-signin"
          : provider.oauth_slug + "-signin"}
        isExpandToFullWidth={true}
        icon={provider.oauth_slug}
        isLoading={currentProgress === provider.oauth_slug}
        label={"Continue with " + properCase(provider.oauth_slug)}
        onclick={async () => {
          currentProgress = provider.oauth_slug;
          try {
            const authProvider = resolveAuthFnProvider(provider.oauth_slug);
            if (!authProvider) return;
            const response = await (
              await authClient()
            ).startSocialSignIn({
              provider: authProvider,
              returnTo: window.location.origin,
              callbackMode: "redirect"
            });
            if (response.ok) {
              if (window.self !== window.top) {
                navigation.openLink(response.data.redirectTo, true);
              } else {
                window.location.href = response.data.redirectTo;
              }
            }
          } finally {
            currentProgress = undefined;
          }
        }}
      />
    {/each}
  {/if}
</div>
