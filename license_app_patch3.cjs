const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// if user is not logged in: show login screen
// if user is logged in:
//   if isLicenseLoading: show loading screen
//   if user.email === admin and activeTab === 'admin': show AdminPanel
//   if !hasLicense: show LicenseActivation screen
//   else: show normal dashboard

// We'll replace the main application render area. 
// Let's find "if (!isLoggedIn) {" mapping and modify it.

let newCode = code.replace(
  /if \(!isLoggedIn\) \{[\s\S]*?<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">/,
  `if (!isLoggedIn) {
    if (authMode === 'login') return <LoginScreen onSignup={() => setAuthMode('signup')} onForgot={() => setAuthMode('forgot')} />;
    if (authMode === 'signup') return <SignupScreen onLogin={() => setAuthMode('login')} />;
    if (authMode === 'forgot') return <ForgotPasswordScreen onBack={() => setAuthMode('login')} />;
  }

  if (isLicenseLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium">Verifying License...</p>
      </div>
    </div>;
  }

  if (!hasLicense && user?.email !== 'itxanasn@gmail.com') {
    return <LicenseActivation userId={user!.id} email={user!.email} onActivated={() => setHasLicense(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">`
);

// We need to add "Admin" tab to navItems.
// "const navItems =" is somewhere in the component. We can just dynamically append it.
newCode = newCode.replace(
  /<div className="w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col h-screen fixed md:relative z-20">/,
  `{user?.email === 'itxanasn@gmail.com' && !navItems.find(n => n.id === 'admin') && navItems.push({ id: 'admin', label: 'Admin Panel', icon: Database })}
      <div className="w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col h-screen fixed md:relative z-20">`
);

// We need to render the contents for activeTab == 'admin'
newCode = newCode.replace(
  /\{activeTab === 'dashboard' && \(/,
  `{activeTab === 'admin' && user?.email === 'itxanasn@gmail.com' && (
                <AdminPanel />
              )}
              {activeTab === 'dashboard' && (`
);

fs.writeFileSync('src/App.tsx', newCode);
