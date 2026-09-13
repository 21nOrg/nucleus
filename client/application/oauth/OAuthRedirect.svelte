<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { page } from "$app/stores";
  import AppLoadingView from "@21n/layout/paint/AppLoadingView.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import account from "@nucleum/stores/account.store";
  import { handleOAuthRedirection } from "@nucleum/application/oauth/oauth.utils";
  import { onMount } from "svelte";
  import context from "@nucleum/stores/context.store";
  import { OperatingSystem } from "@nucleum/client/runtime/context.type";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { ClientStorageKey } from "@nucleum/persistence/persistence.type";
  import { clientStorage } from "@nucleum/persistence/persistence.utils";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  let debugMessage = "debug";
  onMount(async () => {
    try {
      let codeQueryParam = $page.url.searchParams.get(AppSearchParam.CODE);
      let token = $page.url.searchParams.get(AppSearchParam.TOKEN);
      if (token) {
        debugMessage = "token present";
        handleOAuthCompletion({ token });
      } else if (!codeQueryParam) {
        navigation.gotoPath("/signup?msg=invalidoauth");
        return;
      } else {
        debugMessage = "code present. processing oauth";
        let response = await handleOAuthRedirection(
          $page.params.slug,
          codeQueryParam
        );
        if (!response) {
          navigation.gotoErrorPage("OAuth failure");
          return;
        }
        const json = await response.json();
        debugMessage = `isEmbed: ${$context.isEmbed} and os: ${$context.os}`;
        handleOAuthCompletion(json);
      }
    } catch (e) {
      console.error({ at: "OAuthRedirect.onMount", error: e });
      navigation.gotoErrorPage("OAuth failure");
    }
  });

  async function handleOAuthCompletion(data: {
    token: string;
    userInfo?: any;
  }) {
    const isEmbedRedirection = await clientStorage.getForSession(
      ClientStorageKey.EMBED_OAUTH
    );
    console.log({
      ctx: "handleOAuthCompletion",
      os: $context.os,
      isEmbed: $context.isEmbed,
      embed: $context.embed,
      userAgent: navigator.userAgent,
      isEmbedRedirection
    });
    if ($context.os == OperatingSystem.MACOS && $context.isEmbed) {
      handleMacOSEmbedRedirection(data.token);
    } else if (
      $context.os == OperatingSystem.IOS ||
      (isEmbedRedirection &&
        ($context.os === OperatingSystem.MACOS ||
          $context.os === OperatingSystem.WINDOWS))
    ) {
      handleUrlSchemeRedirection(data.token);
    } else if (data.userInfo) {
      debugMessage = "signing in with oauth";
      account.signIn({ ...data, userInfo: data.userInfo });
    } else if (data.token) {
      debugMessage = "signing in using embed token";
      await account.embedOAuthSignin(data.token);
    }
  }

  async function handleUrlSchemeRedirection(token: string) {
    try {
      debugMessage = "ios - url scheme redirection";
      console.log({
        ctx: "handleUrlSchemeRedirection",
        product: $appStore.product
      });
      navigation.gotoPath(
        $appStore.product + "://oauthsignin" + "?token=" + token
      );
    } catch (err) {
      debugMessage = "ios - url scheme redirection error" + err;
      console.error({ err, ctx: "handleUrlSchemeRedirection" });
      navigation.gotoErrorPage(debugMessage);
    }
  }
  async function handleMacOSEmbedRedirection(token: string) {
    try {
      debugMessage = "macos - embed redirection";
      logger.log({
        ctx: "handleMacOSEmbedRedirection"
      });
      navigation.gotoPath(
        (import.meta.env?.VITE_CUSTOM_PROTOCOL ?? "tauri") +
          "://localhost/index.html" +
          "?token=" +
          token
      );
    } catch (err) {
      debugMessage = "macos - embed redirection error" + err;
      logger.error({ err, ctx: "handleMacOSEmbedRedirection" });
      navigation.gotoErrorPage(debugMessage);
    }
  }
</script>

<AppLoadingView message="Signing you in" />
<!-- <AppLoadingView message={debugMessage} /> -->
