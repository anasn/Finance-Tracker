const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/user\.email === 'itxanasn@gmail\.com'/g, "user.email.toLowerCase().trim() === 'itxanasn@gmail.com'");
code = code.replace(/user\?\.email === 'itxanasn@gmail\.com'/g, "user?.email?.toLowerCase().trim() === 'itxanasn@gmail.com'");
code = code.replace(/user\?\.email !== 'itxanasn@gmail\.com'/g, "user?.email?.toLowerCase().trim() !== 'itxanasn@gmail.com'");

fs.writeFileSync('src/App.tsx', code);

let storeCode = fs.readFileSync('src/store.ts', 'utf8');
storeCode = storeCode.replace(/email === 'itxanasn@gmail\.com'/g, "email.toLowerCase().trim() === 'itxanasn@gmail.com'");
fs.writeFileSync('src/store.ts', storeCode);
