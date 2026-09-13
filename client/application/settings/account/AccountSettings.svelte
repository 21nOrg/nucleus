<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { accountDeletion } from "@nucleum/application/account/account-deletion";
  import { fileUpload } from "@nucleum/stores/files/file-upload";

  import Button from "@21n/elements/button/Button.svelte";
  import account from "@nucleum/stores/account.store";
  import { onMount } from "svelte";
  import {
    frameEmailFromParts,
    isValidString,
    properCase
  } from "@21n/shared-utils/text.utils";
  import { PlanStatus } from "@nucleum/schema/account/subscription";
  import { UserDataMode } from "@nucleum/client/runtime/account/account.type";
  import { type EmailParts } from "@nucleum/schema/account/profile.type";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import Text from "@21n/elements/text/Text.svelte";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import ScrollViewBottomSpacer from "@21n/layout/scrollView/ScrollViewBottomSpacer.svelte";
  import { Size } from "@21n/elements/size.enum";
  import ProfilePicture from "@nucleum/application/settings/account/ProfilePicture.svelte";
  import { cn } from "@21n/utils/ui.utils";
  import TextInput from "@21n/elements/input/TextInput.svelte";
  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import Icon from "@21n/elements/Icon.svelte";
  import { fileDrop } from "@nucleum/actions/fileDrop.action";
  import { toasts } from "@nucleum/stores/notification.store";
  import { isValidArrayWithData } from "@21n/shared-utils/obj.utils";
  import { isRecordId } from "@nucleum/datafn/resource.utils";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import { appStore } from "@nucleum/stores/app.store";
  import { Action } from "@nucleum/client/config/action.enum";
  import {
    resolveNextRenewalDate,
    resolvePlanLabel
  } from "@nucleum/application/subscription/userPlan.utils";
  import { determineIfPlanIsActive } from "@nucleum/client/runtime/account/plan.utils";
  import { BillingCycle, PlanType } from "@nucleum/schema/account/subscription";
  import { parseAndFormatDate } from "@21n/utils/time.utils";

  import view from "@nucleum/stores/view.store";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  import { Product } from "@nucleum/client/config/product.type";
  import { hasLegacyCloudSession } from "@21n/utils/account.utils";
  import {
    authClient,
    resolveAuthFnSessionMode,
    shouldUseAuthFnBearerSession
  } from "@nucleum/client/runtime/account/auth";
  import { clientStorage } from "@nucleum/persistence/persistence.utils";
  import { ClientStorageKey } from "@nucleum/persistence/persistence.type";
  import type {
    AuthFnAccountDetails,
    AuthFnSocialProviderId
  } from "@authfn/client";

  let name = $state("");
  let emailParts = $state<EmailParts | undefined>(undefined);
  let isEditing = $state(false);
  let isSaveInProgress = $state(false);
  let isAuthDetailsLoading = $state(false);
  let isPasswordFormVisible = $state(false);
  let isSettingPassword = $state(false);
  let passwordValue = $state("");
  let confirmPasswordValue = $state("");
  let passwordError = $state<string | undefined>(undefined);
  let profilePicture = $state<IRecordId | undefined>(
    $userPreferences.profilePicture
  );
  let accountDetails = $state<AuthFnAccountDetails | undefined>(undefined);
  let authDetailsError = $state<string | undefined>(undefined);
  const accountEmail = $derived(
    accountDetails?.user.primaryEmail ??
      $account.userInfo?.email ??
      (emailParts ? frameEmailFromParts(emailParts) : undefined)
  );
  const isActivePlan = $derived(
    $account.plan ? determineIfPlanIsActive($account.plan) : false
  );
  const isSignedIn = $derived(
    $account.dataMode === UserDataMode.CLOUD ||
      Boolean($account.token) ||
      Boolean($account.userInfo?.id) ||
      Boolean(accountDetails?.user.id)
  );

  onMount(() => {
    const unsubscribeAccount = account.subscribe((value) => {
      if (value.dataMode === UserDataMode.CLOUD || value.token) {
        name = $userPreferences.name || value.userInfo?.nickName || "";
        emailParts = value.userInfo?.emailParts || undefined;
      }
    });
    const unsubscribeUserPreferences = userPreferences.subscribe((value) => {
      name = value.name || $account.userInfo?.nickName || "";
    });
    refreshAuthDetails();
    refreshPlanDataIfLegacySessionExists();
    return () => {
      unsubscribeAccount();
      unsubscribeUserPreferences();
    };
  });

  async function refreshAuthDetails() {
    isAuthDetailsLoading = true;
    authDetailsError = undefined;
    try {
      const response = await (await authClient()).getAccountDetails();
      if (response.ok) {
        accountDetails = response.data;
        return;
      }
      if (response.error.code !== "AUTHFN_UNAUTHENTICATED") {
        authDetailsError = response.error.message;
      }
      accountDetails = undefined;
    } catch (error) {
      console.error("Failed to fetch AuthFn account details", error);
      authDetailsError = "Unable to load account sign-in details.";
      accountDetails = undefined;
    } finally {
      isAuthDetailsLoading = false;
    }
  }

  async function refreshPlanDataIfLegacySessionExists() {
    if (await hasLegacyCloudSession()) {
      account.refreshPlanData();
    }
  }

  function gotoPasswordFlow() {
    if (!accountDetails?.hasPassword) {
      isPasswordFormVisible = true;
      passwordError = undefined;
      return;
    }
    navigation.gotoPath("/account/forgot-password", {
      queryParams: {
        ...(accountEmail ? { email: accountEmail } : {}),
        mode: accountDetails?.hasPassword ? "reset" : "set"
      }
    });
  }

  function providerIcon(provider: AuthFnSocialProviderId) {
    return provider === "github" ? "github-logo" : provider;
  }

  function providerLabel(provider: AuthFnSocialProviderId) {
    return provider === "github" ? "GitHub" : properCase(provider);
  }

  function resetPasswordForm() {
    passwordValue = "";
    confirmPasswordValue = "";
    passwordError = undefined;
    isPasswordFormVisible = false;
  }

  function validatePassword() {
    if (!passwordValue || !confirmPasswordValue) {
      passwordError = "Please fill both password fields.";
      return false;
    }
    if (passwordValue !== confirmPasswordValue) {
      passwordError = "Passwords do not match.";
      return false;
    }
    if (passwordValue.length < 12) {
      passwordError = "Password must be at least 12 characters long.";
      return false;
    }
    if (!passwordValue.match(/[a-z]/)) {
      passwordError = "Password must contain at least one lowercase letter.";
      return false;
    }
    if (!passwordValue.match(/[A-Z]/)) {
      passwordError = "Password must contain at least one uppercase letter.";
      return false;
    }
    if (!passwordValue.match(/[0-9]/)) {
      passwordError = "Password must contain at least one number.";
      return false;
    }
    if (!passwordValue.match(/[^a-zA-Z0-9]/)) {
      passwordError = "Password must contain at least one special character.";
      return false;
    }
    passwordError = undefined;
    return true;
  }

  async function handleSetPassword() {
    if (isSettingPassword) return;
    if (!accountEmail) {
      passwordError = "Account email is missing.";
      return;
    }
    if (!validatePassword()) return;

    isSettingPassword = true;
    try {
      const response = await (
        await authClient()
      ).signUpWithPassword({
        email: accountEmail,
        password: passwordValue,
        sessionMode: resolveAuthFnSessionMode()
      });

      if (!response.ok) {
        passwordError = response.error.message ?? "Failed to set password.";
        return;
      }

      if (shouldUseAuthFnBearerSession() && response.data.token) {
        await clientStorage.set(
          ClientStorageKey.AUTHFN_TOKEN,
          response.data.token
        );
      } else {
        await clientStorage.remove(ClientStorageKey.AUTHFN_TOKEN);
      }
      if (response.data.session) {
        await clientStorage.set(ClientStorageKey.USER, response.data.session);
      }
      resetPasswordForm();
      await refreshAuthDetails();
      toasts.success("Password sign-in is now enabled.");
    } catch (error) {
      console.error("Failed to set AuthFn password", error);
      passwordError = "Failed to set password. Please try again.";
    } finally {
      isSettingPassword = false;
    }
  }

  function onSave() {
    userPreferences.updateUserProfile({ name, profilePicture });
    isEditing = false;
  }

  function handleNameInputKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      onSave();
    }
  }

  async function handleDrop(
    all: File[],
    valid: File[],
    errors: { file: File; type: string }[]
  ) {
    try {
      if (errors && errors.length > 0) {
        toasts.error("Something went wrong");
        return;
      }
      if (all.length === 1) {
        isSaveInProgress = true;
        let file = all[0];
        const response = await fileUpload.uploadFileV2(
          file.type,
          file.name,
          new Blob([file], { type: file.type })
        );
        if (
          isValidArrayWithData(response) &&
          isRecordId(response[0].id, Resource.file)
        ) {
          profilePicture = response[0].id;
        }
      } else if (all.length > 1) {
        toasts.error("Multiple files are not supported");
      }
    } catch (e) {
      toasts.error("Something went wrong");
    } finally {
      isSaveInProgress = false;
    }
  }
</script>

<div class="flex flex-col w-full h-full gap-12 items-start overflow-y-auto">
  <!-- <div
    class="flex flex-col gap-1 w-full justify-center rounded-md bg-bgs2 p-4 text-left"
  >
    <div>Hi {$userPreferences.name ?? $account.userInfo?.nickName ?? ""}!</div>
    <div class="flex flex-col gap-2 text-fgs3 text-b2">
      Thanks for being one of the early users of our app! 🥳
      <div>
        We are working on stability improvements and releasing updates almost
        everyday. Please support us as we build the best possible digital memory
        tool together!
      </div>
      <div>
        To maintain our commitment to privacy and ensure long-term
        sustainability, we will be rolling out paid cloud sync plan soon. We
        promise to keep it as low as possible ({`<`} $10 per month). As an early
        member, you will receive a 50% discount on cloud sync plan for your first
        year after your trial ends.
      </div>
    </div>
    <div class="text-fgs3 text-b3 mt-4">-Team Memotron</div>
  </div> -->
  <div class="flex mo:flex-col gap-4 w-full">
    <div
      class="flex flex-col items-center justify-center bg-bgs2 rounded-md gap-4 w-1/3 mo:w-full p-4"
    >
      {#if $appStore.product === Product.MEMOTRON || $appStore.product === Product.NUCLEUM}
        <div
          class={cn("flex w-full justify-center items-center")}
          use:fileDrop={{
            accept: ".jpg,.png,.jpeg,.svg",
            multiple: false,
            disabled: !isEditing,
            onDrop: handleDrop
          }}
        >
          <ProfilePicture
            context="account-settings"
            {isEditing}
            isLoading={isSaveInProgress}
            fileId={profilePicture}
          />
        </div>
      {/if}
      <div
        class="flex flex-col min-h-12 items-center justify-center gap-1 w-full"
      >
        {#if isEditing}
          <div class="w-full" onkeydown={handleNameInputKeydown}>
            <TextInput bind:value={name} />
          </div>
        {:else}
          <button
            class="text-b2 text-fgs3"
            onclick={() => {
              isEditing = true;
            }}
          >
            {isValidString(name) ? name : "Unknown"}
          </button>
        {/if}
      </div>
      <div class="self-center flex min-h-8 gap-2 items-center">
        {#if !isEditing}
          <Button
            icon="edit"
            size={Size.sm}
            isPreventMinWidth={true}
            label="Edit"
            onclick={() => {
              isEditing = true;
            }}
          />
        {:else}
          <Button
            icon="check"
            size={Size.sm}
            type={ButtonVariant.PRIMARY}
            style={ButtonStyle.OUTLINED}
            tooltip="Save"
            onclick={onSave}
          />
          <Button
            icon="cross"
            size={Size.sm}
            style={ButtonStyle.OUTLINED}
            tooltip="Cancel"
            onclick={() => {
              isEditing = false;
              profilePicture = $userPreferences.profilePicture;
              name = $userPreferences.name || $account.userInfo?.nickName || "";
            }}
          />
        {/if}
      </div>
    </div>
    <div class="flex flex-col items-start gap-4 flex-grow py-4">
      <Text content="Account Details" style={TextStyle.PANEL_HEADING} />
      <div class="flex flex-col gap-4 w-full items-start">
        <div class="flex flex-col gap-1 w-full items-start">
          <div class="text-b2 text-fgs3">Sign in method</div>
          <div class="flex items-center gap-2">
            {#if accountDetails?.hasPassword}
              Password
            {:else if accountDetails?.oauthAccounts?.length}
              <Icon
                icon={providerIcon(accountDetails.oauthAccounts[0].provider)}
              />
              {providerLabel(accountDetails.oauthAccounts[0].provider)}
            {:else if accountDetails?.methods.emailOtp || $account.token}
              Email OTP
            {:else if emailParts && emailParts.emailDomain.includes("gmail.com")}
              <Icon icon="google" />
              Google
            {:else if emailParts && emailParts.emailDomain.includes("apple.com")}
              <Icon icon="apple" />
              Apple
            {:else}
              Unknown
            {/if}
            {#if accountEmail}
              - {accountEmail}
            {/if}
          </div>
        </div>
        {#if accountDetails}
          <div class="flex flex-col gap-1 w-full items-start">
            <div class="text-b2 text-fgs3">User</div>
            <div class="flex flex-col gap-1">
              <span>{accountDetails.user.primaryEmail ?? "No email"}</span>
              <span class="text-fgs3 text-b3"
                >User ID: {accountDetails.user.id}</span
              >
              {#if accountDetails.regionId}
                <span class="text-fgs3 text-b3"
                  >Region: {accountDetails.regionId}</span
                >
              {/if}
              <span class="text-fgs3 text-b3">
                Email verified:
                {accountDetails.user.emailVerifiedAt ? "Yes" : "No"}
              </span>
              <span class="text-fgs3 text-b3">
                Two-factor authentication:
                {accountDetails.twoFactorEnabled ? "Enabled" : "Not enabled"}
              </span>
            </div>
          </div>
          <div class="flex flex-col gap-2 w-full items-start">
            <div class="text-b2 text-fgs3">Password</div>
            <div class="flex items-center justify-between gap-4 w-full">
              <span>
                {accountDetails.hasPassword
                  ? "Password sign-in is enabled."
                  : "No password is set for this account."}
              </span>
              <Button
                label={accountDetails.hasPassword
                  ? "Reset password"
                  : "Set password"}
                size={Size.sm}
                style={ButtonStyle.OUTLINED}
                onclick={gotoPasswordFlow}
              />
            </div>
            {#if !accountDetails.hasPassword && isPasswordFormVisible}
              <div
                class="flex flex-col gap-3 w-full max-w-md bg-bgs2 rounded-md p-3"
              >
                <TextInput
                  bind:value={passwordValue}
                  type="password"
                  label="Password"
                  placeholder="********"
                  onInput={() => {
                    passwordError = undefined;
                  }}
                />
                <TextInput
                  bind:value={confirmPasswordValue}
                  type="password"
                  label="Confirm password"
                  placeholder="********"
                  onInput={() => {
                    passwordError = undefined;
                  }}
                  onEnter={handleSetPassword}
                />
                {#if passwordError}
                  <div class="text-ars1 text-b3">{passwordError}</div>
                {/if}
                <div class="flex gap-2">
                  <Button
                    label={isSettingPassword
                      ? "Setting password..."
                      : "Set password"}
                    size={Size.sm}
                    type={ButtonVariant.PRIMARY}
                    style={ButtonStyle.OUTLINED}
                    isLoading={isSettingPassword}
                    isDisabled={isSettingPassword}
                    onclick={handleSetPassword}
                  />
                  <Button
                    label="Cancel"
                    size={Size.sm}
                    style={ButtonStyle.PLAIN}
                    isDisabled={isSettingPassword}
                    onclick={resetPasswordForm}
                  />
                </div>
              </div>
            {/if}
          </div>
          <div class="flex flex-col gap-2 w-full items-start">
            <div class="text-b2 text-fgs3">Associated OAuth methods</div>
            {#if accountDetails.oauthAccounts.length}
              <div class="flex flex-col gap-2">
                {#each accountDetails.oauthAccounts as oauthAccount}
                  <div class="flex items-center gap-2">
                    <Icon icon={providerIcon(oauthAccount.provider)} />
                    <span>{providerLabel(oauthAccount.provider)}</span>
                    {#if oauthAccount.email}
                      <span class="text-fgs3">- {oauthAccount.email}</span>
                    {/if}
                  </div>
                {/each}
              </div>
            {:else}
              <div class="text-fgs3">
                No OAuth sign-in methods are connected.
              </div>
            {/if}
          </div>
        {:else if isAuthDetailsLoading}
          <div class="text-fgs3">Loading account sign-in details...</div>
        {:else if authDetailsError}
          <div class="text-ars1">{authDetailsError}</div>
        {/if}
        <div class="flex flex-col gap-1 w-full items-start">
          <div class="text-b2 text-fgs3">Plan</div>
          <div
            class={cn({
              "text-ars1": !isActivePlan
            })}
          >
            {resolvePlanLabel($account.plan)}
          </div>
          {#if isActivePlan && $account.plan?.cycle !== BillingCycle.LIFETIME && ($account.plan?.plan === PlanType.CLOUD_SYNC || $account.plan?.plan === PlanType.NUCLEUS) && $account.plan?.paymentDate}
            {@const nextPayment = resolveNextRenewalDate($account.plan)}
            <div class="text-fgs3 text-b3 mt-2">
              {#if nextPayment && $account.plan?.status === PlanStatus.ACTIVE}
                Next renewal: {parseAndFormatDate(nextPayment)}
              {:else if nextPayment && $account.plan?.status === PlanStatus.CANCELLED}
                Expires: {parseAndFormatDate(nextPayment)}
              {/if}
            </div>
          {/if}
        </div>
        {#if !$view.isConstrainedWidth && $account.dataMode === UserDataMode.CLOUD}
          <Button
            label="Go to billing"
            icon="wallet"
            onclick={() => {
              navigation.toggleSearchParam({
                [AppSearchParam.SETTING]: Action.USER_BILLING
              });
            }}
          />
        {/if}
      </div>
    </div>
  </div>

  <div class="flex justify-center w-full gap-4">
    {#if isSignedIn}
      <Button
        icon="log-out"
        label="Sign out"
        testId="account-settings-sign-out"
        onclick={async () => {
          await account.signOut();
        }}
      />
    {/if}
    {#if isSignedIn}
      <Button
        icon="trash"
        label="Delete account"
        type={ButtonVariant.DANGER}
        onclick={async () => {
          await accountDeletion.delete();
        }}
      />
    {/if}
  </div>
  <ScrollViewBottomSpacer />
</div>
