import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';

export function useDialogLayout(ref: RefObject<HTMLDialogElement | null>) {
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const header = dialog.querySelector<HTMLElement>(':scope > .dialog-header');
    let frame: number | null = null;
    const revealFocus = () => {
      frame = null;
      const target = document.activeElement;
      if (
        !(target instanceof HTMLElement) ||
        !dialog.contains(target) ||
        target.closest('.dialog-header, .dialog-actions')
      )
        return;
      const rect = target.getBoundingClientRect();
      const bounds = dialog.getBoundingClientRect();
      const footer = dialog.querySelector<HTMLElement>(':scope > .dialog-actions');
      const top = (header?.getBoundingClientRect().bottom ?? bounds.top) + 12;
      const bottom = (footer?.getBoundingClientRect().top ?? bounds.bottom) - 12;
      if (rect.height <= bottom - top && rect.bottom > bottom)
        dialog.scrollTop += rect.bottom - bottom;
      else if (rect.top < top) dialog.scrollTop -= top - rect.top;
    };
    const scheduleFocus = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(revealFocus);
    };
    const measure = () => {
      const footer = dialog.querySelector<HTMLElement>(':scope > .dialog-actions');
      dialog.style.setProperty(
        '--dialog-header-height',
        `${header?.getBoundingClientRect().height ?? 0}px`,
      );
      scheduleFocus();
      dialog.style.setProperty(
        '--dialog-footer-height',
        `${footer?.getBoundingClientRect().height ?? 0}px`,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(dialog);
    if (header) observer.observe(header);
    const mutations = new MutationObserver(measure);
    mutations.observe(dialog, { childList: true });
    dialog.addEventListener('focusin', scheduleFocus);
    measure();
    return () => {
      observer.disconnect();
      mutations.disconnect();
      dialog.removeEventListener('focusin', scheduleFocus);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [ref]);
}
