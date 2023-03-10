/**
 * Register DOM Elements
 */

import { map, tap } from "rxjs";

import { MessageType } from "~/content/constants";
import { Div, appendTo, Button } from "~/util";

export const nonoGPTExtensionElement = Div({
  className: "main",
  callback: appendTo(document.body),
});

export const triggerButton = Button(
  {
    className: "trigger-button",
    innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"></path><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path></svg>`,
    callback: appendTo(nonoGPTExtensionElement.element),
  },
  {
    mousedown$: (event) => event.pipe(map(() => MessageType.Highlight)),
    mouseup$: (event) => event.pipe(map(() => MessageType.ShowTriggerButton)),
    mouseenter$: (event) => event,
    mouseleave$: (event) => event,
  }
);

export const annotationPanel = Div({
  className: "annotation-panel",
  innerHTML: `
    <div></div>
  `,
  callback: appendTo(document.body),
});

export const originTextContainer = Div({
  className: "origin_text_container",
  callback: appendTo(annotationPanel.element),
});

export const originTextElement = Div({
  className: "origin_text",
  callback: appendTo(originTextContainer.element),
});

export const originTextDeleteButton = Div(
  {
    className: "origin_text_delete_button",
    innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    callback: appendTo(originTextContainer.element),
  },
  {
    click$: (event) => event.pipe(map(() => MessageType.HideAllPopup)),
  }
);

export const actionButtonsElement = Div({
  className: "action_buttons",
  callback: appendTo(annotationPanel.element),
});

export const translateButton = Button(
  {
    className: "translate-button",
    innerHTML: `Translate<span>ZH</span>`,
    callback: appendTo(actionButtonsElement.element),
  },
  {
    click$: (event) =>
      event.pipe(
        tap(() => {
          resultElement.element.innerHTML = "";
        })
      ),
  }
);

export const summarizeButton = Button(
  {
    className: "summarize-button",
    innerHTML: `Summarize`,
    callback: appendTo(actionButtonsElement.element),
  },
  {
    click$: (event) =>
      event.pipe(
        tap(() => {
          resultElement.element.innerHTML = "";
        })
      ),
  }
);

export const vocabularyButton = Button({
  className: "vocabulary-button",
  innerHTML: `Vocabulary`,
  callback: appendTo(actionButtonsElement.element),
});

export const resultElement = Div({
  className: "result",
  style: {
    display: "none",
  },
  callback: appendTo(annotationPanel.element),
});

export const highlightParagraphButton = Div(
  {
    className: "highlight-paragraph-button",
    innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4v16"></path><path d="M17 4v16"></path><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"></path></svg>`,
    callback: appendTo(document.body),
  },
  {
    click$: (event) => event.pipe(map(() => MessageType.TranslateParagraph)),
  }
);
