<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { page } from "$app/stores";
  import Button from "@21n/elements/button/Button.svelte";
  import TextInput from "@21n/elements/input/TextInput.svelte";

  import {
    EmbedDataMessage,
    EmbedMessage
  } from "@nucleum/client/runtime/embed/embedMessage.enum";
  import {
    postDataToParent,
    postMessageToParent
  } from "@nucleum/client/runtime/embed/embed.utils";
  import { isValidEmail } from "@21n/shared-utils/text.utils";
  import { onMount } from "svelte";
  import view from "@nucleum/stores/view.store";
  import { Orientation } from "@21n/elements/direction.enum";
  import OAuthOptions from "@nucleum/application/account/OAuthOptions.svelte";
  import { resolveProductConfig } from "@nucleum/products/product.config";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import {
    authClient,
    resolveAuthFnSessionMode,
    shouldUseAuthFnBearerSession
  } from "@nucleum/client/runtime/account/auth";
  import { Size } from "@21n/elements/size.enum";
  import InlineFeedbackText from "@nucleum/extensions/clipper/InlineFeedbackText.svelte";
  import { AlertType } from "@nucleum/stores/notifications/notification.type";
  import Icon from "@21n/elements/Icon.svelte";
  import { clientStorage } from "@nucleum/persistence/persistence.utils";
  import { ClientStorageKey } from "@nucleum/persistence/persistence.type";
  import DropDown from "@21n/elements/dropdown/DropDown.svelte";
  import { detectUserRegion } from "@21n/utils/network.utils";
  import account from "@nucleum/stores/account.store";
  import { resolveAccountBaseUrl } from "@nucleum/client/runtime/account/network";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  let {
    isSignup = $bindable(false),
    currentProgress = undefined,
    isExpandOAuthButtons = false
  }: {
    isSignup?: boolean;
    currentProgress?: string | undefined;
    isExpandOAuthButtons?: boolean;
  } = $props();
  let passwordMode = $state<"password" | "otp" | "unselected">("unselected");
  let email = $state("");
  let pass = $state("");
  let otp = $state("");
  let error = $state<string | null>(null);
  let info = $state<string | null>(null);
  let isTrusted = $state(true);
  let actionInProgress = $state(false);
  let showPassword = $state(false);
  let region = $state("useast");
  const dev_isShowTrustOption = false;
  const oAuthProviders = resolveProductConfig().oAuthProviders;

  export function reset() {
    pass = "";
    otp = "";
    error = null;
    info = null;
    passwordMode = "unselected";
    actionInProgress = false;
  }

  onMount(async () => {
    postMessageToParent(EmbedMessage.MOUNT);
    const isSignupQueryParam = $page.url.searchParams.get("signup");
    if (isSignupQueryParam && isSignupQueryParam === "true") isSignup = true;
    region = await resolveDefaultRegion();
  });

  async function resolveDefaultRegion() {
    const cachedRegion = await clientStorage.get(ClientStorageKey.REGION);
    if (cachedRegion) {
      return cachedRegion;
    }

    const detectedRegion = await detectUserRegion();
    await clientStorage.set(ClientStorageKey.REGION, detectedRegion);
    return detectedRegion;
  }

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
    if (passwordMode === "unselected") {
      error = "Please select password or OTP.";
      return;
    }
    if (passwordMode === "password" && !isValidFormData()) return;
    if (passwordMode === "otp" && !isValidEmail(email)) {
      showError("Please enter a valid email address.");
      return;
    }
    if (passwordMode === "otp" && !otp) {
      showError("Please enter the OTP code.");
      return;
    }
    actionInProgress = true;
    let response;
    let errorMessage: string | null = null;
    const client = await authClient({ region });
    const sessionMode = resolveAuthFnSessionMode();
    if (isSignup && passwordMode === "password") {
      response = await client.signUpWithPassword({
        email,
        password: pass,
        sessionMode,
        profile: {
          name: ""
        }
      });
    } else if (passwordMode === "password") {
      response = await client.signInWithPassword({
        email,
        password: pass,
        sessionMode
      });
    } else if (passwordMode === "otp") {
      response = await client.verifyOtp({
        email,
        code: otp,
        purpose: isSignup ? "sign-up" : "sign-in",
        profile: isSignup
          ? {
              name: ""
            }
          : undefined,
        sessionMode
      });
    }
    if (!response || !response.ok) {
      errorMessage = response?.error?.message ?? errorMessage;
      if (!response || !response.ok || errorMessage) {
        showError(errorMessage);
        actionInProgress = false;
        return;
      }
    }
    const json = response.data;
    if (!json) {
      showError();
      actionInProgress = false;
      return;
    } else {
      const signedIn = await finishAuthFnLogin(client, json);
      if (!signedIn) {
        showError(
          "Authentication completed, but session setup failed. Please try again."
        );
        return;
      }
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
    if (isSignup && !isValidPasswordChoice()) return false;
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
    info = null;
    error = message ?? "Something went wrong. Please try again later.";
  }

  function showInfo(message: string) {
    actionInProgress = false;
    error = null;
    info = message;
  }

  async function sendOTP() {
    logger.info({
      at: "CloudSyncLogin.sendOTP.start",
      email,
      purpose: isSignup ? "sign-up" : "sign-in",
      region,
      accountUrl: resolveAccountBaseUrl(region)
    });
    const client = await authClient({ region });
    const response = await client.sendOtp({
      email,
      purpose: isSignup ? "sign-up" : "sign-in"
    });
    if (!response.ok) {
      logger.error({
        at: "CloudSyncLogin.sendOTP.failed",
        email,
        region,
        error: response.error
      });
      showError(response.error.message);
      return false;
    }
    if (response.data.sent) {
      logger.info({
        at: "CloudSyncLogin.sendOTP.sent",
        identifierHash: await sha256(email.trim().toLowerCase()),
        region,
        challengeId: response.data.challengeId
      });
      showInfo("OTP sent to your email address. Please check your inbox.");
      return true;
    }
    logger.warn({
      at: "CloudSyncLogin.sendOTP.notSent",
      identifierHash: await sha256(email.trim().toLowerCase()),
      region,
      response
    });
    return false;
  }

  async function sha256(value: string) {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function emailProceedOptionSelection(mode: "password" | "otp") {
    if (!isValidEmail(email)) {
      showError("Please enter a valid email address.");
      return false;
    }

    if (!(await prepareEmailAuthMode())) return false;

    passwordMode = mode;
    if (mode === "otp") await sendOTP();
  }

  async function prepareEmailAuthMode() {
    const client = await authClient({ region });
    const prepared = await client.prepareEmailAuth({
      email,
      flow: isSignup ? "sign-up" : "sign-in",
      preferredRegionId: region
    });
    if (!prepared.ok) {
      showError(prepared.error.message);
      return false;
    }
    region = prepared.data.regionId;
    return true;
  }

  async function finishAuthFnLogin(
    client: Awaited<ReturnType<typeof authClient>>,
    data: { token?: string }
  ) {
    const signedIn = await account.signInFromAuthFnSession({
      token: shouldUseAuthFnBearerSession() ? data.token : undefined,
      session: "session" in data ? data.session : undefined,
      isNewUser: isSignup,
      isPreventRedirect: true,
      persistToken: shouldUseAuthFnBearerSession()
    });
    if (!signedIn) {
      logger.error({
        at: "CloudSyncLogin.finishAuthFnLogin.session.failed",
        hasToken: Boolean(data.token),
        regionId: client.getCurrentRegionId(),
        accountUrl: resolveAccountBaseUrl(client.getCurrentRegionId())
      });
      return false;
    }

    logger.info({
      at: "CloudSyncLogin.finishAuthFnLogin.session.ok",
      hasToken: Boolean(data.token),
      regionId: client.getCurrentRegionId(),
      accountUrl: resolveAccountBaseUrl(client.getCurrentRegionId())
    });

    try {
      const handoff = await client.startNativeHandoff();
      if (handoff.ok) {
        logger.info({
          at: "CloudSyncLogin.nativeHandoff.start.ok",
          regionId: client.getCurrentRegionId(),
          accountUrl: resolveAccountBaseUrl(client.getCurrentRegionId())
        });
        postDataToParent(EmbedDataMessage.AUTHFN_NATIVE_HANDOFF, {
          code: handoff.data.code,
          expiresAt: handoff.data.expiresAt,
          regionId: client.getCurrentRegionId(),
          accountUrl: resolveAccountBaseUrl(client.getCurrentRegionId())
        });
      } else {
        logger.warn({
          at: "CloudSyncLogin.nativeHandoff.start.failed",
          error: handoff.error
        });
      }
    } catch (err) {
      logger.warn({ at: "CloudSyncLogin.nativeHandoff.unavailable", err });
    }
    logger.info({
      at: "CloudSyncLogin.finishAuthFnLogin.redirect.requested",
      isSignup,
      regionId: client.getCurrentRegionId(),
      currentPath: window.location.pathname
    });
    account.gotoPostAuthRoute({ isNewUser: isSignup });
    return true;
  }
</script>

<div class="flex flex-col w-80 {$view.scale > 0.6 ? 'gap-10' : 'gap-6'}">
  <div class="flex flex-col gap-2 justify-center items-center">
    <div class="flex flex-col w-full gap-4">
      <div>
        <DropDown
          isDisableSearch={true}
          label={{
            label: "Base region",
            tooltip: {
              body: "We will use this preference to host your data closest to you. This will help us to provide you with the best experience possible."
            }
          }}
          items={[
            {
              value: "useast",
              label: "US region"
            },
            {
              value: "euwest",
              label: "EU region"
            },
            {
              value: "insouth",
              label: "Asia Pacific"
            }
          ]}
          bind:value={region}
        />
      </div>
      <TextInput
        bind:value={email}
        label={{
          label: "Email",
          orientation: Orientation.Vertical
        }}
        placeholder="username@email.com"
      />
      {#if passwordMode === "unselected"}
        <div class="grid grid-cols-2 gap-2 w-full">
          <Button
            size={Size.sm}
            style={ButtonStyle.OUTLINED}
            isExpandToFullWidth={true}
            label={isSignup ? "Create password" : "Enter password"}
            onclick={() => emailProceedOptionSelection("password")}
          />
          <Button
            size={Size.sm}
            style={ButtonStyle.OUTLINED}
            isExpandToFullWidth={true}
            label="Send OTP"
            onclick={() => emailProceedOptionSelection("otp")}
          />
        </div>
      {:else if passwordMode === "password"}
        <TextInput
          bind:value={pass}
          id="password"
          label={{
            label: isSignup ? "Create password" : "Password",
            orientation: Orientation.Vertical,
            tooltip: isSignup
              ? {
                  body: "Password must be at least 12 characters long and contain at least one lowercase letter, one uppercase letter, one number and one special character."
                }
              : undefined
          }}
          type={showPassword ? "text" : "password"}
          placeholder="********"
        >
          <button
            type="button"
            onclick={() => (showPassword = !showPassword)}
            class="flex items-center justify-center"
          >
            <Icon
              icon={showPassword ? "hide" : "show"}
              size={Size.sm}
              class="stroke-fgs3 hover:stroke-fgs2"
            />
          </button>
        </TextInput>
      {:else if passwordMode === "otp"}
        <TextInput
          bind:value={otp}
          id="otp"
          label={{
            label: "OTP",
            orientation: Orientation.Vertical,
            tooltip: isSignup
              ? {
                  body: "OTP will be sent to your email address."
                }
              : undefined
          }}
          placeholder="123456"
        />
      {/if}
      {#if dev_isShowTrustOption}
        <button
          class="flex items-center gap-2 w-full"
          onclick={() => {
            isTrusted = !isTrusted;
          }}
        >
          <input type="checkbox" class="h-4 w-4" bind:checked={isTrusted} />
          <div class="text-fgs3">Trust this device for 30 days</div>
        </button>
      {/if}
      {#if !isSignup}
        <div class="ml-auto text-b3">
          <Button
            style={ButtonStyle.PLAIN}
            size={Size.xs}
            label="Forgot password?"
            onclick={() => {
              navigation.gotoPath("/account/forgot-password");
            }}
          />
        </div>
      {/if}
    </div>
    <div class="py-1">
      <InlineFeedbackText
        isRenderEmptyHeight={true}
        feedback={info ??
          (error ? { type: AlertType.ERROR, message: error } : undefined)}
      />
    </div>
    <Button
      isExpandToFullWidth={true}
      type={ButtonVariant.PRIMARY}
      style={ButtonStyle.OUTLINED}
      label={isSignup
        ? actionInProgress
          ? "Signing up..."
          : "Sign up with email"
        : actionInProgress
          ? "Signing in..."
          : "Log in"}
      isLoading={actionInProgress}
      onclick={handleClick}
    />
  </div>
  {#if oAuthProviders && oAuthProviders.length > 0}
    <div class="w-full flex justify-center items-center text-fgs3 text-b3 px-4">
      <hr class="grow border-t border-bgs4" />
      <div class="px-2">or</div>
      <hr class="grow border-t border-bgs4" />
    </div>
    <OAuthOptions
      {region}
      providers={oAuthProviders}
      isExpanded={isExpandOAuthButtons}
    />
  {/if}
</div>
