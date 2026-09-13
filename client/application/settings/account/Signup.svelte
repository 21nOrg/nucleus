<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { appStore } from "@nucleum/stores/app.store";
  import AccountForm from "@nucleum/application/settings/account/signup/AccountForm.svelte";
  import PanelSwitcher from "@21n/elements/switcher/PanelSwitcher.svelte";
  import { PanelSwitcherStyle } from "@21n/elements/switcher/switcher.enum";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import SubAtomLogo from "@21n/branding/SubAtomLogo.svelte";
  import { properCase } from "@21n/shared-utils/text.utils";
  import { ClientStorageKey } from "@nucleum/persistence/persistence.type";
  import { clientStorage } from "@nucleum/persistence/persistence.utils";
  import PoliciesFooter from "@21n/elements/PoliciesFooter.svelte";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  import account from "@nucleum/stores/account.store";
  import { toasts } from "@nucleum/stores/notification.store";
  import AppLoadingView from "@21n/layout/paint/AppLoadingView.svelte";
  import { parse } from "@21n/shared-utils/json.utils";
  import Button from "@21n/elements/button/Button.svelte";
  import { ButtonStyle } from "@21n/elements/button/button.type";
  import { Size } from "@21n/elements/size.enum";
  import view from "@nucleum/stores/view.store";
  import { authClient } from "@nucleum/client/runtime/account/auth";
  let isSignup = $state(true);
  let authMode = $state("Sign up");
  let currentProgress = $state<string | undefined>(undefined);
  let isSigningIn = $state(false);
  let isLoginFromExtension = $state(false);
  const managedSyncHosts = [
    "localhost",
    "21n.dev",
    "memotron.app",
    "pointron.app",
    "nucleus.to",
    "nucleum.app"
  ];
  let isSelfHosted =
    typeof window !== "undefined" ? resolveIfSelfHostedInstance() : false;
  const messageParam = $derived($page.url.searchParams.get(AppSearchParam.MSG));
  const productName = $derived(properCase($appStore.product));
  const messageText = $derived.by(() => {
    if (messageParam === "deleted") {
      return "Your account has been deleted.";
    }
    if (messageParam === "signedout") {
      return "You have been signed out.";
    }
    if (messageParam === "expired") {
      return "Your session has expired. Please login again.";
    }
    if (messageParam === "notfound") {
      return "User not found. Please login again.";
    }
    return undefined;
  });

  onMount(async () => {
    const isLoginFromExtensionParam = $page.url.searchParams.get(
      AppSearchParam.EXT
    );
    if (isLoginFromExtensionParam && isLoginFromExtensionParam === "true") {
      isLoginFromExtension = true;
      clientStorage.setForSession(ClientStorageKey.IS_EXTENSION_LOGIN, true);
    }
    const session = await (await authClient()).getSession();
    if (session.ok && session.data.session) {
      navigation.gotoPath("/");
    }
  });

  $effect(() => {
    authMode = isSignup ? "Sign up" : "Sign in";
  });

  $effect(() => {
    isSignup = authMode === "Sign up";
  });

  function resolveIfSelfHostedInstance() {
    const host = window.location.hostname;
    return !managedSyncHosts.some((h) => host === h || host.endsWith(`.${h}`));
  }

  async function handleMessageFromParent(event: MessageEvent) {
    try {
      if (!isTrustedNativeMessage(event)) return;
      if (event?.data?.type === "SWIFT_MESSAGE" && event?.data?.payload) {
        if (typeof event.data.payload !== "string") return;
        if (!event.data.payload.trim().startsWith("{")) return;
        const parsed = parse(event.data.payload);
        console.log({
          at: "Signup - handleMessageFromParent - SWIFT_MESSAGE",
          parsed
        });
        if (parsed.oauth) {
          currentProgress = undefined;
          const { token } = parsed.oauth;
          if (!token) {
            toasts.error();
            return;
          }
          try {
            isSigningIn = true;
            if (parsed.oauth.regionId) {
              await clientStorage.set(
                ClientStorageKey.REGION,
                parsed.oauth.regionId
              );
            }
            await account.embedOAuthSignin(token);
          } finally {
            isSigningIn = false;
          }
        }
      }
    } catch (e) {
      console.error({ at: "Signup - handleMessageFromParent", error: e });
    }
  }

  function isTrustedNativeMessage(event: MessageEvent) {
    if (event?.data?.type !== "SWIFT_MESSAGE") return true;
    if (event.source !== window) return false;
    return event.origin === window.location.origin || event.origin === "null";
  }
</script>

{#if isSigningIn}
  <AppLoadingView message={"Signing you in..."} />
{:else}
  <div class="flex flex-col w-full h-full justify-center cw:pt-8">
    <div
      class="w-full h-full grid grid-cols-2 portrait:grid-cols-1 portrait:justify-start justify-center items-center gap-12 portrait:gap-6"
    >
      <!-- <div class="flex flex-col items-center">
      <SubAtomLogo subatom="pointron" isDark={true} />
      <div class="font-medium text-h3 text-fgs2">
        {$appStore.appData.name}
      </div>
    </div> -->

      <div class="flex flex-col justify-center gap-6 h-full">
        <!-- TODO - reenable email signin/signup upon completion of forgot password flow -->
        {#if $appStore.isDebugMode}
          <PanelSwitcher
            items={["Sign up", "Sign in"]}
            bind:value={authMode}
            style={PanelSwitcherStyle.BAR}
          />
        {:else}
          <div
            class="w-full flex flex-col justify-center items-center cw:h-fit h-40"
          >
            <SubAtomLogo subatom={$appStore.product} />
            <div class="font-medium">
              {properCase($appStore.product)}
            </div>
          </div>
        {/if}
        {#if messageText}
          <div class="font-medium px-4 text-center text-ass1 text-b2 -mb-4">
            {messageText}
          </div>
        {/if}
      </div>
      <div
        class="w-full grid portrait:grid-rows-[1fr,auto] grid-rows-[auto,1fr,auto] portrait:bg-bgs1 bg-bgs2 h-full"
      >
        {#if !$view.isPortrait}
          {#if isLoginFromExtension}
            <div
              class="flex flex-col gap-2 justify-center items-center w-full cw:pt-6 pt-12"
            >
              <div class="text-h4 text-center w-full">
                Thanks for installing {productName} extension.
              </div>
              <div class="text-fgs3 text-b2 text-center">
                Click continue to login to your account.
              </div>
            </div>
          {:else}
            <div class="flex flex-col items-center gap-1 cw:pt-6 pt-12">
              <h3 class="text-h3 text-center font-medium">
                Welcome to {productName}
              </h3>
              <div class="text-fgs3 text-b2 text-center">
                {isSelfHosted ? "[Self-hosted instance]" : "Sign up or Log in"}
              </div>
            </div>
          {/if}
        {/if}
        {#if $appStore.appData.auth?.isInviteOnly}
          <div class="font-medium px-4 text-center text-ass1 text-b2 -mb-4">
            This product is invite only. Please use the invite link to sign up.
          </div>
        {:else}
          <div class="flex w-full justify-center items-center">
            <AccountForm
              {isSignup}
              bind:currentProgress
              {isLoginFromExtension}
              {isSelfHosted}
            />
          </div>
        {/if}
        {#if isSignup}
          <div class="flex flex-col items-center gap-6 pb-12">
            {#if !isSelfHosted}
              <PoliciesFooter pretext="By signing up, you agree to our" />
            {/if}
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
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<svelte:window onmessage={handleMessageFromParent} />
