import { combineLatest, fromEvent, interval, merge, noop } from "rxjs";
import {
  takeUntil,
  map,
  take,
  repeat,
  mergeWith,
  filter,
} from "rxjs/operators";
import { match, P } from "ts-pattern";
import { annotate } from "rough-notation";

import "./index.css";

console.log("Content Script is Working!");
function createElement(
  tagName: string,
  className: string | null,
  callback?: (elm: HTMLElement) => void
) {
  const element = document.createElement(tagName);

  if (className) {
    element.classList.add(className);
  }

  callback?.(element);

  return element;
}

function appendTo(target: HTMLElement) {
  return function (element: HTMLElement) {
    if (target && element) {
      target.appendChild(element);
    }
  };
}

function setStyle(
  target: HTMLElement,
  styles: Record<string, string | number>
) {
  Object.keys(styles).forEach((key) => {
    target.style[key as any] = styles[key] as string;
  });
}

const nonoGPTExtensionElement = createElement(
  "div",
  "nono-gpt-extension",
  appendTo(document.body)
);
const triggerButton = createElement(
  "button",
  "nono-gpt-extension__trigger-button",
  appendTo(nonoGPTExtensionElement)
);

triggerButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"></path><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path></svg>`;

setStyle(nonoGPTExtensionElement, {
  position: "absolute",
  display: "none",
});

let selectedContent = "";

enum MessageType {
  Translate = "translate",
  HideTriggerButton = "hideTriggerButton",
  ShowTriggerButton = "showTriggerButton",
}

const click$ = fromEvent(triggerButton, "click");

const mouseup$ = fromEvent(document, "mouseup");
const mousedown$ = fromEvent(document, "mousedown").pipe(
  map(() => MessageType.HideTriggerButton)
);
const mouseenter$ = fromEvent(triggerButton, "mouseenter");
const mouseleave$ = fromEvent(triggerButton, "mouseleave");

const startInterval$ = merge(mouseup$, mouseleave$);
const stopInterval$ = merge(mouseenter$, mousedown$);

const visibleInterval$ = interval(2000).pipe(
  takeUntil(stopInterval$),
  take(1),
  map(() => MessageType.HideTriggerButton),
  repeat({ delay: () => startInterval$ })
);

mouseup$
  .pipe(
    filter(() => {
      const selection = window.getSelection();
      return selection ? selection.toString().trim().length > 0 : false;
    }),
    map((event) => ({
      x: (event as MouseEvent).clientX + window.scrollX + 7,
      y: (event as MouseEvent).clientY + window.scrollY - 27,
      selectedContent: window.getSelection()?.toString(),
    })),
    mergeWith(visibleInterval$, mousedown$)
  )
  .subscribe((event) => {
    match(event)
      .with(MessageType.HideTriggerButton, () => {
        setStyle(nonoGPTExtensionElement, {
          display: "none",
        });
      })
      .with({ selectedContent: P.string }, (data) => {
        setStyle(nonoGPTExtensionElement, {
          top: `${data.y}px`,
          left: `${data.x}px`,
          display: "block",
        });
      })
      .otherwise(() => noop);
  });
