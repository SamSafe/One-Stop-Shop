export function downloadFile(raw: string, name: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([raw], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
