const FOCUSABLE = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])';

export function handleFormEnterKey(e: React.KeyboardEvent<HTMLDivElement>) {
  if (e.key !== 'Enter') return;

  const target = e.target as HTMLElement;
  const tag = target.tagName;

  if (tag === 'TEXTAREA') return;
  if (tag === 'BUTTON') return;
  if ((target as HTMLInputElement).type === 'checkbox') return;

  e.preventDefault();

  const form = e.currentTarget;
  const focusable = Array.from(form.querySelectorAll<HTMLElement>(FOCUSABLE));
  const idx = focusable.indexOf(target);
  if (idx >= 0 && idx < focusable.length - 1) {
    focusable[idx + 1].focus();
  }
}
