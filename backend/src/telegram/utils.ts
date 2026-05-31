export function escapeMd(text: string): string {
  return text.replace(/[*_`[\]]/g, '\\$&');
}
