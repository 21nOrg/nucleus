import { expect, type Locator, type Page } from "@playwright/test";
import { ensureInAppOnHome } from "../../utils/helpers";
import { resolveRepoFsImportPath } from "../../utils/repo-fs";
import { readSessionRuntime } from "../focus-test-helpers";

const sessionStorePath = resolveRepoFsImportPath(
  "client/features/focus/session.store.ts"
);
const datafnStorePath = resolveRepoFsImportPath(
  "client/datafn/datafn.store.ts"
);
const advancedCompositionDraftStorePath = resolveRepoFsImportPath(
  "client/features/focus/advanced/composition/advancedCompositionDraft.store.ts"
);
const appStorePath = resolveRepoFsImportPath("client/stores/app.store.ts");
const pointronStorePath = resolveRepoFsImportPath(
  "client/features/focus/preferences.store.ts"
);
const backgroundSoundStorePath = resolveRepoFsImportPath(
  "client/features/focus/backgroundMusic/background-sound.store.ts"
);
const focusSessionItemTestId = /^focus-session-item:/;

export type SessionCompositionInput = {
  type: "Countup" | "Focus target" | "Total duration";
  totalDuration: number;
  focusDuration: number;
  breakDuration: number;
  numberOfBreaks: number;
  breakReminder: number;
  breakType: "Predefined" | "Reminder";
  numberOfFocusRounds?: number;
};

/**
 * Applies a deterministic composition to both the active store and draft store.
 */
export async function configureSessionComposition(
  page: Page,
  composition: SessionCompositionInput
) {
  await page.evaluate(
    async ({ modulePaths, composition }) => {
      const sessionMod = await import(modulePaths.sessionStorePath);
      const draftMod = await import(
        modulePaths.advancedCompositionDraftStorePath
      );
      const nextComposition = {
        id: `e2e-composition-${Date.now()}`,
        ...composition
      };
      await sessionMod.activeSession.modify(
        { composition: nextComposition },
        { isPersist: false }
      );
      draftMod.advancedCompositionDraft.set(nextComposition);
      sessionMod.activeSession.onComposeComplete(false);
    },
    {
      composition,
      modulePaths: {
        advancedCompositionDraftStorePath,
        sessionStorePath
      }
    }
  );
}

/**
 * Reads the durable active-session snapshot used to restore Focus after reload.
 */
export async function readPersistedSessionSnapshot(page: Page) {
  return page.evaluate(
    async ({ modulePath }) => {
      const { datafn } = await import(modulePath);
      const snapshot = await datafn.kv.get("pointSessionSnapshotv2");
      if (!snapshot || typeof snapshot !== "object") return undefined;
      const active = snapshot as Record<string, any>;
      return {
        currentFocusItemId:
          active.currentFocusItem?.id?.toString() ?? undefined,
        currentSessionId: active.currentSessionId?.toString() ?? undefined,
        isQuickStartOn: Boolean(active.isQuickStartOn),
        isSessionRunning: Boolean(active.isSessionRunning)
      };
    },
    { modulePath: datafnStorePath }
  );
}

/**
 * Reads the persisted session with expanded items and all associated logs.
 */
export async function readPersistedSession(page: Page, sessionId: string) {
  return page.evaluate(
    async ({ modulePath, sessionId }) => {
      const { datafn } = await import(modulePath);
      const sessionResult = await datafn.session.query({
        select: ["*", "items.*#"],
        filters: { id: sessionId },
        limit: 1
      });
      const logResult = await datafn.sessionLog.query({
        filters: { sessionId }
      });
      const session = sessionResult.data?.[0];
      return {
        logs: (logResult.data ?? []).map((log: any) => ({
          breakTime: Number(log.breakTime ?? 0),
          endUnix: Number(log.endUnix ?? 0),
          focus: Number(log.focus ?? 0),
          id: log.id.toString(),
          objectiveId: log.objectiveId?.toString() ?? "",
          sessionId: log.sessionId?.toString() ?? "",
          startUnix: Number(log.startUnix ?? 0),
          taskId: log.taskId?.toString() ?? ""
        })),
        session: session
          ? {
              blocks: (session.blocks ?? []).map((block: any) => ({
                duration: Number(block.duration ?? 0),
                progress: Number(block.progress ?? 0),
                start: Number(block.start ?? 0),
                type: Number(block.type)
              })),
              elapsed: Number(session.elapsed ?? 0),
              endUnix: Number(session.endUnix ?? 0),
              id: session.id.toString(),
              items: (session.items ?? []).map((item: any) => ({
                id: item.id.toString(),
                parentObjectiveId:
                  item.$relation_metadata?.parentObjectiveId?.toString() ??
                  item.parentObjectiveId?.toString() ??
                  "",
                sortOrder: Number(
                  item.$relation_metadata?.sortOrder ?? item.sortOrder ?? 0
                )
              })),
              notes: session.notes,
              plannedEndUnix: session.plannedEndUnix
                ? Number(session.plannedEndUnix)
                : undefined,
              startUnix: Number(session.startUnix ?? 0),
              type: session.type
            }
          : undefined
      };
    },
    { modulePath: datafnStorePath, sessionId }
  );
}

/**
 * Reads a task record directly from DataFn.
 */
export async function readTaskRecord(page: Page, taskId: string) {
  return page.evaluate(
    async ({ modulePath, taskId }) => {
      const { datafn } = await import(modulePath);
      const result = await datafn.task.query({
        filters: { id: taskId },
        limit: 1
      });
      const task = result.data?.[0];
      return task
        ? {
            id: task.id.toString(),
            isChecked: Boolean(task.isChecked),
            label: task.label ?? "",
            objectiveId: task.objectiveId?.toString() ?? ""
          }
        : undefined;
    },
    { modulePath: datafnStorePath, taskId }
  );
}

/**
 * Finds objective or task records by exact label.
 */
export async function readResourcesByLabel(
  page: Page,
  resource: "objective" | "task",
  label: string
) {
  return page.evaluate(
    async ({ modulePath, resource, label }) => {
      const { datafn } = await import(modulePath);
      const result = await datafn.table(resource).query({
        filters: { label },
        ...(resource === "objective" ? { select: ["*", "children.*"] } : {})
      });
      return (result.data ?? []).map((record: any) => ({
        children: (record.children ?? []).map((child: any) =>
          (child.id ?? child).toString()
        ),
        id: record.id.toString(),
        isChecked: Boolean(record.isChecked),
        label: record.label ?? "",
        objectiveId: record.objectiveId?.toString() ?? "",
        status: record.status ?? ""
      }));
    },
    { label, modulePath: datafnStorePath, resource }
  );
}

/**
 * Updates the automatic Picture-in-Picture preference.
 */
export async function setAutoPipPreference(page: Page, enabled: boolean) {
  await page.evaluate(
    async ({ modulePath, enabled }) => {
      const pointronMod = await import(modulePath);
      await pointronMod.pointronPreferences.modify({
        isEnableAutoPiP: enabled
      });
    },
    { enabled, modulePath: pointronStorePath }
  );
}

/**
 * Selects or clears the background system sound.
 */
export async function setBackgroundSound(page: Page, systemSound?: string) {
  await page.evaluate(
    async ({ modulePath, systemSound }) => {
      const { backgroundSoundStore } = await import(modulePath);
      backgroundSoundStore.set({ systemSound });
    },
    { modulePath: backgroundSoundStorePath, systemSound }
  );
}

/**
 * Returns the interactive row for an objective or task in the live session.
 */
export function getFocusItemRow(page: Page, label: string): Locator {
  return page
    .getByTestId(focusSessionItemTestId)
    .filter({ visible: true })
    .filter({ has: page.getByText(label, { exact: true }) })
    .first();
}

/** Returns a visible active-session item by its resource ID. */
export function getFocusSessionItem(page: Page, id: string): Locator {
  return page
    .getByTestId(`focus-session-item:${id}`)
    .filter({ visible: true })
    .first();
}

/** Returns every visible active-session item exposed by the session contract. */
export function getFocusSessionItems(page: Page): Locator {
  return page.getByTestId(focusSessionItemTestId).filter({ visible: true });
}

/** Returns every active-session item currently marked as focused. */
export function getCurrentFocusSessionItems(page: Page): Locator {
  return getFocusSessionItems(page).and(
    page.locator('[data-current-focus="true"]')
  );
}

/** Returns an identified active-session item when it is currently focused. */
export function getCurrentFocusSessionItem(page: Page, id: string): Locator {
  return getFocusSessionItem(page, id).and(
    page.locator('[data-current-focus="true"]')
  );
}

/** Returns the Advanced Focus item-editor dialog. */
export function getFocusItemsDialog(page: Page): Locator {
  return page.getByTestId("modal-SHOW_FOCUSITEMS_MODAL");
}

/** Returns the compact running-session player. */
export function getFocusPlayer(page: Page): Locator {
  return page.getByTestId("focus-player");
}

/** Returns the interval transition notifier. */
export function getPredefinedIntervalNotifier(page: Page): Locator {
  return page.getByTestId("predefined-interval-notifier");
}

/** Returns the shared confirmation dialog used by session commands. */
export function getSessionConfirmationDialog(page: Page): Locator {
  return page.getByTestId("modal-CONFIRMATION");
}

/**
 * Returns the row currently marked as focused for the supplied label.
 */
export function getCurrentFocusItemRow(page: Page, label: string): Locator {
  return getCurrentFocusSessionItems(page)
    .filter({ has: page.getByText(label, { exact: true }) })
    .first();
}

/**
 * Selects an objective or task from the running session list.
 */
export async function selectFocusItem(
  page: Page,
  label: string,
  expectedId?: string | null
) {
  const row = getFocusItemRow(page, label);
  await expect(row).toBeVisible({ timeout: 15_000 });
  const attempts = expectedId === undefined ? 1 : 3;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await row.click({ position: { x: 4, y: 4 }, timeout: 5_000 });
    if (expectedId === undefined) return;
    const reachedExpectedState = await expect
      .poll(
        async () => {
          const currentId = (await readSessionRuntime(page)).currentFocusItem
            ?.id;
          return expectedId === null
            ? currentId === undefined
            : currentId === expectedId;
        },
        { message: "selectFocusItem: toBe true", timeout: 2_000 }
      )
      .toBe(true)
      .then(() => true)
      .catch(() => false);
    if (reachedExpectedState) return;
  }
  const currentId = (await readSessionRuntime(page)).currentFocusItem?.id;
  throw new Error(
    `Focus item "${label}" did not reach ${expectedId ?? "stopped"} state; current item is ${currentId ?? "none"}`
  );
}

/**
 * Sets edit mode through the visible session control.
 */
export async function setSessionEditMode(page: Page, enabled: boolean) {
  const editToggle = page
    .getByRole("checkbox", { name: "Edit mode" })
    .filter({ visible: true })
    .first();
  await expect(editToggle).toBeVisible({ timeout: 15_000 });
  await editToggle.setChecked(enabled);
  await expect(editToggle).toBeChecked({ checked: enabled });
  if (enabled) {
    await expect(
      page.getByText("Edit mode is on.", { exact: true })
    ).toBeVisible({ timeout: 10_000 });
  } else {
    await expect(
      page.getByText("Edit mode is on.", { exact: true })
    ).toBeHidden({ timeout: 10_000 });
  }
}

/**
 * Reorders focus items through the session store used by the editor.
 */
export async function reorderFocusItems(
  page: Page,
  fromId: string,
  toId: string
) {
  await page.evaluate(
    async ({ modulePath, fromId, toId }) => {
      const sessionMod = await import(modulePath);
      await sessionMod.focusItemsStore.rearrangeFocusItems(fromId, toId);
    },
    { fromId, modulePath: sessionStorePath, toId }
  );
}

/**
 * Reorders two tasks within an objective through the session store.
 */
export async function reorderFocusTasks(
  page: Page,
  objectiveId: string,
  fromId: string,
  toId: string
) {
  await page.evaluate(
    async ({ modulePath, objectiveId, fromId, toId }) => {
      const sessionMod = await import(modulePath);
      await sessionMod.focusItemsStore.rearrangeTasksInObjective(
        objectiveId,
        fromId,
        toId
      );
    },
    { fromId, modulePath: sessionStorePath, objectiveId, toId }
  );
}

/**
 * Finishes a session through its visible control and waits for the summary.
 */
export async function finishSessionFromControl(page: Page) {
  await page
    .getByRole("button", { name: /^Finish$/i })
    .first()
    .click({ timeout: 10_000 });
  await expect(
    page.getByRole("button", { name: /^Done/i }).first()
  ).toBeVisible({ timeout: 20_000 });
}

/**
 * Submits two finish requests concurrently to verify idempotent persistence.
 */
export async function finishSessionConcurrently(page: Page) {
  await page.evaluate(
    async ({ modulePath }) => {
      const sessionMod = await import(modulePath);
      await Promise.all([
        sessionMod.activeSession.finishSession(),
        sessionMod.activeSession.finishSession()
      ]);
    },
    { modulePath: sessionStorePath }
  );
  await expect(
    page.getByRole("button", { name: /^Done/i }).first()
  ).toBeVisible({ timeout: 20_000 });
}

/**
 * Starts a manual break through the active session store.
 */
export async function startSessionBreak(page: Page) {
  await page.evaluate(
    async ({ modulePath }) => {
      const sessionMod = await import(modulePath);
      await sessionMod.activeSession.startBreak();
    },
    { modulePath: sessionStorePath }
  );
}

/**
 * Resumes focus through the active session store.
 */
export async function resumeSessionFocus(page: Page) {
  await page.evaluate(
    async ({ modulePath }) => {
      const sessionMod = await import(modulePath);
      await sessionMod.activeSession.resumeSession();
    },
    { modulePath: sessionStorePath }
  );
}

/**
 * Finishes the active session through the session store.
 */
export async function finishSessionDirect(page: Page) {
  await page.evaluate(
    async ({ modulePath }) => {
      const sessionMod = await import(modulePath);
      await sessionMod.activeSession.finishSession();
    },
    { modulePath: sessionStorePath }
  );
  await expect(
    page.getByRole("button", { name: /^Done/i }).first()
  ).toBeVisible({ timeout: 20_000 });
}

/**
 * Dismisses the finished-session summary.
 */
export async function dismissFinishedSession(page: Page) {
  await page
    .getByRole("button", { name: /^Done/i })
    .first()
    .click({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /^Done/i }).first()).toBeHidden(
    { timeout: 15_000 }
  );
}

/**
 * Sets the global edit-mode store to a deterministic value.
 */
export async function setEditMode(page: Page, enabled: boolean) {
  await page.evaluate(
    async ({ modulePath, enabled }) => {
      const appStoreMod = await import(modulePath);
      appStoreMod.isInEditMode.set(enabled);
    },
    { enabled, modulePath: appStorePath }
  );
}

/**
 * Returns the visible session notes contenteditable.
 */
export function getSessionNotesEditor(page: Page) {
  return page
    .locator('[contenteditable][placeholder="Start typing..."]')
    .first();
}

/** Reloads the app and opens a finished session through its durable record UI. */
export async function reopenPersistedSession(
  page: Page,
  sessionId: string,
  expectedLabels: string[] = []
) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureInAppOnHome(page);
  await page.goto(
    `/calendar?rAt=${Date.now()}&r=${encodeURIComponent(sessionId)}`,
    { waitUntil: "domcontentloaded" }
  );
  await expect(page.getByText("Session details", { exact: true })).toBeVisible({
    timeout: 20_000
  });
  for (const label of expectedLabels) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible({
      timeout: 15_000
    });
  }
}

/** Reloads the app and verifies that no active-session UI is restored. */
export async function reloadWithoutActiveSession(page: Page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureInAppOnHome(page);
  await expect(
    page.locator('[aria-roledescription="zen mode"]').first()
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: /^Focus$/i }).first()
  ).toBeVisible({ timeout: 15_000 });
}
