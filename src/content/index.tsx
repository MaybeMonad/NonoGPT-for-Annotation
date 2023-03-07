import { Observable, Subject, fromEvent, interval, merge, noop } from "rxjs";
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

import {
  Button,
  Div,
  appendChild,
  appendTo,
  createElement,
  // getLatestElement,
  hideElement,
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
  { element: HTMLElement; observable: Observable<Event> }
>();

let selectedTextStore = "";

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

const originTextElement = Div({
  className: "origin_text",
  callback: appendTo(annotationPanel),
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
      api.translate({
        text: selectedTextStore,
        onMessage: ({ content }) => {
          resultElement.style.display = "block";
          resultElement.innerHTML += content;
        },
        onError: console.log,
        onFinish: console.log,
      })
    )
  )
  .subscribe(console.log);

/**
 * Functions
 */

function showAnnotationPanel(text: string) {
  return function (rect: DOMRect) {
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
    mergeWith(visibleInterval$, mousedown$, triggerMousedown$, triggerMouseup$)
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

        // console.log(window.getSelection()?.toString());
        const text = window.getSelection()?.toString();
        const range = window.getSelection()?.getRangeAt?.(0);
        if (!range || !text) return;

        // const selectedText = range.cloneContents();
        selectedTextStore = text;
        const clonedContent = range.cloneContents();
        range.deleteContents();

        const id = new Date().getTime().toString();
        const annotationSpan = createElement("span")({
          id,
          className: `nono-gpt-extension__id-${id}`,
          style: {
            whiteSpace: "pre-wrap",
          },
          callback: appendChild(clonedContent),
        });

        range.insertNode(annotationSpan);

        annotate(annotationSpan, {
          type: "highlight",
          multiline: true,
          color: "rgb(255, 213, 79)",
          brackets: ["left", "right"],
        }).show();

        const rect = annotationSpan.getBoundingClientRect();
        showAnnotationPanel(text)(rect);

        const annotation$ = fromEvent(annotationSpan, "click");
        annotation$
          .pipe(
            map((evt) => (evt.target as HTMLDivElement).getBoundingClientRect())
          )
          .subscribe(showAnnotationPanel(text));

        annotationsStore.set(id, {
          element: annotationSpan,
          observable: annotation$,
        });
      })
      .with({ selectedContent: P.string }, (data) => {
        showElement(nonoGPTExtensionElement, data.y, data.x, {
          scale: [0, 1],
        });
      })
      .otherwise(() => noop);
  });
