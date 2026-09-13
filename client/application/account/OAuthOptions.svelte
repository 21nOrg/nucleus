<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import Button from "@21n/elements/button/Button.svelte";
  import { Size } from "@21n/elements/size.enum";
  import { properCase } from "@21n/shared-utils/text.utils";
  import { cn } from "@21n/utils/ui.utils";
  import Icon from "@21n/elements/Icon.svelte";
  import { authClient } from "@nucleum/client/runtime/account/auth";
  import { resolveAccountBaseUrl } from "@nucleum/client/runtime/account/network";
  import context from "@nucleum/stores/context.store";
  import { appStore } from "@nucleum/stores/app.store";
  import { OperatingSystem } from "@nucleum/client/runtime/context.type";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { EmbedDataMessage } from "@nucleum/client/runtime/embed/embedMessage.enum";
  import { postDataToParent } from "@nucleum/client/runtime/embed/embed.utils";
  let {
    providers,
    isExpanded = false,
    currentProgress = $bindable(),
    region = undefined
  }: {
    providers: string[];
    isExpanded?: boolean;
    currentProgress?: string | undefined;
    region?: string | undefined;
  } = $props();
  const resolveReturnTo = () => {
    if (
      $context.isEmbed &&
      ($context.os === OperatingSystem.IOS ||
        $context.os === OperatingSystem.MACOS)
    ) {
      return `${resolveNativeUrlScheme()}://oauthsignin`;
    }

    return `${window.location.origin}/account/login?oauth_callback=1`;
  };
  const resolveHandoffMode = () =>
    $context.isEmbed &&
    ($context.os === OperatingSystem.IOS ||
      $context.os === OperatingSystem.MACOS)
      ? "session-token"
      : "none";
  const resolveNativeUrlScheme = () => {
    return $appStore.product.toLowerCase();
  };
  const signIn = async (provider: string) => {
    const response = await (
      await authClient({ region })
    ).startSocialSignIn({
      provider: provider as "apple" | "google" | "github",
      returnTo: resolveReturnTo(),
      callbackMode: "redirect",
      handoffMode: resolveHandoffMode()
    });
    if (response.ok) {
      window.location.href = response.data.redirectTo;
    } else {
      throw new Error(response.error.message);
    }
  };

  async function onClick(provider: string) {
    currentProgress = provider;
    logger.info({
      at: "OAuthOptions.onClick",
      isEmbed: $context.isEmbed,
      os: $context.os,
      provider,
      accountUrl: resolveAccountBaseUrl(region ?? "insouth"),
      returnTo: resolveReturnTo(),
      handoffMode: resolveHandoffMode()
    });
    try {
      if ($context.isEmbed) {
        if (provider === "apple" && $context.os === OperatingSystem.IOS) {
          postDataToParent(EmbedDataMessage.AUTHFN_NATIVE_APPLE_SIGN_IN, {
            accountUrl: resolveAccountBaseUrl(region ?? "insouth"),
            returnTo: resolveReturnTo(),
            handoffMode: resolveHandoffMode()
          });
          return;
        }

        const response = await (
          await authClient({ region })
        ).startSocialSignIn({
          provider: provider as "apple" | "google" | "github",
          returnTo: resolveReturnTo(),
          callbackMode: "redirect",
          handoffMode: resolveHandoffMode()
        });
        if (response.ok) {
          logger.info({
            at: "OAuthOptions.startSocialSignIn.ok",
            provider,
            isEmbed: true,
            redirectTo: response.data.redirectTo
          });
          navigation.openLink(response.data.redirectTo, true);
        } else {
          logger.error({
            at: "OAuthOptions.startSocialSignIn.failed",
            provider,
            error: response.error
          });
          throw new Error(response.error.message);
        }
      } else {
        await signIn(provider);
      }
    } catch (e) {
      logger.error({ at: "OAuthOptions.onClick.error", provider }, e);
    }
  }
</script>

<div
  class={cn("flex w-full gap-4", {
    "flex-col": isExpanded,
    "justify-center": !isExpanded
  })}
>
  {#if providers && providers.length > 0}
    {#each providers as provider}
      {#if isExpanded}
        <Button
          id={provider === "apple"
            ? "appleid-disabled-signin"
            : provider + "-signin"}
          isExpandToFullWidth={isExpanded}
          icon={provider + "-oauth-logo"}
          isLoading={currentProgress === provider}
          label={isExpanded
            ? "Continue with " + properCase(provider)
            : undefined}
          onclick={() => onClick(provider)}
        />
      {:else}
        <button
          class="w-12 h-12 rounded-full flex items-center justify-center bg-bgs2 hover:bg-bgs2-striped"
          onclick={() => onClick(provider)}
        >
          <Icon
            icon={provider + "-oauth-logo"}
            size={Size.md}
            class="text-fgs1 fill-fgs1"
          />
        </button>
      {/if}
    {/each}
  {/if}
</div>
