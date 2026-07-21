const ACTIVE_CLASS = 'printable-active';

export function triggerPrint(printableId: string, delayMs = 300): void {
  const element = document.getElementById(printableId);
  if (!element) {
    console.error(`Print target not found: #${printableId}`);
    alert('Nothing to print. Please open the receipt or report first.');
    return;
  }

  document.body.classList.add('print-active');
  document.body.setAttribute('data-print-target', printableId);
  element.classList.add(ACTIVE_CLASS);

  const cleanup = () => {
    document.body.classList.remove('print-active');
    document.body.removeAttribute('data-print-target');
    element.classList.remove(ACTIVE_CLASS);
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);

  setTimeout(() => {
    window.print();
  }, delayMs);
}

export function safePdfExport(action: () => void, label = 'PDF'): boolean {
  try {
    action();
    return true;
  } catch (error) {
    console.error(`${label} generation failed:`, error);
    alert(`${label} generation failed. Please try again.`);
    return false;
  }
}
