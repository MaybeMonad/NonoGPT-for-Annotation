/**
 * Functions
 */

import * as globalStore from "~/content/store";
import { showElement } from "~/util";

export function showAnnotationPanel(options: {
  originTextElement: HTMLElement;
  panelElement: HTMLElement;
  text: string;
  store: typeof globalStore;
}) {
  return function (target: HTMLElement) {
    options.store.currentAnnotationId.setState(
      target.getAttribute("data-annotation-id") || ""
    );

    const rect = target.getBoundingClientRect();
    options.originTextElement.innerHTML = `${options.text}`;

    showElement({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      motion: {
        translateY: [8, 0],
        duration: 240,
        easing: "easeInOutSine",
      },
    })(options.panelElement);
  };
}
