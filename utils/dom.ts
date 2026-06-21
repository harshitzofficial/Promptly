export function getActiveEditable() {
  const chatGptInput = document.getElementById('prompt-textarea');
  if (chatGptInput) return chatGptInput as HTMLTextAreaElement | HTMLElement;
  const claudeInput = document.querySelector('.ProseMirror');
  if (claudeInput) return claudeInput as HTMLElement;
  const geminiInput = document.querySelector('rich-textarea > div[contenteditable="true"], .ql-editor, div[role="textbox"][contenteditable="true"]');
  if (geminiInput) return geminiInput as HTMLElement;
  const active = document.activeElement;
  if (active) {
    if (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT') return active as HTMLInputElement | HTMLTextAreaElement;
    if (active.getAttribute('contenteditable') === 'true') return active as HTMLElement;
  }
  return null;
}

export function getEditableText(element: HTMLElement): string {
  if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    return (element as HTMLInputElement).value;
  }
  return element.innerText || '';
}

export function setEditableText(element: HTMLElement, text: string) {
  const clean = text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    const input = element as HTMLInputElement;
    input.value = clean;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    element.innerText = clean;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
