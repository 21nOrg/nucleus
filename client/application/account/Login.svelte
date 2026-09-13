<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { appStore } from "@nucleum/stores/app.store";
  import { onMount } from "svelte";
  import { properCase } from "@21n/shared-utils/text.utils";
  import PoliciesFooter from "@21n/elements/PoliciesFooter.svelte";
  import Button from "@21n/elements/button/Button.svelte";
  import { ButtonStyle } from "@21n/elements/button/button.type";
  import { Size } from "@21n/elements/size.enum";
  import view from "@nucleum/stores/view.store";
  import BoxSwitcher from "@21n/elements/switcher/BoxSwitcher.svelte";
  import CloudSyncLogin from "@nucleum/application/account/CloudSyncLogin.svelte";
  import { cn } from "@21n/utils/ui.utils";
  import { Display } from "@21n/elements/display.enum";
  import { parse } from "@21n/shared-utils/json.utils";
  import { toasts } from "@nucleum/stores/notification.store";
  import { page } from "$app/stores";
  import account from "@nucleum/stores/account.store";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { clientStorage } from "@nucleum/persistence/persistence.utils";
  import { ClientStorageKey } from "@nucleum/persistence/persistence.type";
  let selectedMode = $state<"signup" | "signin" | "offline">("signup");
  let currentProgress = $state<string | undefined>(undefined);
  let cloudSyncLoginRef = $state<CloudSyncLogin | undefined>(undefined);
  let isLoginFromExtension = $state(false);
  const dev_isEnableCaptcha = false;
  const managedSyncHosts = [
    "localhost",
    "21n.dev",
    "memotron.app",
    "pointron.app",
    "nucleus.to"
  ];
  let isSelfHosted = $state(
    typeof window !== "undefined" ? resolveIfSelfHostedInstance() : false
  );

  function resolveProductName() {
    return properCase($appStore.product);
  }

  function resolveIsExpandOAuthButtons() {
    return !$view.isConstrainedWidth && $view.display === Display.TK;
  }

  function resolveIfSelfHostedInstance() {
    const host = window.location.hostname;
    return !managedSyncHosts.some((h) => host === h || host.endsWith(`.${h}`));
  }

  function onTurnstileSuccess(_token) {
    logger.debug({ at: "Login.turnstile.success" });
  }
  function onTurnstileError(errorCode) {
    console.error("Turnstile error:", errorCode);
  }
  function onTurnstileExpired() {
    console.warn("Turnstile token expired");
  }

  onMount(() => {
    window.onTurnstileSuccess = onTurnstileSuccess;
    window.onTurnstileError = onTurnstileError;
    window.onTurnstileExpired = onTurnstileExpired;
    window.addEventListener("message", handleMessageFromParent);
    void finishOAuthCallbackLogin();
    if (dev_isEnableCaptcha && import.meta.env.VITE_NATIVE_EMBED !== "true") {
      loadTurnstileScript();
    }

    return () => {
      window.removeEventListener("message", handleMessageFromParent);
      delete window.onTurnstileSuccess;
      delete window.onTurnstileError;
      delete window.onTurnstileExpired;
    };
  });

  async function finishOAuthCallbackLogin() {
    const isOAuthCallback =
      $page.url.searchParams.get("oauth_callback") === "1";
    if ($page.url.searchParams.has("auth_error")) return;

    if (isOAuthCallback) {
      currentProgress = "oauth";
    }
    try {
      const signedIn = await account.signInFromAuthFnSession();
      if (!signedIn) {
        if (isOAuthCallback) {
          toasts.error("Authentication failed. Please try again.");
          currentProgress = undefined;
        }
      }
    } catch (error) {
      logger.error({ at: "Login.finishOAuthCallbackLogin", error });
      if (isOAuthCallback) {
        toasts.error("Authentication failed. Please try again.");
      }
      currentProgress = undefined;
    }
  }

  function loadTurnstileScript() {
    const preconnectId = "turnstile-preconnect";
    const scriptId = "turnstile-script";
    if (!document.getElementById(preconnectId)) {
      const preconnect = document.createElement("link");
      preconnect.id = preconnectId;
      preconnect.rel = "preconnect";
      preconnect.href = "https://challenges.cloudflare.com";
      document.head.appendChild(preconnect);
    }
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }

  async function handleMessageFromParent(event: MessageEvent) {
    try {
      const isOriginAllowed = window.location.origin === event.origin;
      if (!isOriginAllowed) {
        console.warn(
          "Rejected message from untrusted origin:",
          event.origin,
          "currentOrigin:",
          window.location.origin
        );
        return;
      }

      if (event?.data?.type === "SWIFT_MESSAGE" && event?.data?.payload) {
        if (typeof event.data.payload !== "string") return;
        if (!event.data.payload.trim().startsWith("{")) return;
        const parsed = parse(event.data.payload);
        if (parsed.oauth) {
          logger.info({
            at: "Login.handleMessageFromParent.oauth.received",
            hasToken: Boolean(parsed.oauth.token),
            hasError: Boolean(parsed.oauth.error || parsed.oauth.errorCode),
            isSignup: parsed.oauth.signup === "true",
            regionId: parsed.oauth.regionId
          });
          currentProgress = undefined;
          let { token } = parsed.oauth;
          if (token) {
            if (token.endsWith("#")) {
              token = token.slice(0, -1);
            }
          }
          if (!token) {
            logger.error({
              at: "Login.handleMessageFromParent.oauth.failed",
              error: parsed.oauth.error,
              errorCode: parsed.oauth.errorCode,
              provider: parsed.oauth.provider,
              requestId: parsed.oauth.requestId
            });
            toasts.error("Authentication failed. Please try again.");
            return;
          }
          localStorage.setItem("embedToken", token);
          if (parsed.oauth.regionId) {
            await clientStorage.set(
              ClientStorageKey.REGION,
              parsed.oauth.regionId
            );
          }
          logger.info({
            at: "Login.handleMessageFromParent.oauth.token.received",
            isSignup: parsed.oauth.signup === "true",
            regionId: parsed.oauth.regionId
          });
          const signedIn = await account.signInFromAuthFnSession({
            token,
            regionId: parsed.oauth.regionId,
            isNewUser: parsed.oauth.signup === "true",
            isPreventRedirect: true,
            persistToken: true
          });
          if (!signedIn) {
            logger.error({
              at: "Login.handleMessageFromParent.oauth.session.failed",
              hasToken: true
            });
            toasts.error("Authentication failed. Please try again.");
            return;
          }
          account.gotoPostAuthRoute({
            isNewUser: parsed.oauth.signup === "true"
          });
          logger.info({
            at: "Login.handleMessageFromParent.oauth.redirect.requested",
            isSignup: parsed.oauth.signup === "true",
            currentPath: window.location.pathname
          });
        }
      }
    } catch (e) {
      logger.error({ at: "Login.handleMessageFromParent", error: e });
    }
  }

  async function onOfflineClick() {
    await account.startOfflineSession();
    navigation.gotoPath("/");
  }
</script>

<div
  class="w-full grid portrait:grid-rows-[1fr,auto] grid-rows-[auto,1fr,auto] gap-12 h-full"
>
  {#if !$view.isPortrait}
    {#if isLoginFromExtension}
      <div
        class="flex flex-col gap-2 justify-center items-center w-full cw:pt-6 pt-12"
      >
        <div class="text-h4 text-center w-full">
          Thanks for installing {resolveProductName()} extension.
        </div>
        <div class="text-fgs3 text-b2 text-center">
          Click continue to login to your account.
        </div>
      </div>
    {:else}
      <div class="flex flex-col items-center gap-1 cw:pt-6 pt-12">
        <h3 class="text-h3 text-center font-medium">
          Welcome to {resolveProductName()}
        </h3>
        <!-- <div class="text-fgs3 text-b2 text-center">
                {isSelfHosted ? "[Self-hosted instance]" : "Sign up or Log in"}
              </div> -->
      </div>
    {/if}
  {/if}
  {#if $appStore.appData.auth?.isInviteOnly}
    <div class="font-medium px-4 text-center text-ass1 text-b2 -mb-4">
      This product is invite only. Please use the invite link to sign up.
    </div>
  {:else}
    <div class="flex flex-col gap-6 w-full items-center justify-center">
      <div class="h-12">
        <BoxSwitcher
          bind:selected={selectedMode}
          options={[
            {
              value: "signup",
              label: "Sign up"
            },
            {
              value: "signin",
              label: "Log in"
            },
            {
              value: "offline",
              label: "Offline"
            }
          ]}
          onSelect={() => {
            if (cloudSyncLoginRef) {
              cloudSyncLoginRef.reset();
            }
          }}
        />
      </div>
      <div
        class={cn(
          "cw:h-[30rem] flex flex-col gap-6 justify-center transition-all duration-300",
          {
            "h-[42rem]": resolveIsExpandOAuthButtons(),
            "h-[32rem]": !resolveIsExpandOAuthButtons()
          }
        )}
      >
        {#if selectedMode === "signup" || selectedMode === "signin"}
          <CloudSyncLogin
            isSignup={selectedMode === "signup"}
            isExpandOAuthButtons={resolveIsExpandOAuthButtons()}
            bind:this={cloudSyncLoginRef}
          />
        {:else}
          <Button
            label="Continue using offline"
            icon="proceed"
            onclick={onOfflineClick}
          />
        {/if}
        <div
          class="text-fgs3 text-b3 opacity-80 group-hover:opacity-100 transition-opacity duration-300"
        >
          {#if selectedMode === "offline"}
            Single device use & free forever. No signup required.
          {:else if selectedMode === "signup"}
            Includes a 14-day free trial. No credit card required.
          {/if}
          {#if dev_isEnableCaptcha}
            <div class="my-2">
              <div
                class="cf-turnstile"
                data-sitekey="0x4AAAAAACATamWGPvJohc2V"
                data-theme="auto"
                data-size="flexible"
                data-callback="onTurnstileSuccess"
                data-error-callback="onTurnstileError"
                data-expired-callback="onTurnstileExpired"
              ></div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
  <div class="flex flex-col items-center gap-6 pb-12">
    {#if !isSelfHosted}
      <PoliciesFooter pretext="By signing up, you agree to our" />
    {/if}
    {#if $view.display === Display.TK}
      <div class="flex items-center gap-12">
        {#if isSelfHosted}
          <Button
            label="Github"
            style={ButtonStyle.PLAIN}
            icon="weblink-two"
            size={Size.sm}
            onclick={() => {
              if ($appStore.appData?.urls?.git)
                navigation.openLink($appStore.appData?.urls?.git);
            }}
          />
        {/if}
        <Button
          label="Pricing"
          style={ButtonStyle.PLAIN}
          icon="weblink-two"
          size={Size.sm}
          onclick={() => {
            if ($appStore.appData?.urls?.pricing)
              navigation.openLink($appStore.appData?.urls?.pricing);
            else if ($appStore.appData?.urls?.landing)
              navigation.openLink(
                `https://${$appStore.appData?.urls?.landing}/pricing`
              );
          }}
        />
        <Button
          label="Docs"
          icon="weblink-two"
          style={ButtonStyle.PLAIN}
          size={Size.sm}
          onclick={() => {
            if ($appStore.appData?.urls?.docs)
              navigation.openLink($appStore.appData?.urls?.docs);
          }}
        />
        <Button
          label="Discord"
          icon="weblink-two"
          style={ButtonStyle.PLAIN}
          size={Size.sm}
          onclick={() => {
            if ($appStore.appData?.urls?.discord)
              navigation.openLink($appStore.appData?.urls?.discord);
          }}
        />
      </div>
    {/if}
  </div>
</div>
