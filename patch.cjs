const fs = require('fs');
let code = fs.readFileSync('src/store.ts', 'utf8');

// Replace standard where ==
code = code.replace(/query\(\s*collection\(db,\s*'([^']+)'\),\s*where\('([^']+)',\s*'==',\s*([^)]+)\)\)/g, (match, col, field, val) => {
    if (field === 'userId') return match;
    return `query(collection(db, '${col}'), where('${field}', '==', ${val}), where('userId', '==', auth.currentUser?.uid || ''))`;
});

// Replace standard where in
code = code.replace(/query\(\s*collection\(db,\s*'([^']+)'\),\s*where\('([^']+)',\s*'in',\s*([^)]+)\)\)/g, (match, col, field, val) => {
    if (field === 'userId') return match;
    return `query(collection(db, '${col}'), where('${field}', 'in', ${val}), where('userId', '==', auth.currentUser?.uid || ''))`;
});

fs.writeFileSync('src/store.ts', code);
