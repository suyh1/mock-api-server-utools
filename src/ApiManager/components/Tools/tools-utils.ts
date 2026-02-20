export function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function copyText(text: string) {
  navigator.clipboard.writeText(text);
}
