const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const licenseComponents = `
function LicenseActivation({ userId, email, onActivated }: { userId: string, email: string, onActivated: () => void }) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    if (key.length < 16) {
      toast({ title: 'Invalid Key', description: 'Please enter a valid 16-character license key.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await store.activateLicense(userId, key, email);
      toast({ title: 'Success', description: 'License activated successfully!' });
      onActivated();
    } catch (e: any) {
      toast({ title: 'Activation Failed', description: e.message || 'Invalid or already used license key', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <Card className="max-w-md w-full border-0 shadow-2xl bg-white dark:bg-gray-900 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
            <Database className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
            Activate License
          </CardTitle>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
            Enter your 16-character license key to access the application.
          </p>
        </CardHeader>
        <CardContent className="pt-6 pb-8 px-8 flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="key" className="text-sm font-medium text-gray-700 dark:text-gray-300">License Key</Label>
            <Input 
              id="key" 
              placeholder="XXXX-XXXX-XXXX-XXXX" 
              value={key} 
              onChange={e => setKey(e.target.value.toUpperCase())}
              className="text-center tracking-widest uppercase font-mono text-lg bg-gray-50/50 dark:bg-gray-800/50"
              maxLength={19}
            />
          </div>
          <Button 
            className="w-full h-12 text-md font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md transition-all duration-200"
            onClick={handleActivate} 
            disabled={loading || key.length < 16}
          >
            {loading ? 'Activating...' : 'Activate Now'}
          </Button>
          <div className="mt-4 flex justify-center">
            <Button variant="ghost" className="text-gray-500 text-sm hover:text-gray-700 dark:hover:text-gray-300" onClick={() => auth.signOut()}>
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminPanel() {
  const [licenses, setLicenses] = useState<store.License[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLicenses = async () => {
    setLoading(true);
    const data = await store.getAllLicenses();
    setLicenses(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLicenses();
  }, []);

  const handleGenerate = async () => {
    try {
      await store.generateLicense(auth.currentUser?.uid || 'admin');
      toast({ title: 'Created', description: 'New license key generated.' });
      fetchLicenses();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleStatusChange = async (key: string, newStatus: 'active' | 'disabled' | 'unused') => {
    try {
      await store.updateLicenseStatus(key, newStatus);
      toast({ title: 'Updated', description: 'License status updated.' });
      fetchLicenses();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">Admin Control Panel</h2>
          <p className="text-gray-500 mt-1">Manage system licenses and access.</p>
        </div>
        <Button onClick={handleGenerate} className="bg-indigo-600 hover:bg-indigo-700 shadow-md"><Plus className="w-4 h-4 mr-2" /> Generate License</Button>
      </div>
      
      <Card className="border-0 shadow-sm bg-white dark:bg-gray-900">
        <CardHeader className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <CardTitle>Generated Licenses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading licenses...</div>
          ) : (
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b border-gray-200 dark:border-gray-800">
                  <tr className="border-b transition-colors bg-gray-50/50 dark:bg-gray-900/50 hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <th className="h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400">License Key</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400">Used By Email</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400">CreatedAt</th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-gray-500 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0 divide-y divide-gray-100 dark:divide-gray-800">
                  {licenses.map(l => (
                    <tr key={l.id} className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                      <td className="p-4 align-middle font-mono font-medium">{l.id}</td>
                      <td className="p-4 align-middle">
                        <Badge variant="outline" className={
                          l.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          l.status === 'disabled' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400'
                        }>
                          {l.status}
                        </Badge>
                      </td>
                      <td className="p-4 align-middle text-gray-600 dark:text-gray-300">{l.usedByEmail || '-'}</td>
                      <td className="p-4 align-middle text-gray-500">{new Date(l.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 align-middle text-right">
                        {l.status === 'active' && <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleStatusChange(l.id, 'disabled')}>Disable</Button>}
                        {l.status === 'disabled' && <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={() => handleStatusChange(l.id, 'active')}>Reactivate</Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

`;

code = code.replace(/export function AppContent\(\) \{/, licenseComponents + "\nexport function AppContent() {");

fs.writeFileSync('src/App.tsx', code);
