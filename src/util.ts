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

export function Span(props: ElementProps) {
  return createElement("span")(props);
}

export function P(props: ElementProps) {
  return createElement("p")(props);
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

export function showElement(options: {
  top: number;
  left: number;
  motion: anime.AnimeParams;
  style?: Record<string, string | number>;
  innerHTML?: string;
}) {
  return function (target: HTMLElement) {
    const { top, left, motion, style, innerHTML } = options;
    const shouldAnimate = target.style.display === "none";

    setStyle(target, {
      display: "block",
      top: `${top}px`,
      left: `${left}px`,
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
  const startNode = range.startContainer;
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
  const annotationSpan = Span({
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
    let currentNode = startNode.nextSibling;
    while (currentNode !== null && currentNode !== endNode) {
      annotationSpan.appendChild(currentNode);
      currentNode = currentNode.nextSibling;
    }

    const clonedEndNode = endNode.cloneNode(true);
    (clonedEndNode as Text).splitText(endOffset);

    const startText = (startNode as Text).splitText(startOffset);
    annotationSpan.prepend(startText.cloneNode(true));
    (endNode as Text).splitText(endOffset);
    annotationSpan.appendChild(endNode);
    startNode.parentNode?.replaceChild(annotationSpan, startText);
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
