/**
 * Everything happened focusing on inputs...
 */
import { fromEvent, map, tap } from "rxjs";

import api from "~/content/api";
import * as elements from "~/content/elements";
import { useLoading } from "~/content/functions";
import * as globalStore from "~/content/store";
import { showElement } from "~/util";

export default function assist2Inputs(
  translateInputButton: typeof elements.translateInputButton,
  store: typeof globalStore
) {
  const inputs = document.getElementsByTagName("input");

  for (const input of inputs) {
    fromEvent(input, "focus")
      .pipe(
        tap((event) => {
          store.currentInputElement.setState(event.target as HTMLInputElement);
        }),
        map((event) => {
          const { top, right } = (
            event.target as HTMLInputElement
          ).getBoundingClientRect();

          return {
            top,
            right,
          };
        })
      )
      .subscribe(({ top, right }) => {
        showElement({
          top: top + window.scrollY + 6,
          left: right + window.scrollX + 8,
          motion: {
            translateX: [8, 0],
            duration: 500,
            easing: "easeInOutSine",
          },
          style: {
            display: "flex",
          },
        })(translateInputButton.element);
      });
  }

  translateInputButton.listeners.click$.subscribe(() => {
    const input = store.currentInputElement.getState();

    if (input && input.value) {
      const prevInput = input.value;
      const { loading$ } = useLoading((frame) => {
        input.value = `${frame} Translating...`;
      });

      api.translate(
        (result, isFirst) => {
          if (isFirst) {
            loading$.unsubscribe();
            input.value = "";
          }
          input.value += result;
        },
        (receivedText) => {
          console.log(receivedText);
        },
        (error) => {
          input.value = prevInput;
        }
      )(prevInput, "en");
    }
  });
}
