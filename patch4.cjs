const fs = require('fs');
let code = fs.readFileSync('src/store.ts', 'utf8');

const functionsToPatch = [
  'deleteStockRecord', 'deletePayment', 'deleteBankPayment', 'deleteExpense', 'deletePurchase', 'deleteInvoice'
];

functionsToPatch.forEach(fn => {
  const regex = new RegExp(`export async function ${fn}\\(id: string\\): Promise<void> \\{`, 'g');
  code = code.replace(regex, `export async function ${fn}(id: string): Promise<void> {\n  console.log("Starting ${fn}", id);`);
});

fs.writeFileSync('src/store.ts', code);
