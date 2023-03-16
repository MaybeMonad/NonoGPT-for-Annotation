import anime from "animejs";
import { BehaviorSubject, Observable, fromEvent } from "rxjs";

type EventReturnType<ListenerFn> = ListenerFn extends (
  event: Observable<Event>
) => infer T
  ? T
  : never;

type Listeners = Record<string, (event: Observable<Event>) => Observable<any>>;

type ElementProps = {
  id?: string;
  className?: string;
  innerHTML?: string;
  style?: Record<string, string | number>;
  mount?: (elm: HTMLElement) => void;
};

export const $prefix = "nono-gpt-extension__";

export function createElement(tagName: string) {
  return function <T extends Record<string, any>>(
    props: ElementProps,
    listeners?: T
  ) {
    const { id, className, innerHTML, mount, style } = props;
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

    mount?.(element);

    let events = {} as {
      [K in keyof T]: EventReturnType<T[K]>;
    };

    if (listeners) {
      events = Object.keys(listeners).reduce(
        (acc, cur) => {
          acc[cur as keyof T] = listeners[cur](
            fromEvent(element, cur.slice(0, -1))
          ) as EventReturnType<T[keyof T]>;

          return acc;
        },
        {} as {
          [K in keyof T]: EventReturnType<T[K]>;
        }
      );
    }

    return { element, listeners: events };
  };
}

export function Div<T extends Listeners>(props: ElementProps, listeners?: T) {
  return createElement("div")<T>(props, listeners);
}

export function Button<T extends Listeners>(
  props: ElementProps,
  listeners?: T
) {
  return createElement("button")<T>(props, listeners);
}

export function Span<T extends Listeners>(props: ElementProps, listeners?: T) {
  return createElement("span")<T>(props, listeners);
}

export function P<T extends Listeners>(props: ElementProps, listeners?: T) {
  return createElement("p")<T>(props, listeners);
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
  styles: Record<string, string | number | undefined>
) {
  Object.keys(styles).forEach((key) => {
    if (styles[key]) {
      target.style[key as any] = styles[key] as string;
    }
  });
}

export function hideElement(...targets: HTMLElement[]) {
  for (const target of targets) {
    target.style.display = "none";
  }
}

export function showElement(options: {
  top?: number;
  left?: number;
  right?: number;
  motion?: anime.AnimeParams;
  style?: Record<string, string | number>;
  innerHTML?: string;
}) {
  return function (target: HTMLElement) {
    const { top, left, right, motion = {}, style, innerHTML } = options;
    const shouldAnimate = target.style.display === "none";

    setStyle(target, {
      display: "block",
      top: top && `${top}px`,
      left: left && `${left}px`,
      right: right && `${right}px`,
      ...style,
    });

    if (innerHTML) {
      target.innerHTML = innerHTML;
    }

    if (shouldAnimate) {
      anime({
        targets: target,
        easing: "easeInOutExpo",
        duration: 240,
        opacity: [0, 100],
        ...motion,
      });
    }
  };
}

export function getLatestElement<P extends object>(
  store: Map<string, P>
): P | undefined {
  const keys = Array.from(store.keys());
  return store.get(keys[keys.length - 1]);
}

export function getElement<P extends object>(
  store: Map<string, P>,
  element: HTMLElement
): P | undefined {
  const id = element.getAttribute("data-annotation-id");
  return id ? store.get(id) : undefined;
}

export function highlightSelection() {
  const selection = window.getSelection();
  if (!selection) return;

  const range = selection.getRangeAt(0);
  let startNode = range.startContainer;
  const endNode = range.endContainer;
  const startOffset = range.startOffset;
  const endOffset = range.endOffset;
  const text = selection.toString();

  // Get the common ancestor of the start and end nodes
  let commonAncestor = range.commonAncestorContainer;
  while (commonAncestor.nodeType !== Node.ELEMENT_NODE) {
    commonAncestor = commonAncestor.parentNode ?? commonAncestor;
  }

  // Create a new span element for the highlight
  const id = text;
  const { element: annotationSpan } = Span({
    id,
    className: `annotation-highlighted-text`,
  });

  // If the start and end nodes are the same, wrap them in the span element
  if (startNode === endNode) {
    if (startNode.nodeType === Node.TEXT_NODE) {
      const highlightedText = (startNode as Text).splitText(startOffset);
      highlightedText.splitText(endOffset - startOffset);
      const clonedText = highlightedText.cloneNode(true);
      annotationSpan.appendChild(clonedText);
      highlightedText.parentNode?.replaceChild(annotationSpan, highlightedText);
    } else {
      console.warn(
        "startNode.nodeType !== Node.TEXT_NODE",
        startNode.nodeType,
        Node.TEXT_NODE
      );
    }

    // If the start and end nodes are different, wrap the start node in the span and add any intervening nodes
  } else {
    let currentNode: ChildNode | null = startNode.nextSibling;

    if (currentNode === null) {
      if (!startNode.parentNode) return;
      startNode = startNode.parentNode;
      currentNode = startNode.nextSibling;
    }

    while (currentNode !== null && currentNode !== endNode) {
      const clonedNode = currentNode.cloneNode(true);
      annotationSpan.appendChild(clonedNode);
      const currentNodeShadow = currentNode;
      currentNode = currentNode.nextSibling;
      currentNodeShadow.remove();
    }

    const clonedEndNode = endNode.cloneNode(true);

    if (clonedEndNode.nodeType === Node.TEXT_NODE) {
      (clonedEndNode as Text).splitText(endOffset);
    }

    if (startNode.nodeType === Node.TEXT_NODE) {
      startNode = (startNode as Text).splitText(startOffset);
    }

    annotationSpan.prepend(startNode.cloneNode(true));
    if (endNode.nodeType === Node.TEXT_NODE) {
      (endNode as Text).splitText(endOffset);
      annotationSpan.appendChild(endNode);
    }
    startNode.parentNode?.replaceChild(annotationSpan, startNode);
  }

  const highlighted = {
    text,
    start: startOffset,
    end: endOffset,
    html: annotationSpan.outerHTML,
    container: annotationSpan,
  };

  return highlighted;
}

export function atom<T extends any>(state: T) {
  const state$ = new BehaviorSubject(state);

  const setState = (state: T) => {
    state$.next(state);
  };

  const getState = () => state$.getValue();

  const subscribe = (mount: (state: T) => void) => {
    state$.subscribe(mount);
  };

  return {
    setState,
    getState,
    subscribe,
  };
}
