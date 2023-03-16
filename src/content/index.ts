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

import { $prefix, hideElement, highlightSelection, showElement } from "~/util";
import { useAnnotationPanel, useLoading } from "~/content/functions";
import * as store from "~/content/store";
import { MessageType } from "~/content/constants";
import * as elements from "~/content/elements";
import speedyTranslationForParagraph from "~/content/paragraph";
import assist2Inputs from "~/content/input";
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
      api[action](
        (result, isFirst) => {
          if (isFirst) {
            loading$.unsubscribe();
            elements.resultElement.element.innerHTML = "";
          }
          elements.resultElement.element.innerHTML += result;
        },
        (receivedText) => {
          const annotations = store.annotations.getState();
          const annotationId = store.currentAnnotationId.getState();
          const annotation = annotations.get(annotationId);

          if (annotation) {
            const newState = annotations.set(annotationId, {
              ...annotation,
              [action]: receivedText,
            });
            store.annotations.setState(newState);
          }
        },
        (err) => {
          loading$.unsubscribe();
          elements.resultElement.element.innerHTML =
            'Unexpected Error: "' + err + '"';
        }
      )(store.selectedTextStore.getState())
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
    const annotation = annotations.get(currentId);

    if (annotation) {
      annotation.element.classList.add("invalid");
      annotation.annotationInstance.remove();
      annotation.subscription.unsubscribe();
      annotations.delete(currentId);
      store.annotations.setState(annotations);
    }
  }
});

const mouseup$ = fromEvent(document, "mouseup");
const mousedown$ = fromEvent(document, "mousedown").pipe(
  takeUntil(elements.triggerButton.listeners.mousedown$),
  repeat({ delay: () => mouseup$ }),
  map((event) =>
    elements.annotationPanel.element.contains(event.target as Node)
      ? MessageType.HideTriggerButton
      : MessageType.HideAllPopup
  )
);

const startInterval$ = merge(
  mouseup$,
  elements.triggerButton.listeners.mouseleave$
).pipe(
  takeUntil(elements.triggerButton.listeners.mousedown$),
  repeat({ delay: () => mouseup$ }),
  filter(
    (event) => !elements.annotationPanel.element.contains(event.target as Node)
  )
);
const stopInterval$ = merge(
  elements.triggerButton.listeners.mouseenter$,
  mousedown$,
  elements.triggerButton.listeners.mousedown$,
  elements.triggerButton.listeners.mouseup$
);

const visibleInterval$ = interval(2000).pipe(
  takeUntil(stopInterval$),
  take(1),
  map(() => MessageType.HideTriggerButton),
  repeat({ delay: () => startInterval$ })
);

store.annotations.subscribe((annotations) => {
  if (annotations.size > 0) {
    showElement({
      style: {
        display: "flex",
      },
      motion: {
        scale: [0, 1],
      },
      innerHTML: `${annotations.size}`,
    })(elements.annotationsCountButton.element);
  } else {
    hideElement(elements.annotationsCountButton.element);
  }
});

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
      elements.highlightParagraphButton.listeners.click$,
      elements.annotationsCountButton.listeners.click$,
      elements.closeAnnotationsBoard.listeners.click$
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
      .with(MessageType.HideAnnotationsBoard, () => {
        hideElement(elements.annotationsBoard.element);
      })
      .with(MessageType.ShowAnnotationsBoard, () => {
        console.log("Show Annotation Board");
        const annotations = Array.from(
          store.annotations.getState().values()
        ).map((annotation) => {
          return `<div class="${$prefix}annotation-card">
          <div class="original-text">${annotation.originalText}</div>
          <div class="translated-text">${annotation.translate}</div>
          <div class="summarized-text">${annotation.summarize}</div>
          <div class="definition-text">${annotation.definite}</div>
          </div>`;
        });

        elements.annotationCards.element.innerHTML = annotations.join("");

        showElement({
          motion: {
            scale: [0.8, 1],
            duration: 500,
          },
        })(elements.annotationsBoard.element);
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
          translate: "",
          summarize: "",
          definite: "",
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
assist2Inputs(elements.translateInputButton, store);
