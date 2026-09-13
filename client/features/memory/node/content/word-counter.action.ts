interface WordCountParameters {
  onUpdate?: (counts: { words: number; characters: number }) => void;
}

/** Reports visible editor word and character counts as its content changes. */
export function wordCounter(
  node: HTMLElement,
  parameters: WordCountParameters = {}
) {
  let onUpdate = parameters.onUpdate || (() => {});
  let observer: MutationObserver;

  function getVisibleContent(element: HTMLElement): string {
    let content = "";
    for (const child of element.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const style = window.getComputedStyle(el);
        if (
          style.display !== "none" &&
          !el.classList.contains("popover") &&
          !el.classList.contains("exclude-from-count") &&
          !el.classList.contains("tooltip") &&
          !el.classList.contains("placeholder")
        ) {
          content += getVisibleContent(el);
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        content += child.textContent;
      }
    }
    return content;
  }

  function countWords(text: string): number {
    const words = text.trim().split(/\s+/);
    return words.filter((word) => word.length > 0).length;
  }

  function stripHtml(html: string): string {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }

  function updateCounts() {
    const visibleContent = getVisibleContent(node);
    const strippedContent = stripHtml(visibleContent);
    const wordCount = countWords(strippedContent);
    const charCount = strippedContent.length;
    onUpdate({ words: wordCount, characters: charCount });
  }

  updateCounts();

  observer = new MutationObserver(updateCounts);
  observer.observe(node, {
    childList: true,
    subtree: true,
    characterData: true
  });

  return {
    update(newParameters: WordCountParameters = {}) {
      onUpdate = newParameters.onUpdate || onUpdate;
      updateCounts();
    },
    destroy() {
      if (observer) {
        observer.disconnect();
      }
    }
  };
}
