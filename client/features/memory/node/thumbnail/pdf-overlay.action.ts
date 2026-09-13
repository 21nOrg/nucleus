type HideOnOverlayParams = {
  enabled?: boolean;
};

/** Hides the PDF embed while an application overlay covers it. */
export function hideOnOverlay(
  node: HTMLElement,
  params: HideOnOverlayParams = {}
) {
  let observer: MutationObserver;
  let { enabled = false } = params;

  const updateVisibility = () => {
    if (!enabled) {
      node.style.display = "";
      return;
    }
    const isOverlayPresent = document.querySelector(".pop-overlay") !== null;
    node.style.display = isOverlayPresent ? "none" : "";
  };

  observer = new MutationObserver(updateVisibility);

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class"]
  });

  updateVisibility();

  return {
    update(newParams: HideOnOverlayParams = {}) {
      enabled = newParams.enabled ?? false;
      updateVisibility();
    },
    destroy() {
      if (observer) {
        observer.disconnect();
      }
    }
  };
}
