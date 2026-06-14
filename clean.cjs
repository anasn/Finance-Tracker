const fs = require('fs');
let code = fs.readFileSync('src/store.ts', 'utf8');

code = code.replace(/\\s*console\\.log\\("Starting [a-zA-Z]+", id\\);/g, '');
code = code.replace(/\\s*console\\.log\\("Committing batch"\\);/g, '');
code = code.replace(/\\s*console\\.log\\("Commit succeeded"\\);/g, '');
code = code.replace(/\\s*console\\.log\\("Promise\\.all succeeded"\\);/g, '');
code = code.replace(/\\s*console\\.error\\("Committing batch failed:", e\\);/g, '');
code = code.replace(/\\s*console\\.error\\("Promise\\.all relatedQueries failed:", e\\);/g, '');
code = code.replace(/\\s*console\\.log\\('Fetching invoices for customer\\.userId:', customer\\.userId\\);/g, '');

fs.writeFileSync('src/store.ts', code);
