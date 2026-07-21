declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf';

  interface AutoTableOptions {
    startY?: number;
    head?: string[][];
    body?: string[][];
    styles?: Record<string, unknown>;
    headStyles?: Record<string, unknown>;
    alternateRowStyles?: Record<string, unknown>;
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
  }

  export default function autoTable(doc: jsPDF, options: AutoTableOptions): void;
}
