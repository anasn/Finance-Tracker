import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  getDoc,
  setDoc,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from './lib/firebase';

// ==================== TYPES ====================

export interface License {
  id: string;
  status: 'unused' | 'active' | 'disabled';
  usedBy?: string;
  usedByEmail?: string;
  createdAt: string;
}

export interface Branding {
  userId: string;
  appName: string;
  logoUrl: string | null;
  primaryColor: string;
}

// ==================== HELPERS ====================

function now(): string {
  return new Date().toISOString();
}

function getUserId(): string {
  return auth.currentUser?.uid || '';
}

// ==================== DASHBOARD ====================

export function computeDashboardData(
  customers: any[],
  stockRecords: any[],
  payments: any[],
  expenses: any[],
  dateFrom?: string,
  dateTo?: string
) {
  const filterByDate = (date: string) => {
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    return true;
  };

  const filteredPayments = payments.filter(p => filterByDate(p.date || ''));
  const filteredExpenses = expenses.filter(e => filterByDate(e.date || ''));
  const filteredStock = stockRecords.filter(s => filterByDate(s.date || ''));

  const legacyStockWithoutPayments = stockRecords.filter((s: any) => {
    if (payments.some((p: any) => p.stockRecordId === s.id)) return false;
    const sDate = s.date || (s.createdAt ? s.createdAt.split('T')[0] : '');
    return !payments.some((p: any) => {
      const pDate = p.date || (p.createdAt ? p.createdAt.split('T')[0] : '');
      return !p.stockRecordId && p.amount === s.paidAmount && pDate === sDate && p.customerId === s.customerId;
    });
  });
  const filteredLegacyStock = legacyStockWithoutPayments.filter((s:any) => filterByDate(s.date || ''));
  const legacyMoneyReceived = filteredLegacyStock.reduce((s: number, r: any) => s + (r.paidAmount || 0), 0);

  const totalMoneyReceived = filteredPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0) + legacyMoneyReceived;
  const totalRemainingMoney = customers.reduce((s: number, c: any) => s + (c.totalRemaining || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);

  const today = new Date().toISOString().split('T')[0];
  const legacyTodayReceived = legacyStockWithoutPayments.filter((s:any) => (s.date || '').startsWith(today)).reduce((s: number, r: any) => s + (r.paidAmount || 0), 0);
  const todayWasooli = filteredPayments
    .filter(p => (p.date || '').startsWith(today))
    .reduce((s: number, p: any) => s + (p.amount || 0), 0) + legacyTodayReceived;

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const legacyMonthReceived = legacyStockWithoutPayments.filter(s => (s.date || '').startsWith(currentMonth)).reduce((s: number, r: any) => s + (r.paidAmount || 0), 0);
  const monthWasooli = filteredPayments
    .filter(p => (p.date || '').startsWith(currentMonth))
    .reduce((s: number, p: any) => s + (p.amount || 0), 0) + legacyMonthReceived;

  const pendingPayments = customers.filter(c => c.totalRemaining > 0).length;
  const paidPayments = customers.filter(c => c.totalRemaining <= 0 && c.totalPaid > 0).length;

  // Monthly data for charts (last 6 months)
  const monthlyData: { month: string; wasooli: number; expenses: number; stockSent: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthStr = d.toLocaleString('default', { month: 'short' });
    const yr = d.getFullYear();
    const mo = d.getMonth();

    const wasooli = payments
      .filter(p => {
        const pd = new Date(p.date || '');
        return pd.getMonth() === mo && pd.getFullYear() === yr;
      })
      .reduce((s: number, p: any) => s + (p.amount || 0), 0);

    const exp = expenses
      .filter(e => {
        const ed = new Date(e.date || '');
        return ed.getMonth() === mo && ed.getFullYear() === yr;
      })
      .reduce((s: number, e: any) => s + (e.amount || 0), 0);

    const stockSent = stockRecords
      .filter(s => {
        const sd = new Date(s.date || '');
        return sd.getMonth() === mo && sd.getFullYear() === yr;
      })
      .reduce((s: number, r: any) => s + (r.totalAmount || 0), 0);

    monthlyData.push({ month: `${monthStr} ${yr}`, wasooli, expenses: exp, stockSent });
  }

  // Recent activity
  const recentActivity: { id: string; type: string; description: string; date: string; customerName: string }[] = [];
  
  [...stockRecords]
    .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
    .slice(0, 5)
    .forEach(s => {
      recentActivity.push({
        id: s.id,
        type: 'stock',
        description: `Sale: ${s.itemName} (${s.weight} ${s.weightUnit})`,
        date: s.date || s.createdAt || '',
        customerName: s.customer?.name || '',
      });
    });

  [...payments]
    .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
    .slice(0, 5)
    .forEach(p => {
      recentActivity.push({
        id: p.id,
        type: 'payment',
        description: `Payment: PKR ${Math.round(p.amount || 0).toLocaleString()}`,
        date: p.date || p.createdAt || '',
        customerName: p.customer?.name || '',
      });
    });

  [...expenses]
    .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
    .slice(0, 3)
    .forEach(e => {
      recentActivity.push({
        id: e.id,
        type: 'expense',
        description: `Expense: ${e.description} (${e.category})`,
        date: e.date || e.createdAt || '',
        customerName: '',
      });
    });

  recentActivity.sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());

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
    recentActivity: recentActivity.slice(0, 10),
  };
}

// ==================== CUSTOMERS ====================

export async function getCustomers(userId: string) {
  const q = query(collection(db, 'customers'), where('userId', '==', userId));
  const snap = await getDocs(q);

  const customers: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Background sync for legacy customers missing the pre-calculated fields
  Promise.all(customers.filter(c => typeof c.totalRemaining === 'undefined').map(async (c) => {
    try { await syncCustomerLedger(c.id, userId); } catch (e) { console.error('Legacy sync error', e); }
  })).catch(() => {});

  return customers.map(c => ({
    ...c,
    totalPaid: typeof c.totalPaid === 'number' ? c.totalPaid : 0,
    totalRemaining: typeof c.totalRemaining === 'number' ? c.totalRemaining : 0,
    lastPaymentDate: c.lastPaymentDate || null,
  }));
}

export async function createCustomer(data: any) {
  const userId = getUserId() || data.userId;
  const docData = {
    ...data,
    userId,
    createdAt: now(),
    updatedAt: now(),
  };
  const docRef = await addDoc(collection(db, 'customers'), docData);
  return { id: docRef.id, ...docData };
}

export async function updateCustomer(id: string, data: any) {
  const ref = doc(db, 'customers', id);
  await updateDoc(ref, { ...data, updatedAt: now() });
}

export async function deleteCustomer(id: string): Promise<void> {
  // Get customer to find related records
  const customerDoc = await getDoc(doc(db, 'customers', id));
  if (!customerDoc.exists()) {
    await deleteDoc(doc(db, 'customers', id));
    return;
  }
  const customer = { id, ...customerDoc.data() } as any;

  const uid = getUserId() || customer.userId;

  const relatedQueries = [
    getDocs(query(collection(db, 'stockRecords'), where('customerId', '==', id), where('userId', '==', uid))),
    getDocs(query(collection(db, 'payments'), where('customerId', '==', id), where('userId', '==', uid))),
    getDocs(query(collection(db, 'bankPayments'), where('customerId', '==', id), where('userId', '==', uid))),
  ];

  let stocks, payments, banks;
  try {
    [stocks, payments, banks] = await Promise.all(relatedQueries);
  } catch (e) {
    console.error('Promise.all relatedQueries failed:', e);
    throw e;
  }

  let invQ;
  try {
    invQ = await getDocs(query(collection(db, 'invoices'), where('userId', '==', customer.userId), where('userId', '==', uid)));
  } catch (e) {
    console.error('fetching invQ failed:', e);
    throw e;
  }

  // Filter invoices related to this customer's stock records
  const stockIds = new Set(stocks.docs.map(d => d.id));
  const relatedInvoices = invQ.docs.filter(d => stockIds.has(d.data().referenceId));

  const batch = writeBatch(db);
  stocks.docs.forEach(d => batch.delete(d.ref));
  payments.docs.forEach(d => batch.delete(d.ref));
  banks.docs.forEach(d => batch.delete(d.ref));
  relatedInvoices.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, 'customers', id));

  try {
    await batch.commit();
  } catch (e) {
    console.error('Committing batch failed:', e);
    throw e;
  }
}

// ==================== STOCK RECORDS ====================

export async function getStockRecords(userId: string) {
  const q = query(collection(db, 'stockRecords'), where('userId', '==', userId));
  const snap = await getDocs(q);

  const records: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Attach customer info
  const customerSnap = await getDocs(query(collection(db, 'customers'), where('userId', '==', userId)));
  const customerMap: Record<string, any> = {};
  customerSnap.docs.forEach(d => { customerMap[d.id] = { id: d.id, ...d.data() }; });

  return records.map(r => ({
    ...r,
    remainingAmount: Math.max(0, (r.totalAmount || 0) - (r.paidAmount || 0)),
    customer: customerMap[r.customerId] ? {
      name: customerMap[r.customerId].name,
      phone: customerMap[r.customerId].phone,
    } : undefined,
  })).sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
}

export async function createStockRecord(data: any) {
  const userId = getUserId() || data.userId;
  const totalAmount = parseFloat(data.totalAmount) || 0;
  const paidAmount = parseFloat(data.paidAmount) || 0;
  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  const batch = writeBatch(db);
  const stockRef = doc(collection(db, 'stockRecords'));
  const stockRecordId = stockRef.id;

  const docData = {
    ...data,
    userId,
    totalAmount,
    paidAmount,
    remainingAmount,
    createdAt: now(),
    updatedAt: now(),
  };
  batch.set(stockRef, docData);

  // If paidAmount > 0, auto-create a payment
  if (paidAmount > 0) {
    const paymentRef = doc(collection(db, 'payments'));
    const pm = data.paymentMethod || 'Cash';
    const bn = data.bankName || '';
    batch.set(paymentRef, {
      userId,
      customerId: data.customerId,
      stockRecordId,
      amount: paidAmount,
      paymentMethod: pm,
      bankName: bn,
      transactionNote: `Stock Sale: ${data.itemName || ''}`,
      date: data.date || new Date().toISOString().split('T')[0],
      createdAt: now(),
      updatedAt: now()
    });

    if (pm !== 'Cash' && bn) {
       const bankRef = doc(collection(db, 'bankPayments'));
       batch.set(bankRef, {
         userId,
         customerId: data.customerId,
         paymentDate: data.date || new Date().toISOString().split('T')[0],
         paymentAmount: paidAmount,
         bankName: bn,
         accountType: pm,
         paymentMethod: pm,
         transactionNote: `Stock Sale: ${data.itemName || ''}`,
         createdAt: now(),
         updatedAt: now()
       });
    }
  }

  // Auto-create invoice
  const invRef = doc(collection(db, 'invoices'));
  const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
  let partyName = '', partyPhone = '', partyCity = '';
  if (docData.customerId) {
    const custDoc = await getDoc(doc(db, 'customers', docData.customerId));
    if (custDoc.exists()) {
      const c = custDoc.data() as any;
      partyName = c.name || '';
      partyPhone = c.phone || '';
      partyCity = c.city || '';
    }
  }

  batch.set(invRef, {
    userId,
    invoiceNumber,
    type: 'sale',
    referenceId: stockRecordId,
    partyName,
    partyPhone,
    partyCity,
    itemName: data.itemName || '',
    itemCategory: data.itemCategory || '',
    weight: data.weight || 0,
    weightUnit: data.weightUnit || 'KG',
    pricePerUnit: data.pricePerUnit || 0,
    totalAmount,
    paidAmount,
    remainingAmount: Math.max(0, totalAmount - paidAmount),
    status: (totalAmount - paidAmount) <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
    notes: data.notes || '',
    date: data.date || new Date().toISOString().split('T')[0],
    createdAt: now(),
    updatedAt: now(),
  });

  await batch.commit();

  if (docData.customerId) {
    await syncCustomerLedger(docData.customerId, userId);
  }

  return { id: stockRecordId, ...docData };
}

export async function updateStockRecord(id: string, data: any) {
  const totalAmount = parseFloat(data.totalAmount) || 0;
  const paidAmount = parseFloat(data.paidAmount) || 0;
  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  const ref = doc(db, 'stockRecords', id);
  const updateData = { ...data, totalAmount, paidAmount, remainingAmount, updatedAt: now() };
  await updateDoc(ref, updateData);

  // Update related invoice
  await _upsertInvoice(id, 'sale', updateData);

  if (data.customerId) {
    await syncCustomerLedger(data.customerId, getUserId() || data.userId || '');
  }
}

export async function deleteStockRecord(id: string): Promise<void> {
  const uid = getUserId();
  const docRef = doc(db, 'stockRecords', id);
  const snap = await getDoc(docRef);
  let customerId = '';
  let userId = '';
  if (snap.exists()) {
    customerId = snap.data().customerId;
    userId = snap.data().userId;
  }

  const batch = writeBatch(db);
  batch.delete(docRef);

  // Also delete related invoices
  const invQ = await getDocs(query(collection(db, 'invoices'), where('referenceId', '==', id), where('userId', '==', uid)));
  invQ.docs.forEach(d => batch.delete(d.ref));

  await batch.commit();
  
  if (customerId) {
    await syncCustomerLedger(customerId, userId);
  }
}

export async function syncCustomerLedger(customerId: string, userId: string) {
  if (!customerId) return;
  const stockQ = query(collection(db, 'stockRecords'), where('userId', '==', userId), where('customerId', '==', customerId));
  const paymentQ = query(collection(db, 'payments'), where('userId', '==', userId), where('customerId', '==', customerId));
  const invQGlobal = query(collection(db, 'invoices'), where('userId', '==', userId), where('customerId', '==', customerId), where('type', '==', 'sale'));
  
  const [stockSnap, paymentSnap, invSnap] = await Promise.all([getDocs(stockQ), getDocs(paymentQ), getDocs(invQGlobal)]);
  
  const stocks = stockSnap.docs.map(d => ({id: d.id, ref: d.ref, ...d.data() as any}))
    .sort((a,b) => new Date(a.date || a.createdAt || '').getTime() - new Date(b.date || b.createdAt || '').getTime());
  
  const invoicesByRef = new Map();
  invSnap.docs.forEach(d => invoicesByRef.set(d.data().referenceId, d));
  
  const totalWasooli = paymentSnap.docs.reduce((sum, d) => sum + (parseFloat(d.data().amount) || 0), 0);
  let remainingWasooli = totalWasooli;
  
  let batch = writeBatch(db);
  let opCount = 0;

  const commitBatch = async () => {
    if (opCount > 0) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  };

  let totalSaleAmount = 0;

  for (const stock of stocks) {
    const totalAmt = parseFloat(stock.totalAmount) || 0;
    totalSaleAmount += totalAmt;
    let allocatedPaid = 0;
    
    if (remainingWasooli >= totalAmt) {
      allocatedPaid = totalAmt;
      remainingWasooli -= totalAmt;
    } else {
      allocatedPaid = remainingWasooli;
      remainingWasooli = 0;
    }
    
    const allocatedRemaining = Math.max(0, totalAmt - allocatedPaid);
    
    if (stock.paidAmount !== allocatedPaid || stock.remainingAmount !== allocatedRemaining) {
      batch.update(stock.ref, { paidAmount: allocatedPaid, remainingAmount: allocatedRemaining, updatedAt: now() });
      opCount++;
      if (opCount >= 450) await commitBatch();
      
      const invDoc = invoicesByRef.get(stock.id);
      if (invDoc) {
        const status = allocatedRemaining <= 0 ? 'paid' : allocatedPaid > 0 ? 'partial' : 'unpaid';
        batch.update(invDoc.ref, { paidAmount: allocatedPaid, remainingAmount: allocatedRemaining, status, updatedAt: now() });
        opCount++;
        if (opCount >= 450) await commitBatch();
      }
    }
  }

  // Update customer totals
  const totalPaid = totalWasooli; // Assuming all payments count towards totalPaid
  const totalRemaining = Math.max(0, totalSaleAmount - totalPaid);
  
  const lastPayment = paymentSnap.docs
    .map(d => d.data())
    .filter(p => p.date)
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  const custRef = doc(db, 'customers', customerId);
  batch.update(custRef, {
    totalPaid,
    totalRemaining,
    totalSaleAmount,
    lastPaymentDate: lastPayment?.date || null,
    updatedAt: now()
  });
  opCount++;
  
  await commitBatch();
}

// ==================== PAYMENTS ====================

export async function getPayments(userId: string) {
  const q = query(collection(db, 'payments'), where('userId', '==', userId));
  const snap = await getDocs(q);

  const payments: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const customerSnap = await getDocs(query(collection(db, 'customers'), where('userId', '==', userId)));
  const customerMap: Record<string, any> = {};
  customerSnap.docs.forEach(d => { customerMap[d.id] = { id: d.id, ...d.data() }; });

  return payments.map(p => ({
    ...p,
    customer: customerMap[p.customerId] ? {
      name: customerMap[p.customerId].name,
      phone: customerMap[p.customerId].phone,
    } : undefined,
  })).sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
}

export async function createPayment(data: any) {
  const userId = getUserId() || data.userId;
  const batch = writeBatch(db);
  const paymentRef = doc(collection(db, 'payments'));
  const paymentId = paymentRef.id;

  const docData = {
    ...data,
    userId,
    stockRecordId: data.stockRecordId || null,
    createdAt: now(),
    updatedAt: now(),
  };
  batch.set(paymentRef, docData);

  const pm = data.paymentMethod || 'Cash';
  const bn = data.bankName || '';

  if (pm !== 'Cash' && bn) {
    const bankRef = doc(collection(db, 'bankPayments'));
    batch.set(bankRef, {
      userId,
      customerId: data.customerId,
      paymentDate: data.date || new Date().toISOString().split('T')[0],
      paymentAmount: data.amount || 0,
      bankName: bn,
      accountType: pm,
      paymentMethod: pm,
      transactionNote: data.transactionNote || `Payment Received`,
      createdAt: now(),
      updatedAt: now(),
    });
  }

  await batch.commit();

  await _upsertInvoice(paymentId, 'payment', docData);

  await syncCustomerLedger(data.customerId, userId);

  return { id: paymentId, ...docData };
}

export async function updatePayment(id: string, data: any) {
  const ref = doc(db, 'payments', id);
  const updateData = { ...data, updatedAt: now() };
  await updateDoc(ref, updateData);
  await _upsertInvoice(id, 'payment', updateData);
  await syncCustomerLedger(data.customerId, getUserId() || data.userId || '');
}

export async function deletePayment(id: string): Promise<void> {
  const docRef = doc(db, 'payments', id);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data();
    await deleteDoc(docRef);
    await syncCustomerLedger(data.customerId, data.userId);
  } else {
    await deleteDoc(docRef);
  }
}

// ==================== BANK PAYMENTS ====================

export async function getBankPayments(userId: string) {
  const q = query(collection(db, 'bankPayments'), where('userId', '==', userId));
  const snap = await getDocs(q);

  const bankPayments: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const customerSnap = await getDocs(query(collection(db, 'customers'), where('userId', '==', userId)));
  const customerMap: Record<string, any> = {};
  customerSnap.docs.forEach(d => { customerMap[d.id] = { id: d.id, ...d.data() }; });

  return bankPayments.map(b => ({
    ...b,
    customer: customerMap[b.customerId] ? {
      name: customerMap[b.customerId].name,
      phone: customerMap[b.customerId].phone,
    } : undefined,
  })).sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
}

export async function createBankPayment(data: any) {
  const userId = getUserId() || data.userId;
  const docData = {
    ...data,
    userId,
    createdAt: now(),
    updatedAt: now(),
  };
  const docRef = await addDoc(collection(db, 'bankPayments'), docData);
  return { id: docRef.id, ...docData };
}

export async function updateBankPayment(id: string, data: any) {
  const ref = doc(db, 'bankPayments', id);
  await updateDoc(ref, { ...data, updatedAt: now() });
}

export async function deleteBankPayment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'bankPayments', id));
}

// ==================== EXPENSES ====================

export async function getExpenses(userId: string) {
  const q = query(collection(db, 'expenses'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
}

export async function createExpense(data: any) {
  const userId = getUserId() || data.userId;
  const batch = writeBatch(db);
  const expenseRef = doc(collection(db, 'expenses'));
  const expenseId = expenseRef.id;

  const docData = {
    ...data,
    userId,
    createdAt: now(),
    updatedAt: now(),
  };
  batch.set(expenseRef, docData);

  const pm = data.paymentMethod || 'Cash';
  const bn = data.bankName || '';

  if (pm !== 'Cash' && bn) {
    const bankRef = doc(collection(db, 'bankPayments'));
    batch.set(bankRef, {
      userId,
      paymentDate: data.date || new Date().toISOString().split('T')[0],
      paymentAmount: data.amount || 0,
      bankName: bn,
      accountType: pm,
      paymentMethod: pm,
      transactionNote: `Expense: ${data.description || ''}`,
      createdAt: now(),
      updatedAt: now()
    });
  }

  await batch.commit();
  await _upsertInvoice(expenseId, 'expense', docData);
  return { id: expenseId, ...docData };
}

export async function updateExpense(id: string, data: any) {
  const ref = doc(db, 'expenses', id);
  const updateData = { ...data, updatedAt: now() };
  await updateDoc(ref, updateData);
  await _upsertInvoice(id, 'expense', updateData);
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, 'expenses', id));
}

// ==================== PURCHASES ====================

export async function getPurchases(userId: string) {
  const q = query(collection(db, 'purchases'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => {
      const d2 = { id: d.id, ...d.data() } as any;
      d2.remainingAmount = Math.max(0, (d2.totalAmount || 0) - (d2.paidAmount || 0));
      return d2;
    })
    .sort((a: any, b: any) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
}

export async function createPurchase(data: any) {
  const userId = getUserId() || data.userId;
  const totalAmount = parseFloat(data.totalAmount) || 0;
  const paidAmount = parseFloat(data.paidAmount) || 0;
  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  const batch = writeBatch(db);
  const purchaseRef = doc(collection(db, 'purchases'));
  const purchaseId = purchaseRef.id;

  const docData = {
    ...data,
    userId,
    totalAmount,
    paidAmount,
    remainingAmount,
    createdAt: now(),
    updatedAt: now(),
  };
  batch.set(purchaseRef, docData);

  // If paidAmount > 0, auto-create an expense
  if (paidAmount > 0) {
    const expenseRef = doc(collection(db, 'expenses'));
    const pm = data.paymentMethod || 'Cash';
    const bn = data.bankName || '';
    batch.set(expenseRef, {
      userId,
      amount: paidAmount,
      description: `Purchase: ${data.itemName || ''}`,
      category: 'Purchase',
      paymentMethod: pm,
      bankName: bn,
      date: data.date || new Date().toISOString().split('T')[0],
      createdAt: now(),
      updatedAt: now()
    });

    if (pm !== 'Cash' && bn) {
       const bankRef = doc(collection(db, 'bankPayments'));
       batch.set(bankRef, {
         userId,
         paymentDate: data.date || new Date().toISOString().split('T')[0],
         paymentAmount: paidAmount,
         bankName: bn,
         accountType: pm,
         paymentMethod: pm,
         transactionNote: `Purchase Expense: ${data.itemName || ''}`,
         createdAt: now(),
         updatedAt: now()
       });
    }
  }

  // Auto-create invoice
  const invRef = doc(collection(db, 'invoices'));
  const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
  batch.set(invRef, {
    userId,
    invoiceNumber,
    type: 'purchase',
    referenceId: purchaseId,
    partyName: data.sellerName || '',
    partyPhone: '',
    partyCity: '',
    itemName: data.itemName || '',
    itemCategory: data.itemCategory || '',
    weight: data.weight || 0,
    weightUnit: data.weightUnit || 'KG',
    pricePerUnit: data.pricePerUnit || 0,
    totalAmount,
    paidAmount,
    remainingAmount: Math.max(0, totalAmount - paidAmount),
    status: (totalAmount - paidAmount) <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
    notes: data.notes || '',
    date: data.date || new Date().toISOString().split('T')[0],
    createdAt: now(),
    updatedAt: now(),
  });

  await batch.commit();

  return { id: purchaseId, ...docData };
}

export async function updatePurchase(id: string, data: any) {
  const totalAmount = parseFloat(data.totalAmount) || 0;
  const paidAmount = parseFloat(data.paidAmount) || 0;
  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  const ref = doc(db, 'purchases', id);
  const updateData = { ...data, totalAmount, paidAmount, remainingAmount, updatedAt: now() };
  await updateDoc(ref, updateData);
  
  await _upsertInvoice(id, 'purchase', updateData);
}

export async function deletePurchase(id: string): Promise<void> {
  await deleteDoc(doc(db, 'purchases', id));
}

// ==================== INVOICES ====================

export async function getInvoices(userId: string) {
  const q = query(collection(db, 'invoices'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
}

export async function deleteInvoice(id: string): Promise<void> {
  await deleteDoc(doc(db, 'invoices', id));
}

async function _upsertInvoice(referenceId: string, invoiceType: 'sale' | 'purchase' | 'payment' | 'expense', data: any, additionalContext: any = {}) {
  try {
    const userId = data.userId || getUserId();
    const q = query(collection(db, 'invoices'), where('referenceId', '==', referenceId), where('userId', '==', userId));
    const snap = await getDocs(q);
    
    let partyName = data.partyName || '';
    let partyPhone = data.partyPhone || '';

    // Dynamically fetch customer details if needed
    if (!partyName && data.customerId) {
        const custDoc = await getDoc(doc(db, 'customers', data.customerId));
        if (custDoc.exists()) {
            const c = custDoc.data() as any;
            partyName = c.name || '';
            partyPhone = c.phone || '';
        }
    }

    const totalAmount = parseFloat(data.totalAmount) || parseFloat(data.amount) || 0;
    const paidAmount = parseFloat(data.paidAmount) || (['payment', 'expense'].includes(invoiceType) ? totalAmount : 0);
    const remainingAmount = Math.max(0, totalAmount - paidAmount);
    const status = remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

    let itemName = data.itemName || data.transactionNote || data.description || '';
    
    const invoiceRecord = {
        userId: data.userId || getUserId(),
        type: invoiceType,
        referenceId,
        partyName: partyName || data.supplierName || data.category || '',
        partyPhone: partyPhone || data.supplierPhone || '',
        partyCity: data.partyCity || data.supplierCity || '',
        itemName,
        itemCategory: data.itemCategory || data.paymentMethod || data.category || '',
        weight: data.weight || 0,
        weightUnit: data.weightUnit || 'KG',
        pricePerUnit: data.pricePerUnit || 0,
        totalAmount,
        paidAmount,
        remainingAmount,
        status,
        notes: data.notes || '',
        date: data.date || new Date().toISOString().split('T')[0],
        updatedAt: now(),
    };

    if (snap.empty) {
        // Create new
        const prefix = invoiceType === 'payment' ? 'REC' : invoiceType === 'expense' ? 'EXP' : invoiceType === 'purchase' ? 'PINV' : 'INV';
        const invoiceNumber = `${prefix}-${Date.now().toString(36).toUpperCase()}`;
        await addDoc(collection(db, 'invoices'), { ...invoiceRecord, invoiceNumber, createdAt: now() });
        return;
    }

    // Update existing
    const batch = writeBatch(db);
    snap.docs.forEach(d => {
        batch.update(d.ref, invoiceRecord);
    });
    await batch.commit();
  } catch (e) {
    console.error(`Failed to upsert invoice for ${invoiceType}:`, e);
  }
}

// ==================== BRANDING ====================

export async function getBranding(userId: string): Promise<Branding> {
  const defaultBranding: Branding = {
    userId,
    appName: 'Finance Tracker',
    logoUrl: null,
    primaryColor: '#059669',
  };
  try {
    const ref = doc(db, 'branding', userId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { ...defaultBranding, ...snap.data() } as Branding;
    }
    return defaultBranding;
  } catch {
    return defaultBranding;
  }
}

export async function saveBranding(userId: string, data: Branding) {
  const ref = doc(db, 'branding', userId);
  await setDoc(ref, { ...data, userId, updatedAt: now() }, { merge: true });
}

// ==================== LICENSE ====================

export async function checkUserLicense(userId: string, email: string, name: string): Promise<boolean> {
  try {
    // Check/create user doc
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        userId,
        email,
        name,
        hasValidLicense: false,
        createdAt: now(),
      });
      return false;
    }

    const userData = userSnap.data();
    return userData?.hasValidLicense === true;
  } catch (e) {
    console.error('checkUserLicense error:', e);
    return false;
  }
}

export async function activateLicense(userId: string, licenseKey: string, email: string): Promise<void> {
  const licenseRef = doc(db, 'licenses', licenseKey);
  const licenseSnap = await getDoc(licenseRef);

  if (!licenseSnap.exists()) throw new Error('License key not found');
  const licenseData = licenseSnap.data();
  if (licenseData?.status !== 'unused') throw new Error('License key already used or disabled');

  const userRef = doc(db, 'users', userId);

  // Update user and license atomically
  const batch = writeBatch(db);
  batch.update(userRef, {
    hasValidLicense: true,
    licenseKey,
    licenseActivatedAt: now(),
  });
  batch.update(licenseRef, {
    status: 'active',
    usedBy: userId,
    usedByEmail: email,
    activatedAt: now(),
  });
  await batch.commit();
}

export async function getAllLicenses(): Promise<License[]> {
  const snap = await getDocs(collection(db, 'licenses'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as License));
}

export async function generateLicense(generatedBy: string): Promise<string> {
  const key = `${_randomHex(4)}-${_randomHex(4)}-${_randomHex(4)}-${_randomHex(4)}`.toUpperCase();
  await setDoc(doc(db, 'licenses', key), {
    status: 'unused',
    generatedBy,
    createdAt: now(),
  });
  return key;
}

export async function updateLicenseStatus(key: string, status: 'active' | 'disabled' | 'unused') {
  const ref = doc(db, 'licenses', key);
  await updateDoc(ref, { status, updatedAt: now() });
}

function _randomHex(len: number): string {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// ==================== BACKUP / RESTORE ====================

export async function restoreBackup(data: any, userId: string): Promise<boolean> {
  try {
    const collections = [
      { key: 'customers', name: 'customers' },
      { key: 'stockRecords', name: 'stockRecords' },
      { key: 'payments', name: 'payments' },
      { key: 'bankPayments', name: 'bankPayments' },
      { key: 'expenses', name: 'expenses' },
      { key: 'purchases', name: 'purchases' },
      { key: 'invoices', name: 'invoices' },
    ];

    for (const c of collections) {
      const items: any[] = Array.isArray(data[c.key]) ? data[c.key] : [];
      if (items.length === 0) continue;

      for (let i = 0; i < items.length; i += 400) {
        const batch = writeBatch(db);
        items.slice(i, i + 400).forEach(item => {
          const id = item.id || crypto.randomUUID();
          const ref = doc(db, c.name, id);
          batch.set(ref, { ...item, userId, updatedAt: now() }, { merge: true });
        });
        await batch.commit();
      }
    }
    return true;
  } catch (e) {
    console.error('Restore backup error:', e);
    return false;
  }
}

// ==================== REAL-TIME SUBSCRIPTIONS ====================
export function subscribeToData(userId: string, callbacks: {
  onCustomers: (data: any[]) => void,
  onStock: (data: any[]) => void,
  onPayments: (data: any[]) => void,
  onBankPayments: (data: any[]) => void,
  onExpenses: (data: any[]) => void,
  onPurchases: (data: any[]) => void,
  onInvoices: (data: any[]) => void,
}) {
  const unsubCustomers = onSnapshot(query(collection(db, 'customers'), where('userId', '==', userId)), (snap) => {
    const data: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    Promise.all(data.filter(c => typeof c.totalRemaining === 'undefined').map(async (c) => {
      try { await syncCustomerLedger(c.id, userId); } catch {}
    })).catch(() => {});
    callbacks.onCustomers(data.map(c => ({
      ...c,
      totalPaid: typeof c.totalPaid === 'number' ? c.totalPaid : 0,
      totalRemaining: typeof c.totalRemaining === 'number' ? c.totalRemaining : 0,
      lastPaymentDate: c.lastPaymentDate || null,
    })));
  });

  const unsubStock = onSnapshot(query(collection(db, 'stockRecords'), where('userId', '==', userId)), (snap) => {
    callbacks.onStock(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.date || b.createdAt || '').getTime() - new Date(a.date || a.createdAt || '').getTime()));
  });

  const unsubPayments = onSnapshot(query(collection(db, 'payments'), where('userId', '==', userId)), (snap) => {
    callbacks.onPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  });

  const unsubBank = onSnapshot(query(collection(db, 'bankPayments'), where('userId', '==', userId)), (snap) => {
    callbacks.onBankPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()));
  });

  const unsubExpenses = onSnapshot(query(collection(db, 'expenses'), where('userId', '==', userId)), (snap) => {
    callbacks.onExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  });

  const unsubPurchases = onSnapshot(query(collection(db, 'purchases'), where('userId', '==', userId)), (snap) => {
    callbacks.onPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  });

  const unsubInvoices = onSnapshot(query(collection(db, 'invoices'), where('userId', '==', userId)), (snap) => {
    callbacks.onInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()));
  });

  return () => {
    unsubCustomers();
    unsubStock();
    unsubPayments();
    unsubBank();
    unsubExpenses();
    unsubPurchases();
    unsubInvoices();
  };
}
