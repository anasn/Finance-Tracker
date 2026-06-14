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

  const totalMoneyReceived = filteredPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const totalRemainingMoney = customers.reduce((s: number, c: any) => s + (c.totalRemaining || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);

  const today = new Date().toISOString().split('T')[0];
  const todayWasooli = filteredPayments
    .filter(p => (p.date || '').startsWith(today))
    .reduce((s: number, p: any) => s + (p.amount || 0), 0);

  const now = new Date();
  const monthWasooli = filteredPayments
    .filter(p => {
      const d = new Date(p.date || '');
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s: number, p: any) => s + (p.amount || 0), 0);

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

  // Fetch all stockRecords and payments for this user to compute totals
  const [stockSnap, paymentSnap] = await Promise.all([
    getDocs(query(collection(db, 'stockRecords'), where('userId', '==', userId))),
    getDocs(query(collection(db, 'payments'), where('userId', '==', userId))),
  ]);

  const allStock: any[] = stockSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const allPayments: any[] = paymentSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  return customers.map(c => {
    const cStocks = allStock.filter(s => s.customerId === c.id);
    const cPayments = allPayments.filter(p => p.customerId === c.id);

    const totalSaleAmount = cStocks.reduce((s: number, r: any) => s + (r.totalAmount || 0), 0);
    const totalDownpayments = cStocks.reduce((s: number, r: any) => s + (r.paidAmount || 0), 0);
    const totalWasooli = cPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);

    const totalPaid = totalDownpayments + totalWasooli;
    const totalRemaining = Math.max(0, totalSaleAmount - totalPaid);

    const lastPayment = cPayments
      .filter(p => p.date)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    return {
      ...c,
      totalPaid,
      totalRemaining,
      lastPaymentDate: lastPayment?.date || null,
    };
  });
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

  const docData = {
    ...data,
    userId,
    totalAmount,
    paidAmount,
    remainingAmount,
    createdAt: now(),
    updatedAt: now(),
  };

  const docRef = await addDoc(collection(db, 'stockRecords'), docData);

  // Auto-create invoice
  await _createInvoiceForStock({ id: docRef.id, ...docData });

  return { id: docRef.id, ...docData };
}

export async function updateStockRecord(id: string, data: any) {
  const totalAmount = parseFloat(data.totalAmount) || 0;
  const paidAmount = parseFloat(data.paidAmount) || 0;
  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  const ref = doc(db, 'stockRecords', id);
  const updateData = { ...data, totalAmount, paidAmount, remainingAmount, updatedAt: now() };
  await updateDoc(ref, updateData);

  // Update related invoice
  await _updateInvoiceForRecord(id, updateData);
}

export async function deleteStockRecord(id: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'stockRecords', id));

  // Also delete related invoices
  const invQ = await getDocs(query(collection(db, 'invoices'), where('referenceId', '==', id)));
  invQ.docs.forEach(d => batch.delete(d.ref));

  await batch.commit();
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
  const docData = {
    ...data,
    userId,
    stockRecordId: data.stockRecordId || null,
    createdAt: now(),
    updatedAt: now(),
  };
  const docRef = await addDoc(collection(db, 'payments'), docData);
  return { id: docRef.id, ...docData };
}

export async function updatePayment(id: string, data: any) {
  const ref = doc(db, 'payments', id);
  await updateDoc(ref, { ...data, updatedAt: now() });
}

export async function deletePayment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'payments', id));
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
  const docData = {
    ...data,
    userId,
    createdAt: now(),
    updatedAt: now(),
  };
  const docRef = await addDoc(collection(db, 'expenses'), docData);
  return { id: docRef.id, ...docData };
}

export async function updateExpense(id: string, data: any) {
  const ref = doc(db, 'expenses', id);
  await updateDoc(ref, { ...data, updatedAt: now() });
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

  const docData = {
    ...data,
    userId,
    totalAmount,
    paidAmount,
    remainingAmount,
    createdAt: now(),
    updatedAt: now(),
  };
  const docRef = await addDoc(collection(db, 'purchases'), docData);
  return { id: docRef.id, ...docData };
}

export async function updatePurchase(id: string, data: any) {
  const totalAmount = parseFloat(data.totalAmount) || 0;
  const paidAmount = parseFloat(data.paidAmount) || 0;
  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  const ref = doc(db, 'purchases', id);
  await updateDoc(ref, { ...data, totalAmount, paidAmount, remainingAmount, updatedAt: now() });
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

async function _createInvoiceForStock(stockRecord: any) {
  try {
    const userId = getUserId() || stockRecord.userId;

    // Get customer info
    let partyName = '', partyPhone = '', partyCity = '';
    if (stockRecord.customerId) {
      const custDoc = await getDoc(doc(db, 'customers', stockRecord.customerId));
      if (custDoc.exists()) {
        const c = custDoc.data() as any;
        partyName = c.name || '';
        partyPhone = c.phone || '';
        partyCity = c.city || '';
      }
    }

    const totalAmount = parseFloat(stockRecord.totalAmount) || 0;
    const paidAmount = parseFloat(stockRecord.paidAmount) || 0;
    const remainingAmount = Math.max(0, totalAmount - paidAmount);

    const status = remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

    const invoiceData = {
      userId,
      invoiceNumber,
      type: 'sale',
      referenceId: stockRecord.id,
      partyName,
      partyPhone,
      partyCity,
      itemName: stockRecord.itemName || '',
      itemCategory: stockRecord.itemCategory || '',
      weight: stockRecord.weight || 0,
      weightUnit: stockRecord.weightUnit || 'KG',
      pricePerUnit: stockRecord.pricePerUnit || 0,
      totalAmount,
      paidAmount,
      remainingAmount,
      status,
      notes: stockRecord.notes || '',
      date: stockRecord.date || new Date().toISOString().split('T')[0],
      createdAt: now(),
      updatedAt: now(),
    };

    await addDoc(collection(db, 'invoices'), invoiceData);
  } catch (e) {
    console.error('Failed to create invoice for stock:', e);
    // Don't throw - invoice creation is secondary
  }
}

async function _updateInvoiceForRecord(referenceId: string, data: any) {
  try {
    const q = query(collection(db, 'invoices'), where('referenceId', '==', referenceId));
    const snap = await getDocs(q);
    if (snap.empty) return;

    const totalAmount = parseFloat(data.totalAmount) || 0;
    const paidAmount = parseFloat(data.paidAmount) || 0;
    const remainingAmount = Math.max(0, totalAmount - paidAmount);
    const status = remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

    const batch = writeBatch(db);
    snap.docs.forEach(d => {
      batch.update(d.ref, {
        totalAmount,
        paidAmount,
        remainingAmount,
        status,
        itemName: data.itemName || '',
        itemCategory: data.itemCategory || '',
        weight: data.weight || 0,
        weightUnit: data.weightUnit || 'KG',
        pricePerUnit: data.pricePerUnit || 0,
        notes: data.notes || '',
        updatedAt: now(),
      });
    });
    await batch.commit();
  } catch (e) {
    console.error('Failed to update invoice:', e);
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
