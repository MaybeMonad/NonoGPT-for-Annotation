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
  throttleTime,
} from "rxjs/operators";
import { match, Pattern } from "ts-pattern";
import { annotate } from "rough-notation";
import type { RoughAnnotation } from "rough-notation/lib/model";

import {
  $prefix,
  Button,
  Div,
  P,
  appendTo,
  hideElement,
  highlightSelection,
  setStyle,
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
let currentParagraphElement = null as HTMLParagraphElement | null;

enum MessageType {
  Translate = "translate",
  HideTriggerButton = "hideTriggerButton",
  ShowTriggerButton = "showTriggerButton",
  Highlight = "highlight",
  ShowAnnotationPanel = "showAnnotationPanel",
  HideAllPopup = "hideAllPopup",
  TranslateParagraph = "translateParagraph",
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

const highlightParagraphButton = Div({
  className: "highlight-paragraph-button",
  innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4v16"></path><path d="M17 4v16"></path><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"></path></svg>`,
  callback: appendTo(document.body),
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

const highlightParagraphButton$ = fromEvent(
  highlightParagraphButton,
  "click"
).pipe(map(() => MessageType.TranslateParagraph));

/**
 * Functions
 */

function showAnnotationPanel(text: string) {
  return function (target: HTMLElement) {
    currentAnnotationId = target.getAttribute("data-annotation-id") || "";

    const rect = target.getBoundingClientRect();
    originTextElement.innerHTML = `${text}`;

    showElement({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      motion: {
        translateY: [8, 0],
        duration: 240,
        easing: "easeInOutSine",
      },
    })(annotationPanel);
  };
}

/**
 * Everything happened hovering on paragraphs...
 */
const paragraphs = document.getElementsByTagName("p");

for (const paragraph of paragraphs) {
  fromEvent(paragraph, "mouseenter")
    .pipe(
      throttleTime(50),
      filter(
        (event) =>
          (event.target as HTMLElement).nodeType === Node.ELEMENT_NODE &&
          (event.target as HTMLElement).nodeName === "P"
      )
    )
    .subscribe((event) => {
      const { top, left } = (
        event.target as HTMLParagraphElement
      ).getBoundingClientRect();
      currentParagraphElement = event.target as HTMLParagraphElement;

      showElement({
        top: top + window.scrollY + 6,
        left: left + window.scrollX - 28,
        motion: {
          translateX: [8, 0],
          duration: 500,
          easing: "easeInOutSine",
        },
        style: {
          display: "flex",
        },
      })(highlightParagraphButton);
    });
}

highlightParagraphButton$.pipe().subscribe(() => {
  if (currentParagraphElement) {
    console.log(currentParagraphElement.style);
    const translatedParagraphWrapper = Div({
      className: "translated-paragraph-wrapper",
      style: {
        marginTop: currentParagraphElement.style.marginTop,
        marginBottom: currentParagraphElement.style.marginBottom || "18px",
      },
    });

    const translatedTextElement = currentParagraphElement.cloneNode(
      true
    ) as HTMLParagraphElement;

    translatedTextElement.innerText = "Translating...";
    translatedTextElement.setAttribute("data-translated", "translated");
    translatedTextElement.classList.add(`${$prefix}translated-paragraph`);

    currentParagraphElement.setAttribute("data-translated", "original");
    setStyle(currentParagraphElement, {
      backgroundColor: "rgba(255, 255, 0, 0.25)",
      margin: 0,
      padding: "12px",
      color: "rgba(0, 0, 0, 0.8)",
    });

    const clonedParagraphElement = currentParagraphElement.cloneNode(true);

    translatedParagraphWrapper.append(
      clonedParagraphElement,
      translatedTextElement
    );

    currentParagraphElement.parentElement?.replaceChild(
      translatedParagraphWrapper,
      currentParagraphElement
    );

    let isFirst = true;

    api.translate((result) => {
      if (isFirst) {
        translatedTextElement.innerText = "";
        isFirst = false;
      }
      translatedTextElement.innerText += result;
    })((clonedParagraphElement as HTMLParagraphElement).innerText);
  }
});

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
      originTextDeleteButton$,
      highlightParagraphButton$
    )
  )
  .subscribe((event) => {
    // console.log({ event });
    match(event)
      .with(MessageType.HideTriggerButton, () => {
        hideElement(nonoGPTExtensionElement);
      })
      .with(MessageType.HideAllPopup, () => {
        hideElement(nonoGPTExtensionElement, annotationPanel);
      })
      .with(MessageType.TranslateParagraph, () => {
        console.log("Translate Paragraph");
      })
      .with(MessageType.Highlight, () => {
        hideElement(nonoGPTExtensionElement);

        const { text, container } = highlightSelection() || {};

        if (!text || !container) return;

        selectedTextStore = text;

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
          observable: annotation$,
          subscription,
          annotationInstance: annotation,
        });
      })
      .with({ selectedContent: Pattern.string }, (data) => {
        showElement({
          top: data.y,
          left: data.x,
          motion: {
            scale: [0, 1],
          },
        })(nonoGPTExtensionElement);
      })
      .otherwise(() => noop);
  });
