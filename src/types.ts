export interface User {
  id: number;
  username: string;
  fullName: string;
  role: 'Admin' | 'Manager' | 'Cashier';
  createdAt: string;
  updatedAt?: string;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Supplier {
  id: number;
  name: string;
  companyName: string;
  phone: string;
  email: string;
  address: string;
  productType: string;
  balance?: number;
  openingBalance?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  whatsappNumber?: string;
  email?: string;
  address: string;
  balance: number;
  openingBalance: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Loan {
  id: number;
  customerId: number;
  invoiceNumber: string;
  billAmount: number;
  paidAmount: number;
  remainingBalance: number;
  loanDate: string;
  dueDate?: string;
  status: 'Paid' | 'Outstanding' | 'Partial';
  createdAt?: string;
  updatedAt?: string;
}

export interface LoanPayment {
  id: number;
  loanId: number;
  customerId: number;
  amount: number;
  paymentMethod: 'Cash' | 'Bank' | 'Other';
  paymentDate: string;
  invoiceNumber?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  id: number;
  name: string;
  barcode: string;
  categoryId: number;
  supplierId: number;
  costPrice: number;
  salePrice: number;
  quantity: number;
  unit: string;
  expiryDate?: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Sale {
  id: number;
  invoiceNo: string;
  customerId?: number;
  userId: number;
  subtotal: number;
  discount: number; // Flat discount
  tax: number; // Calculated tax
  grandTotal: number;
  paidAmount: number;
  returnAmount: number;
  paymentMethod: 'Cash' | 'Card' | 'Easypaisa' | 'JazzCash' | 'Bank Transfer';
  saleDate: string;
  items?: { productId: number; name: string; quantity: number; salePrice: number; costPrice: number }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface StockHistory {
  id: number;
  productId: number;
  changeType: 'Add' | 'Reduce' | 'Sale' | 'Adjustment';
  quantityChanged: number;
  oldQuantity: number;
  newQuantity: number;
  note: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Settings {
  id: number;
  shopName: string;
  shopAddress: string;
  phone: string;
  taxPercentage: number;
  currencySymbol: string;
  receiptFooter: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActivityLog {
  id: number;
  action: string;
  details: string;
  userId: number;
  username?: string;
  dataAffected?: string;
  recordsDeleted?: number;
  deviceInfo?: string;
  status?: 'Success' | 'Failed' | 'Denied';
  createdAt?: string;
  updatedAt?: string;
}

export interface Expense {
  id: number;
  category: 'Electricity' | 'Rent' | 'Salaries' | 'Internet' | 'Transport' | 'Maintenance' | 'Miscellaneous' | string;
  amount: number;
  expenseDate: string;
  description: string;
  createdAt?: string;
}

export interface Purchase {
  id: number;
  invoiceNo: string;
  supplierId: number;
  purchaseDate: string;
  items: {
    productId: number;
    name: string;
    quantity: number;
    purchasePrice: number;
    sellingPrice: number;
  }[];
  totalAmount: number;
  paidAmount: number;
  status: 'Paid' | 'Outstanding' | 'Partial';
  createdAt?: string;
}
