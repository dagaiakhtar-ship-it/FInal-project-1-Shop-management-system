import React, { useState, useEffect } from 'react';
import { User, Product, Category, Customer, Supplier, Sale, StockHistory, Settings, Loan, LoanPayment, Expense, Purchase, ActivityLog } from './types';
import {
  DEFAULT_USERS,
  DEFAULT_CATEGORIES,
  DEFAULT_SUPPLIERS,
  DEFAULT_CUSTOMERS,
  DEFAULT_PRODUCTS,
  DEFAULT_SETTINGS,
  DEFAULT_SALES,
  DEFAULT_STOCK_HISTORY,
  loadFromLocalStorage,
  saveToLocalStorage,
  hashPassword,
  DEFAULT_USER_PASSWORDS,
  DEFAULT_EXPENSES,
  DEFAULT_PURCHASES,
  ensureDataVersion,
  DATA_VERSION,
} from './data';
import {
  exportBackup,
  getBackupSummary,
  BackupPayload,
  BackupCollections,
  BackupExportResult,
} from './utils/backup';
import {
  checkServerHealth,
  loadAllDataFromServer,
  saveAllDataToServer,
} from './utils/serverSync';
import {
  DataManagementAction,
  getDeviceInfo,
  clearStoredImages,
  clearReportCache,
  exportShopDataCsv,
  exportReportsPdf,
  DATA_ACTION_CONFIGS,
} from './utils/dataManagement';
import {
  allocatePaymentToLoans,
  getCustomerOutstanding,
  round2,
} from './utils/finance';

// Run the one-time stale-data reset before any state is initialized, so the
// lazy initializers below always read either the user's real persisted data or
// the (clean) defaults — never stale demo data.
ensureDataVersion();

// Component Views
import LoginView from './components/LoginView';
import DashboardView from './components/DashboardView';
import ProductView from './components/ProductView';
import CategoryView from './components/CategoryView';
import InventoryView from './components/InventoryView';
import BillingView from './components/BillingView';
import CustomerView from './components/CustomerView';
import SupplierView from './components/SupplierView';
import SalesHistoryView from './components/SalesHistoryView';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';
import GmailView from './components/GmailView';
import ExpenseView from './components/ExpenseView';
import PurchaseView from './components/PurchaseView';

// Icons
import {
  Store,
  LayoutDashboard,
  Package,
  Tags,
  RefreshCw,
  ShoppingCart,
  Users,
  Truck,
  History,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  Briefcase,
  UserCheck,
  Mail,
  TrendingDown,
  ShoppingBag,
  Sun,
  Moon,
} from 'lucide-react';

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Users database — lazy-initialized from localStorage so there is never an
  // empty-state phase that could overwrite persisted data via the save effects.
  const [users, setUsers] = useState<User[]>(() => loadFromLocalStorage('users', DEFAULT_USERS));
  const [userPasswords, setUserPasswords] = useState<Record<string, string>>(() => loadFromLocalStorage('userPasswords', DEFAULT_USER_PASSWORDS));

  // Core database collections — initialized directly from localStorage.
  const [products, setProducts] = useState<Product[]>(() => loadFromLocalStorage('products', DEFAULT_PRODUCTS));
  const [categories, setCategories] = useState<Category[]>(() => loadFromLocalStorage('categories', DEFAULT_CATEGORIES));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadFromLocalStorage('suppliers', DEFAULT_SUPPLIERS));
  const [customers, setCustomers] = useState<Customer[]>(() => loadFromLocalStorage('customers', DEFAULT_CUSTOMERS));
  const [sales, setSales] = useState<Sale[]>(() => loadFromLocalStorage('sales', DEFAULT_SALES));
  const [stockHistory, setStockHistory] = useState<StockHistory[]>(() => loadFromLocalStorage('stockHistory', DEFAULT_STOCK_HISTORY));
  const [loans, setLoans] = useState<Loan[]>(() => loadFromLocalStorage('loans', []));
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>(() => loadFromLocalStorage('loanPayments', []));
  const [settings, setSettings] = useState<Settings>(() => loadFromLocalStorage('settings', DEFAULT_SETTINGS));
  const [expenses, setExpenses] = useState<Expense[]>(() => loadFromLocalStorage('expenses', DEFAULT_EXPENSES));
  const [purchases, setPurchases] = useState<Purchase[]>(() => loadFromLocalStorage('purchases', DEFAULT_PURCHASES));
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => loadFromLocalStorage('activityLogs', []));

  const getAllCollectionsPayload = () => ({
    products,
    categories,
    suppliers,
    customers,
    sales,
    stockHistory,
    loans,
    loanPayments,
    settings,
    users,
    userPasswords,
    expenses,
    purchases,
    activityLogs,
  });

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'light';
  });
  const [serverAvailable, setServerAvailable] = useState(false);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [theme]);

  // Active Screen Selector
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Restore last logged-in user (the collections are lazy-initialized above,
  // so the data-reset is handled by ensureDataVersion() at module load).
  useEffect(() => {
    const savedUser = localStorage.getItem('smart_shop_remembered_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setCurrentUser(u);
        if (u.role === 'Cashier') {
          setActiveTab('billing');
        }
      } catch (e) {
        console.error('Failed to parse saved user credentials');
      }
    }
  }, []);

  // Save changes to localStorage whenever state variables change (for local mode).
  // NOTE: no `length > 0` guard — an empty array is a valid state (e.g. after
  // deleting the last record) and must be persisted, otherwise deleted items
  // would silently reappear on the next page reload.
  useEffect(() => {
    saveToLocalStorage('products', products);
  }, [products]);

  useEffect(() => {
    saveToLocalStorage('categories', categories);
  }, [categories]);

  useEffect(() => {
    saveToLocalStorage('suppliers', suppliers);
  }, [suppliers]);

  useEffect(() => {
    saveToLocalStorage('customers', customers);
  }, [customers]);

  useEffect(() => {
    saveToLocalStorage('sales', sales);
  }, [sales]);

  useEffect(() => {
    saveToLocalStorage('stockHistory', stockHistory);
  }, [stockHistory]);

  useEffect(() => {
    saveToLocalStorage('loans', loans);
  }, [loans]);

  useEffect(() => {
    saveToLocalStorage('loanPayments', loanPayments);
  }, [loanPayments]);

  useEffect(() => {
    saveToLocalStorage('settings', settings);
  }, [settings]);

  useEffect(() => {
    saveToLocalStorage('users', users);
  }, [users]);

  useEffect(() => {
    saveToLocalStorage('userPasswords', userPasswords);
  }, [userPasswords]);

  useEffect(() => {
    saveToLocalStorage('expenses', expenses);
  }, [expenses]);

  useEffect(() => {
    saveToLocalStorage('purchases', purchases);
  }, [purchases]);

  useEffect(() => {
    saveToLocalStorage('activityLogs', activityLogs);
  }, [activityLogs]);

  useEffect(() => {
    async function hydrateFromServer() {
      const healthy = await checkServerHealth();
      setServerAvailable(healthy);

      if (!healthy) {
        console.warn('Server not available, falling back to localStorage only.');
        return;
      }

      const result = await loadAllDataFromServer();
      if (!result.success || !result.data) {
        return;
      }

      const data = result.data;
      setProducts(data.products ?? products);
      setCategories(data.categories ?? categories);
      setSuppliers(data.suppliers ?? suppliers);
      setCustomers(data.customers ?? customers);
      setSales(data.sales ?? sales);
      setStockHistory(data.stockHistory ?? stockHistory);
      setLoans(data.loans ?? loans);
      setLoanPayments(data.loanPayments ?? loanPayments);
      setSettings(data.settings ?? settings);
      setUsers(data.users ?? users);
      setUserPasswords(data.userPasswords ?? userPasswords);
      setExpenses(data.expenses ?? expenses);
      setPurchases(data.purchases ?? purchases);
      setActivityLogs(data.activityLogs ?? activityLogs);
    }

    hydrateFromServer();
  }, []);

  useEffect(() => {
    if (!serverAvailable) {
      return;
    }

    const payload = getAllCollectionsPayload();
    saveAllDataToServer(payload).catch((error) => {
      console.warn('Could not save data to server:', error);
    });
  }, [serverAvailable, products, categories, suppliers, customers, sales, stockHistory, loans, loanPayments, settings, users, userPasswords, expenses, purchases, activityLogs]);

  // Auth Callbacks
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveTab(user.role === 'Cashier' ? 'billing' : 'dashboard');
  };

  const handleLogout = async () => {
    localStorage.removeItem('smart_shop_remembered_user');
    setCurrentUser(null);
  };

  const handleAddExpense = (newExpenseData: Omit<Expense, 'id'>) => {
    setExpenses((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((e) => e.id)) + 1 : 1;
      const newExpense: Expense = {
        ...newExpenseData,
        id: nextId,
        createdAt: new Date().toISOString(),
      };
      return [...prev, newExpense];
    });
  };

  const handleDeleteExpense = (id: number) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const handleAddPurchase = (
    newPurchaseData: Omit<Purchase, 'id'>,
    itemUpdates: { productId: number; addQuantity: number; newCostPrice: number; newSalePrice: number }[]
  ) => {
    const nextPurchaseId = purchases.length > 0 ? Math.max(...purchases.map((p) => p.id)) + 1 : 1;
    const newPurchase: Purchase = {
      ...newPurchaseData,
      id: nextPurchaseId,
    };
    setPurchases((prev) => [...prev, newPurchase]);

    setProducts((prevProducts) => {
      return prevProducts.map((p) => {
        const update = itemUpdates.find((u) => u.productId === p.id);
        if (update) {
          return {
            ...p,
            quantity: p.quantity + update.addQuantity,
            costPrice: update.newCostPrice,
            salePrice: update.newSalePrice,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      });
    });

    const newLogs = itemUpdates.map((update, idx) => {
      const originalProduct = products.find((p) => p.id === update.productId);
      const oldQty = originalProduct ? originalProduct.quantity : 0;
      return {
        id: stockHistory.length + 1 + idx,
        productId: update.productId,
        changeType: 'Add' as const,
        quantityChanged: update.addQuantity,
        oldQuantity: oldQty,
        newQuantity: oldQty + update.addQuantity,
        note: `Purchased via Invoice ${newPurchaseData.invoiceNo}`,
        createdAt: new Date().toISOString(),
      };
    });
    setStockHistory((prev) => [...prev, ...newLogs]);

    const outstanding = Math.max(0, parseFloat((newPurchaseData.totalAmount - newPurchaseData.paidAmount).toFixed(2)));
    if (outstanding > 0) {
      setSuppliers((prevSuppliers) => {
        return prevSuppliers.map((s) => {
          if (s.id === newPurchaseData.supplierId) {
            return {
              ...s,
              balance: parseFloat(((s.balance || 0) + outstanding).toFixed(2)),
              updatedAt: new Date().toISOString(),
            };
          }
          return s;
        });
      });
    }
  };

  const handlePaySupplier = (supplierId: number, amountPaid: number) => {
    setSuppliers((prevSuppliers) => {
      return prevSuppliers.map((s) => {
        if (s.id === supplierId) {
          const originalBalance = s.balance || 0;
          const newBalance = Math.max(0, parseFloat((originalBalance - amountPaid).toFixed(2)));
          return {
            ...s,
            balance: newBalance,
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      });
    });
  };

  const handleUpdateSettings = (updated: Settings) => {
    setSettings(updated);
  };

  const handleAddUser = (newUser: User, initialPasswordPlain: string) => {
    setUsers((prev) => {
      const updated = [...prev, newUser];
      return updated;
    });

    const hash = hashPassword(initialPasswordPlain);
    setUserPasswords((prev) => {
      const updated = { ...prev, [newUser.username]: hash };
      return updated;
    });
  };

  const handleUpdateUser = (updatedUser: User, newPasswordPlain?: string, oldUsername?: string) => {
    setUsers((prev) => {
      const updated = prev.map((u) => (u.id === updatedUser.id ? updatedUser : u));
      return updated;
    });

    setUserPasswords((prev) => {
      const updated = { ...prev };
      // Handle rename if username changed
      if (oldUsername && oldUsername !== updatedUser.username) {
        const existingHash = updated[oldUsername];
        delete updated[oldUsername];
        updated[updatedUser.username] = existingHash;
      }
      
      if (newPasswordPlain) {
        const hash = hashPassword(newPasswordPlain);
        updated[updatedUser.username] = hash;
      }

      return updated;
    });

    // Also update currentUser so the session details in sidebar/topbar update immediately
    if (currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }
  };

  const handleDeleteUser = (id: number, username: string) => {
    setUsers((prev) => {
      const updated = prev.filter((u) => u.id !== id);
      return updated;
    });

    setUserPasswords((prev) => {
      const updated = { ...prev };
      delete updated[username];
      return updated;
    });
  };

  const handleResetUsers = () => {
    setUsers(DEFAULT_USERS);
    setUserPasswords(DEFAULT_USER_PASSWORDS);
  };

  const getBackupCollections = (): BackupCollections => ({
    products,
    categories,
    suppliers,
    customers,
    sales,
    stockHistory,
    loans,
    loanPayments,
    settings,
    users,
    userPasswords,
    expenses,
    purchases,
  });

  const logAdminAction = (
    action: string,
    dataAffected: string,
    recordsDeleted: number,
    status: ActivityLog['status'] = 'Success',
    details?: string
  ) => {
    if (!currentUser || currentUser.role !== 'Admin') return;
    const entry: ActivityLog = {
      id: activityLogs.length > 0 ? Math.max(...activityLogs.map((l) => l.id)) + 1 : 1,
      action,
      details: details ?? `${action} — ${recordsDeleted} record(s) affected`,
      userId: currentUser.id,
      username: currentUser.fullName,
      dataAffected,
      recordsDeleted,
      deviceInfo: getDeviceInfo(),
      status,
      createdAt: new Date().toISOString(),
    };
    setActivityLogs((prev) => [...prev, entry]);
  };

  const handleExportBackup = (): BackupExportResult => {
    const result = exportBackup(getBackupCollections());
    if (currentUser?.role === 'Admin') {
      logAdminAction('Export Backup (JSON)', 'All Collections', Object.values(result.recordCounts).reduce((s, n) => s + n, 0), 'Success', `File: ${result.filename}`);
    }
    return result;
  };

  const handleImportBackup = (payload: BackupPayload): { sessionWarning?: string } => {
    const { data } = payload;
    setProducts(data.products);
    setCategories(data.categories);
    setSuppliers(data.suppliers);
    setCustomers(data.customers);
    setSales(data.sales);
    setStockHistory(data.stockHistory);
    setLoans(data.loans);
    setLoanPayments(data.loanPayments);
    setSettings(data.settings);
    setUsers(data.users);
    setUserPasswords(data.userPasswords);
    setExpenses(data.expenses);
    setPurchases(data.purchases);
    localStorage.setItem('smart_shop_data_version', String(DATA_VERSION));

    const totalImported = Object.values(payload.meta.recordCounts).reduce((s, n) => s + n, 0);
    if (currentUser?.role === 'Admin') {
      logAdminAction('Import Backup (JSON)', 'All Collections', totalImported, 'Success', `Restored from ${payload.meta.exportedAt}`);
    }

    if (currentUser && !data.users.some((u) => u.id === currentUser.id)) {
      return {
        sessionWarning: 'Your current login account is not in the restored backup. You may need to log out and sign in again.',
      };
    }
    return {};
  };

  const backupSummary = getBackupSummary(getBackupCollections());

  const handleAdminDataAction = (
    action: DataManagementAction
  ): { success: boolean; recordsDeleted: number; message?: string } => {
    if (!currentUser || currentUser.role !== 'Admin') {
      logAdminAction('Access Denied', 'N/A', 0, 'Denied', 'Non-admin attempted restricted action');
      return { success: false, recordsDeleted: 0, message: 'Access Denied. Only administrators can perform this operation.' };
    }

    const config = DATA_ACTION_CONFIGS.find((c) => c.id === action);
    const dataAffected = config?.dataAffected ?? action;
    let recordsDeleted = 0;

    switch (action) {
      case 'clear_sales':
        recordsDeleted = sales.length;
        setSales([]);
        break;
      case 'clear_products':
        recordsDeleted = products.length + stockHistory.length;
        setProducts([]);
        setStockHistory([]);
        break;
      case 'clear_customers':
        recordsDeleted = customers.length - DEFAULT_CUSTOMERS.length;
        setCustomers(DEFAULT_CUSTOMERS);
        break;
      case 'clear_loans':
        recordsDeleted = loans.length + loanPayments.length;
        setLoans([]);
        setLoanPayments([]);
        setCustomers((prev) =>
          prev.map((c) => (c.id === 1 ? c : { ...c, balance: 0, updatedAt: new Date().toISOString() }))
        );
        break;
      case 'clear_suppliers':
        recordsDeleted = suppliers.length;
        setSuppliers([]);
        break;
      case 'clear_purchases':
        recordsDeleted = purchases.length;
        setPurchases([]);
        break;
      case 'clear_reports':
        recordsDeleted = expenses.length + clearReportCache();
        setExpenses([]);
        break;
      case 'reset_dashboard':
        recordsDeleted = sales.length + loans.length + loanPayments.length + expenses.length;
        setSales([]);
        setLoans([]);
        setLoanPayments([]);
        setExpenses([]);
        break;
      case 'clear_activity_logs':
        recordsDeleted = activityLogs.length;
        setActivityLogs([]);
        return { success: true, recordsDeleted, message: `Activity logs cleared (${recordsDeleted} entries removed).` };
      case 'reset_settings':
        recordsDeleted = 1;
        setSettings(DEFAULT_SETTINGS);
        break;
      case 'clear_images':
        recordsDeleted = clearStoredImages();
        break;
      case 'factory_reset':
        recordsDeleted =
          products.length +
          categories.length +
          suppliers.length +
          customers.length +
          sales.length +
          stockHistory.length +
          loans.length +
          loanPayments.length +
          expenses.length +
          purchases.length +
          activityLogs.length +
          clearStoredImages() +
          clearReportCache();
        setProducts(DEFAULT_PRODUCTS);
        setCategories(DEFAULT_CATEGORIES);
        setSuppliers(DEFAULT_SUPPLIERS);
        setCustomers(DEFAULT_CUSTOMERS);
        setSales(DEFAULT_SALES);
        setStockHistory(DEFAULT_STOCK_HISTORY);
        setLoans([]);
        setLoanPayments([]);
        setExpenses(DEFAULT_EXPENSES);
        setPurchases(DEFAULT_PURCHASES);
        setSettings(DEFAULT_SETTINGS);
        setUsers(DEFAULT_USERS);
        setUserPasswords(DEFAULT_USER_PASSWORDS);
        setActivityLogs([]);
        localStorage.setItem('smart_shop_data_version', String(DATA_VERSION));
        logAdminAction('Factory Reset', 'All Application Data', recordsDeleted, 'Success');
        return {
          success: true,
          recordsDeleted,
          message: `Factory reset complete. All data has been deleted and defaults restored.`,
        };
      default:
        return { success: false, recordsDeleted: 0, message: 'Unknown action.' };
    }

    logAdminAction(config?.label ?? action, dataAffected, recordsDeleted, 'Success');
    return {
      success: true,
      recordsDeleted,
      message: `${config?.label ?? action} completed successfully.`,
    };
  };

  const handleExportDataCsv = () => {
    if (!currentUser || currentUser.role !== 'Admin') return;
    exportShopDataCsv({ sales, products, customers, suppliers, loans, loanPayments, expenses, purchases });
    logAdminAction('Export CSV', 'Sales, Products, Customers, Suppliers, Loans, Expenses, Purchases', 0, 'Success', 'CSV export downloaded');
  };

  const handleExportReportsPdf = () => {
    if (!currentUser || currentUser.role !== 'Admin') return;
    exportReportsPdf({ settings, sales, products, customers, loans, loanPayments, expenses, purchases });
    logAdminAction('Export PDF Reports', 'Business Summary Report', 0, 'Success', 'PDF report downloaded');
  };

  // Product CRUD
  const handleAddProduct = (pData: Omit<Product, 'id' | 'createdAt'>) => {
    const newProduct: Product = {
      ...pData,
      id: products.length > 0 ? Math.max(...products.map((p) => p.id)) + 1 : 1,
      createdAt: new Date().toISOString(),
    };
    const updated = [...products, newProduct];
    setProducts(updated);

    // Create a stock history entry
    const newLog: StockHistory = {
      id: stockHistory.length > 0 ? Math.max(...stockHistory.map((s) => s.id)) + 1 : 1,
      productId: newProduct.id,
      changeType: 'Add',
      quantityChanged: newProduct.quantity,
      oldQuantity: 0,
      newQuantity: newProduct.quantity,
      note: 'Initial product registration load',
      createdAt: new Date().toISOString(),
    };
    setStockHistory([...stockHistory, newLog]);

    return true;
  };

  const handleUpdateProduct = (updatedProd: Product) => {
    const oldProd = products.find((p) => p.id === updatedProd.id);
    if (!oldProd) return false;

    // Detect quantity changes and log history
    if (oldProd.quantity !== updatedProd.quantity) {
      const delta = updatedProd.quantity - oldProd.quantity;
      const newLog: StockHistory = {
        id: stockHistory.length > 0 ? Math.max(...stockHistory.map((s) => s.id)) + 1 : 1,
        productId: updatedProd.id,
        changeType: delta > 0 ? 'Add' : 'Reduce',
        quantityChanged: delta,
        oldQuantity: oldProd.quantity,
        newQuantity: updatedProd.quantity,
        note: `Manual parameter update (Qty: ${delta > 0 ? '+' : ''}${delta})`,
        createdAt: new Date().toISOString(),
      };
      setStockHistory([...stockHistory, newLog]);
    }

    setProducts(products.map((p) => (p.id === updatedProd.id ? updatedProd : p)));
    return true;
  };

  const handleDeleteProduct = (id: number) => {
    setProducts(products.filter((p) => p.id !== id));
  };

  // Category CRUD
  const handleAddCategory = (cData: Omit<Category, 'id'>) => {
    const newCat: Category = {
      ...cData,
      id: categories.length > 0 ? Math.max(...categories.map((c) => c.id)) + 1 : 1,
    };
    setCategories([...categories, newCat]);
  };

  const handleUpdateCategory = (updatedCat: Category) => {
    setCategories(categories.map((c) => (c.id === updatedCat.id ? updatedCat : c)));
  };

  const handleDeleteCategory = (id: number) => {
    setCategories(categories.filter((c) => c.id !== id));
  };

  // Customer CRUD
  const handleAddCustomer = (cData: Omit<Customer, 'id' | 'balance'>) => {
    const newCust: Customer = {
      ...cData,
      id: customers.length > 0 ? Math.max(...customers.map((c) => c.id)) + 1 : 1,
      balance: 0,
    };
    setCustomers([...customers, newCust]);
  };

  const handleUpdateCustomer = (updatedCust: Customer) => {
    setCustomers(customers.map((c) => (c.id === updatedCust.id ? updatedCust : c)));
  };

  const handleDeleteCustomer = (id: number) => {
    setCustomers(customers.filter((c) => c.id !== id));
  };

  // Supplier CRUD
  const handleAddSupplier = (sData: Omit<Supplier, 'id'>) => {
    const newSup: Supplier = {
      ...sData,
      id: suppliers.length > 0 ? Math.max(...suppliers.map((s) => s.id)) + 1 : 1,
    };
    setSuppliers([...suppliers, newSup]);
  };

  const handleUpdateSupplier = (updatedSup: Supplier) => {
    setSuppliers(suppliers.map((s) => (s.id === updatedSup.id ? updatedSup : s)));
  };

  const handleDeleteSupplier = (id: number) => {
    setSuppliers(suppliers.filter((s) => s.id !== id));
  };

  // Manual Stock Adjustment
  const handleAdjustStock = (productId: number, changeType: 'Add' | 'Reduce' | 'Adjustment', qty: number, note: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return false;

    const oldQty = prod.quantity;
    const delta = changeType === 'Add' ? qty : -qty;
    const newQty = Math.max(0, oldQty + delta);

    const updatedProduct = { ...prod, quantity: newQty };

    // Update Product Stock
    setProducts(products.map((p) => (p.id === productId ? updatedProduct : p)));

    // Create Log
    const newLog: StockHistory = {
      id: stockHistory.length > 0 ? Math.max(...stockHistory.map((s) => s.id)) + 1 : 1,
      productId,
      changeType,
      quantityChanged: delta,
      oldQuantity: oldQty,
      newQuantity: newQty,
      note,
      createdAt: new Date().toISOString(),
    };
    setStockHistory([...stockHistory, newLog]);
    return true;
  };

  // POS Billing Checkout
  const handleCheckout = (
    cartItems: { product: Product; quantity: number }[],
    customerId: number,
    subtotal: number,
    discount: number,
    tax: number,
    grandTotal: number,
    paidAmount: number,
    returnAmount: number,
    paymentMethod: Sale['paymentMethod']
  ) => {
    if (!currentUser) return null;

    // 1. Save Sale Transaction
    const newSaleId = sales.length > 0 ? Math.max(...sales.map((s) => s.id)) + 1 : 1;
    const invoiceNo = `INV-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(newSaleId).padStart(3, '0')}`;

    const newSale: Sale = {
      id: newSaleId,
      invoiceNo,
      customerId,
      userId: currentUser.id,
      subtotal,
      discount,
      tax,
      grandTotal,
      paidAmount,
      returnAmount,
      paymentMethod,
      saleDate: new Date().toISOString(),
      items: cartItems.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        salePrice: item.product.salePrice,
        costPrice: item.product.costPrice,
      })),
      createdAt: new Date().toISOString(),
    };

    // 2. Deduct quantities from products & create stock history logs
    const updatedProducts = [...products];
    const newLogs: StockHistory[] = [];

    cartItems.forEach((item, idx) => {
      const matchIndex = updatedProducts.findIndex((p) => p.id === item.product.id);
      if (matchIndex > -1) {
        const prodObj = updatedProducts[matchIndex];
        const oldQty = prodObj.quantity;
        const newQty = Math.max(0, oldQty - item.quantity);
        updatedProducts[matchIndex] = { ...prodObj, quantity: newQty };

        const nextLogId = stockHistory.length + 1 + idx;
        const newLog: StockHistory = {
          id: nextLogId,
          productId: prodObj.id,
          changeType: 'Sale',
          quantityChanged: -item.quantity,
          oldQuantity: oldQty,
          newQuantity: newQty,
          note: `Sold via checkout ${invoiceNo}`,
          createdAt: new Date().toISOString(),
        };
        newLogs.push(newLog);
      }
    });

    setProducts(updatedProducts);
    setStockHistory([...stockHistory, ...newLogs]);
    setSales([...sales, newSale]);

    // 3. Update Customer Balance and Create Loan Record if applicable.
    //    The payment handed over by the cashier must FIRST retire any prior
    //    outstanding loans on this customer's account; only the leftover is
    //    applied to the current bill. This keeps the loan ledger, the
    //    dashboard receivables, and the customer balance all consistent.
    if (customerId !== 1) {
      const customer = customers.find((c) => c.id === customerId);
      const previousOutstanding = customer ? Math.max(0, customer.balance) : 0;

      // (a) Allocate the payment to existing outstanding loans (FIFO).
      const { updatedLoans, remainder: leftoverAfterOldLoans } = allocatePaymentToLoans(
        loans,
        customerId,
        Math.min(paidAmount, previousOutstanding)
      );
      setLoans(updatedLoans);

      // (b) Whatever of the payment is left after old loans reduces the current bill.
      const currentBillAmount = round2(subtotal - discount + tax);
      const appliedToCurrentBill = Math.max(0, round2(paidAmount - (previousOutstanding - leftoverAfterOldLoans)));
      const currentBillUnpaid = round2(Math.max(0, currentBillAmount - appliedToCurrentBill));

      if (currentBillUnpaid > 0) {
        const newLoanId = loans.length > 0 ? Math.max(...loans.map((l) => l.id)) + 1 : 1;
        const newLoan: Loan = {
          id: newLoanId,
          customerId,
          invoiceNumber: invoiceNo,
          billAmount: currentBillAmount,
          paidAmount: round2(currentBillAmount - currentBillUnpaid),
          remainingBalance: currentBillUnpaid,
          loanDate: new Date().toISOString(),
          status: currentBillUnpaid >= currentBillAmount ? 'Outstanding' : 'Partial',
          createdAt: new Date().toISOString(),
        };
        setLoans((prev) => [...prev, newLoan]);
      }

      // (c) Recompute the customer balance from raw history (no clipping).
      //      `newSale.paidAmount` already carries the checkout payment into the
      //      engine via the sales array, so we pass the EXISTING loanPayments
      //      unchanged — adding a synthetic payment here would double-count the
      //      checkout amount (getCustomerTotalPaid sums both sale.paidAmount
      //      AND loanPayment.amount, which are disjoint by design).
      setCustomers((prevCustomers) =>
        prevCustomers.map((c) => {
          if (c.id !== customerId) return c;
          const newBalance = getCustomerOutstanding(
            { ...c, openingBalance: c.openingBalance || 0 },
            [...sales, newSale],
            loanPayments
          );
          return { ...c, balance: newBalance, updatedAt: new Date().toISOString() };
        })
      );
    }

    return newSale;
  };

  const handleProcessLoanPayment = (customerId: number, amount: number, method: 'Cash' | 'Bank' | 'Other' = 'Cash') => {
    if (amount <= 0) return;

    // 1. Allocate the payment across the customer's outstanding loans using the
    //    centralized engine. This is a PURE computation (no side effects) so it
    //    is safe to call directly — it computes the new loans array + the
    //    invoice number to stamp on the receipt (fixes broken installment link).
    const { updatedLoans, allocatedInvoiceNumber } = allocatePaymentToLoans(loans, customerId, amount);
    setLoans(updatedLoans);

    // 2. Create the payment record, now linked to the invoice it was applied to.
    const newPaymentId = loanPayments.length > 0 ? Math.max(...loanPayments.map((p) => p.id)) + 1 : 1;
    const newPayment: LoanPayment = {
      id: newPaymentId,
      loanId: 0, // Composite payment allocated across loans above
      customerId: customerId,
      amount,
      paymentMethod: method,
      paymentDate: new Date().toISOString(),
      invoiceNumber: allocatedInvoiceNumber, // restore receipt → loan linkage
      createdAt: new Date().toISOString(),
    };
    setLoanPayments((prevPayments) => [...prevPayments, newPayment]);

    // 3. Recompute the customer's outstanding balance from the complete payment
    //    history via the engine. Negative balances (overpayment) are preserved
    //    as store credit — Math.max(0) clipping is NOT applied (was data loss).
    setCustomers((prevCustomers) =>
      prevCustomers.map((c) => {
        if (c.id !== customerId) return c;
        const newBalance = getCustomerOutstanding(
          { ...c, openingBalance: c.openingBalance || 0 },
          sales,
          [...loanPayments, newPayment]
        );
        return { ...c, balance: newBalance, updatedAt: new Date().toISOString() };
      })
    );
  };

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} users={users} userPasswords={userPasswords} />;
  }

  // Define sidebar menu options restricted by User Role
  // Admin -> All tabs
  // Manager -> All tabs except backup tools
  // Cashier -> billing component only
  const menuOptions = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Manager'] },
    { id: 'billing', label: 'Billing / POS', icon: ShoppingCart, roles: ['Admin', 'Manager', 'Cashier'] },
    { id: 'products', label: 'Products', icon: Package, roles: ['Admin', 'Manager'] },
    { id: 'categories', label: 'Categories', icon: Tags, roles: ['Admin', 'Manager'] },
    { id: 'inventory', label: 'Inventory / Stock', icon: RefreshCw, roles: ['Admin', 'Manager'] },
    { id: 'expenses', label: 'Expenses Log', icon: TrendingDown, roles: ['Admin', 'Manager'] },
    { id: 'purchases', label: 'Supplier Purchases', icon: ShoppingBag, roles: ['Admin', 'Manager'] },
    { id: 'customers', label: 'Customers', icon: Users, roles: ['Admin', 'Manager'] },
    { id: 'suppliers', label: 'Suppliers', icon: Truck, roles: ['Admin', 'Manager'] },
    { id: 'sales_history', label: 'Sales History', icon: History, roles: ['Admin', 'Manager', 'Cashier'] },
    { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['Admin', 'Manager'] },
    { id: 'gmail', label: 'Gmail Communications', icon: Mail, roles: ['Admin', 'Manager'] },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, roles: ['Admin', 'Manager'] },
  ];

  const allowedOptions = menuOptions.filter((opt) => opt.roles.includes(currentUser.role));

  // Cashier can view only their own sales
  const filteredSalesHistory =
    currentUser.role === 'Cashier'
      ? sales.filter((s) => s.userId === currentUser.id)
      : sales;

  // Render Role icon helper
  const getRoleIcon = (role: User['role']) => {
    switch (role) {
      case 'Admin':
        return <ShieldCheck size={16} className="text-red-500" />;
      case 'Manager':
        return <Briefcase size={16} className="text-amber-500" />;
      case 'Cashier':
        return <UserCheck size={16} className="text-blue-500" />;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900" id="main-application-frame">
      {/* 1. Left Sidebar Navigation */}
      <aside className="w-60 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0 print:hidden">
        {/* Brand Banner */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-xs">
            <Store size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold font-display text-white tracking-tight">{settings.shopName}</h2>
            <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">RETAIL ENGINE v1.2</p>
          </div>
        </div>

        {/* Dynamic Sidebar Links */}
        <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
          {allowedOptions.map((opt) => {
            const Icon = opt.icon;
            const isActive = activeTab === opt.id;
            return (
              <button
                key={opt.id}
                id={`sidebar-link-${opt.id}`}
                onClick={() => setActiveTab(opt.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                {opt.label}
              </button>
            );
          })}
        </nav>

        {/* Footer info & Logout CTA */}
        <div className="p-3 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-2.5 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/40">
            <div className="p-1 bg-slate-800 rounded text-slate-400">
              <UserIcon size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-slate-200 block truncate" id="sidebar-user-fullname">
                {currentUser.fullName}
              </span>
              <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mt-0.5">
                {getRoleIcon(currentUser.role)}
                {currentUser.role}
              </span>
            </div>
          </div>

          <button
            id="sidebar-logout"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all"
          >
            <LogOut size={12} />
            Exit Console
          </button>
        </div>
      </aside>

      {/* 2. Main Workstage Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Upper Top Bar */}
        <header className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-5 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold font-display text-slate-800 uppercase tracking-wider">
              {menuOptions.find((opt) => opt.id === activeTab)?.label || 'System'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer flex items-center justify-center border border-slate-200/60"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon size={14} className="text-slate-600" /> : <Sun size={14} className="text-amber-500" />}
            </button>

            <div className="flex flex-col text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Workstation Date</span>
              <span className="text-xs font-semibold text-slate-700 font-mono animate-pulse-once" id="current-workstation-time">
                {new Date().toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </span>
            </div>
          </div>
        </header>

        {/* Content View Stage */}
        <main className="flex-1 p-4 md:p-5 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              products={products}
              categories={categories}
              customers={customers}
              suppliers={suppliers}
              sales={sales}
              loans={loans}
              loanPayments={loanPayments}
              settings={settings}
              expenses={expenses}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'billing' && (
            <BillingView
              products={products}
              categories={categories}
              customers={customers}
              settings={settings}
              currentUser={currentUser}
              onCheckout={handleCheckout}
              loans={loans}
              loanPayments={loanPayments}
              onProcessLoanPayment={handleProcessLoanPayment}
            />
          )}

          {activeTab === 'products' && (
            <ProductView
              products={products}
              categories={categories}
              suppliers={suppliers}
              settings={settings}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              userRole={currentUser.role}
            />
          )}

          {activeTab === 'categories' && (
            <CategoryView
              categories={categories}
              onAddCategory={handleAddCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
              userRole={currentUser.role}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              products={products}
              stockHistory={stockHistory}
              onAdjustStock={handleAdjustStock}
              userRole={currentUser.role}
            />
          )}

          {activeTab === 'customers' && (
            <CustomerView
              customers={customers}
              sales={sales}
              loans={loans}
              loanPayments={loanPayments}
              settings={settings}
              onAddCustomer={handleAddCustomer}
              onUpdateCustomer={handleUpdateCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onProcessLoanPayment={handleProcessLoanPayment}
              userRole={currentUser.role}
            />
          )}

          {activeTab === 'suppliers' && (
            <SupplierView
              suppliers={suppliers}
              products={products}
              onAddSupplier={handleAddSupplier}
              onUpdateSupplier={handleUpdateSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              userRole={currentUser.role}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpenseView
              expenses={expenses}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              settings={settings}
              userRole={currentUser.role}
            />
          )}

          {activeTab === 'purchases' && (
            <PurchaseView
              purchases={purchases}
              suppliers={suppliers}
              products={products}
              settings={settings}
              onAddPurchase={handleAddPurchase}
              onPaySupplier={handlePaySupplier}
              userRole={currentUser.role}
            />
          )}

          {activeTab === 'sales_history' && (
            <SalesHistoryView sales={filteredSalesHistory} customers={customers} loans={loans} loanPayments={loanPayments} settings={settings} users={users} />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              sales={sales}
              products={products}
              customers={customers}
              suppliers={suppliers}
              loans={loans}
              loanPayments={loanPayments}
              settings={settings}
            />
          )}

          {activeTab === 'gmail' && <GmailView />}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              currentUser={currentUser}
              users={users}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onResetUsers={handleResetUsers}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              backupSummary={backupSummary}
              activityLogs={activityLogs}
              onAdminDataAction={handleAdminDataAction}
              onExportDataCsv={handleExportDataCsv}
              onExportReportsPdf={handleExportReportsPdf}
            />
          )}
        </main>
      </div>
    </div>
  );
}
