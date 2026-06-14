import { collection, doc, query, where, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, getDoc, getCountFromServer } from 'firebase/firestore';
import { db } from './lib/firebase';
import { auth } from './lib/firebase';

const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

// Helper to refresh auth token before write operations
async function refreshAuth(): Promise<boolean> {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      await currentUser.getIdToken(true);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Auth refresh failed:', e);
    return false;
  }
}

// ============ AUTH / BRANDING ============

export interface Branding { userId: string; appName: string; logoUrl: string | null; primaryColor: string; }

export async function getBranding(userId: string): Promise<Branding> {
  const d = await getDoc(doc(db, 'branding', userId));
  if (d.exists()) return d.data() as Branding;
  return { userId, appName: 'Finance Tracker', logoUrl: null, primaryColor: '#059669' };
}

export async function saveBranding(userId: string, data: Partial<Branding>): Promise<void> {
  const ref = doc(db, 'branding', userId);
  await setDoc(ref, { ...data, userId, updatedAt: new Date().toISOString() }, { merge: true });
}

// ============ CUSTOMERS ============

export interface Customer { id: string; userId: string; name: string; phone: string; city: string; address: string; notes: string; totalRemaining: number; totalPaid: number; lastPaymentDate: string | null; createdAt: string; updatedAt?: string; }

export async function getCustomers(userId: string): Promise<Customer[]> {
  const q = query(collection(db, 'customers'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Customer);
}

export async function createCustomer(data: Partial<Customer> & { userId: string }): Promise<Customer> {
  await refreshAuth();
  const id = uid();
  const now = new Date().toISOString();
  const customer: Customer = { id, userId: data.userId, name: data.name || '', phone: data.phone || '', city: data.city || '', address: data.address || '', notes: data.notes || '', totalRemaining: 0, totalPaid: 0, lastPaymentDate: null, createdAt: now, updatedAt: now };
  await setDoc(doc(db, 'customers', id), customer);
  return customer;
}

export async function updateCustomer(id: string, data: Partial<Customer>): Promise<void> {
  await updateDoc(doc(db, 'customers', id), { ...data, updatedAt: new Date().toISOString() });
}


export async function deleteCustomer(id: string): Promise<void> {
  console.log("Starting deleteCustomer", id);

  await refreshAuth();
  const customerDoc = await getDoc(doc(db, 'customers', id));
  if (!customerDoc.exists()) return;
  const customer = customerDoc.data() as Customer;
  
  const batch = writeBatch(db);
  batch.delete(doc(db, 'customers', id));
  
  // Clean up related (Simplified for 500 limit safety, typically handled via server function)
  const relatedQueries = [
    getDocs(query(collection(db, 'stockRecords'), where('customerId', '==', id), where('userId', '==', auth.currentUser?.uid || ''))),
    getDocs(query(collection(db, 'payments'), where('customerId', '==', id), where('userId', '==', auth.currentUser?.uid || ''))),
    getDocs(query(collection(db, 'bankPayments'), where('customerId', '==', id), where('userId', '==', auth.currentUser?.uid || '')))
  ];
  
  
  let stocks, payments, banks;
  try {
    [stocks, payments, banks] = await Promise.all(relatedQueries);
    console.log("Promise.all succeeded");
  } catch (e) {
    console.error("Promise.all relatedQueries failed:", e);
    throw e;
  }

  const stockIds = stocks.docs.map(d => d.id);
  
  stocks.forEach(d => batch.delete(d.ref));
  payments.forEach(d => batch.delete(d.ref));
  banks.forEach(d => batch.delete(d.ref));

  if (stockIds.length > 0) {
     
console.log('Fetching invoices for customer.userId:', customer.userId);
const invQ = await getDocs(query(collection(db, 'invoices'), where('userId', '==', customer.userId), where('userId', '==', auth.currentUser?.uid || '')));

     invQ.forEach(d => {
       const data = d.data();
       if (stockIds.includes(data.referenceId)) batch.delete(d.ref);
     });
  }
  
  
  try {
     console.log("Committing batch");
     await batch.commit();
     console.log("Commit succeeded");
  } catch (e) {
     console.error("Committing batch failed:", e);
     throw e;
  }

}

// ============ UTILS ============

async function recalcCustomerTotals(customerId: string): Promise<void> {
  if (!customerId) return;
  const custDoc = await getDoc(doc(db, 'customers', customerId));
  if (!custDoc.exists()) return;

  const stocksSnap = await getDocs(query(collection(db, 'stockRecords'), where('customerId', '==', customerId), where('userId', '==', auth.currentUser?.uid || '')));
  const paymentsSnap = await getDocs(query(collection(db, 'payments'), where('customerId', '==', customerId), where('userId', '==', auth.currentUser?.uid || '')));
  
  const totalPurchases = stocksSnap.docs.reduce((s, doc) => s + (Number(doc.data().totalAmount) || 0), 0);
  const totalPaid = paymentsSnap.docs.reduce((s, doc) => s + (Number(doc.data().amount) || 0), 0);
  const totalRemaining = totalPurchases - totalPaid;
  
  const payments = paymentsSnap.docs.map(d => d.data());
  payments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const lastPaymentDate = payments.length > 0 ? payments[payments.length - 1].date : null;

  await updateDoc(doc(db, 'customers', customerId), {
    totalPaid,
    totalRemaining: Math.max(0, totalRemaining),
    lastPaymentDate,
    updatedAt: new Date().toISOString()
  });

  // Also update invoice statuses for this customer's stock records
  try {
    const stockIds = stocksSnap.docs.map(d => d.id);
    if (stockIds.length > 0) {
      // Get all invoices referencing this customer's stock records
      const invoicesSnap = await getDocs(query(collection(db, 'invoices'), where('referenceId', 'in', stockIds.length <= 30 ? stockIds : stockIds.slice(0, 30)), where('userId', '==', auth.currentUser?.uid || '')));
      const batch = writeBatch(db);
      let batchCount = 0;

      // Extract general unallocated payments
      const unallocatedPaid = payments.filter(p => !p.stockRecordId).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      let remainingUnallocated = unallocatedPaid;

      // Sort stock records chronologically (oldest first)
      const stockRecords = stocksSnap.docs.map(d => ({ ref: d.ref, id: d.id, data: d.data() as StockRecord }));
      stockRecords.sort((a, b) => new Date(a.data.date).getTime() - new Date(b.data.date).getTime());

      for (const stock of stockRecords) {
          const stockRefId = stock.id;
          const stockData = stock.data;
          
          // Calculate strictly allocated payments
          const allocatedPaid = payments.filter((p: any) => p.stockRecordId === stockRefId).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
          const totalAmount = Number(stockData.totalAmount) || 0;
          let stockPaid = allocatedPaid;
          
          if (remainingUnallocated > 0 && totalAmount > stockPaid) {
              const needed = totalAmount - stockPaid;
              const toApply = Math.min(needed, remainingUnallocated);
              stockPaid += toApply;
              remainingUnallocated -= toApply;
          }

          const newRemaining = Math.max(0, totalAmount - stockPaid);
          const newStatus = newRemaining <= 0 ? 'paid' : stockPaid > 0 ? 'partial' : 'unpaid';

          // Update the stock record's paid/remaining
          batch.update(stock.ref, {
            paidAmount: stockPaid,
            remainingAmount: newRemaining,
            updatedAt: new Date().toISOString()
          });
          batchCount++;

          // Update associated invoice
          const invDoc = invoicesSnap.docs.find(d => d.data().referenceId === stockRefId);
          if (invDoc) {
             batch.update(invDoc.ref, {
               paidAmount: stockPaid,
               remainingAmount: newRemaining,
               status: newStatus,
               updatedAt: new Date().toISOString()
             });
             batchCount++;
          }
      }

      if (batchCount > 0) {
        
  try {
     console.log("Committing batch");
     await batch.commit();
     console.log("Commit succeeded");
  } catch (e) {
     console.error("Committing batch failed:", e);
     throw e;
  }

      }
    }
  } catch (e) {
    console.error('Failed to update invoice statuses:', e);
    // Don't throw - customer totals were still updated
  }
}

// ============ STOCK RECORDS ============

export interface StockRecord { id: string; userId: string; customerId: string; date: string; itemName: string; itemCategory: string; weight: number; weightUnit: string; pricePerUnit: number; totalAmount: number; paidAmount: number; remainingAmount: number; notes: string; createdAt: string; updatedAt?: string; }

export async function getStockRecords(userId: string): Promise<(StockRecord & { customer?: { name: string; phone: string } })[]> {
  const [stocksSnap, custSnap] = await Promise.all([
    getDocs(query(collection(db, 'stockRecords'), where('userId', '==', userId))),
    getDocs(query(collection(db, 'customers'), where('userId', '==', userId)))
  ]);
  
  const customers = new Map(custSnap.docs.map(d => [d.id, d.data() as Customer]));
  
  return stocksSnap.docs.map(d => {
    const data = d.data() as StockRecord;
    const c = customers.get(data.customerId);
    return { ...data, customer: c ? { name: c.name, phone: c.phone } : undefined };
  });
}

export async function createStockRecord(data: Partial<StockRecord> & { userId: string }): Promise<StockRecord> {
  await refreshAuth();
  const id = uid();
  const nowUtc = new Date();
  const localDateForToday = new Date(nowUtc);
  localDateForToday.setMinutes(localDateForToday.getMinutes() - localDateForToday.getTimezoneOffset());
  const localTodayStr = localDateForToday.toISOString().split('T')[0];
  const now = nowUtc.toISOString();
  const record: StockRecord = { id, userId: data.userId, customerId: data.customerId || '', date: data.date || localTodayStr, itemName: data.itemName || '', itemCategory: data.itemCategory || '', weight: data.weight || 0, weightUnit: data.weightUnit || 'KG', pricePerUnit: data.pricePerUnit || 0, totalAmount: data.totalAmount || 0, paidAmount: data.paidAmount || 0, remainingAmount: (data.totalAmount || 0) - (data.paidAmount || 0), notes: data.notes || '', createdAt: now, updatedAt: now };
  
  const batch = writeBatch(db);
  batch.set(doc(db, 'stockRecords', id), record);
  
  const paidAmt = record.paidAmount;
  let custName = '';
  let custPhone = '';
  let custCity = '';

  if (record.customerId) {
    const custDoc = await getDoc(doc(db, 'customers', record.customerId));
    if (custDoc.exists()) {
      custName = custDoc.data().name;
      custPhone = custDoc.data().phone;
      custCity = custDoc.data().city;
    }
  }

  if (paidAmt > 0) {
    const pid = uid();
    const pm = (data as any).paymentMethod || 'Cash';
    const bn = (data as any).bankName || '';
    batch.set(doc(db, 'payments', pid), { id: pid, userId: data.userId, customerId: record.customerId, stockRecordId: id, amount: paidAmt, date: record.date, paymentMethod: pm, bankName: bn, transactionNote: `Stock: ${record.itemName}`, createdAt: now, updatedAt: now });
    
    if (pm !== 'Cash' && bn) {
      const bpid = uid();
      batch.set(doc(db, 'bankPayments', bpid), { id: bpid, userId: data.userId, customerId: record.customerId, paymentDate: record.date, paymentAmount: paidAmt, bankName: bn, accountType: pm, transactionNote: `Stock Sent: ${record.itemName} (${custName})`, paymentMethod: pm, createdAt: now, updatedAt: now });
    }
  }
  
  const invIdStr = Math.floor(Date.now() / 1000 % 100000).toString() + Math.floor(Math.random() * 10).toString();
  const invoiceCount = invIdStr;
  const invId = uid();
  batch.set(doc(db, 'invoices', invId), { id: invId, userId: data.userId, invoiceNumber: `INV-${invoiceCount}`, type: 'sale', referenceId: id, partyName: custName, partyPhone: custPhone, partyCity: custCity, itemName: record.itemName, itemCategory: record.itemCategory, weight: record.weight, weightUnit: record.weightUnit, pricePerUnit: record.pricePerUnit, totalAmount: record.totalAmount, paidAmount: record.paidAmount, remainingAmount: record.remainingAmount, status: record.remainingAmount <= 0 ? 'paid' : record.paidAmount > 0 ? 'partial' : 'unpaid', notes: record.notes || '', date: record.date, createdAt: now, updatedAt: now });

  
  try {
     console.log("Committing batch");
     await batch.commit();
     console.log("Commit succeeded");
  } catch (e) {
     console.error("Committing batch failed:", e);
     throw e;
  }

  await recalcCustomerTotals(record.customerId);
  return record;
}

export async function updateStockRecord(id: string, data: Partial<StockRecord>): Promise<void> {
  const oldDoc = await getDoc(doc(db, 'stockRecords', id));
  if (!oldDoc.exists()) return;
  const oldData = oldDoc.data() as StockRecord;
  const newRemaining = (data.totalAmount ?? oldData.totalAmount) - (data.paidAmount ?? oldData.paidAmount);
  
  await updateDoc(doc(db, 'stockRecords', id), { ...data, remainingAmount: newRemaining, updatedAt: new Date().toISOString() });
  
  const paymentDiff = (data.paidAmount ?? oldData.paidAmount) - oldData.paidAmount;
  
  if (paymentDiff > 0) {
    const pid = uid();
    const now = new Date().toISOString();
    const pm = (data as any).paymentMethod || 'Cash';
    const bn = (data as any).bankName || '';

    await setDoc(doc(db, 'payments', pid), { 
       id: pid, 
       userId: oldData.userId, 
       customerId: data.customerId ?? oldData.customerId, 
       stockRecordId: id, 
       amount: paymentDiff, 
       date: data.date ?? oldData.date, 
       paymentMethod: pm, 
       bankName: bn, 
       transactionNote: `Installment for Stock: ${oldData.itemName}`, 
       createdAt: now, 
       updatedAt: now 
    });

    if (pm !== 'Cash' && bn) {
      const bpid = uid();
      let custName = 'Customer';
      try {
         const cd = await getDoc(doc(db, 'customers', data.customerId ?? oldData.customerId));
         if (cd.exists()) custName = cd.data().name;
      } catch (e) {
         console.error(e);
      }
      await setDoc(doc(db, 'bankPayments', bpid), { 
        id: bpid, 
        userId: oldData.userId, 
        customerId: data.customerId ?? oldData.customerId, 
        paymentDate: data.date ?? oldData.date, 
        paymentAmount: paymentDiff, 
        bankName: bn, 
        accountType: pm, 
        transactionNote: `Installment for Stock: ${oldData.itemName} (${custName})`, 
        paymentMethod: pm, 
        createdAt: now, 
        updatedAt: now 
      });
    }
  } else if (paymentDiff < 0) {
    const paymentsSnap = await getDocs(query(collection(db, 'payments'), where('stockRecordId', '==', id), where('userId', '==', auth.currentUser?.uid || '')));
    if (!paymentsSnap.empty) {
      const pd = paymentsSnap.docs[paymentsSnap.docs.length - 1]; // update the most recent one
      const newAmt = pd.data().amount + paymentDiff; // paymentDiff is negative
      if (newAmt <= 0) {
        await deleteDoc(pd.ref);
      } else {
        await updateDoc(pd.ref, { amount: newAmt, updatedAt: new Date().toISOString() });
      }
    }
  }

  await recalcCustomerTotals(oldData.customerId);
  if (data.customerId && data.customerId !== oldData.customerId) await recalcCustomerTotals(data.customerId);
}

export async function deleteStockRecord(id: string): Promise<void> {
  console.log("Starting deleteStockRecord", id);
  await refreshAuth();
  const recDoc = await getDoc(doc(db, 'stockRecords', id));
  if (!recDoc.exists()) return;
  const rec = recDoc.data() as StockRecord;
  
  const batch = writeBatch(db);
  batch.delete(recDoc.ref);
  
  const paymentsQ = await getDocs(query(collection(db, 'payments'), where('stockRecordId', '==', id), where('userId', '==', auth.currentUser?.uid || '')));
  paymentsQ.forEach(d => batch.delete(d.ref));
  
  const invQ = await getDocs(query(collection(db, 'invoices'), where('referenceId', '==', id), where('userId', '==', auth.currentUser?.uid || '')));
  invQ.forEach(d => batch.delete(d.ref));
  
  
  try {
     console.log("Committing batch");
     await batch.commit();
     console.log("Commit succeeded");
  } catch (e) {
     console.error("Committing batch failed:", e);
     throw e;
  }

  await recalcCustomerTotals(rec.customerId);
}

// ============ PAYMENTS ============

export interface Payment { id: string; userId: string; customerId: string; stockRecordId: string | null; amount: number; date: string; paymentMethod: string; bankName: string; transactionNote: string; createdAt: string; updatedAt?: string; }

export async function getPayments(userId: string): Promise<(Payment & { customer?: { name: string; phone: string } })[]> {
  const [paySnap, custSnap] = await Promise.all([
    getDocs(query(collection(db, 'payments'), where('userId', '==', userId))),
    getDocs(query(collection(db, 'customers'), where('userId', '==', userId)))
  ]);
  
  const customers = new Map(custSnap.docs.map(d => [d.id, d.data() as Customer]));
  const payments = paySnap.docs.map(d => {
    const p = d.data() as Payment;
    const c = customers.get(p.customerId);
    return { ...p, customer: c ? { name: c.name, phone: c.phone } : undefined };
  });
  return payments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createPayment(data: Partial<Payment> & { userId: string }): Promise<Payment> {
  await refreshAuth();
  const id = uid();
  const nowUtc = new Date();
  const localDateForToday = new Date(nowUtc);
  localDateForToday.setMinutes(localDateForToday.getMinutes() - localDateForToday.getTimezoneOffset());
  const localTodayStr = localDateForToday.toISOString().split('T')[0];
  const now = nowUtc.toISOString();
  const payment: Payment = { id, userId: data.userId, customerId: data.customerId || '', stockRecordId: data.stockRecordId || null, amount: data.amount || 0, date: data.date || localTodayStr, paymentMethod: data.paymentMethod || 'Cash', bankName: data.bankName || '', transactionNote: data.transactionNote || '', createdAt: now, updatedAt: now };
  
  const batch = writeBatch(db);
  batch.set(doc(db, 'payments', id), payment);
  
  const pm = data.paymentMethod || 'Cash';
  const bn = data.bankName || '';
  if (payment.amount > 0 && pm !== 'Cash' && bn) {
    let custName = '';
    const cd = await getDoc(doc(db, 'customers', payment.customerId));
    if (cd.exists()) custName = cd.data().name;
    const bpid = uid();
    batch.set(doc(db, 'bankPayments', bpid), { id: bpid, userId: data.userId, customerId: payment.customerId, paymentDate: payment.date, paymentAmount: payment.amount, bankName: bn, accountType: pm, transactionNote: `Wasooli: ${custName}`, paymentMethod: pm, createdAt: now, updatedAt: now });
  }
  
  
  try {
     console.log("Committing batch");
     await batch.commit();
     console.log("Commit succeeded");
  } catch (e) {
     console.error("Committing batch failed:", e);
     throw e;
  }

  await recalcCustomerTotals(payment.customerId);
  return payment;
}

export async function updatePayment(id: string, data: Partial<Payment>): Promise<void> {
  const docRef = doc(db, 'payments', id);
  const oldDoc = await getDoc(docRef);
  if (!oldDoc.exists()) return;
  const oldPayment = oldDoc.data() as Payment;
  const amountDiff = (data.amount !== undefined) ? data.amount - oldPayment.amount : 0;
  
  await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
  
  if (oldPayment.stockRecordId && amountDiff !== 0) {
    const sDocRef = doc(db, 'stockRecords', oldPayment.stockRecordId);
    const sDoc = await getDoc(sDocRef);
    if (sDoc.exists()) {
      const sData = sDoc.data() as StockRecord;
      const newPaid = Math.max(0, sData.paidAmount + amountDiff);
      await updateDoc(sDocRef, { paidAmount: newPaid, remainingAmount: sData.totalAmount - newPaid, updatedAt: new Date().toISOString() });
    }
  }
  
  await recalcCustomerTotals(oldPayment.customerId);
  if (data.customerId && data.customerId !== oldPayment.customerId) await recalcCustomerTotals(data.customerId);
}

export async function deletePayment(id: string): Promise<void> {
  console.log("Starting deletePayment", id);
  await refreshAuth();
  const docRef = doc(db, 'payments', id);
  const oldDoc = await getDoc(docRef);
  if (!oldDoc.exists()) return;
  const payment = oldDoc.data() as Payment;
  
  await deleteDoc(docRef);
  
  if (payment.stockRecordId) {
    const sDocRef = doc(db, 'stockRecords', payment.stockRecordId);
    const sDoc = await getDoc(sDocRef);
    if (sDoc.exists()) {
      const sData = sDoc.data() as StockRecord;
      const newPaid = Math.max(0, sData.paidAmount - payment.amount);
      await updateDoc(sDocRef, { paidAmount: newPaid, remainingAmount: sData.totalAmount - newPaid, updatedAt: new Date().toISOString() });
    }
  }
  await recalcCustomerTotals(payment.customerId);
}

// ============ BANK PAYMENTS ============

export interface BankPayment { id: string; userId: string; customerId: string; paymentDate: string; paymentAmount: number; bankName: string; accountType: string; transactionNote: string; paymentMethod: string; createdAt: string; updatedAt?: string; }

export async function getBankPayments(userId: string): Promise<(BankPayment & { customer?: { name: string; phone: string } })[]> {
  const [bpSnap, custSnap] = await Promise.all([
    getDocs(query(collection(db, 'bankPayments'), where('userId', '==', userId))),
    getDocs(query(collection(db, 'customers'), where('userId', '==', userId)))
  ]);
  const customers = new Map(custSnap.docs.map(d => [d.id, d.data() as Customer]));
  const banks = bpSnap.docs.map(d => {
    const b = d.data() as BankPayment;
    const c = customers.get(b.customerId);
    return { ...b, customer: c ? { name: c.name, phone: c.phone } : undefined };
  });
  return banks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createBankPayment(data: Partial<BankPayment> & { userId: string }): Promise<BankPayment> {
  const id = uid();
  const nowUtc = new Date();
  const localDateForToday = new Date(nowUtc);
  localDateForToday.setMinutes(localDateForToday.getMinutes() - localDateForToday.getTimezoneOffset());
  const localTodayStr = localDateForToday.toISOString().split('T')[0];
  const now = nowUtc.toISOString();
  const bp: BankPayment = { id, userId: data.userId, customerId: data.customerId || '', paymentDate: data.paymentDate || localTodayStr, paymentAmount: data.paymentAmount || 0, bankName: data.bankName || '', accountType: data.accountType || '', transactionNote: data.transactionNote || '', paymentMethod: data.paymentMethod || 'Bank Transfer', createdAt: now, updatedAt: now };
  await setDoc(doc(db, 'bankPayments', id), bp);
  return bp;
}

export async function updateBankPayment(id: string, data: Partial<BankPayment>): Promise<void> {
  await updateDoc(doc(db, 'bankPayments', id), { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteBankPayment(id: string): Promise<void> {
  console.log("Starting deleteBankPayment", id);
  await deleteDoc(doc(db, 'bankPayments', id));
}

// ============ EXPENSES ============

export interface Expense { id: string; userId: string; description: string; amount: number; category: string; date: string; notes: string; createdAt: string; updatedAt?: string; }

export async function getExpenses(userId: string): Promise<Expense[]> {
  const snap = await getDocs(query(collection(db, 'expenses'), where('userId', '==', userId)));
  const expenses = snap.docs.map(d => d.data() as Expense);
  return expenses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createExpense(data: Partial<Expense> & { userId: string }): Promise<Expense> {
  const id = uid();
  const nowUtc = new Date();
  const localDateForToday = new Date(nowUtc);
  localDateForToday.setMinutes(localDateForToday.getMinutes() - localDateForToday.getTimezoneOffset());
  const localTodayStr = localDateForToday.toISOString().split('T')[0];
  const now = nowUtc.toISOString();
  const expense: Expense = { id, userId: data.userId, description: data.description || '', amount: data.amount || 0, category: data.category || 'General', date: data.date || localTodayStr, notes: data.notes || '', createdAt: now, updatedAt: now };
  
  const batch = writeBatch(db);
  batch.set(doc(db, 'expenses', id), expense);
  
  const invIdStr = Math.floor(Date.now() / 1000 % 100000).toString() + Math.floor(Math.random() * 10).toString();
  const invoiceCount = invIdStr;
  const invId = uid();
  batch.set(doc(db, 'invoices', invId), { id: invId, userId: data.userId, invoiceNumber: `INV-${invoiceCount}`, type: 'expense', referenceId: id, partyName: 'N/A', partyPhone: '', partyCity: '', itemName: expense.description, itemCategory: expense.category, weight: 0, weightUnit: '', pricePerUnit: expense.amount, totalAmount: expense.amount, paidAmount: expense.amount, remainingAmount: 0, status: 'paid', notes: expense.notes || '', date: expense.date, createdAt: now, updatedAt: now });

  
  try {
     console.log("Committing batch");
     await batch.commit();
     console.log("Commit succeeded");
  } catch (e) {
     console.error("Committing batch failed:", e);
     throw e;
  }

  return expense;
}

export async function updateExpense(id: string, data: Partial<Expense>): Promise<void> {
  await updateDoc(doc(db, 'expenses', id), { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteExpense(id: string): Promise<void> {
  console.log("Starting deleteExpense", id);
  const batch = writeBatch(db);
  batch.delete(doc(db, 'expenses', id));
  const invQ = await getDocs(query(collection(db, 'invoices'), where('referenceId', '==', id), where('userId', '==', auth.currentUser?.uid || '')));
  invQ.forEach(d => batch.delete(d.ref));
  
  try {
     console.log("Committing batch");
     await batch.commit();
     console.log("Commit succeeded");
  } catch (e) {
     console.error("Committing batch failed:", e);
     throw e;
  }

}

// ============ PURCHASES ============

export interface Purchase { id: string; userId: string; supplierName: string; supplierPhone: string; supplierCity: string; date: string; itemName: string; itemCategory: string; weight: number; weightUnit: string; pricePerUnit: number; totalAmount: number; paidAmount: number; remainingAmount: number; notes: string; createdAt: string; updatedAt?: string; }

export async function getPurchases(userId: string): Promise<Purchase[]> {
  const snap = await getDocs(query(collection(db, 'purchases'), where('userId', '==', userId)));
  const purchases = snap.docs.map(d => d.data() as Purchase);
  return purchases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createPurchase(data: Partial<Purchase> & { userId: string }): Promise<Purchase> {
  const id = uid();
  const nowUtc = new Date();
  const localDateForToday = new Date(nowUtc);
  localDateForToday.setMinutes(localDateForToday.getMinutes() - localDateForToday.getTimezoneOffset());
  const localTodayStr = localDateForToday.toISOString().split('T')[0];
  const now = nowUtc.toISOString();
  const record: Purchase = { id, userId: data.userId, supplierName: data.supplierName || '', supplierPhone: data.supplierPhone || '', supplierCity: data.supplierCity || '', date: data.date || localTodayStr, itemName: data.itemName || '', itemCategory: data.itemCategory || '', weight: data.weight || 0, weightUnit: data.weightUnit || 'KG', pricePerUnit: data.pricePerUnit || 0, totalAmount: data.totalAmount || 0, paidAmount: data.paidAmount || 0, remainingAmount: (data.totalAmount || 0) - (data.paidAmount || 0), notes: data.notes || '', createdAt: now, updatedAt: now };
  
  const batch = writeBatch(db);
  batch.set(doc(db, 'purchases', id), record);
  
  const paidAmt = record.paidAmount;
  const pm = ((data as any).paymentMethod) || 'Cash';
  const bn = ((data as any).bankName) || '';
  if (paidAmt > 0 && pm !== 'Cash' && bn) {
    const bpid = uid();
    batch.set(doc(db, 'bankPayments', bpid), { id: bpid, userId: data.userId, customerId: '', paymentDate: record.date, paymentAmount: paidAmt, bankName: bn, accountType: pm, transactionNote: `Purchase: ${record.itemName} (${record.supplierName})`, paymentMethod: pm, createdAt: now, updatedAt: now });
  }
  
  const invIdStr = Math.floor(Date.now() / 1000 % 100000).toString() + Math.floor(Math.random() * 10).toString();
  const invoiceCount = invIdStr;
  const invId = uid();
  batch.set(doc(db, 'invoices', invId), { id: invId, userId: data.userId, invoiceNumber: `INV-${invoiceCount}`, type: 'purchase', referenceId: id, partyName: record.supplierName, partyPhone: record.supplierPhone, partyCity: record.supplierCity, itemName: record.itemName, itemCategory: record.itemCategory, weight: record.weight, weightUnit: record.weightUnit, pricePerUnit: record.pricePerUnit, totalAmount: record.totalAmount, paidAmount: record.paidAmount, remainingAmount: record.remainingAmount, status: record.remainingAmount <= 0 ? 'paid' : record.paidAmount > 0 ? 'partial' : 'unpaid', notes: record.notes || '', date: record.date, createdAt: now, updatedAt: now });
  
  
  try {
     console.log("Committing batch");
     await batch.commit();
     console.log("Commit succeeded");
  } catch (e) {
     console.error("Committing batch failed:", e);
     throw e;
  }

  return record;
}

export async function updatePurchase(id: string, data: Partial<Purchase>): Promise<void> {
  const dRef = doc(db, 'purchases', id);
  const oldDoc = await getDoc(dRef);
  if (!oldDoc.exists()) return;
  const old = oldDoc.data() as Purchase;
  const newRemain = (data.totalAmount ?? old.totalAmount) - (data.paidAmount ?? old.paidAmount);
  await updateDoc(dRef, { ...data, remainingAmount: newRemain, updatedAt: new Date().toISOString() });
}

export async function deletePurchase(id: string): Promise<void> {
  console.log("Starting deletePurchase", id);
  const batch = writeBatch(db);
  batch.delete(doc(db, 'purchases', id));
  const invQ = await getDocs(query(collection(db, 'invoices'), where('referenceId', '==', id), where('userId', '==', auth.currentUser?.uid || '')));
  invQ.forEach(d => batch.delete(d.ref));
  
  try {
     console.log("Committing batch");
     await batch.commit();
     console.log("Commit succeeded");
  } catch (e) {
     console.error("Committing batch failed:", e);
     throw e;
  }

}

// ============ INVOICES ============

export interface Invoice { id: string; userId: string; invoiceNumber: string; type: string; referenceId: string; partyName: string; partyPhone: string; partyCity: string; itemName: string; itemCategory: string; weight: number; weightUnit: string; pricePerUnit: number; totalAmount: number; paidAmount: number; remainingAmount: number; status: string; notes: string; date: string; createdAt: string; updatedAt?: string; }

export async function getInvoices(userId: string): Promise<Invoice[]> {
  const snap = await getDocs(query(collection(db, 'invoices'), where('userId', '==', userId)));
  const invs = snap.docs.map(d => d.data() as Invoice);
  return invs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function deleteInvoice(id: string): Promise<void> {
  console.log("Starting deleteInvoice", id);
  await deleteDoc(doc(db, 'invoices', id));
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

export function computeDashboardData(
  allCustomers: Customer[],
  stockRecords: (StockRecord & { customer?: { name: string; phone: string } })[],
  payments: (Payment & { customer?: { name: string; phone: string } })[],
  expenses: Expense[],
  dateFrom?: string,
  dateTo?: string,
  bankPayments?: BankPayment[]
): DashboardData {
  let filteredStockRecords = stockRecords;
  let filteredPayments = payments;
  let filteredExpenses = expenses;
  let filteredBankPayments = bankPayments || [];

  if (dateFrom) {
    filteredStockRecords = filteredStockRecords.filter(r => r.date >= dateFrom);
    filteredPayments = filteredPayments.filter(p => p.date >= dateFrom);
    filteredExpenses = filteredExpenses.filter(e => e.date >= dateFrom);
    filteredBankPayments = filteredBankPayments.filter(b => b.paymentDate >= dateFrom);
  }
  if (dateTo) {
    filteredStockRecords = filteredStockRecords.filter(r => r.date <= dateTo);
    filteredPayments = filteredPayments.filter(p => p.date <= dateTo);
    filteredExpenses = filteredExpenses.filter(e => e.date <= dateTo);
    filteredBankPayments = filteredBankPayments.filter(b => b.paymentDate <= dateTo);
  }

  const localDate = new Date();
  localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
  const today = localDate.toISOString().split('T')[0];
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  
  // Total money received includes both Customer payments and direct Bank payments (that are not linked to a customer payment to avoid double counting)
  // Actually, bankPayments created from createPayment have customerId. Direct ones might not have customerId if they are generic, but we must avoid double counting.
  // We'll trust filteredPayments for Wasooli, but if we want todayWasooli to be very explicitly from today's Date:
  const todayWasooli = filteredPayments.filter(p => !p.date ? false : p.date === today || p.date.startsWith(today)).reduce((s, p) => s + (parseFloat(p.amount as any) || 0), 0);
  const totalMoneyReceived = filteredPayments.reduce((s, p) => s + (parseFloat(p.amount as any) || 0), 0);
  const totalRemainingMoney = allCustomers.reduce((s, c) => s + (parseFloat(c.totalRemaining as any) || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + (parseFloat(e.amount as any) || 0), 0);
  const monthWasooli = filteredPayments.filter(p => { const d = new Date(p.date || new Date().toISOString()); return d.getMonth() === thisMonth && d.getFullYear() === thisYear; }).reduce((s, p) => s + (parseFloat(p.amount as any) || 0), 0);
  
  const pendingPayments = allCustomers.filter(c => c.totalRemaining > 0).length;
  const paidPayments = allCustomers.filter(c => c.totalRemaining <= 0).length;
  
  let monthlyPaymentsForChart = payments;
  let monthlyExpensesForChart = expenses;
  let monthlyStockRecordsForChart = stockRecords;
  
  if (dateFrom) {
    monthlyPaymentsForChart = monthlyPaymentsForChart.filter(p => p.date >= dateFrom);
    monthlyExpensesForChart = monthlyExpensesForChart.filter(e => e.date >= dateFrom);
    monthlyStockRecordsForChart = monthlyStockRecordsForChart.filter(r => r.date >= dateFrom);
  }
  if (dateTo) {
    monthlyPaymentsForChart = monthlyPaymentsForChart.filter(p => p.date <= dateTo);
    monthlyExpensesForChart = monthlyExpensesForChart.filter(e => e.date <= dateTo);
    monthlyStockRecordsForChart = monthlyStockRecordsForChart.filter(r => r.date <= dateTo);
  }

  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(thisYear, thisMonth - i, 1);
    const monthStr = d.toLocaleString('default', { month: 'short' });
    const m = d.getMonth();
    const y = d.getFullYear();
    const mWasooli = monthlyPaymentsForChart.filter(p => { const pd = new Date(p.date); return pd.getMonth() === m && pd.getFullYear() === y; }).reduce((s, p) => s + p.amount, 0);
    const mExpenses = monthlyExpensesForChart.filter(e => { const ed = new Date(e.date); return ed.getMonth() === m && ed.getFullYear() === y; }).reduce((s, e) => s + e.amount, 0);
    const mStockSent = monthlyStockRecordsForChart.filter(sr => { const sd = new Date(sr.date); return sd.getMonth() === m && sd.getFullYear() === y; }).reduce((s, sr) => s + sr.totalAmount, 0);
    monthlyData.push({ month: monthStr, wasooli: mWasooli, expenses: mExpenses, stockSent: mStockSent });
  }
  
  const activities: { id: string; type: string; description: string; date: string; customerName: string }[] = [];
  filteredStockRecords.slice(-10).forEach(r => activities.push({ id: r.id, type: 'stock', description: `Sale: ${r.itemName} - PKR ${Math.round(r.totalAmount).toLocaleString()}`, date: r.createdAt, customerName: r.customer?.name || '' }));
  filteredPayments.slice(-10).forEach(p => activities.push({ id: p.id, type: 'payment', description: `Payment: PKR ${Math.round(p.amount).toLocaleString()}`, date: p.createdAt, customerName: p.customer?.name || '' }));
  filteredExpenses.slice(-5).forEach(e => activities.push({ id: e.id, type: 'expense', description: `Expense: ${e.description} - PKR ${Math.round(e.amount).toLocaleString()}`, date: e.createdAt, customerName: '' }));
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return {
    totalCustomers: allCustomers.length,
    totalStockRecords: filteredStockRecords.length,
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

export async function getDashboardData(userId: string, dateFrom?: string, dateTo?: string): Promise<DashboardData> {
  const [cust, stocks, pays, exps] = await Promise.all([
    getCustomers(userId),
    getStockRecords(userId),
    getPayments(userId),
    getExpenses(userId)
  ]);
  
  return computeDashboardData(cust, stocks, pays, exps, dateFrom, dateTo);
}

export async function restoreBackup(data: any, userId: string): Promise<boolean> {
  try {
    const collections = [
      { key: 'customers', items: data.customers || [] },
      { key: 'stockRecords', items: data.stockRecords || [] },
      { key: 'payments', items: data.payments || [] },
      { key: 'bankPayments', items: data.bankPayments || [] },
      { key: 'expenses', items: data.expenses || [] },
      { key: 'purchases', items: data.purchases || [] },
      { key: 'invoices', items: data.invoices || [] }
    ];

    for (let i = 0; i < collections.length; i++) {
        const { key, items } = collections[i];
        if (!items || items.length === 0) continue;
        
        // chunking by 500
        for (let j = 0; j < items.length; j += 500) {
            const chunk = items.slice(j, j + 500);
            const batch = writeBatch(db);
            for (const item of chunk) {
                if (!item.userId) item.userId = userId;
                if (item.userId !== userId) continue; // safety check
                
                if (!item.id) item.id = uid();
                item.updatedAt = new Date().toISOString();
                
                batch.set(doc(db, key, item.id), item, { merge: true });
            }
            
  try {
     console.log("Committing batch");
     await batch.commit();
     console.log("Commit succeeded");
  } catch (e) {
     console.error("Committing batch failed:", e);
     throw e;
  }

        }
    }
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}


// ============ LICENSING ============
export interface License {
  id: string; // key
  status: 'active' | 'disabled' | 'unused';
  usedBy: string | null;
  usedByEmail: string | null;
  activatedAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface UserDoc {
  email: string;
  name: string;
  hasValidLicense: boolean;
  licenseKey: string | null;
}

export async function checkUserLicense(userId: string, email: string, name: string): Promise<boolean> {
  if (email.toLowerCase().trim() === 'itxanasn@gmail.com') return true;
  await refreshAuth();
  const docRef = doc(db, 'users', userId);
  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      try {
        await setDoc(docRef, { email, name, hasValidLicense: false, licenseKey: null });
      } catch(e) {
        console.error(e);
      }
      return false;
    }
    return docSnap.data().hasValidLicense === true;
  } catch (e) {
    console.error('getDoc users error (likely missing rules or permission denied):', e);
    return false;
  }
}

export async function activateLicense(userId: string, key: string, email: string): Promise<boolean> {
  await refreshAuth();
  const licenseRef = doc(db, 'licenses', key);
  const licenseSnap = await getDoc(licenseRef);
  
  if (!licenseSnap.exists()) throw new Error('Invalid license key');
  const licenseData = licenseSnap.data() as License;
  if (licenseData.status !== 'unused') throw new Error('License key is already used or disabled');
  
  const batch = writeBatch(db);
  batch.update(licenseRef, { status: 'active', usedBy: userId, usedByEmail: email, activatedAt: new Date().toISOString() });
  
  const userRef = doc(db, 'users', userId);
  batch.update(userRef, { hasValidLicense: true, licenseKey: key });
  
  await batch.commit();
  return true;
}

// ============ ADMIN LICENSES ============
export async function generateLicense(adminId: string): Promise<string> {
  await refreshAuth();
  // generate a key like XXXX-XXXX-XXXX-XXXX
  const generateSegment = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  const key = `${generateSegment()}-${generateSegment()}-${generateSegment()}-${generateSegment()}`;
  
  await setDoc(doc(db, 'licenses', key), {
    id: key,
    status: 'unused',
    usedBy: null,
    usedByEmail: null,
    activatedAt: null,
    createdBy: adminId,
    createdAt: new Date().toISOString()
  });
  return key;
}

export async function getAllLicenses(): Promise<License[]> {
  await refreshAuth();
  const snap = await getDocs(collection(db, 'licenses'));
  return snap.docs.map(d => d.data() as License).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function updateLicenseStatus(key: string, status: 'active' | 'disabled' | 'unused'): Promise<void> {
  await refreshAuth();
  await updateDoc(doc(db, 'licenses', key), { status });
}
