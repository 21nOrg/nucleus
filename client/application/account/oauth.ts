import { navigation } from "@21n/layout/navigation/navigation";
import { get } from "svelte/store";

import { IdentityProvider } from "@nucleum/client/runtime/account/oauth.type";
import { goto } from "@21n/utils/browser.utils";
import { getDapId } from "@nucleum/persistence/persistence.utils";

import context from "@nucleum/stores/context.store";

import { OperatingSystem } from "@nucleum/client/runtime/context.type";

import { appStore } from "@nucleum/stores/app.store";

/** Starts the configured legacy OAuth flow for the application login route. */
export const oauth = {
  initiateOAuth2Flow: async (provider: IdentityProvider, guest?: string) => {
    const ctx = get(context);
    const app = get(appStore);
    const oAuthConfig = app.appData?.oAuthConfig;
    if (!oAuthConfig || oAuthConfig.length < 1) return;
    const config = oAuthConfig.find((c) => c.provider === provider);
    if (!config) return;
    const dev = import.meta.env?.DEV;
    const host =
      ctx.isEmbed || dev || window.location.hostname === "localhost"
        ? import.meta.env?.VITE_HOST
        : window.location.hostname;
    const guestPartForState = guest ?? (await getDapId()) ?? "";
    const domainPartForState =
      ctx.os === OperatingSystem.MACOS &&
      ctx.isEmbed &&
      provider === IdentityProvider.Apple
        ? `localredirect.${host}`
        : ctx.isEmbed &&
            (ctx.os === OperatingSystem.IOS || ctx.os === OperatingSystem.MACOS)
          ? `${app.product.toLowerCase()}_schemeredirect.${host}`
          : host;
    const state = guestPartForState + ":" + domainPartForState;
    const authorizationUrl = new URL(config.authorise_url);
    authorizationUrl.searchParams.set("client_id", config.client_id);
    authorizationUrl.searchParams.set("scope", config.scope);
    authorizationUrl.searchParams.set(
      "response_type",
      config.response_type ?? "code"
    );
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("prompt", "select_account");
    let redirectUri = "";
    if (config.response_mode === "form_post") {
      authorizationUrl.searchParams.set("response_mode", "form_post");
    }
    if (config.isRedirectToClient) {
      const clientRedirect = ctx.isEmbed
        ? (import.meta.env?.VITE_OAUTH_REDIRECT ?? "https://" + host)
        : window.location.origin;
      redirectUri = clientRedirect + "/oauth/" + config.oauth_slug;
    } else {
      redirectUri =
        import.meta.env?.VITE_API_URL + "/oauth/" + config.oauth_slug;
    }
    if (config.code_challenge_method) {
      authorizationUrl.searchParams.set("code_challenge", "challenge");
      authorizationUrl.searchParams.set(
        "code_challenge_method",
        config.code_challenge_method
      );
    }
    if (!redirectUri) return;
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    let url = authorizationUrl.href;
    if (ctx.isEmbed) {
      if (
        provider === IdentityProvider.Apple &&
        ctx.os === OperatingSystem.MACOS
      ) {
        goto(url);
        return;
      }
      if (
        config.isUseAuthClient &&
        (ctx.os === OperatingSystem.MACOS || ctx.os === OperatingSystem.WINDOWS)
      ) {
        const authClientHost = dev
          ? "http://localhost:5002"
          : `https://${import.meta.env?.VITE_HOST}`;
        const authClientUrl = new URL("/embed", authClientHost);
        authClientUrl.searchParams.set("provider", config.oauth_slug);
        authClientUrl.searchParams.set("guest", guestPartForState);
        url = authClientUrl.href;
      }
      navigation.openLink(
        url,
        ctx.os === OperatingSystem.IOS || ctx.os === OperatingSystem.MACOS
      );
    } else {
      goto(url);
    }
  }
};
