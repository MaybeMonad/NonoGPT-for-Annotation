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

export function getElement<P extends object>(
  store: Map<string, P>,
  element: HTMLElement
): P | undefined {
  const id = element.getAttribute("data-annotation-id");
  return id ? store.get(id) : undefined;
}
