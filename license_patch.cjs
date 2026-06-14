const fs = require('fs');
let code = fs.readFileSync('src/store.ts', 'utf8');

// adding types and functions
const licensingCode = `

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
  if (email === 'itxanasn@gmail.com') return true;
  await refreshAuth();
  const docRef = doc(db, 'users', userId);
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
  const key = \`\${generateSegment()}-\${generateSegment()}-\${generateSegment()}-\${generateSegment()}\`;
  
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
`;

code = code + licensingCode;

fs.writeFileSync('src/store.ts', code);
