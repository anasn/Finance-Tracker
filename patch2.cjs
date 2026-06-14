const fs = require('fs');
let code = fs.readFileSync('src/store.ts', 'utf8');

// replace getDocs around invoices with a console log
code = code.replace(/const invQ = await getDocs\(query\(collection\(db, 'invoices'\), where\('userId', '==', customer\.userId\)\)\);/g, `
console.log('Fetching invoices for customer.userId:', customer.userId);
const invQ = await getDocs(query(collection(db, 'invoices'), where('userId', '==', customer.userId), where('userId', '==', auth.currentUser?.uid || '')));
`);

fs.writeFileSync('src/store.ts', code);
