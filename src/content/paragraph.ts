/**
 * Everything happened hovering on paragraphs...
 */
import { fromEvent, throttleTime, filter, interval, map, take } from "rxjs";

import api from "~/content/api";
import * as elements from "~/content/elements";
import { useLoading } from "~/content/functions";
import * as globalStore from "~/content/store";
import { showElement, Div, $prefix, setStyle } from "~/util";

export default function speedyTranslationForParagraph(
  highlightParagraphButton: typeof elements.highlightParagraphButton,
  store: typeof globalStore
) {
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
        store.currentParagraphElement.setState(
          event.target as HTMLParagraphElement
        );

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
        })(highlightParagraphButton.element);
      });
  }

  highlightParagraphButton.listeners.click$.subscribe(() => {
    // console.log(3333, store.currentParagraphElement.getState());
    const paragraph = store.currentParagraphElement.getState();
    if (paragraph) {
      const { element: translatedParagraphWrapper } = Div({
        className: "translated-paragraph-wrapper",
        style: {
          marginTop: paragraph.style.marginTop,
          marginBottom: paragraph.style.marginBottom || "18px",
        },
      });

      const translatedTextElement = paragraph.cloneNode(
        true
      ) as HTMLParagraphElement;

      const { loading$ } = useLoading((frame) => {
        translatedTextElement.innerText = `${frame} Translating...`;
      });

      translatedTextElement.setAttribute("data-translated", "translated");
      translatedTextElement.classList.add(`${$prefix}translated-paragraph`);

      paragraph.setAttribute("data-translated", "original");
      setStyle(paragraph, {
        backgroundColor: "rgba(255, 255, 0, 0.25)",
        margin: 0,
        padding: "12px",
        color: "rgba(0, 0, 0, 0.8)",
      });

      const clonedParagraphElement = paragraph.cloneNode(true);

      translatedParagraphWrapper.append(
        clonedParagraphElement,
        translatedTextElement
      );

      paragraph.parentElement?.replaceChild(
        translatedParagraphWrapper,
        paragraph
      );

      api.translate((result, isFirst) => {
        if (isFirst) {
          loading$.unsubscribe();
          translatedTextElement.innerText = "";
        }
        translatedTextElement.innerText += result;
      })((clonedParagraphElement as HTMLParagraphElement).innerText);
    }
  });
}
