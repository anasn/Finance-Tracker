// Finance Tracker - localStorage Store
// Replaces all API routes with browser localStorage operations

const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

// Generic localStorage helpers
function get<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function set<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// Table keys
const KEYS = {
  users: 'ft_users',
  customers: 'ft_customers',
  stockRecords: 'ft_stock_records',
  payments: 'ft_payments',
  bankPayments: 'ft_bank_payments',
  expenses: 'ft_expenses',
  purchases: 'ft_purchases',
  invoices: 'ft_invoices',
  branding: 'ft_branding',
};

// ============ AUTH ============

export interface Branding {
  userId: string;
  appName: string;
  logoUrl: string | null;
  primaryColor: string;
}

export function getBranding(userId: string): Branding {
  const all = get<Branding>(KEYS.branding);
  return all.find(b => b.userId === userId) || { userId, appName: 'Finance Tracker', logoUrl: null, primaryColor: '#059669' }; // emerald-600
}

export function saveBranding(userId: string, data: Partial<Branding>): void {
  const all = get<Branding>(KEYS.branding);
  const idx = all.findIndex(b => b.userId === userId);
  if (idx >= 0) all[idx] = { ...all[idx], ...data };
  else all.push({ userId, appName: data.appName || 'Finance Tracker', logoUrl: data.logoUrl || null, primaryColor: data.primaryColor || '#059669', ...data });
  set(KEYS.branding, all);
}


interface User { id: string; name: string; email: string; password: string; phone: string; createdAt: string; }

// Auth is now handled by Firebase in App.tsx

// ============ CUSTOMERS ============

export interface Customer { id: string; userId: string; name: string; phone: string; city: string; address: string; notes: string; totalRemaining: number; totalPaid: number; lastPaymentDate: string | null; createdAt: string; }

export function getCustomers(userId: string): Customer[] {
  return get<Customer>(KEYS.customers).filter(c => c.userId === userId);
}

export function createCustomer(data: Partial<Customer> & { userId: string }): Customer {
  const customer: Customer = { id: uid(), userId: data.userId, name: data.name || '', phone: data.phone || '', city: data.city || '', address: data.address || '', notes: data.notes || '', totalRemaining: 0, totalPaid: 0, lastPaymentDate: null, createdAt: new Date().toISOString() };
  const all = get<Customer>(KEYS.customers);
  all.push(customer);
  set(KEYS.customers, all);
  return customer;
}

export function updateCustomer(id: string, data: Partial<Customer>): void {
  const all = get<Customer>(KEYS.customers);
  const idx = all.findIndex(c => c.id === id);
  if (idx >= 0) { all[idx] = { ...all[idx], ...data }; set(KEYS.customers, all); }
}

export function deleteCustomer(id: string): void {
  const userId = get<Customer>(KEYS.customers).find(c => c.id === id)?.userId;
  // Delete all related records
  const filterByUser = (arr: any[]) => userId ? arr.filter((r: any) => r.userId === userId) : arr;
  set(KEYS.customers, get<Customer>(KEYS.customers).filter(c => c.id !== id));
  set(KEYS.stockRecords, filterByUser(get<any>(KEYS.stockRecords)).filter((r: any) => r.customerId !== id));
  set(KEYS.payments, filterByUser(get<any>(KEYS.payments)).filter((r: any) => r.customerId !== id));
  set(KEYS.bankPayments, filterByUser(get<any>(KEYS.bankPayments)).filter((r: any) => r.customerId !== id));
  set(KEYS.invoices, filterByUser(get<any>(KEYS.invoices)).filter((r: any) => {
    const ref = r.referenceId;
    if (!ref) return false;
    const stockRecords = get<any>(KEYS.stockRecords);
    const purchases = get<any>(KEYS.purchases);
    const allRelated = [...stockRecords, ...purchases].filter(s => s.customerId === id).map(s => s.id);
    return !allRelated.includes(ref);
  }));
}

// ============ STOCK RECORDS ============

export interface StockRecord { id: string; userId: string; customerId: string; date: string; itemName: string; itemCategory: string; weight: number; weightUnit: string; pricePerUnit: number; totalAmount: number; paidAmount: number; remainingAmount: number; notes: string; createdAt: string; }

export function getStockRecords(userId: string): (StockRecord & { customer?: { name: string; phone: string } })[] {
  const records = get<StockRecord>(KEYS.stockRecords).filter(r => r.userId === userId);
  const customers = get<Customer>(KEYS.customers);
  return records.map(r => {
    const c = customers.find(cu => cu.id === r.customerId);
    return { ...r, customer: c ? { name: c.name, phone: c.phone } : undefined };
  });
}

function recalcCustomerTotals(customerId: string) {
  const allCustomers = get<Customer>(KEYS.customers);
  const allStocks = get<StockRecord>(KEYS.stockRecords);
  const allPayments = get<any>(KEYS.payments);
  const idx = allCustomers.findIndex(c => c.id === customerId);
  if (idx < 0) return;
  const cStocks = allStocks.filter(s => s.customerId === customerId);
  const cPayments = allPayments.filter(p => p.customerId === customerId);
  
  const totalPurchases = cStocks.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);
  const totalPaid = cPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalRemaining = totalPurchases - totalPaid;
  
  allCustomers[idx] = { ...allCustomers[idx], totalPaid, totalRemaining: Math.max(0, totalRemaining), lastPaymentDate: cPayments.length > 0 ? cPayments[cPayments.length - 1].date : null };
  set(KEYS.customers, allCustomers);
}

export function createStockRecord(data: Partial<StockRecord> & { userId: string }): StockRecord {
  const record: StockRecord = { id: uid(), userId: data.userId, customerId: data.customerId || '', date: data.date || new Date().toISOString().split('T')[0], itemName: data.itemName || '', itemCategory: data.itemCategory || '', weight: data.weight || 0, weightUnit: data.weightUnit || 'KG', pricePerUnit: data.pricePerUnit || 0, totalAmount: data.totalAmount || 0, paidAmount: data.paidAmount || 0, remainingAmount: (data.totalAmount || 0) - (data.paidAmount || 0), notes: data.notes || '', createdAt: new Date().toISOString() };
  const all = get<StockRecord>(KEYS.stockRecords);
  all.push(record);
  set(KEYS.stockRecords, all);
  
  // Create payment record if paidAmount > 0
  const paidAmt = record.paidAmount;
  if (paidAmt > 0) {
    const customers = get<Customer>(KEYS.customers);
    const cust = customers.find(c => c.id === record.customerId);
    const payment = { id: uid(), userId: data.userId, customerId: record.customerId, stockRecordId: record.id, amount: paidAmt, date: record.date, paymentMethod: (data as any).paymentMethod || 'Cash', bankName: (data as any).bankName || '', transactionNote: `Stock: ${record.itemName}`, createdAt: new Date().toISOString() };
    const allPayments = get<any>(KEYS.payments);
    allPayments.push(payment);
    set(KEYS.payments, allPayments);
  }
  
  // Create bank payment if non-cash and paidAmount > 0
  const pm = (data as any).paymentMethod || 'Cash';
  const bn = (data as any).bankName || '';
  if (paidAmt > 0 && pm !== 'Cash' && bn) {
    const customers = get<Customer>(KEYS.customers);
    const cust = customers.find(c => c.id === record.customerId);
    const bankPayment = { id: uid(), userId: data.userId, customerId: record.customerId, paymentDate: record.date, paymentAmount: paidAmt, bankName: bn, accountType: pm, transactionNote: `Stock Sent: ${record.itemName} (${cust?.name || ''})`, paymentMethod: pm, createdAt: new Date().toISOString() };
    const allBP = get<any>(KEYS.bankPayments);
    allBP.push(bankPayment);
    set(KEYS.bankPayments, allBP);
  }
  
  // Auto-create invoice
  const customers = get<Customer>(KEYS.customers);
  const cust = customers.find(c => c.id === record.customerId);
  const invoiceCount = get<any>(KEYS.invoices).filter(i => i.userId === data.userId).length + 1;
  const invoice = { id: uid(), userId: data.userId, invoiceNumber: `INV-${String(invoiceCount).padStart(4, '0')}`, type: 'sale', referenceId: record.id, partyName: cust?.name || '', partyPhone: cust?.phone || '', partyCity: cust?.city || '', itemName: record.itemName, itemCategory: record.itemCategory, weight: record.weight, weightUnit: record.weightUnit, pricePerUnit: record.pricePerUnit, totalAmount: record.totalAmount, paidAmount: record.paidAmount, remainingAmount: record.remainingAmount, status: record.remainingAmount <= 0 ? 'paid' : record.paidAmount > 0 ? 'partial' : 'unpaid', notes: record.notes || '', date: record.date, createdAt: new Date().toISOString() };
  const allInv = get<any>(KEYS.invoices);
  allInv.push(invoice);
  set(KEYS.invoices, allInv);

  // Update customer totals
  recalcCustomerTotals(record.customerId);
  
  return record;
}

export function updateStockRecord(id: string, data: Partial<StockRecord>): void {
  const all = get<StockRecord>(KEYS.stockRecords);
  const idx = all.findIndex(r => r.id === id);
  if (idx >= 0) {
    const oldRecord = all[idx];
    all[idx] = { ...all[idx], ...data, remainingAmount: (data.totalAmount ?? all[idx].totalAmount) - (data.paidAmount ?? all[idx].paidAmount) };
    set(KEYS.stockRecords, all);

    if (data.paidAmount !== undefined && data.paidAmount !== oldRecord.paidAmount) {
      const allPayments = get<any>(KEYS.payments);
      const paymentIdx = allPayments.findIndex(p => p.stockRecordId === id);
      if (paymentIdx >= 0) {
        if (data.paidAmount > 0) {
          allPayments[paymentIdx].amount = data.paidAmount;
        } else {
          allPayments.splice(paymentIdx, 1);
        }
      } else if (data.paidAmount > 0) {
        allPayments.push({ id: uid(), userId: oldRecord.userId, customerId: oldRecord.customerId, stockRecordId: id, amount: data.paidAmount, date: oldRecord.date, paymentMethod: 'Cash', bankName: '', transactionNote: `Stock: ${oldRecord.itemName}`, createdAt: new Date().toISOString() });
      }
      set(KEYS.payments, allPayments);
    }
    
    recalcCustomerTotals(all[idx].customerId);
  }
}

export function deleteStockRecord(id: string): void {
  const record = get<StockRecord>(KEYS.stockRecords).find(r => r.id === id);
  set(KEYS.stockRecords, get<StockRecord>(KEYS.stockRecords).filter(r => r.id !== id));
  if (record) {
    // Delete related payments
    set(KEYS.payments, get<any>(KEYS.payments).filter(p => p.stockRecordId !== id));
    // Delete related invoices
    set(KEYS.invoices, get<any>(KEYS.invoices).filter(i => i.referenceId !== id));
    recalcCustomerTotals(record.customerId);
  }
}

// ============ PAYMENTS ============

export interface Payment { id: string; userId: string; customerId: string; stockRecordId: string | null; amount: number; date: string; paymentMethod: string; bankName: string; transactionNote: string; createdAt: string; }

export function getPayments(userId: string): (Payment & { customer?: { name: string; phone: string } })[] {
  const records = get<Payment>(KEYS.payments).filter(r => r.userId === userId);
  const customers = get<Customer>(KEYS.customers);
  return records.map(r => {
    const c = customers.find(cu => cu.id === r.customerId);
    return { ...r, customer: c ? { name: c.name, phone: c.phone } : undefined };
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function createPayment(data: Partial<Payment> & { userId: string }): Payment {
  const payment: Payment = { id: uid(), userId: data.userId, customerId: data.customerId || '', stockRecordId: data.stockRecordId || null, amount: data.amount || 0, date: data.date || new Date().toISOString().split('T')[0], paymentMethod: data.paymentMethod || 'Cash', bankName: data.bankName || '', transactionNote: data.transactionNote || '', createdAt: new Date().toISOString() };
  const all = get<Payment>(KEYS.payments);
  all.push(payment);
  set(KEYS.payments, all);
  
  // Update customer totals
  recalcCustomerTotals(payment.customerId);
  
  // Create bank payment if non-cash
  const pm = data.paymentMethod || 'Cash';
  const bn = data.bankName || '';
  if (payment.amount > 0 && pm !== 'Cash' && bn) {
    const customers = get<Customer>(KEYS.customers);
    const cust = customers.find(c => c.id === payment.customerId);
    const bankPayment = { id: uid(), userId: data.userId, customerId: payment.customerId, paymentDate: payment.date, paymentAmount: payment.amount, bankName: bn, accountType: pm, transactionNote: `Wasooli: ${cust?.name || ''}`, paymentMethod: pm, createdAt: new Date().toISOString() };
    const allBP = get<any>(KEYS.bankPayments);
    allBP.push(bankPayment);
    set(KEYS.bankPayments, allBP);
  }
  
  return payment;
}

export function updatePayment(id: string, data: Partial<Payment>): void {
  const all = get<Payment>(KEYS.payments);
  const idx = all.findIndex(p => p.id === id);
  if (idx >= 0) {
    const oldCustomerId = all[idx].customerId;
    all[idx] = { ...all[idx], ...data };
    set(KEYS.payments, all);
    recalcCustomerTotals(data.customerId || oldCustomerId);
  }
}

export function deletePayment(id: string): void {
  const payment = get<Payment>(KEYS.payments).find(p => p.id === id);
  set(KEYS.payments, get<Payment>(KEYS.payments).filter(p => p.id !== id));
  if (payment) recalcCustomerTotals(payment.customerId);
}

// ============ BANK PAYMENTS ============

export interface BankPayment { id: string; userId: string; customerId: string; paymentDate: string; paymentAmount: number; bankName: string; accountType: string; transactionNote: string; paymentMethod: string; createdAt: string; }

export function getBankPayments(userId: string): (BankPayment & { customer?: { name: string; phone: string } })[] {
  const records = get<BankPayment>(KEYS.bankPayments).filter(r => r.userId === userId);
  const customers = get<Customer>(KEYS.customers);
  return records.map(r => {
    const c = customers.find(cu => cu.id === r.customerId);
    return { ...r, customer: c ? { name: c.name, phone: c.phone } : undefined };
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function createBankPayment(data: Partial<BankPayment> & { userId: string }): BankPayment {
  const bp: BankPayment = { id: uid(), userId: data.userId, customerId: data.customerId || '', paymentDate: data.paymentDate || new Date().toISOString().split('T')[0], paymentAmount: data.paymentAmount || 0, bankName: data.bankName || '', accountType: data.accountType || '', transactionNote: data.transactionNote || '', paymentMethod: data.paymentMethod || 'Bank Transfer', createdAt: new Date().toISOString() };
  const all = get<BankPayment>(KEYS.bankPayments);
  all.push(bp);
  set(KEYS.bankPayments, all);
  return bp;
}

export function updateBankPayment(id: string, data: Partial<BankPayment>): void {
  const all = get<BankPayment>(KEYS.bankPayments);
  const idx = all.findIndex(b => b.id === id);
  if (idx >= 0) { all[idx] = { ...all[idx], ...data }; set(KEYS.bankPayments, all); }
}

export function deleteBankPayment(id: string): void {
  set(KEYS.bankPayments, get<BankPayment>(KEYS.bankPayments).filter(b => b.id !== id));
}

// ============ EXPENSES ============

export interface Expense { id: string; userId: string; description: string; amount: number; category: string; date: string; notes: string; createdAt: string; }

export function getExpenses(userId: string): Expense[] {
  return get<Expense>(KEYS.expenses).filter(e => e.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function createExpense(data: Partial<Expense> & { userId: string }): Expense {
  const expense: Expense = { id: uid(), userId: data.userId, description: data.description || '', amount: data.amount || 0, category: data.category || 'General', date: data.date || new Date().toISOString().split('T')[0], notes: data.notes || '', createdAt: new Date().toISOString() };
  const all = get<Expense>(KEYS.expenses);
  all.push(expense);
  set(KEYS.expenses, all);
  return expense;
}

export function updateExpense(id: string, data: Partial<Expense>): void {
  const all = get<Expense>(KEYS.expenses);
  const idx = all.findIndex(e => e.id === id);
  if (idx >= 0) { all[idx] = { ...all[idx], ...data }; set(KEYS.expenses, all); }
}

export function deleteExpense(id: string): void {
  set(KEYS.expenses, get<Expense>(KEYS.expenses).filter(e => e.id !== id));
}

// ============ PURCHASES ============

export interface Purchase { id: string; userId: string; supplierName: string; supplierPhone: string; supplierCity: string; date: string; itemName: string; itemCategory: string; weight: number; weightUnit: string; pricePerUnit: number; totalAmount: number; paidAmount: number; remainingAmount: number; notes: string; createdAt: string; }

export function getPurchases(userId: string): Purchase[] {
  return get<Purchase>(KEYS.purchases).filter(p => p.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function createPurchase(data: Partial<Purchase> & { userId: string }): Purchase {
  const record: Purchase = { id: uid(), userId: data.userId, supplierName: data.supplierName || '', supplierPhone: data.supplierPhone || '', supplierCity: data.supplierCity || '', date: data.date || new Date().toISOString().split('T')[0], itemName: data.itemName || '', itemCategory: data.itemCategory || '', weight: data.weight || 0, weightUnit: data.weightUnit || 'KG', pricePerUnit: data.pricePerUnit || 0, totalAmount: data.totalAmount || 0, paidAmount: data.paidAmount || 0, remainingAmount: (data.totalAmount || 0) - (data.paidAmount || 0), notes: data.notes || '', createdAt: new Date().toISOString() };
  const all = get<Purchase>(KEYS.purchases);
  all.push(record);
  set(KEYS.purchases, all);
  
  // Create bank payment if non-cash and paidAmount > 0
  const paidAmt = record.paidAmount;
  const pm = (data as any).paymentMethod || 'Cash';
  const bn = (data as any).bankName || '';
  if (paidAmt > 0 && pm !== 'Cash' && bn) {
    const bankPayment = { id: uid(), userId: data.userId, customerId: '', paymentDate: record.date, paymentAmount: paidAmt, bankName: bn, accountType: pm, transactionNote: `Purchase: ${record.itemName} (${record.supplierName})`, paymentMethod: pm, createdAt: new Date().toISOString() };
    const allBP = get<any>(KEYS.bankPayments);
    allBP.push(bankPayment);
    set(KEYS.bankPayments, allBP);
  }
  
  // Auto-create invoice
  const invoiceCount = get<any>(KEYS.invoices).filter(i => i.userId === data.userId).length + 1;
  const invoice = { id: uid(), userId: data.userId, invoiceNumber: `INV-${String(invoiceCount).padStart(4, '0')}`, type: 'purchase', referenceId: record.id, partyName: record.supplierName, partyPhone: record.supplierPhone, partyCity: record.supplierCity, itemName: record.itemName, itemCategory: record.itemCategory, weight: record.weight, weightUnit: record.weightUnit, pricePerUnit: record.pricePerUnit, totalAmount: record.totalAmount, paidAmount: record.paidAmount, remainingAmount: record.remainingAmount, status: record.remainingAmount <= 0 ? 'paid' : record.paidAmount > 0 ? 'partial' : 'unpaid', notes: record.notes || '', date: record.date, createdAt: new Date().toISOString() };
  const allInv = get<any>(KEYS.invoices);
  allInv.push(invoice);
  set(KEYS.invoices, allInv);
  
  return record;
}

export function updatePurchase(id: string, data: Partial<Purchase>): void {
  const all = get<Purchase>(KEYS.purchases);
  const idx = all.findIndex(p => p.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...data, remainingAmount: (data.totalAmount ?? all[idx].totalAmount) - (data.paidAmount ?? all[idx].paidAmount) };
    set(KEYS.purchases, all);
  }
}

export function deletePurchase(id: string): void {
  const record = get<Purchase>(KEYS.purchases).find(p => p.id === id);
  set(KEYS.purchases, get<Purchase>(KEYS.purchases).filter(p => p.id !== id));
  if (record) set(KEYS.invoices, get<any>(KEYS.invoices).filter(i => i.referenceId !== id));
}

// ============ INVOICES ============

export interface Invoice { id: string; userId: string; invoiceNumber: string; type: string; referenceId: string; partyName: string; partyPhone: string; partyCity: string; itemName: string; itemCategory: string; weight: number; weightUnit: string; pricePerUnit: number; totalAmount: number; paidAmount: number; remainingAmount: number; status: string; notes: string; date: string; createdAt: string; }

export function getInvoices(userId: string): Invoice[] {
  return get<Invoice>(KEYS.invoices).filter(i => i.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function deleteInvoice(id: string): void {
  set(KEYS.invoices, get<Invoice>(KEYS.invoices).filter(i => i.id !== id));
}

// ============ DASHBOARD DATA ============

export interface DashboardData {
  totalCustomers: number;
  totalStockRecords: number;
  totalMoneyReceived: number;
  totalRemainingMoney: number;
  totalExpenses: number;
  todayWasooli: number;
  monthWasooli: number;
  pendingPayments: number;
  paidPayments: number;
  monthlyData: { month: string; wasooli: number; expenses: number; stockSent: number }[];
  recentActivity: { id: string; type: string; description: string; date: string; customerName: string }[];
}

export function getDashboardData(userId: string): DashboardData {
  const customers = get<Customer>(KEYS.customers).filter(c => c.userId === userId);
  const stockRecords = get<StockRecord>(KEYS.stockRecords).filter(r => r.userId === userId);
  const payments = get<Payment>(KEYS.payments).filter(p => p.userId === userId);
  const expenses = get<Expense>(KEYS.expenses).filter(e => e.userId === userId);
  
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  
  const totalMoneyReceived = payments.reduce((s, p) => s + p.amount, 0);
  const totalRemainingMoney = customers.reduce((s, c) => s + c.totalRemaining, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const todayWasooli = payments.filter(p => p.date === today).reduce((s, p) => s + p.amount, 0);
  const monthWasooli = payments.filter(p => { const d = new Date(p.date); return d.getMonth() === thisMonth && d.getFullYear() === thisYear; }).reduce((s, p) => s + p.amount, 0);
  
  const pendingPayments = customers.filter(c => c.totalRemaining > 0).length;
  const paidPayments = customers.filter(c => c.totalRemaining <= 0).length;
  
  // Monthly data for last 6 months
  const monthlyData: { month: string; wasooli: number; expenses: number; stockSent: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(thisYear, thisMonth - i, 1);
    const monthStr = d.toLocaleString('default', { month: 'short' });
    const m = d.getMonth();
    const y = d.getFullYear();
    const mWasooli = payments.filter(p => { const pd = new Date(p.date); return pd.getMonth() === m && pd.getFullYear() === y; }).reduce((s, p) => s + p.amount, 0);
    const mExpenses = expenses.filter(e => { const ed = new Date(e.date); return ed.getMonth() === m && ed.getFullYear() === y; }).reduce((s, e) => s + e.amount, 0);
    const mStockSent = stockRecords.filter(sr => { const sd = new Date(sr.date); return sd.getMonth() === m && sd.getFullYear() === y; }).reduce((s, sr) => s + sr.totalAmount, 0);
    monthlyData.push({ month: monthStr, wasooli: mWasooli, expenses: mExpenses, stockSent: mStockSent });
  }
  
  // Recent activity
  const allCustomers = get<Customer>(KEYS.customers);
  const activities: { id: string; type: string; description: string; date: string; customerName: string }[] = [];
  
  stockRecords.slice(-10).reverse().forEach(r => {
    const c = allCustomers.find(cu => cu.id === r.customerId);
    activities.push({ id: r.id, type: 'stock', description: `Sale: ${r.itemName} - ${PKR(r.totalAmount)}`, date: r.createdAt, customerName: c?.name || '' });
  });
  
  payments.slice(-10).reverse().forEach(p => {
    const c = allCustomers.find(cu => cu.id === p.customerId);
    activities.push({ id: p.id, type: 'payment', description: `Payment: ${PKR(p.amount)}`, date: p.createdAt, customerName: c?.name || '' });
  });
  
  expenses.slice(-5).reverse().forEach(e => {
    activities.push({ id: e.id, type: 'expense', description: `Expense: ${e.description} - ${PKR(e.amount)}`, date: e.createdAt, customerName: '' });
  });
  
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return {
    totalCustomers: customers.length,
    totalStockRecords: stockRecords.length,
    totalMoneyReceived,
    totalRemainingMoney,
    totalExpenses,
    todayWasooli,
    monthWasooli,
    pendingPayments,
    paidPayments,
    monthlyData,
    recentActivity: activities.slice(0, 20),
  };
}

export function restoreBackup(data: any): boolean {
  try {
    if (data.customers) set(KEYS.customers, data.customers);
    if (data.stockRecords) set(KEYS.stockRecords, data.stockRecords);
    if (data.payments) set(KEYS.payments, data.payments);
    if (data.bankPayments) set(KEYS.bankPayments, data.bankPayments);
    if (data.expenses) set(KEYS.expenses, data.expenses);
    if (data.purchases) set(KEYS.purchases, data.purchases);
    if (data.invoices) set(KEYS.invoices, data.invoices);
    return true;
  } catch {
    return false;
  }
}

const PKR = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;
