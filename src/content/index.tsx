import {
  Observable,
  Subject,
  Subscription,
  fromEvent,
  interval,
  merge,
  noop,
} from "rxjs";
import {
  takeUntil,
  map,
  take,
  repeat,
  mergeWith,
  filter,
  tap,
  switchMap,
} from "rxjs/operators";
import { match, P } from "ts-pattern";
import { annotate } from "rough-notation";
import type { RoughAnnotation } from "rough-notation/lib/model";

import {
  Button,
  Div,
  Span,
  appendChild,
  appendTo,
  // getElement,
  // getLatestElement,
  hideElement,
  highlightSelection,
  showElement,
} from "~/util";
import api from "~/content/api";

import "./index.css";

console.log("Content Script is Working!");

/**
 * Definitions
 */

const annotationsStore = new Map<
  string,
  {
    element: HTMLElement;
    observable: Observable<Event>;
    originalText: string;
    // originalElement: DocumentFragment;
    annotationInstance: RoughAnnotation;
    subscription: Subscription;
  }
>();

let selectedTextStore = "";
let currentAnnotationId = "";

enum MessageType {
  Translate = "translate",
  HideTriggerButton = "hideTriggerButton",
  ShowTriggerButton = "showTriggerButton",
  Highlight = "highlight",
  ShowAnnotationPanel = "showAnnotationPanel",
  HideAllPopup = "hideAllPopup",
}

/**
 * Register DOM Elements
 */

const nonoGPTExtensionElement = Div({
  className: "main",
  callback: appendTo(document.body),
});

const triggerButton = Button({
  className: "trigger-button",
  innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"></path><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path></svg>`,
  callback: appendTo(nonoGPTExtensionElement),
});

const annotationPanel = Div({
  className: "annotation-panel",
  innerHTML: `
    <div></div>
  `,
  callback: appendTo(document.body),
});

const originTextContainer = Div({
  className: "origin_text_container",
  callback: appendTo(annotationPanel),
});

const originTextElement = Div({
  className: "origin_text",
  callback: appendTo(originTextContainer),
});

const originTextDeleteButton = Div({
  className: "origin_text_delete_button",
  innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  callback: appendTo(originTextContainer),
});

const actionButtonsElement = Div({
  className: "action_buttons",
  callback: appendTo(annotationPanel),
});

const translateButton = Button({
  className: "translate-button",
  innerHTML: `Translate<span>ZH</span>`,
  callback: appendTo(actionButtonsElement),
});

const summarizeButton = Button({
  className: "summarize-button",
  innerHTML: `Summarize`,
  callback: appendTo(actionButtonsElement),
});

const vocabularyButton = Button({
  className: "vocabulary-button",
  innerHTML: `Vocabulary`,
  callback: appendTo(actionButtonsElement),
});

const resultElement = Div({
  className: "result",
  callback: appendTo(annotationPanel),
});

/**
 * Register Event Listeners
 */

const triggerMousedown$ = fromEvent(triggerButton, "mousedown").pipe(
  map(() => MessageType.Highlight)
);
const triggerMouseup$ = fromEvent(triggerButton, "mouseup").pipe(
  map(() => MessageType.ShowTriggerButton)
);

const mouseup$ = fromEvent(document, "mouseup");
const mousedown$ = fromEvent(document, "mousedown").pipe(
  takeUntil(triggerMousedown$),
  repeat({ delay: () => mouseup$ }),
  map((event) =>
    annotationPanel.contains(event.target as Node)
      ? MessageType.HideTriggerButton
      : MessageType.HideAllPopup
  )
);
const mouseenter$ = fromEvent(triggerButton, "mouseenter");
const mouseleave$ = fromEvent(triggerButton, "mouseleave");

const startInterval$ = merge(mouseup$, mouseleave$).pipe(
  takeUntil(triggerMousedown$),
  repeat({ delay: () => mouseup$ }),
  filter((event) => !annotationPanel.contains(event.target as Node))
);
const stopInterval$ = merge(
  mouseenter$,
  mousedown$,
  triggerMousedown$,
  triggerMouseup$
);

const visibleInterval$ = interval(2000).pipe(
  takeUntil(stopInterval$),
  take(1),
  map(() => MessageType.HideTriggerButton),
  repeat({ delay: () => startInterval$ })
);

const loading$ = interval(600).pipe(
  takeUntil(triggerMousedown$),
  repeat({ delay: () => mouseup$ }),
  map(() => MessageType.HideTriggerButton)
);

const updateResult$ = new Subject();

const translateButton$ = fromEvent(translateButton, "click")
  .pipe(
    tap(() => {
      resultElement.innerHTML = "";
    }),
    switchMap(() =>
      api.translate((result) => {
        resultElement.style.display = "block";
        resultElement.innerHTML += result;
      })(selectedTextStore)
    )
  )
  .subscribe(console.log);

const summarizeButton$ = fromEvent(summarizeButton, "click")
  .pipe(
    tap(() => {
      resultElement.innerHTML = "";
    }),
    switchMap(() =>
      api.summarize((result) => {
        resultElement.style.display = "block";
        resultElement.innerHTML += result;
      })(selectedTextStore)
    )
  )
  .subscribe(console.log);

const originTextDeleteButton$ = fromEvent(originTextDeleteButton, "click").pipe(
  map(() => MessageType.HideAllPopup)
);

originTextDeleteButton$.subscribe(() => {
  if (annotationsStore.has(currentAnnotationId)) {
    const store = annotationsStore.get(currentAnnotationId);

    if (store) {
      store.annotationInstance.remove();
      store.subscription.unsubscribe();
      // store.element.replaceWith(store.originalElement);
    }
  }
});

/**
 * Functions
 */

function showAnnotationPanel(text: string) {
  return function (target: HTMLElement) {
    currentAnnotationId = target.getAttribute("data-annotation-id") || "";

    const rect = target.getBoundingClientRect();
    originTextElement.innerHTML = `${text}`;

    showElement(
      annotationPanel,
      rect.bottom + window.scrollY,
      rect.left + window.scrollX,
      {
        translateY: [8, 0],
        duration: 240,
        easing: "easeInOutSine",
      }
    );
  };
}

/**
 * Everything happened after `mouseup`...
 */

mouseup$
  .pipe(
    filter((event) => {
      const selection = window.getSelection();
      if (triggerButton.contains(event.target as Node)) return true;
      return selection ? selection.toString().trim().length > 0 : false;
    }),
    map((event) => ({
      x: (event as MouseEvent).pageX + 7,
      y: (event as MouseEvent).pageY - 27,
      selectedContent: window.getSelection()?.toString(),
    })),
    mergeWith(
      visibleInterval$,
      mousedown$,
      triggerMousedown$,
      triggerMouseup$,
      originTextDeleteButton$
    )
  )
  .subscribe((event) => {
    console.log({ event });
    match(event)
      .with(MessageType.HideTriggerButton, () => {
        hideElement(nonoGPTExtensionElement);
      })
      .with(MessageType.HideAllPopup, () => {
        hideElement(nonoGPTExtensionElement, annotationPanel);
      })
      // .with(MessageType.ShowAnnotationPanel, () => {
      //   const { element } = getLatestElement(annotationsStore) || {};
      //   if (!element) return;

      //   const rect = element.getBoundingClientRect();
      //   showElement(
      //     annotationPanel,
      //     rect.bottom + window.scrollY,
      //     rect.left + window.scrollX
      //   );
      // })
      .with(MessageType.Highlight, () => {
        hideElement(nonoGPTExtensionElement);

        const { text, container } = highlightSelection() || {};

        if (!text || !container) return;

        const annotation = annotate(container, {
          type: "highlight",
          multiline: true,
          color: "rgb(255, 213, 79)",
          brackets: ["left", "right"],
        });
        annotation.show();

        showAnnotationPanel(text)(container);

        const annotation$ = fromEvent(container, "click");
        const subscription = annotation$
          .pipe(map((evt) => evt.target as HTMLDivElement))
          .subscribe(showAnnotationPanel(text));

        annotationsStore.set(text, {
          element: container,
          originalText: text,
          // originalElement: container,
          observable: annotation$,
          subscription,
          annotationInstance: annotation,
        });
      })
      .with({ selectedContent: P.string }, (data) => {
        showElement(nonoGPTExtensionElement, data.y, data.x, {
          scale: [0, 1],
        });
      })
      .otherwise(() => noop);
  });
