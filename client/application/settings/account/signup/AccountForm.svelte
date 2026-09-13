<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { page } from "$app/stores";
  import Button from "@21n/elements/button/Button.svelte";
  import TextInput from "@21n/elements/input/TextInput.svelte";
  import InlineErrorMessage from "@21n/elements/text/InlineErrorMessage.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import { EmbedMessage } from "@nucleum/client/runtime/embed/embedMessage.enum";
  import {
    postMessageToParent,
    postTokenToExtension
  } from "@nucleum/client/runtime/embed/embed.utils";
  import { isValidEmail } from "@21n/shared-utils/text.utils";
  import { onMount } from "svelte";
  import OAuthButtons from "@nucleum/application/oauth/OAuthButtons.svelte";
  import { isValidArrayWithData } from "@21n/shared-utils/obj.utils";
  import account from "@nucleum/stores/account.store";
  import view from "@nucleum/stores/view.store";
  import { Orientation } from "@21n/elements/direction.enum";
  import { Action } from "@nucleum/client/config/action.enum";
  import Icon from "@21n/elements/Icon.svelte";
  import { cn } from "@21n/utils/ui.utils";
  import { ButtonStyle } from "@21n/elements/button/button.type";
  import { Size } from "@21n/elements/size.enum";
  import {
    authClient,
    resolveAuthFnSessionMode
  } from "@nucleum/client/runtime/account/auth";
  import type { AuthFnSession } from "@authfn/client";
  let {
    isSignup: initialIsSignup = false,
    currentProgress = $bindable(),
    isLoginFromExtension = false,
    isSelfHosted = false
  }: {
    isSignup?: boolean;
    currentProgress?: string | undefined;
    isLoginFromExtension?: boolean;
    isSelfHosted?: boolean;
  } = $props();
  let isSignup = $state(false);
  let email = $state("");
  let pass = $state("");
  let nickName = $state("");
  let error = $state<string | null>(null);
  let actionInProgress = $state(false);
  const mode = $derived(resolveMode(isLoginFromExtension, isSelfHosted));

  $effect(() => {
    isSignup = initialIsSignup;
  });

  onMount(() => {
    postMessageToParent(EmbedMessage.MOUNT);
    const isSignupQueryParam = $page.url.searchParams.get("signup");
    if (isSignupQueryParam && isSignupQueryParam === "true") isSignup = true;
  });

  function resolveMode(
    isLoginFromExtensionParam: boolean,
    isSelfHostedParam: boolean
  ) {
    if (isLoginFromExtensionParam) {
      return "cloud-only";
    } else if (isSelfHostedParam) {
      return "offline-only";
    }
    return "all";
  }

  async function handleClick() {
    if (!isValidFormData()) return;
    actionInProgress = true;
    const client = await authClient();
    const sessionMode = isLoginFromExtension
      ? "hybrid"
      : resolveAuthFnSessionMode();
    const response = isSignup
      ? await client.signUpWithPassword({
          email: email.toLowerCase(),
          password: pass,
          profile: { nickName },
          sessionMode
        })
      : await client.signInWithPassword({
          email: email.toLowerCase(),
          password: pass,
          sessionMode
        });
    if (!response.ok) {
      if (response.error.code === "AUTHFN_REGION_MISMATCH") {
        showError(
          "This account belongs to another region. Please sign in again."
        );
      } else if (response.error.code === "AUTHFN_INVALID_CREDENTIALS") {
        showError("Invalid email or password.");
      } else if (response.error.code === "AUTHFN_DUPLICATE_IDENTITY") {
        showError("User already exists. Please signin instead.");
      } else {
        showError(response.error.message);
      }
      actionInProgress = false;
      return;
    }
    const token = response.data.token;
    const session = response.data.session;
    if (!session || (isLoginFromExtension && !token)) {
      showError();
      actionInProgress = false;
      return;
    }
    const json = {
      token,
      userInfo: userInfoFromSession(session)
    };
    if (isLoginFromExtension) {
      postTokenToExtension(json);
      requireCommandHost().runAction(Action.EXTENSTION_LOGIN);
    } else {
      await account.signInFromAuthFnSession({
        session,
        isNewUser: isSignup,
        persistToken: false
      });
    }
    actionInProgress = false;
  }
  function isValidFormData() {
    if (!email || !pass) {
      showError("Please fill all the fields.");
      return false;
    }
    if (!isValidEmail(email)) {
      showError("Please enter a valid email address.");
      return false;
    }
    if (isSignup && !isValidPasswordChoice()) return;
    return true;
  }
  function isValidPasswordChoice() {
    if (pass.length < 12) {
      showError("Password must be at least 12 characters long.");
      return false;
    }
    if (!pass.match(/[a-z]/)) {
      showError("Password must contain at least one lowercase letter.");
      return false;
    }
    if (!pass.match(/[A-Z]/)) {
      showError("Password must contain at least one uppercase letter.");
      return false;
    }
    if (!pass.match(/[0-9]/)) {
      showError("Password must contain at least one number.");
      return false;
    }
    if (!pass.match(/[^a-zA-Z0-9]/)) {
      showError("Password must contain at least one special character.");
      return false;
    }
    return true;
  }

  function showError(message: string | null = null) {
    actionInProgress = false;
    error = message ?? "Something went wrong. Please try again later.";
  }

  function userInfoFromSession(session: AuthFnSession) {
    const email = session.primaryEmail ?? session.subject.email ?? "";
    return {
      id: session.actorId.startsWith("user:")
        ? session.actorId
        : `user:${session.actorId}`,
      email,
      nickName: nickName || email.split("@")[0] || "",
      joinDate: new Date(),
      lastLogin: new Date(),
      isBootstrapped:
        (session.metadata?.nucleus as { isBootstrapped?: boolean } | undefined)
          ?.isBootstrapped ?? true,
      region: session.regionId ?? session.subject.regionId
    };
  }

  async function onOfflineClick() {
    await account.startOfflineSession();
    navigation.gotoPath("/");
  }
</script>

<!-- transition:fade -->
<div class="flex flex-col w-96 {$view.scale > 0.6 ? 'gap-10' : 'gap-6'}">
  <!-- TODO - reenable email signin/signup upon completion of forgot password flow -->
  {#if $appStore.isDebugMode}
    <div class="flex flex-col gap-2 justify-center items-center">
      <div class="flex flex-col w-full gap-4">
        <TextInput
          bind:value={email}
          label={{
            label: "Email",
            orientation: Orientation.Vertical,
            tooltip: isSignup
              ? {
                  body:
                    $appStore.appData.name +
                    " doesn't store your email or password.",
                  action: $appStore.appData?.urls?.privacy
                }
              : undefined
          }}
          placeholder="username@email.com"
        />
        <TextInput
          bind:value={pass}
          id="password"
          label={{
            label: "Password",
            orientation: Orientation.Vertical,
            tooltip: isSignup
              ? {
                  body: "Password must be at least 12 characters long and contain at least one lowercase letter, one uppercase letter, one number and one special character."
                }
              : undefined
          }}
          type="password"
          placeholder="********"
        />
      </div>
      <InlineErrorMessage bind:error />
      <Button
        isExpandToFullWidth={true}
        type="primary"
        label={isSignup
          ? actionInProgress
            ? "Signing up..."
            : "Sign up with email"
          : actionInProgress
            ? "Signing in..."
            : "Sign in"}
        isLoading={actionInProgress}
        onclick={handleClick}
      />
    </div>
  {/if}
  {#if $appStore.isDebugMode}
    <div class="w-full flex justify-center items-center text-fgs3 text-b3 px-4">
      <hr class="grow border-t border-bgs4" />
      <div class="px-2">or</div>
      <hr class="grow border-t border-bgs4" />
    </div>
  {/if}

  <div class="flex flex-col justify-center self-center cw:w-80 w-96">
    {#if mode !== "offline-only"}
      <div
        class={cn("group flex flex-col justify-between gap-4 p-4", {
          "cw:h-fit h-72 bg-bgs1 border-t-transparent border-x-transparent border-t border-x border-brs3 hover:border-t-brs3 hover:border-x-brs3 hover:rounded-t-md rounded-t-md":
            mode === "all" && !$view.isPortrait
        })}
      >
        {#if mode === "all" && !$view.isPortrait}
          <div class="text-fgs3 text-center">Sync across devices</div>
        {/if}
        {#if isValidArrayWithData($appStore?.appData?.oAuthConfig)}
          <OAuthButtons bind:currentProgress />
        {/if}
        {#if !$view.isPortrait}
          <div
            class={cn(
              "text-fgs3 text-b3 text-center transition-opacity duration-300",
              {
                "opacity-80 group-hover:opacity-100": mode === "all"
              }
            )}
          >
            Includes a 14-day free trial. No credit card required.
          </div>
        {/if}
      </div>
    {/if}
    {#if mode !== "cloud-only" && $view.isPortrait}
      <div class="flex items-center cw:w-80 w-96 p-4 mx-auto">
        <Button
          label="Continue offline"
          icon="proceed"
          size={Size.lg}
          isExpandToFullWidth={true}
          style={ButtonStyle.OUTLINED}
          onclick={onOfflineClick}
        />
      </div>
    {:else if mode !== "cloud-only" && !$view.isPortrait}
      <button
        class={cn(
          "group flex flex-col justify-center items-center w-full  p-3",
          {
            "cw:h-48 h-60 bg-bgs1 hover:border-x-brs3 hover:border-b-brs3 rounded-b-md border border-x-transparent border-b-transparent border-brs3":
              mode === "all"
          }
        )}
        onclick={onOfflineClick}
      >
        <div
          class="flex items-center gap-2 group-hover:translate-x-1 transition-transform duration-300 my-auto"
        >
          <Icon icon="proceed" />
          Continue offline
        </div>
        {#if mode === "all"}
          <div
            class="text-fgs3 text-b3 opacity-80 group-hover:opacity-100 transition-opacity duration-300"
          >
            Single device use & free forever. No signup required.
          </div>
        {/if}
      </button>
    {/if}
  </div>
</div>
