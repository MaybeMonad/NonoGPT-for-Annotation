import { Observable, fromEvent, interval, merge, noop } from "rxjs";
import {
  map,
  mergeWith,
  filter,
  repeat,
  takeUntil,
  take,
  switchMap,
} from "rxjs/operators";
import { match, Pattern } from "ts-pattern";
import { annotate } from "rough-notation";

import { hideElement, highlightSelection, showElement } from "~/util";
import { useAnnotationPanel, useLoading } from "~/content/functions";
import * as store from "~/content/store";
import { MessageType } from "~/content/constants";
import * as elements from "~/content/elements";
import speedyTranslationForParagraph from "~/content/paragraph";
import api from "~/content/api";

import "./index.css";

console.log("Content Script is Working!");

function actionButton(event: Observable<Event>, action: keyof typeof api) {
  return event.pipe(
    map(() => {
      elements.resultElement.element.style.display = "block";
      const { loading$ } = useLoading((frame) => {
        elements.resultElement.element.innerHTML = `${frame} loading...`;
      });

      return loading$;
    }),
    switchMap((loading$) =>
      api[action]((result, isFirst) => {
        if (isFirst) {
          loading$.unsubscribe();
          elements.resultElement.element.innerHTML = "";
        }
        elements.resultElement.element.innerHTML += result;
      })(store.selectedTextStore.getState())
    )
  );
}

const translateButton = actionButton(
  elements.translateButton.listeners.click$,
  "translate"
);

const summarizeButton = actionButton(
  elements.summarizeButton.listeners.click$,
  "summarize"
);

const definitionButton = actionButton(
  elements.definitionButton.listeners.click$,
  "definite"
);

merge(translateButton, summarizeButton, definitionButton).subscribe();

elements.originTextDeleteButton.listeners.click$.subscribe(() => {
  const annotations = store.annotations.getState();
  const currentId = store.currentAnnotationId.getState();

  if (annotations.has(currentId)) {
    const store = annotations.get(currentId);

    if (store) {
      store.element.classList.add("invalid");
      store.annotationInstance.remove();
      store.subscription.unsubscribe();
      // store.element.replaceWith(store.originalElement);
    }
  }
});

export const mouseup$ = fromEvent(document, "mouseup");
export const mousedown$ = fromEvent(document, "mousedown").pipe(
  takeUntil(elements.triggerButton.listeners.mousedown$),
  repeat({ delay: () => mouseup$ }),
  map((event) =>
    elements.annotationPanel.element.contains(event.target as Node)
      ? MessageType.HideTriggerButton
      : MessageType.HideAllPopup
  )
);

export const startInterval$ = merge(
  mouseup$,
  elements.triggerButton.listeners.mouseleave$
).pipe(
  takeUntil(elements.triggerButton.listeners.mousedown$),
  repeat({ delay: () => mouseup$ }),
  filter(
    (event) => !elements.annotationPanel.element.contains(event.target as Node)
  )
);
export const stopInterval$ = merge(
  elements.triggerButton.listeners.mouseenter$,
  mousedown$,
  elements.triggerButton.listeners.mousedown$,
  elements.triggerButton.listeners.mouseup$
);

export const visibleInterval$ = interval(2000).pipe(
  takeUntil(stopInterval$),
  take(1),
  map(() => MessageType.HideTriggerButton),
  repeat({ delay: () => startInterval$ })
);

export const loading$ = interval(600).pipe(
  takeUntil(elements.triggerButton.listeners.mousedown$),
  repeat({ delay: () => mouseup$ }),
  map(() => MessageType.HideTriggerButton)
);

/**
 * Everything happened after `mouseup`...
 */

mouseup$
  .pipe(
    filter((event) => {
      const selection = window.getSelection();
      if (elements.triggerButton.element.contains(event.target as Node))
        return true;
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
      elements.triggerButton.listeners.mousedown$,
      elements.triggerButton.listeners.mouseup$,
      elements.originTextDeleteButton.listeners.click$,
      elements.highlightParagraphButton.listeners.click$
    )
  )
  .subscribe((event) => {
    // console.log({ event });
    match(event)
      .with(MessageType.HideTriggerButton, () => {
        hideElement(elements.nonoGPTExtensionElement.element);
      })
      .with(MessageType.HideAllPopup, () => {
        hideElement(
          elements.nonoGPTExtensionElement.element,
          elements.annotationPanel.element
        );
      })
      .with(MessageType.TranslateParagraph, () => {
        console.log("Translate Paragraph");
      })
      .with(MessageType.Highlight, () => {
        hideElement(elements.nonoGPTExtensionElement.element);

        const { text, container } = highlightSelection() || {};

        if (!text || !container) return;

        store.selectedTextStore.setState(text);

        const annotation = annotate(container, {
          type: "highlight",
          multiline: true,
          color: "rgb(255, 213, 79)",
          brackets: ["left", "right"],
        });
        annotation.show();

        const showPanel = useAnnotationPanel({
          originTextElement: elements.originTextElement.element,
          panelElement: elements.annotationPanel.element,
          text,
          store,
        });

        showPanel(container);

        const annotation$ = fromEvent(container, "click");
        const subscription = annotation$
          .pipe(map((evt) => evt.target as HTMLDivElement))
          .subscribe(showPanel);

        const newState = store.annotations.getState().set(text, {
          element: container,
          originalText: text,
          observable: annotation$,
          subscription,
          annotationInstance: annotation,
        });

        store.annotations.setState(newState);
      })
      .with({ selectedContent: Pattern.string }, (data) => {
        showElement({
          top: data.y,
          left: data.x,
          motion: {
            scale: [0, 1],
          },
        })(elements.nonoGPTExtensionElement.element);
      })
      .otherwise(() => noop);
  });

speedyTranslationForParagraph(elements.highlightParagraphButton, store);
