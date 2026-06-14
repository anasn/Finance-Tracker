const fs = require('fs');
let code = fs.readFileSync('src/store.ts', 'utf8');

code = code.replace(/export async function deleteCustomer\(id: string\): Promise<void> \{/g, `
export async function deleteCustomer(id: string): Promise<void> {
  console.log("Starting deleteCustomer", id);
`);

code = code.replace(/const \[stocks, payments, banks\] = await Promise\.all\(relatedQueries\);/g, `
  let stocks, payments, banks;
  try {
    [stocks, payments, banks] = await Promise.all(relatedQueries);
    console.log("Promise.all succeeded");
  } catch (e) {
    console.error("Promise.all relatedQueries failed:", e);
    throw e;
  }
`);

code = code.replace(/const invQ = await getDocs\(query\(collection\(db, 'invoices'\), where\('userId', '==', customer\.userId\)\)\);/g, `
  let invQ;
  try {
     console.log("fetching invQ");
     invQ = await getDocs(query(collection(db, 'invoices'), where('userId', '==', customer.userId), where('userId', '==', auth.currentUser?.uid || '')));
     console.log("fetching invQ succeeded");
  } catch(e) {
     console.error("fetching invQ failed:", e);
     throw e;
  }
`);

code = code.replace(/await batch\.commit\(\);/g, `
  try {
     console.log("Committing batch");
     await batch.commit();
     console.log("Commit succeeded");
  } catch (e) {
     console.error("Committing batch failed:", e);
     throw e;
  }
`);

fs.writeFileSync('src/store.ts', code);
