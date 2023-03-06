export function createElement(
  tagName: string,
  className: string | null,
  callback?: (elm: HTMLElement) => void
) {
  const element = document.createElement(tagName);

  if (className) {
    element.classList.add(className);
  }

  callback?.(element);

  return element;
}

export function appendTo(target: HTMLElement) {
  return function (element: HTMLElement) {
    if (target && element) {
      target.appendChild(element);
    }
  };
}
