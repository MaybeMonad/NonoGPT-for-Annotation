/**
 * State Definitions
 */

import type { RoughAnnotation } from "rough-notation/lib/model";
import { Observable, Subscription } from "rxjs";
import { atom } from "~/util";

export const annotations = atom(
  new Map<
    string,
    {
      element: HTMLElement;
      observable: Observable<Event>;
      originalText: string;
      annotationInstance: RoughAnnotation;
      subscription: Subscription;
    }
  >()
);

export const selectedTextStore = atom("");
export const currentAnnotationId = atom("");
export const currentParagraphElement = atom<HTMLParagraphElement | null>(null);
