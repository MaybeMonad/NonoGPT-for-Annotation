/**
 * Functions
 */

import { interval, map } from "rxjs";

import * as globalStore from "~/content/store";
import { showElement } from "~/util";

export function useAnnotationPanel(options: {
  originTextElement: HTMLElement;
  panelElement: HTMLElement;
  text: string;
  store: typeof globalStore;
}) {
  return function (target: HTMLElement) {
    options.store.currentAnnotationId.setState(
      target.getAttribute("data-annotation-id") || ""
    );
    options.store.selectedTextStore.setState(options.text);

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

export function useLoading(actionOnLoading: (frame: string) => void) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

  const loading$ = interval(80)
    .pipe(map((i) => frames[i % frames.length]))
    .subscribe((frame) => {
      actionOnLoading(frame);
    });

  return { loading$ };
}
