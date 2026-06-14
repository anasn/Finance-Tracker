import { collection, writeBatch, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

export async function migrateLocalStorageToFirestore(userId: string) {
  if (localStorage.getItem('ft_migration_complete_' + userId) === 'true') {
    return;
  }

  console.log("Starting automatic migration to Firestore for user:", userId);

  const get = <T>(key: string): T[] => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };

  const collections = [
    { key: 'ft_customers', name: 'customers' },
    { key: 'ft_stock_records', name: 'stockRecords' },
    { key: 'ft_payments', name: 'payments' },
    { key: 'ft_bank_payments', name: 'bankPayments' },
    { key: 'ft_expenses', name: 'expenses' },
    { key: 'ft_purchases', name: 'purchases' },
    { key: 'ft_invoices', name: 'invoices' },
    { key: 'ft_branding', name: 'branding' }
  ];

  try {
    for (const c of collections) {
      let data = get<any>(c.key);
      if (!Array.isArray(data)) {
        if (data && typeof data === 'object') data = [data];
        else data = [];
      }
      data = data.filter((r: any) => !r.userId || r.userId === userId || r.userId === '');
      
      if (data.length === 0) continue;

      const q = query(collection(db, c.name), where('userId', '==', userId));
      const snap = await getDocs(q);
      
      // If records already exist, to prevent duplication, we skip
      if (!snap.empty && snap.size >= data.length) {
         console.log(`Collection ${c.name} already seems migrated. Skipping.`);
         continue;
      }
      
      // Firebase batch allows up to 500 writes. We chunk it if needed.
      for (let i = 0; i < data.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = data.slice(i, i + 500);
        for (const item of chunk) {
          const id = item.id || (c.name === 'branding' ? userId : crypto.randomUUID());
          const docRef = doc(db, c.name, id);
          
          if (!item.userId) item.userId = userId;

          if (!item.createdAt) item.createdAt = new Date().toISOString();
          if (!item.updatedAt) item.updatedAt = item.createdAt;
          
          batch.set(docRef, item, { merge: true });
        }
        await batch.commit();
      }
      console.log(`Migrated ${data.length} records for ${c.name}`);
    }

    localStorage.setItem('ft_migration_complete_' + userId, 'true');
    console.log("Migration complete! Local storage data safely copied to Firestore.");

  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}
