const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const licenseStateCode = `
  const [hasLicense, setHasLicense] = useState(false);
  const [isLicenseLoading, setIsLicenseLoading] = useState(true);

  useEffect(() => {
    if (isLoggedIn && user) {
      if (user.email === 'itxanasn@gmail.com') {
         setHasLicense(true);
         setIsLicenseLoading(false);
         return;
      }
      setIsLicenseLoading(true);
      store.checkUserLicense(user.id, user.email, user.name)
        .then((valid) => {
           setHasLicense(valid);
        })
        .catch((e) => {
           setHasLicense(false);
           toast({ title: 'Error', description: 'Failed to verify license.', variant: 'destructive' });
        })
        .finally(() => {
           setIsLicenseLoading(false);
        });
    } else {
       setHasLicense(false);
       setIsLicenseLoading(false);
    }
  }, [isLoggedIn, user]);
`;

code = code.replace(/const \[authMode, setAuthMode\] = useState<'login' \| 'signup' \| 'forgot'>\('login'\);/, "const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');\n" + licenseStateCode);

fs.writeFileSync('src/App.tsx', code);
