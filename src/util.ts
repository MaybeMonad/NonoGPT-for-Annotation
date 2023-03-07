import { createParser } from "eventsource-parser";
import anime from "animejs";

type ElementProps = {
  id?: string;
  className?: string;
  innerHTML?: string;
  style?: Record<string, string | number>;
  callback?: (elm: HTMLElement) => void;
};

export const $prefix = "nono-gpt-extension__";

export function createElement(tagName: string) {
  return function (props: ElementProps) {
    const { id, className, innerHTML, callback, style } = props;
    const element = document.createElement(tagName);

    element.innerHTML = innerHTML || "";

    if (id) {
      element.setAttribute("data-annotation-id", id);
    }

    if (style) {
      setStyle(element, style);
    }

    if (className) {
      element.classList.add($prefix + className);
    }

    callback?.(element);

    return element;
  };
}

export function Div(props: ElementProps) {
  return createElement("div")(props);
}

export function Button(props: ElementProps) {
  return createElement("button")(props);
}

export function appendTo(target: HTMLElement) {
  return function (element: HTMLElement) {
    if (target && element) {
      target.appendChild(element);
    }
  };
}

export function appendChild(child: DocumentFragment) {
  return function (parent: HTMLElement) {
    if (parent && child) {
      parent.appendChild(child);
    }
  };
}

export function setStyle(
  target: HTMLElement,
  styles: Record<string, string | number>
) {
  Object.keys(styles).forEach((key) => {
    target.style[key as any] = styles[key] as string;
  });
}

export function hideElement(...targets: HTMLElement[]) {
  for (const target of targets) {
    target.style.display = "none";
  }
}

export function showElement(
  target: HTMLElement,
  top: number,
  left: number,
  motion: anime.AnimeParams,
  innerHTML?: string
) {
  target.style.display = "block";
  target.style.top = `${top}px`;
  target.style.left = `${left}px`;

  if (innerHTML) {
    target.innerHTML = innerHTML;
  }

  anime({
    targets: target,
    easing: "easeInOutExpo",
    duration: 240,
    opacity: [0, 100],
    ...motion,
  });
}

export function getLatestElement<P extends object>(
  store: Map<string, P>
): P | undefined {
  const keys = Array.from(store.keys());
  return store.get(keys[keys.length - 1]);
}

/**
 * The SSE parser code is borrowed from @yetone
 */

export async function* streamAsyncIterable(
  stream: ReadableStream<Uint8Array> | null
) {
  if (!stream) {
    return;
  }

  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        return;
      }

      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

interface FetchSSEOptions extends RequestInit {
  onMessage(data: string): void;
  onError(error: any): void;
}

export async function fetchSSE(input: string, options: FetchSSEOptions) {
  const { onMessage, onError, ...fetchOptions } = options;
  let response;
  try {
    response = await fetch(input, fetchOptions);
  } catch (err) {
    onError(err);
    return;
  }

  if (response.status !== 200) {
    onError(await response.json());
    return;
  }

  const parser = createParser((event) => {
    if (event.type === "event") {
      onMessage(event.data);
    }
  });

  for await (const chunk of streamAsyncIterable(response.body)) {
    const str = new TextDecoder().decode(chunk);
    parser.feed(str);
  }
}
