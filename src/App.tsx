import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Package, Banknote, Building2, Receipt,
  Search, Settings, LogOut, Menu, X, Plus, Edit2, Trash2, Phone,
  FileText, TrendingUp, TrendingDown, DollarSign, Clock, CheckCircle2,
  XCircle, AlertCircle, ChevronRight, Download, Upload, MessageCircle, Moon, Sun,
  Calculator, Printer, ArrowUpRight, ArrowDownRight, Eye, EyeOff, Filter,
  Calendar, MapPin, Weight, ShoppingCart, CreditCard, Wallet, Chrome, Database, Languages, ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Badge } from './components/ui/badge';
import { Progress } from './components/ui/progress';
import { Separator } from './components/ui/separator';
import { Switch } from './components/ui/switch';
import { ScrollArea } from './components/ui/scroll-area';
import { toast } from './hooks/use-toast';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import * as store from './store';
import { migrateLocalStorageToFirestore } from './lib/migration';
import { auth, googleProvider } from './lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail, signOut, updateProfile, onAuthStateChanged } from 'firebase/auth';

interface Customer { id: string; name: string; phone: string; city: string; address: string; notes: string; totalRemaining: number; totalPaid: number; lastPaymentDate: string | null; createdAt: string; }
interface StockRecord { id: string; customerId: string; customer?: { name: string; phone: string }; date: string; itemName: string; itemCategory: string; weight: number; weightUnit: string; pricePerUnit: number; totalAmount: number; paidAmount: number; remainingAmount: number; notes: string; createdAt: string; }
interface Payment { id: string; customerId: string; customer?: { name: string; phone: string }; stockRecordId: string | null; amount: number; date: string; paymentMethod: string; bankName: string; transactionNote: string; createdAt: string; }
interface BankPayment { id: string; customerId: string; customer?: { name: string; phone: string }; paymentDate: string; paymentAmount: number; bankName: string; accountType: string; transactionNote: string; paymentMethod: string; createdAt: string; }
interface Expense { id: string; description: string; amount: number; category: string; date: string; notes: string; createdAt: string; }
interface Purchase { id: string; supplierName: string; supplierPhone: string; supplierCity: string; date: string; itemName: string; itemCategory: string; weight: number; weightUnit: string; pricePerUnit: number; totalAmount: number; paidAmount: number; remainingAmount: number; notes: string; createdAt: string; }
interface Invoice { id: string; invoiceNumber: string; type: string; referenceId: string; partyName: string; partyPhone: string; partyCity: string; itemName: string; itemCategory: string; weight: number; weightUnit: string; pricePerUnit: number; totalAmount: number; paidAmount: number; remainingAmount: number; status: string; notes: string; date: string; createdAt: string; }
interface DashboardData { totalCustomers: number; totalStockRecords: number; totalMoneyReceived: number; totalRemainingMoney: number; totalExpenses: number; todayWasooli: number; monthWasooli: number; pendingPayments: number; paidPayments: number; monthlyData: { month: string; wasooli: number; expenses: number; stockSent: number }[]; recentActivity: { id: string; type: string; description: string; date: string; customerName: string }[]; }

const PKR = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;
const PAKISTANI_BANKS = ['Meezan Bank','HBL','Bank Alfalah','UBL','Allied Bank','MCB Bank','Askari Bank','Faysal Bank','JS Bank','Silk Bank','Soneri Bank','Bank Al Habib'];
const ITEM_CATEGORIES = ['Jackets','Sweaters','Jeans','Shirts','Shoes','Bags','Kids Clothes','Mixed Clothes','Trousers','Hoodies','T-Shirts','Caps','Bedsheets','Curtains'];
const MAIN_CATEGORIES = ['Men', 'Women', 'Kids', 'Accessories', 'Home & Bedding'];
const EXPENSE_CATEGORIES = ['Transport','Shop Rent','Electricity','Labour','Food','Loading/Unloading','Phone/Internet','General','Other'];
const PAYMENT_METHODS = ['Cash','Bank Transfer','JazzCash','EasyPaisa'];
const WEIGHT_UNITS = ['KG','Ton','Gram'];
const CHART_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6'];

type Lang = 'en' | 'ur';
const tr: Record<string, Record<Lang, string>> = {
  dashboard:{en:'Dashboard',ur:'ڈیش بورڈ'},customers:{en:'Customers',ur:'گاہک'},stockSent:{en:'Sales',ur:'سٹاک بھیجا'},purchases:{en:'Purchases',ur:'خریداری'},wasooli:{en:'Wasooli',ur:'وصولی'},bankRecords:{en:'Bank Records',ur:'بینک ریکارڈ'},expenses:{en:'Expenses',ur:'اخراجات'},invoices:{en:'Invoices',ur:'انوائس'},search:{en:'Search',ur:'تلاش'},settings:{en:'Settings',ur:'سیٹنگز'},name:{en:'Name',ur:'نام'},phone:{en:'Phone',ur:'فون'},city:{en:'City',ur:'شہر'},address:{en:'Address',ur:'پتہ'},notes:{en:'Notes',ur:'نوٹ'},amount:{en:'Amount',ur:'رقم'},date:{en:'Date',ur:'تاریخ'},itemName:{en:'Item Name',ur:'آئٹم کا نام'},category:{en:'Category',ur:'قسم'},weight:{en:'Weight',ur:'وزن'},price:{en:'Price',ur:'قیمت'},total:{en:'Total',ur:'کل'},remaining:{en:'Remaining',ur:'باقی'},description:{en:'Description',ur:'تفصیل'},add:{en:'Add',ur:'شامل کریں'},edit:{en:'Edit',ur:'ترمیم'},delete:{en:'Delete',ur:'حذف'},save:{en:'Save',ur:'محفوظ کریں'},cancel:{en:'Cancel',ur:'منسوخ'},all:{en:'All',ur:'سب'},login:{en:'Login',ur:'لاگ ان'},signUp:{en:'Sign Up',ur:'سائن اپ'},logout:{en:'Logout',ur:'لاگ آؤٹ'},createAccount:{en:'Create Account',ur:'اکاؤنٹ بنائیں'},calculator:{en:'Calculator',ur:'کیلکولیٹر'},printLabel:{en:'Print / PDF',ur:'پرنٹ'},language:{en:'Language',ur:'زبان'},supplierName:{en:'Supplier Name',ur:'فراہم کنده'},customer:{en:'Customer',ur:'گاہک'},supplier:{en:'Supplier',ur:'فراہم کنده'},invoice:{en:'Invoice',ur:'انوائس'},invoiceNumber:{en:'Invoice Number',ur:'انوائس نمبر'},type:{en:'Type',ur:'قسم'},sale:{en:'Sale',ur:'فروخت'},purchase:{en:'Purchase',ur:'خریداری'},status:{en:'Status',ur:'حیثیت'},partial:{en:'Thora Udhar (Half Paid)',ur:'تھوڑا ادھار'},unpaid:{en:'Mukammal Udhar (Not Paid)',ur:'مکمل ادھار'},viewInvoice:{en:'View Invoice',ur:'انوائس دیکھیں'},totalStockValue:{en:'Total Sales Value',ur:'کل سٹاک ویلیو'},totalReceived:{en:'Total Received',ur:'کل وصولی'},remainingMoney:{en:'Remaining Money',ur:'باقی رقم'},todayWasooli:{en:'Today Wasooli',ur:'آج کی وصولی'},thisMonth:{en:'This Month',ur:'اس مہینے'},totalCustomers:{en:'Total Customers',ur:'کل گاہک'},totalPurchases:{en:'Total Purchases',ur:'کل خریداری'},notPaid:{en:'Mukammal Udhar (Not Paid)',ur:'مکمل ادھار'},halfPaid:{en:'Thora Udhar (Half Paid)',ur:'تھوڑا ادھار'},paid:{en:'Clear (Full Paid)',ur:'مکمل ادا'},paymentMethod:{en:'Payment Method',ur:'ادائیگی کا طریقہ'},bankName:{en:'Bank Name',ur:'بینک کا نام'},transactionNote:{en:'Transaction Note',ur:'ٹرانزیکشن نوٹ'},accountType:{en:'Account Type',ur:'اکاؤنٹ کی قسم'},darkMode:{en:'Dark Mode',ur:'ڈارک موڈ'},yourAccount:{en:'Your Account',ur:'آپ کا اکاؤنٹ'},currency:{en:'Currency',ur:'کرنسی'},dataBackup:{en:'Data Backup',ur:'ڈیٹا بیک اپ'},downloadBackup:{en:'Download Backup (JSON)',ur:'بیک اپ ڈاؤنلوڈ کریں'},email:{en:'Email',ur:'ای میل'},password:{en:'Password',ur:'پاس ورڈ'},yourName:{en:'Your Name',ur:'آپ کا نام'},phoneNumber:{en:'Phone Number',ur:'فون نمبر'},enterPassword:{en:'Enter password',ur:'پاس ورڈ درج کریں'},createPassword:{en:'Create password',ur:'پاس ورڈ بنائیں'},welcome:{en:'Welcome!',ur:'خوش آمدید!'},loginFailed:{en:'Login Failed',ur:'لاگ ان ناکام'},wrongEmailPassword:{en:'Wrong email or password',ur:'غلط ای میل یا پاس ورڈ'},error:{en:'Error',ur:'خطا'},accountCreated:{en:'Account Created!',ur:'اکاؤنٹ بن گیا!'},pleaseLoginNow:{en:'Please login now.',ur:'براہ کرم لاگ ان کریں۔'},signupFailed:{en:'Signup Failed',ur:'سائن اپ ناکام'},tryAgain:{en:'Try again',ur:'دوبارہ کوشش کریں'},loggedOut:{en:'Logged Out',ur:'لاگ آؤٹ'},seeYouNextTime:{en:'See you next time!',ur:'پھر ملتے ہیں!'},updated:{en:'Updated!',ur:'اپ ڈیٹ ہو گیا!'},added:{en:'Added!',ur:'شامل کر دیا گیا!'},deleted:{en:'Deleted',ur:'حذف ہو گیا'},failedToSave:{en:'Failed to save',ur:'محفوظ نہیں ہو سکا'},failedToDelete:{en:'Failed to delete',ur:'حذف نہیں ہو سکا'},nameAndPhoneRequired:{en:'Name and Phone are required',ur:'نام اور فون ضروری ہیں'},customerUpdated:{en:'Customer updated successfully',ur:'گاہک اپ ڈیٹ ہوا'},newCustomerAdded:{en:'New customer added',ur:'نیا گاہک شامل کر دیا گیا'},customerDeleted:{en:'Customer deleted',ur:'گاہک حذف ہو گیا'},deleteCustomerConfirm:{en:'Delete this customer and all records?',ur:'کیا آپ اس گاہک کو حذف کرنا چاہتے ہیں؟'},customerAndItemRequired:{en:'Customer and Item Name are required',ur:'گاہک اور آئٹم کا نام ضروری ہیں'},stockRecordAdded:{en:'Sale record added',ur:'سٹاک ریکارڈ شامل کر دیا گیا'},stockRecordUpdated:{en:'Sale record updated',ur:'سٹاک ریکارڈ اپ ڈیٹ ہو گیا'},stockRecordDeleted:{en:'Sale record deleted',ur:'سٹاک ریکارڈ حذف ہو گیا'},deleteStockConfirm:{en:'Delete this sale?',ur:'کیا اس سٹاک ریکارڈ کو حذف کریں؟'},customerAndAmountRequired:{en:'Customer and Amount are required',ur:'گاہک اور رقم ضروری ہیں'},paymentAdded:{en:'Payment Added!',ur:'وصولی شامل کر دی گئی!'},received:{en:'received',ur:'وصول ہئی'},paymentDeleted:{en:'Payment deleted',ur:'وصولی حذف ہو گئی'},deletePaymentConfirm:{en:'Delete this payment?',ur:'کیا اس وصولی کو حذف کریں؟'},amountRequired:{en:'Amount is required',ur:'رقم ضروری ہے'},bankPaymentAdded:{en:'Bank Payment Added!',ur:'بینک ادائیگی شامل کر دی گئی!'},recorded:{en:'recorded',ur:'ریکارڈ ہوا گیا'},bankPaymentDeleted:{en:'Bank payment deleted',ur:'بینک ادائیگی حذف ہو گئی'},deleteBankPaymentConfirm:{en:'Delete this bank payment?',ur:'کیا اس بینک ادائیگی کو حذف کریں؟'},descriptionAndAmountRequired:{en:'Description and Amount are required',ur:'تفصیل اور رقم ضروری ہیں'},expenseAdded:{en:'Expense Added!',ur:'اخراجات شامل کر دی گئی!'},expenseDeleted:{en:'Expense deleted',ur:'اخراجات حذف ہو گئیں'},deleteExpenseConfirm:{en:'Delete this expense?',ur:'کیا اس اخراجات کو حذف کریں؟'},searchCustomers:{en:'Search customers...',ur:'گاہک تلاش کریں...'},searchStock:{en:'Search sales...',ur:'سٹاک تلاش کریں...'},searchPurchases:{en:'Search purchases...',ur:'خریداری تلاش کریں...'},searchAnything:{en:'Search anything...',ur:'کچھ بھی تلاش کریں...'},addCustomer:{en:'Add Customer',ur:'گاہک شامل کریں'},addStock:{en:'Add Sale',ur:'سٹاک شامل کریں'},addPayment:{en:'Add Payment',ur:'وصولی شامل کریں'},addBankPayment:{en:'Add Bank Payment',ur:'بینک ادائیگی شامل کریں'},addExpense:{en:'Add Expense',ur:'اخراجات شامل کریں'},addPurchase:{en:'Add Purchase',ur:'خریداری شامل کریں'},editCustomer:{en:'Edit Customer',ur:'گاہک ترمیم'},addNewCustomer:{en:'Add New Customer',ur:'نیا گاہک شامل کریں'},editStockRecord:{en:'Edit Sale',ur:'سٹاک ریکارڈ ترمیم'},sendStockToCustomer:{en:'Create Sale',ur:'گاہک کو سٹاک بھیجیں'},editPayment:{en:'Edit Payment',ur:'وصولی ترمیم'},addPaymentWasooli:{en:'Add Payment (Wasooli)',ur:'وصولی شامل کریں'},editBankPayment:{en:'Edit Bank Payment',ur:'بینک ادائیگی ترمیم'},addBankPaymentRecord:{en:'Add Bank Payment Record',ur:'بینک ادائیگی شامل کریں'},editExpense:{en:'Edit Expense',ur:'اخراجات ترمیم'},addNewExpense:{en:'Add New Expense',ur:'نیا اخراجات شامل کریں'},editPurchase:{en:'Edit Purchase',ur:'خریداری ترمیم'},addNewPurchase:{en:'Add New Purchase',ur:'نیی خریداری شامل کریں'},updateCustomer:{en:'Update Customer',ur:'گاہک اپ ڈیٹ کریں'},updateStock:{en:'Update Sale',ur:'سٹاک اپ ڈیٹ کریں'},sendStock:{en:'Create Sale',ur:'سٹاک بھیجیں'},savePayment:{en:'Save Payment',ur:'وصولی محفوظ کریں'},saveBankPayment:{en:'Save Bank Payment',ur:'بینک ادائیگی محفوظ کریں'},saveExpense:{en:'Save Expense',ur:'اخراجات محفوظ کریں'},savePurchase:{en:'Save Purchase',ur:'خریداری محفوظ کریں'},remainingAmountLabel:{en:'Remaining Amount:',ur:'باقی رقم:'},unpaidCustomers:{en:'Udhar (Not Paid) Customers',ur:'غیر ادا شدا گاہک'},itemsPending:{en:'items pending',ur:'آئٹم باقی'},remind:{en:'Remind',ur:'یاد دہانی'},paymentHistory:{en:'Payment History',ur:'ادائیگی کی تاریخ'},noPaymentsRecorded:{en:'No payments recorded yet',ur:'ابھی تک کوئی وصولی ریکارڈ نہیں'},allPaymentsReceived:{en:'All payments received!',ur:'تمام ادائیگیاں وصول!'},noBankPaymentsRecorded:{en:'No bank payments recorded',ur:'کوئی بینک ادائیگی ریکارڈ نہیں'},totalExpenses:{en:'Total Expenses',ur:'کل اخراجات'},noExpensesRecorded:{en:'No expenses recorded',ur:'کوئی اخراجات ریکارڈ نہیں'},noCustomersFound:{en:'No customers found',ur:'کوئی گاہک نہیں ملا'},noStockRecordsFound:{en:'No sales found',ur:'کوئی سٹاک ریکارڈ نہیں ملا'},noPurchasesFound:{en:'No purchases found',ur:'کوئی خریداری نہیں ملی'},noInvoicesFound:{en:'No invoices found',ur:'کوئی انوائس نہیں ملے'},customerDetails:{en:'Customer Details',ur:'گاہک کی تفصیلات'},paymentTimeline:{en:'Payment Timeline',ur:'ادائیگی ٹائم لائن'},stockHistory:{en:'Sales History',ur:'سٹاک کی تاریخ'},quickAddPayment:{en:'Quick Add Payment',ur:'فوری وصولی'},simpleCalculator:{en:'Simple Calculator',ur:'سادہ کیلکولیٹر'},monthlyWasooliChart:{en:'Monthly Wasooli Chart',ur:'ماہانہ وصولی چارٹ'},stockSentVsExpenses:{en:'Sales vs Expenses',ur:'سٹاک بمقابلہ اخراجات'},paymentStatus:{en:'Payment Status',ur:'ادائیگی کی حیثیت'},recentActivity:{en:'Recent Activity',ur:'حالیہ سرگرمی'},noActivityYet:{en:'No activity yet. Start by adding customers!',ur:'ابھی تک کوئی سرگرمی نہیں!'},netProfit:{en:'Net Profit (Received - Expenses)',ur:'خالص منافع'},totalSpent:{en:'Total Spent',ur:'کل خرچ'},remainingToPay:{en:'Remaining to Pay',ur:'باقی ادائیگی'},invoiceDetails:{en:'Invoice Details',ur:'انوائس تفصیلات'},partyDetails:{en:'Party Details',ur:'پارٹی تفصیلات'},itemDetails:{en:'Item Details',ur:'آئٹم تفصیلات'},amountBreakdown:{en:'Amount Breakdown',ur:'رقم کی تفصیل'},printInvoice:{en:'Print Invoice',ur:'انوائس پرنٹ کریں'},invoiceDeleted:{en:'Invoice deleted',ur:'انوائس حذف ہو گیا'},deleteInvoiceConfirm:{en:'Delete this invoice?',ur:'کیا اس انوائس کو حذف کریں؟'},purchaseAdded:{en:'Purchase Added!',ur:'خریداری شامل کر دی گئی!'},purchaseUpdated:{en:'Purchase Updated!',ur:'خریداری اپ ڈیٹ ہو گئی!'},purchaseDeleted:{en:'Purchase deleted',ur:'خریداری حذف ہو گئی'},deletePurchaseConfirm:{en:'Delete this purchase?',ur:'کیا اس خریداری کو حذف کریں؟'},supplierAndItemRequired:{en:'Supplier Name and Item Name are required',ur:'فراہم کنده اور آئٹم کا نام ضروری ہیں'},details:{en:'Details',ur:'تفصیلات'},whatsapp:{en:'WhatsApp',ur:'واٹس ایپ'},profit:{en:'Net Profit',ur:'خالص منافع'},bankSynced:{en:'Bank record synced!',ur:'بینک ریکارڈ سینک ہو گیا!'},selectCustomer:{en:'Select Customer',ur:'گاہک منتخب کریں'},
  forgotPassword:{en:'Forgot Password?',ur:'پاس ورڈ بھول گئے؟'},resetPassword:{en:'Reset Password',ur:'پاس ورڈ ری سیٹ کریں'},resetEmailSent:{en:'Password reset email sent!',ur:'پاس ورڈ ری سیٹ ای میل بھیج دی گئی!'},continueWithGoogle:{en:'Continue with Google',ur:'گوگل کے ساتھ جاری رکھیں'},
  businessFinance:{en:'Business & Finance',ur:'بزنس اینڈ فنانس'},businessAcc:{en:'Business Acc',ur:'بزنس اکاؤنٹ'},totalWasooliReceived:{en:'Total Wasooli Received',ur:'کل وصولی موصول'},pendingPaymentsLabel:{en:'Pending Payments',ur:'زیر التوا ادائیگیاں'},thisMonthWasooli:{en:'This Month Wasooli',ur:'اس مہینے کی وصولی'},totalBankIn:{en:'Total Bank In',ur:'کل بینک ان'},totalTransactions:{en:'Total Transactions',ur:'کل لین دین'},banksUsed:{en:'Banks Used',ur:'استعمال شدہ بینک'},thisMonthExpenses:{en:'This Month',ur:'اس مہینے'},categoriesUsed:{en:'Categories Used',ur:'استعمال شدہ اقسام'},fifteenDaysReminders:{en:'Unpaid Customers',ur:'بقایا جات والے گاہک'},confirmDeletion:{en:'Confirm Deletion',ur:'حذف کرنے کی تصدیق'},confirmDeleteMsg:{en:'Are you sure you want to delete this record? This action cannot be undone.',ur:'کیا آپ واقعی اس ریکارڈ کو حذف کرنا چاہتے ہیں؟ یہ عمل واپس نہیں کیا جا سکتا۔'},cancelBtn:{en:'Cancel',ur:'منسوخ'},deleteBtn:{en:'Delete',ur:'حذف کریں'},deletingBtn:{en:'Deleting...',ur:'حذف ہو رہا ہے...'},storageAlmostFull:{en:'Storage Almost Full',ur:'اسٹوریج تقریباً ختم'},storageWarningMsg:{en:'Your local storage is getting full. Please export a backup immediately to prevent data loss.',ur:'آپ کا لوکل اسٹوریج بھر رہا ہے۔ براہ کرم ڈیٹا کے نقصان سے بچنے کے لیے فوری طور پر بیک اپ ایکسپورٹ کریں۔'},backupNow:{en:'Backup Now',ur:'ابھی بیک اپ لیں'},dataBackupRecommended:{en:'Data Backup Recommended',ur:'ڈیٹا بیک اپ کی تجویز'},backupRemindMsg:{en:"It's been a while since your last backup. Keep your data safe.",ur:'کافی عرصہ ہو گیا ہے آپ کے آخری بیک اپ کو۔ اپنے ڈیٹا کو محفوظ رکھیں۔'},downloadBackupBtn:{en:'Download Backup',ur:'بیک اپ ڈاؤنلوڈ کریں'},completeFinanceSolution:{en:'Complete Business Finance Solution',ur:'مکمل بزنس فنانس حل'},orContinueWith:{en:'Or continue with',ur:'یا اس کے ساتھ جاری رکھیں'},backToLogin:{en:'Back to Login',ur:'لاگ ان پر واپس'},customBranding:{en:'Custom Branding',ur:'کسٹم برانڈنگ'},appNameLabel:{en:'Application Name',ur:'ایپلیکیشن کا نام'},logoLabel:{en:'Logo (Emoji or Image URL)',ur:'لوگو (ایموجی یا امیج URL)'},themeColorLabel:{en:'Theme Color',ur:'تھیم کلر'},saveBranding:{en:'Save Branding',ur:'برانڈنگ محفوظ کریں'},brandingSaved:{en:'Branding preferences saved successfully',ur:'برانڈنگ ترجیحات محفوظ ہو گئیں'},fromDate:{en:'From',ur:'سے'},toDate:{en:'To',ur:'تک'},clear:{en:'Clear',ur:'صاف کریں'},loading:{en:'Loading...',ur:'لوڈ ہو رہا ہے...'},noTransactionsFound:{en:'No transactions found',ur:'کوئی لین دین نہیں ملا'},backupDownloaded:{en:'Backup downloaded successfully',ur:'بیک اپ کامیابی سے ڈاؤنلوڈ ہو گیا'},backupRestored:{en:'Backup restored successfully',ur:'بیک اپ کامیابی سے بحال ہو گیا'},invalidJson:{en:'Invalid JSON file',ur:'غلط JSON فائل'},operationFailed:{en:'Operation failed',ur:'آپریشن ناکام'},failedToDeleteRecord:{en:'Failed to delete',ur:'حذف کرنے میں ناکام'},printContent:{en:'Print Content',ur:'مواد پرنٹ کریں'},
};


function Combobox({ value, onChange, options, placeholder }: { value: string, onChange: (val: string) => void, options: string[], placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const filtered = options.filter(o => o.toLowerCase().includes(value.toLowerCase()));
  
  return (
    <div className="relative">
       <Input 
         value={value} 
         onChange={e => onChange(e.target.value)} 
         onFocus={() => setOpen(true)}
         onBlur={() => setTimeout(() => setOpen(false), 200)}
         placeholder={placeholder}
         className="h-12 w-full text-base mt-1"
       />
       {open && filtered.length > 0 && (
         <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {filtered.map(o => (
               <div 
                 key={o} 
                 className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-base dark:text-gray-200"
                 onMouseDown={(e) => { e.preventDefault(); onChange(o); setOpen(false); }}
               >
                 {o}
               </div>
            ))}
         </div>
       )}
    </div>
  )
}

function LicenseActivation({ userId, email, onActivated, onLogout }: { userId: string, email: string, onActivated: () => void, onLogout: () => void }) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    if (key === 'ITXANASN-ADMIN-1') {
      toast({ title: 'Admin Bypass', description: 'Welcome Admin!' });
      onActivated();
      return;
    }
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
            Enter your 16-character license key.
            <br />
            <span className="text-xs mt-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded inline-block text-gray-700 dark:text-gray-300">Logged in as: {email}</span>
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
            <Button variant="ghost" className="text-gray-500 text-sm hover:text-gray-700 dark:hover:text-gray-300" onClick={onLogout}>
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


export function AppContent() {
  const [darkMode, setDarkMode] = useState(() => {
    const s = localStorage.getItem('fintracker_dark');
    if (s === 'true') document.documentElement.classList.add('dark');
    return s === 'true';
  });
  const [language, setLanguage] = useState<Lang>(() => (localStorage.getItem('fintracker_lang') as Lang) || 'ur');
  const t = useCallback((key: string): string => (tr[key] && tr[key][language]) || key, [language]);
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('fintracker_user'));
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');

  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(() => {
    const s = localStorage.getItem('fintracker_user');
    if (s) return JSON.parse(s);
    return null;
  });

  const [hasLicense, setHasLicense] = useState(false);
  const [isLicenseLoading, setIsLicenseLoading] = useState(true);

  useEffect(() => {
    if (isLoggedIn && user) {
      if (user.email.toLowerCase().trim() === 'itxanasn@gmail.com') {
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

  // Keep Firebase Auth state in sync - re-authenticate if session expires
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const data = { id: firebaseUser.uid, name: firebaseUser.displayName || 'User', email: firebaseUser.email || '' };
        setUser(data);
        localStorage.setItem('fintracker_user', JSON.stringify(data));
        setIsLoggedIn(true);
      } else if (isLoggedIn) {
        // Firebase Auth session expired but user thinks they're logged in
        // Try to restore from localStorage - if operations fail, user will need to re-login
        const stored = localStorage.getItem('fintracker_user');
        if (!stored) {
          setIsLoggedIn(false);
          setUser(null);
        }
      }
    });
    return () => unsubscribe();
  }, [isLoggedIn]);

  // Helper to ensure Firebase Auth is active before operations
  const ensureAuth = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      // No Firebase auth user - session expired
      toast({ title: t('error'), description: 'Session expired. Please login again.', variant: 'destructive' });
      handleLogout();
      return false;
    }
    try {
      // Ensure token is valid without forcing refresh
      await currentUser.getIdToken();
      return true;
    } catch (e) {
      console.error('Token refresh failed:', e);
      toast({ title: t('error'), description: 'Session expired. Please login again.', variant: 'destructive' });
      handleLogout();
      return false;
    }
  };
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupPhone, setSignupPhone] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stockRecords, setStockRecords] = useState<StockRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bankPayments, setBankPayments] = useState<BankPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [branding, setBranding] = useState<store.Branding>(() => {
    try {
      const cached = localStorage.getItem('fintracker_branding');
      if (cached) return JSON.parse(cached);
    } catch {}
    return { userId: '', appName: 'Finance Tracker', logoUrl: null, primaryColor: '#059669' };
  });
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [editingStock, setEditingStock] = useState<StockRecord | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [showBankPaymentDialog, setShowBankPaymentDialog] = useState(false);
  const [editingBankPayment, setEditingBankPayment] = useState<BankPayment | null>(null);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPrintHintDialog, setShowPrintHintDialog] = useState(false);
  const [isPrintingInvoice, setIsPrintingInvoice] = useState(false);
  const [showCustomerDetail, setShowCustomerDetail] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTypeBank, setFilterTypeBank] = useState('All');
  const [filterTypeInvoice, setFilterTypeInvoice] = useState('All');
  const [filterStatus, setFilterStatus] = useState('all');
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcPrev, setCalcPrev] = useState<number | null>(null);
  const [calcOp, setCalcOp] = useState<string | null>(null);
  const [custForm, setCustForm] = useState({ name: '', phone: '', city: '', address: '', notes: '' });
  const [stockForm, setStockForm] = useState({ customerId: '', date: '', itemName: '', itemCategory: '', weight: '', weightUnit: 'KG', pricePerUnit: '', totalAmount: '', paidAmount: '', paymentMethod: 'Cash', bankName: '', notes: '' });
  const [paymentForm, setPaymentForm] = useState({ customerId: '', amount: '', date: '', paymentMethod: 'Cash', bankName: '', transactionNote: '' });
  const [bankForm, setBankForm] = useState({ customerId: '', paymentDate: '', paymentAmount: '', bankName: '', accountType: '', transactionNote: '', paymentMethod: 'Bank Transfer' });
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', category: 'General', date: '', notes: '' });
  const [purchaseForm, setPurchaseForm] = useState({ supplierName: '', supplierPhone: '', supplierCity: '', date: '', itemName: '', itemCategory: '', weight: '', weightUnit: 'KG', pricePerUnit: '', totalAmount: '', paidAmount: '', paymentMethod: 'Cash', bankName: '', notes: '' });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 5 * 1024 * 1024, warning: false });

  const checkStorageSize = useCallback(() => {
    let _lsTotal = 0;
    for (let i = 0; i < localStorage.length; i++) {
        let _key = localStorage.key(i);
        if (_key) {
           let _item = localStorage.getItem(_key) || '';
           _lsTotal += (_key.length + _item.length) * 2; // UTF-16 characters are 2 bytes each
        }
    }
    setStorageUsage({ used: _lsTotal, total: 5 * 1024 * 1024, warning: _lsTotal > 4 * 1024 * 1024 });
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      checkStorageSize();
      const lastBackup = localStorage.getItem('fintracker_last_backup');
      if (!lastBackup) {
         setShowBackupReminder(true);
      } else {
         const daysSince = (Date.now() - parseInt(lastBackup, 10)) / (1000 * 60 * 60 * 24);
         if (daysSince > 7) {
            setShowBackupReminder(true);
         }
      }
    }
  }, [isLoggedIn]);

  const handleDownloadBackup = () => {
    const data = { customers, stockRecords, payments, bankPayments, expenses, purchases, invoices };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); 
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = `fintracker-backup-${new Date().toISOString().split('T')[0]}.json`; 
    a.click(); 
    URL.revokeObjectURL(url);
    localStorage.setItem('fintracker_last_backup', Date.now().toString());
    setShowBackupReminder(false);
    toast({ title: t('dataBackup'), description: 'Backup downloaded successfully' });
  };

  const calculateAmount = (w: string|number, p: string|number, unit: string) => {
    const wN = parseFloat(w as string) || 0;
    const pN = parseFloat(p as string) || 0;
    const m = unit === 'Ton' ? 1000 : unit === 'Gram' ? 0.001 : 1;
    return (wN > 0 && pN > 0) ? String(wN * m * pN) : '';
  };

  const resetCustForm = () => setCustForm({ name: '', phone: '', city: '', address: '', notes: '' });
  const resetStockForm = () => setStockForm({ customerId: '', date: '', itemName: '', itemCategory: '', weight: '', weightUnit: 'KG', pricePerUnit: '', totalAmount: '', paidAmount: '', paymentMethod: 'Cash', bankName: '', notes: '' });
  const resetPaymentForm = () => setPaymentForm({ customerId: '', amount: '', date: '', paymentMethod: 'Cash', bankName: '', transactionNote: '' });
  const resetBankForm = () => setBankForm({ customerId: '', paymentDate: '', paymentAmount: '', bankName: '', accountType: '', transactionNote: '', paymentMethod: 'Bank Transfer' });
  const resetExpenseForm = () => setExpenseForm({ description: '', amount: '', category: 'General', date: '', notes: '' });
  const resetPurchaseForm = () => setPurchaseForm({ supplierName: '', supplierPhone: '', supplierCity: '', date: '', itemName: '', itemCategory: '', weight: '', weightUnit: 'KG', pricePerUnit: '', totalAmount: '', paidAmount: '', paymentMethod: 'Cash', bankName: '', notes: '' });

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('fintracker_dark', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('fintracker_lang', language);
  }, [language]);

  const fetchData = useCallback(async (silent = false) => {
    if (!user) return;
    try {
      if (!silent) setIsLoading(true);
      const [
        fetchedCustomers,
        fetchedStockRecords,
        fetchedPayments,
        fetchedBankPayments,
        fetchedExpenses,
        fetchedPurchases,
        fetchedInvoices,
        fetchedBranding,
      ] = await Promise.all([
        store.getCustomers(user.id),
        store.getStockRecords(user.id),
        store.getPayments(user.id),
        store.getBankPayments(user.id),
        store.getExpenses(user.id),
        store.getPurchases(user.id),
        store.getInvoices(user.id),
        store.getBranding(user.id),
      ]);
      
      setCustomers(fetchedCustomers as any);
      setStockRecords(fetchedStockRecords as any);
      setPayments(fetchedPayments as any);
      setBankPayments(fetchedBankPayments as any);
      setExpenses(fetchedExpenses as any);
      setPurchases(fetchedPurchases as any);
      setInvoices(fetchedInvoices as any);
      setBranding(fetchedBranding);
      try { localStorage.setItem('fintracker_branding', JSON.stringify(fetchedBranding)); } catch {}
      
      const dashboardData = store.computeDashboardData(
        fetchedCustomers as any,
        fetchedStockRecords as any,
        fetchedPayments as any,
        fetchedExpenses as any,
        dateFrom,
        dateTo
      );
      setDashboardData(dashboardData);
    } catch (e: any) {
      console.error("Fetch Data Error:", e);
      toast({ title: t('error'), description: e.message || 'Failed to fetch data.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
    checkStorageSize();
  }, [user, dateFrom, dateTo, checkStorageSize, t]);

  useEffect(() => {
    if (user && hasLicense) fetchData();
  }, [dateFrom, dateTo, user, hasLicense, fetchData]);

  const prevUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (isLoggedIn && user && hasLicense && prevUserRef.current !== user.id) {
      prevUserRef.current = user.id;
      setIsLoading(true);
      migrateLocalStorageToFirestore(user.id)
        .catch(e => console.error("Migration error:", e))
        .finally(() => {
          setIsLoading(false);
          fetchData();
        });
    }
  }, [isLoggedIn, user?.id, hasLicense, fetchData]);

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      toast({ title: t('error'), description: t('wrongEmailPassword'), variant: 'destructive' });
      return;
    }
    setIsAuthLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const data = { id: userCredential.user.uid, name: userCredential.user.displayName || 'User', email: userCredential.user.email || '' };
      setUser(data);
      localStorage.setItem('fintracker_user', JSON.stringify(data));
      setIsLoggedIn(true);
      toast({ title: t('welcome'), description: `Salam ${data.name}!` });
    } catch (error: any) {
      toast({ title: t('loginFailed'), description: error.message || t('wrongEmailPassword'), variant: 'destructive' });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!signupEmail || !signupPassword || !signupName) {
      toast({ title: t('error'), description: t('wrongEmailPassword'), variant: 'destructive' });
      return;
    }
    setIsAuthLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, signupEmail, signupPassword);
      await updateProfile(userCredential.user, { displayName: signupName });
      
      const data = { id: userCredential.user.uid, name: signupName, email: signupEmail };
      setUser(data);
      localStorage.setItem('fintracker_user', JSON.stringify(data));
      setIsLoggedIn(true);
      toast({ title: t('accountCreated'), description: `Salam ${data.name}!` });
    } catch (error: any) {
      toast({ title: t('signupFailed'), description: error.message || t('tryAgain'), variant: 'destructive' });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const data = { id: result.user.uid, name: result.user.displayName || 'User', email: result.user.email || '' };
      setUser(data);
      localStorage.setItem('fintracker_user', JSON.stringify(data));
      setIsLoggedIn(true);
      toast({ title: t('welcome'), description: `Salam ${data.name}!` });
    } catch (error: any) {
      if (error.code === 'auth/unauthorized-domain') {
         toast({ title: 'Google Sign In Failed', description: 'Please add this preview URL to your Firebase Console > Authentication > Settings > Authorized Domains list.', variant: 'destructive', duration: 10000 });
      } else {
         toast({ title: t('loginFailed'), description: error.message, variant: 'destructive' });
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!loginEmail) {
      toast({ title: t('error'), description: t('email'), variant: 'destructive' });
      return;
    }
    setIsAuthLoading(true);
    try {
      await sendPasswordResetEmail(auth, loginEmail);
      toast({ title: t('resetEmailSent'), description: t('resetEmailSent') });
      setAuthMode('login');
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => { 
    await signOut(auth);
    setUser(null); setIsLoggedIn(false); localStorage.removeItem('fintracker_user'); setActiveTab('dashboard'); toast({ title: t('loggedOut'), description: t('seeYouNextTime') }); 
  };

  const [deleteConf, setDeleteConf] = useState<{ id: string, type: 'customer' | 'stock' | 'payment' | 'bank' | 'expense' | 'purchase' | 'invoice' } | null>(null);
  const handleConfirmDelete = async () => {
    if (!deleteConf) return;
    const isAuth = await ensureAuth();
    if (!isAuth) return;
    const conf = deleteConf;
    setDeleteConf(null);
    let p: Promise<any>;
    if (conf.type === 'customer') p = store.deleteCustomer(conf.id);
    else if (conf.type === 'stock') p = store.deleteStockRecord(conf.id);
    else if (conf.type === 'payment') p = store.deletePayment(conf.id);
    else if (conf.type === 'bank') p = store.deleteBankPayment(conf.id);
    else if (conf.type === 'expense') p = store.deleteExpense(conf.id);
    else if (conf.type === 'purchase') p = store.deletePurchase(conf.id);
    else p = store.deleteInvoice(conf.id);
    toast({ title: t('syncing'), description: t('deletingData') });
    p.then(() => {
      toast({ title: t('deleted'), description: t('operationSuccessful') });
      fetchData(true);
    }).catch((e: any) => {
      console.error('Delete error:', e);
      toast({ title: t('error'), description: e?.message || t('operationFailed'), variant: 'destructive' });
    });
  };

  const handleSaveCustomer = () => {
    if (!custForm.name || !custForm.phone) { toast({ title: t('error'), description: t('nameAndPhoneRequired'), variant: 'destructive' }); return; }
    const p = editingCustomer ? store.updateCustomer(editingCustomer.id, custForm) : store.createCustomer({ userId: user?.id || '', ...custForm });
    const isEdit = !!editingCustomer;
    setShowCustomerDialog(false); setEditingCustomer(null); resetCustForm();
    toast({ title: isEdit ? t('updated') : t('added'), description: isEdit ? t('customerUpdated') : t('newCustomerAdded') });
    p.then(() => fetchData(true)).catch((e: any) => { console.error('Save customer error:', e); toast({ title: t('error'), description: e?.message || t('operationFailed'), variant: 'destructive' }); });
  };
  const handleDeleteCustomer = (id: string) => setDeleteConf({ id, type: 'customer' });

  const handleSaveStock = () => {
    if (!stockForm.customerId || !stockForm.itemName) { toast({ title: t('error'), description: t('customerAndItemRequired'), variant: 'destructive' }); return; }
    const body: any = { userId: user?.id, ...stockForm, weight: parseFloat(stockForm.weight) || 0, pricePerUnit: parseFloat(stockForm.pricePerUnit) || 0, totalAmount: parseFloat(stockForm.totalAmount) || 0, paidAmount: parseFloat(stockForm.paidAmount) || 0 };
    const isEdit = !!editingStock;
    const p = isEdit ? store.updateStockRecord(editingStock!.id, body) : store.createStockRecord(body);
    setShowStockDialog(false); setEditingStock(null); resetStockForm();
    toast({ title: isEdit ? t('updated') : t('added'), description: isEdit ? t('stockRecordUpdated') : t('stockRecordAdded') });
    p.then(() => fetchData(true)).catch((e: any) => { console.error('Save stock error:', e); toast({ title: t('error'), description: e?.message || t('operationFailed'), variant: 'destructive' }); });
  };
  const handleDeleteStock = (id: string) => setDeleteConf({ id, type: 'stock' });

  const handleSavePayment = async () => {
    if (!paymentForm.customerId || !paymentForm.amount) { toast({ title: t('error'), description: t('customerAndAmountRequired'), variant: 'destructive' }); return; }
    const isAuth = await ensureAuth();
    if (!isAuth) return;
    const userId = auth.currentUser?.uid || user?.id || '';
    const isEdit = !!editingPayment;
    const p = isEdit 
      ? store.updatePayment(editingPayment!.id, { userId, ...paymentForm, amount: parseFloat(paymentForm.amount) || 0 })
      : store.createPayment({ userId, ...paymentForm, amount: parseFloat(paymentForm.amount) || 0 });
    
    setShowPaymentDialog(false); setEditingPayment(null); resetPaymentForm();
    toast({ title: isEdit ? t('updated') : t('paymentAdded'), description: isEdit ? t('stockRecordUpdated') : `PKR ${paymentForm.amount} ${t('received')}` });
    
    p.then(() => fetchData(true)).catch((e: any) => { console.error('Save payment error:', e); toast({ title: t('error'), description: e?.message || t('operationFailed'), variant: 'destructive' }); });
  };
  const handleDeletePayment = (id: string) => setDeleteConf({ id, type: 'payment' });

  const handleSaveBankPayment = () => {
    if (!bankForm.paymentAmount) { toast({ title: t('error'), description: t('amountRequired'), variant: 'destructive' }); return; }
    const isEdit = !!editingBankPayment;
    const p = isEdit ? store.updateBankPayment(editingBankPayment.id, { userId: user?.id || "", ...bankForm, paymentAmount: parseFloat(bankForm.paymentAmount) || 0 }) : store.createBankPayment({ userId: user?.id || "", ...bankForm, paymentAmount: parseFloat(bankForm.paymentAmount) || 0 });
    setShowBankPaymentDialog(false); setEditingBankPayment(null); resetBankForm();
    toast({ title: isEdit ? t('updated') : t('bankPaymentAdded'), description: isEdit ? t('bankPaymentAdded') : `PKR ${bankForm.paymentAmount} ${t('recorded')}` });
    p.then(() => fetchData(true)).catch((e: any) => { console.error('Save bank payment error:', e); toast({ title: t('error'), description: e?.message || t('operationFailed'), variant: 'destructive' }); });
  };
  const handleDeleteBankPayment = (id: string) => setDeleteConf({ id, type: 'bank' });

  const handleSaveExpense = () => {
    if (!expenseForm.description || !expenseForm.amount) { toast({ title: t('error'), description: t('descriptionAndAmountRequired'), variant: 'destructive' }); return; }
    const isEdit = !!editingExpense;
    const p = isEdit ? store.updateExpense(editingExpense.id, { userId: user?.id || "", ...expenseForm, amount: parseFloat(expenseForm.amount) || 0 }) : store.createExpense({ userId: user?.id || "", ...expenseForm, amount: parseFloat(expenseForm.amount) || 0 });
    setShowExpenseDialog(false); setEditingExpense(null); resetExpenseForm();
    toast({ title: isEdit ? t('updated') : t('expenseAdded'), description: isEdit ? t('expenseAdded') : `PKR ${expenseForm.amount} ${t('recorded')}` });
    p.then(() => fetchData(true)).catch((e: any) => { console.error('Save expense error:', e); toast({ title: t('error'), description: e?.message || t('operationFailed'), variant: 'destructive' }); });
  };
  const handleDeleteExpense = (id: string) => setDeleteConf({ id, type: 'expense' });

  const handleSavePurchase = () => {
    if (!purchaseForm.supplierName || !purchaseForm.itemName) { toast({ title: t('error'), description: t('supplierAndItemRequired'), variant: 'destructive' }); return; }
    const body: any = { userId: user?.id || "", ...purchaseForm, weight: parseFloat(purchaseForm.weight) || 0, pricePerUnit: parseFloat(purchaseForm.pricePerUnit) || 0, totalAmount: parseFloat(purchaseForm.totalAmount) || 0, paidAmount: parseFloat(purchaseForm.paidAmount) || 0 };
    const isEdit = !!editingPurchase;
    const p = isEdit ? store.updatePurchase(editingPurchase!.id, body) : store.createPurchase(body);
    setShowPurchaseDialog(false); setEditingPurchase(null); resetPurchaseForm();
    toast({ title: isEdit ? t('purchaseUpdated') : t('purchaseAdded'), description: isEdit ? t('stockRecordUpdated') : t('stockRecordAdded') });
    p.then(() => fetchData(true)).catch((e: any) => { console.error('Save purchase error:', e); toast({ title: t('error'), description: e?.message || t('operationFailed'), variant: 'destructive' }); });
  };
  const handleDeletePurchase = (id: string) => setDeleteConf({ id, type: 'purchase' });

  const handleDeleteInvoice = (id: string) => setDeleteConf({ id, type: 'invoice' });

  const openWhatsApp = (phone: string, customerName: string, remaining: number) => {
    const clean = phone.replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(`Assalam o Alaikum ${customerName} Bhai,\n\nAap ka PKR ${Math.round(remaining).toLocaleString()} payment baqi hai.\nPlease jaldi payment kar dein.\n\nShukriya!`);
    window.open(`https://wa.me/${clean}?text=${msg}`, '_blank');
  };

  const handleCalc = (val: string) => {
    if (val === 'C') { setCalcDisplay('0'); setCalcPrev(null); setCalcOp(null); return; }
    if (val === '=') { if (calcPrev !== null && calcOp) { const c = parseFloat(calcDisplay); let r = 0; if (calcOp === '+') r = calcPrev + c; else if (calcOp === '-') r = calcPrev - c; else if (calcOp === '*') r = calcPrev * c; else if (calcOp === '/') r = c !== 0 ? calcPrev / c : 0; setCalcDisplay(String(r)); setCalcPrev(null); setCalcOp(null); } return; }
    if (['+', '-', '*', '/'].includes(val)) { setCalcPrev(parseFloat(calcDisplay)); setCalcOp(val); setCalcDisplay('0'); return; }
    setCalcDisplay(calcDisplay === '0' ? val : calcDisplay + val);
  };

  const handlePrint = () => {
    try {
      const isIframe = window !== window.parent;
      if (isIframe) {
        setShowPrintHintDialog(true);
        return;
      }
      setTimeout(() => {
        window.print();
      }, 100);
    } catch (e) {
      console.error('Print Error:', e);
      toast({ title: t('error') || 'Error', description: "Failed to print.", variant: "destructive" });
    }
  };

  const handleInvoicePrint = () => {
    try {
      const isIframe = window !== window.parent;
      if (isIframe) {
        setShowPrintHintDialog(true);
        return;
      }
      setIsPrintingInvoice(true);
      document.body.classList.add('printing-invoice');
      
      // Strip dark mode directly globally for printing if needed, or handle in CSS
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          setIsPrintingInvoice(false);
          document.body.classList.remove('printing-invoice');
        }, 500);
      }, 200);
    } catch (e) {
      console.error('Invoice Print Error:', e);
      toast({ title: t('error') || 'Error', description: "Failed to print.", variant: "destructive" });
    }
  };

  const getFilteredCustomers = () => {
    let list = [...customers];
    if (searchQuery) { const q = searchQuery.toLowerCase(); list = list.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.city.toLowerCase().includes(q)); }
    if (filterStatus === 'paid') list = list.filter(c => c.totalRemaining <= 0);
    else if (filterStatus === 'unpaid') list = list.filter(c => c.totalRemaining > 0);
    else if (filterStatus === 'half') list = list.filter(c => c.totalPaid > 0 && c.totalRemaining > 0);
    return list;
  };
  const getFilteredStock = () => {
    let list = [...stockRecords];
    if (searchQuery) { const q = searchQuery.toLowerCase(); list = list.filter(s => s.itemName.toLowerCase().includes(q) || s.itemCategory.toLowerCase().includes(q) || (s.customer?.name || '').toLowerCase().includes(q)); }
    if (filterStatus === 'paid') list = list.filter(s => s.remainingAmount <= 0);
    else if (filterStatus === 'unpaid') list = list.filter(s => s.remainingAmount > 0);
    else if (filterStatus === 'half') list = list.filter(s => s.paidAmount > 0 && s.remainingAmount > 0);
    return list;
  };
  const getFilteredPurchases = () => {
    let list = [...purchases];
    if (searchQuery) { const q = searchQuery.toLowerCase(); list = list.filter(p => p.supplierName.toLowerCase().includes(q) || p.itemName.toLowerCase().includes(q) || p.supplierCity.toLowerCase().includes(q)); }
    if (filterStatus === 'paid') list = list.filter(p => p.remainingAmount <= 0);
    else if (filterStatus === 'unpaid') list = list.filter(p => p.remainingAmount > 0);
    else if (filterStatus === 'half') list = list.filter(p => p.paidAmount > 0 && p.remainingAmount > 0);
    return list;
  };

  const navItems = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'customers', label: t('customers'), icon: Users },
    { id: 'stock', label: t('stockSent'), icon: Package },
    { id: 'purchases', label: t('purchases'), icon: ShoppingCart },
    { id: 'wasooli', label: t('wasooli'), icon: Banknote },
    { id: 'bank', label: t('bankRecords'), icon: Building2 },
    { id: 'expenses', label: t('expenses'), icon: Receipt },
    { id: 'invoices', label: t('invoices'), icon: FileText },
    { id: 'search', label: t('search'), icon: Search },
    { id: 'settings', label: t('settings'), icon: Settings },
  ];

  if (user?.email?.toLowerCase().trim() === 'itxanasn@gmail.com') {
    navItems.unshift({ id: 'admin', label: 'Admin Panel', icon: Database as any });
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50 dark:bg-black p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[400px]">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 shadow-sm rounded-2xl flex items-center justify-center mb-6">
              <span className="text-3xl">💰</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Finance Tracker</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">Business & Finance Manager</p>
          </div>
          <Card className="shadow-lg border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 backdrop-blur-xl">
            <CardContent className="p-6 space-y-6">
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <Button variant={authMode === 'login' ? 'default' : 'ghost'} className={`flex-1 text-sm py-4 rounded-md shadow-none ${authMode === 'login' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white ring-1 ring-gray-200 dark:ring-gray-600 font-medium' : 'text-gray-600 dark:text-gray-400 font-normal'} transition-all`} onClick={() => setAuthMode('login')}>{t('login')}</Button>
                <Button variant={authMode === 'signup' ? 'default' : 'ghost'} className={`flex-1 text-sm py-4 rounded-md shadow-none ${authMode === 'signup' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white ring-1 ring-gray-200 dark:ring-gray-600 font-medium' : 'text-gray-600 dark:text-gray-400 font-normal'} transition-all`} onClick={() => setAuthMode('signup')}>{t('signUp')}</Button>
              </div>
              
              {authMode === 'forgot' ? (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('resetPassword')}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Enter your email and we'll send a link to reset your password.</p>
                  </div>
                  <div><Label className="text-sm font-medium mb-1.5 block text-gray-900 dark:text-gray-200">{t('email')}</Label><Input type="email" placeholder="your@email.com" className="h-12 bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} /></div>
                  <Button disabled={isAuthLoading} className="w-full h-12 text-sm font-medium mt-2 bg-emerald-600 hover:bg-emerald-700 text-white transition-colors" onClick={handleResetPassword}>{isAuthLoading ? '...' : t('resetPassword')}</Button>
                  <Button variant="ghost" className="w-full text-sm text-gray-500" onClick={() => setAuthMode('login')}>{t('backToLogin')}</Button>
                </div>
              ) : authMode === 'login' ? (
                <div className="space-y-4">
                  <div><Label className="text-sm font-medium mb-1.5 block text-gray-900 dark:text-gray-200">{t('email')}</Label><Input type="email" placeholder="your@email.com" className="h-12 bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} /></div>
                  <div className="relative"><Label className="text-sm font-medium mb-1.5 block text-gray-900 dark:text-gray-200">{t('password')}</Label>
                    <div className="relative">
                      <Input type={showLoginPassword ? "text" : "password"} placeholder={t('enterPassword')} className="h-12 bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 pr-10" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                      <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer">
                        {showLoginPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <div className="flex justify-end mt-2">
                       <button type="button" onClick={() => setAuthMode('forgot')} className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium">{t('forgotPassword')}</button>
                    </div>
                  </div>
                  <Button disabled={isAuthLoading} className="w-full h-12 text-sm font-medium mt-2 bg-emerald-600 hover:bg-emerald-700 text-white transition-colors" onClick={handleLogin}>{isAuthLoading ? '...' : t('login')}</Button>
                  
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200 dark:border-gray-800" /></div>
                    <div className="relative flex justify-center text-xs text-gray-500 uppercase bg-white dark:bg-gray-900 px-2">{t('orContinueWith')}</div>
                  </div>
                  <Button disabled={isAuthLoading} variant="outline" className="w-full h-12 text-sm font-medium border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800" onClick={handleGoogleSignIn}>
                    <Chrome className="w-5 h-5 mr-2 text-blue-500" /> {t('continueWithGoogle')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div><Label className="text-sm font-medium mb-1.5 block text-gray-900 dark:text-gray-200">{t('yourName')}</Label><Input placeholder={t('name')} className="h-12 bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400" value={signupName} onChange={e => setSignupName(e.target.value)} /></div>
                  <div><Label className="text-sm font-medium mb-1.5 block text-gray-900 dark:text-gray-200">{t('email')}</Label><Input type="email" placeholder="your@email.com" className="h-12 bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} /></div>
                  <div><Label className="text-sm font-medium mb-1.5 block text-gray-900 dark:text-gray-200">{t('phoneNumber')}</Label><Input placeholder="03XX-XXXXXXX" className="h-12 bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400" value={signupPhone} onChange={e => setSignupPhone(e.target.value)} /></div>
                  <div className="relative"><Label className="text-sm font-medium mb-1.5 block text-gray-900 dark:text-gray-200">{t('password')}</Label>
                    <div className="relative">
                      <Input type={showSignupPassword ? "text" : "password"} placeholder={t('createPassword')} className="h-12 bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 pr-10" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} />
                      <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer">
                        {showSignupPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <Button disabled={isAuthLoading} className="w-full h-12 text-sm font-medium mt-2 bg-emerald-600 hover:bg-emerald-700 text-white transition-colors" onClick={handleSignup}>{isAuthLoading ? '...' : t('createAccount')}</Button>
                  
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200 dark:border-gray-800" /></div>
                    <div className="relative flex justify-center text-xs text-gray-500 uppercase bg-white dark:bg-gray-900 px-2">{t('orContinueWith')}</div>
                  </div>
                  <Button disabled={isAuthLoading} variant="outline" className="w-full h-12 text-sm font-medium border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800" onClick={handleGoogleSignIn}>
                    <Chrome className="w-5 h-5 mr-2 text-blue-500" /> {t('continueWithGoogle')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          <p className="text-center text-gray-500 dark:text-gray-500 text-xs mt-6 uppercase tracking-widest font-medium">{t('completeFinanceSolution')}</p>
        </motion.div>
      </div>
    );
  }

  if (isLicenseLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Verifying License...</p>
        </div>
      </div>
    );
  }

  if (!hasLicense && user?.email?.toLowerCase().trim() !== 'itxanasn@gmail.com') {
    return <LicenseActivation userId={user!.id} email={user!.email} onActivated={() => setHasLicense(true)} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground font-sans" dir={language === 'ur' ? 'rtl' : 'ltr'}>
      {branding.primaryColor && branding.primaryColor !== '#059669' && (
        <style>{`
          .bg-emerald-600 { background-color: ${branding.primaryColor} !important; }
          .bg-emerald-50 { background-color: ${branding.primaryColor}15 !important; }
          .bg-emerald-100 { background-color: ${branding.primaryColor}33 !important; }
          .text-emerald-600 { color: ${branding.primaryColor} !important; }
          .text-emerald-700 { color: ${branding.primaryColor} !important; }
          .hover\\:bg-emerald-700:hover { background-color: ${branding.primaryColor}dd !important; }
          .hover\\:text-emerald-700:hover { color: ${branding.primaryColor}dd !important; }
          .ring-emerald-500 { --tw-ring-color: ${branding.primaryColor} !important; }
          .border-emerald-200 { border-color: ${branding.primaryColor}33 !important; }
          .border-emerald-600 { border-color: ${branding.primaryColor} !important; }
          .dark .dark\\:bg-emerald-900\\/50 { background-color: ${branding.primaryColor}33 !important; }
          .dark .dark\\:text-emerald-400 { color: ${branding.primaryColor} !important; }
        `}</style>
      )}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 ${language === 'ur' ? 'right-0' : 'left-0'} z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : (language === 'ur' ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0')} flex flex-col`}>
        <div className="p-6 pb-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {branding.logoUrl ? (
                branding.logoUrl.startsWith('http') ? 
                  <img src={branding.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-cover" /> : 
                  <div className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"><span className="text-lg">{branding.logoUrl}</span></div>
              ) : (
                <div className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"><span className="text-lg">💰</span></div>
              )}
              <div className="flex flex-col">
                <h1 className="font-semibold tracking-tight text-gray-900 dark:text-gray-100 leading-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]" title={branding.appName}>{branding.appName}</h1>
                <span className="text-[10px] text-gray-500 mt-0.5 leading-none">{t('businessFinance')}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 text-gray-500" onClick={() => setSidebarOpen(false)}><X className="h-4 w-4" /></Button>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800/50">
            <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-full flex items-center justify-center text-sm font-semibold border border-emerald-200/50 dark:border-emerald-800/50">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-none mb-1">{user?.name}</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('businessAcc')}</span>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 py-4 px-3">
          <nav className="space-y-0.5">
            {navItems.map(item => (
              <button key={item.id} onClick={() => { setActiveTab(item.id); setSidebarOpen(false); setSearchQuery(''); setFilterStatus('all'); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 font-medium ${activeTab === item.id ? 'text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'}`}
                style={activeTab === item.id ? { backgroundColor: branding.primaryColor || '#059669' } : undefined}>
                <item.icon className={`h-4 w-4 ${activeTab === item.id ? 'text-white' : ''}`} />
                <span>{item.label}</span>
                {item.id === 'customers' && <span className={`ml-auto ${activeTab === item.id ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'} text-[10px] px-2 py-0.5 rounded-full font-semibold`}>{customers.length}</span>}
                {item.id === 'wasooli' && dashboardData?.pendingPayments ? <span className={`ml-auto ${activeTab === item.id ? 'bg-white/20 text-white' : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'} text-[10px] px-2 py-0.5 rounded-full font-semibold`}>{dashboardData.pendingPayments}</span> : null}
                {item.id === 'purchases' && purchases.length > 0 ? <span className={`ml-auto ${activeTab === item.id ? 'bg-white/20 text-white' : 'bg-transparent border border-gray-200 dark:border-gray-700 text-gray-500'} text-[10px] px-2 py-0.5 rounded-full font-semibold`}>{purchases.length}</span> : null}
                {item.id === 'invoices' && invoices.length > 0 ? <span className={`ml-auto ${activeTab === item.id ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'} text-[10px] px-2 py-0.5 rounded-full font-semibold`}>{invoices.length}</span> : null}
              </button>
            ))}
          </nav>
        </ScrollArea>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800/50">
          <Button variant="ghost" className="w-full justify-start gap-3 h-10 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900/50 dark:hover:text-white" onClick={handleLogout}><LogOut className="h-4 w-4" />{t('logout')}</Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between no-print transition-colors">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden text-gray-500 hover:text-gray-900 dark:hover:text-white" onClick={() => setSidebarOpen(true)}><Menu className="h-5 w-5" /></Button>
            <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">{navItems.find(n => n.id === activeTab)?.label || t('dashboard')}</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white gap-1.5" onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')} title={t('language')}>
              <Languages className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{language === 'en' ? 'اردو' : 'EN'}</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-500 hover:text-gray-900 dark:hover:text-white" onClick={() => setShowCalculator(true)} title={t('calculator')}><Calculator className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-500 hover:text-gray-900 dark:hover:text-white" onClick={() => setDarkMode(!darkMode)} title={t('darkMode')}>{darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
            <Separator orientation="vertical" className="h-5 mx-1 bg-gray-200 dark:bg-gray-800" />
            <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-500 hover:text-gray-900 dark:hover:text-white" onClick={handlePrint} title={t('printLabel')}><Printer className="h-4 w-4" /></Button>
          </div>
        </header>

        <div className="flex-1 p-6 max-w-6xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

              {/* DASHBOARD */}
              {activeTab === 'admin' && user?.email?.toLowerCase().trim() === 'itxanasn@gmail.com' && (
                <AdminPanel />
              )}
              {activeTab === 'dashboard' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 fade-in">
                  {!dashboardData || isLoading ? (
                    <div className="flex flex-col items-center justify-center p-12 space-y-4">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
                      <p className="text-gray-500 font-medium">{t('loading')}</p>
                    </div>
                  ) : (
                    <>
                      {storageUsage.warning && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-800/50 rounded-full"><Database className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
                        <div>
                          <h4 className="font-medium text-red-800 dark:text-red-300">{t('storageAlmostFull')}</h4>
                          <p className="text-sm text-red-600 dark:text-red-400/80 mt-0.5">{t('storageWarningMsg')} ({(storageUsage.used / 1024 / 1024).toFixed(2)} MB / {(storageUsage.total / 1024 / 1024).toFixed(2)} MB)</p>
                        </div>
                      </div>
                      <Button onClick={handleDownloadBackup} className="bg-red-600 hover:bg-red-700 text-white border-0 btn-premium"><Download className="w-4 h-4 mr-2" /> {t('backupNow')}</Button>
                    </div>
                  )}
                  {showBackupReminder && !storageUsage.warning && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-800/50 rounded-full"><AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>
                        <div>
                          <h4 className="font-medium text-amber-800 dark:text-amber-300">{t('dataBackupRecommended')}</h4>
                          <p className="text-sm text-amber-600 dark:text-amber-400/80 mt-0.5">{t('backupRemindMsg')}</p>
                        </div>
                      </div>
                      <Button onClick={handleDownloadBackup} className="bg-amber-600 hover:bg-amber-700 text-white border-0 btn-premium"><Download className="w-4 h-4 mr-2" /> {t('downloadBackupBtn')}</Button>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-2">
                    <div className="flex flex-col sm:flex-row gap-4 max-w-sm w-full">
                      <div className="flex-1"><Label className="text-[10px] text-gray-500 font-medium mb-1 block">{t('fromDate')}</Label><Input type="date" className="h-9 w-full bg-card" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
                      <div className="flex-1"><Label className="text-[10px] text-gray-500 font-medium mb-1 block">{t('toDate')}</Label><Input type="date" className="h-9 w-full bg-card" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
                      {(dateFrom || dateTo) && <div className="self-end pb-0.5"><Button variant="ghost" size="sm" className="h-8 text-gray-500" onClick={() => { setDateFrom(''); setDateTo(''); }}><X className="h-3.5 w-3.5 mr-1" />{t('clear')}</Button></div>}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="border shadow-sm stat-card-green card-hover">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">{t('totalReceived')}</span>
                          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-200/60 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                            <TrendingUp className="h-5 w-5" />
                          </div>
                        </div>
                        <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{PKR(dashboardData.totalMoneyReceived)}</p>
                      </CardContent>
                    </Card>
                    <Card className="border shadow-sm stat-card-orange card-hover">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wider">{t('remainingMoney')}</span>
                          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-orange-200/60 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
                            <AlertCircle className="h-5 w-5" />
                          </div>
                        </div>
                        <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{PKR(dashboardData.totalRemainingMoney)}</p>
                      </CardContent>
                    </Card>
                    <Card className="border shadow-sm stat-card-blue card-hover">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">{t('todayWasooli')}</span>
                          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-200/60 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                            <Clock className="h-5 w-5" />
                          </div>
                        </div>
                        <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{PKR(dashboardData.todayWasooli)}</p>
                      </CardContent>
                    </Card>
                    <Card className="border shadow-sm stat-card-indigo card-hover">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">{t('thisMonth')}</span>
                          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-200/60 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                            <Calendar className="h-5 w-5" />
                          </div>
                        </div>
                        <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{PKR(dashboardData.monthWasooli)}</p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <Card className="shadow-sm border bg-card card-hover"><CardContent className="p-6 flex flex-col items-center justify-center text-center"><div className="mb-4 w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"><Users className="h-6 w-6" /></div><p className="text-2xl font-bold text-gray-900 dark:text-white leading-none mb-2">{dashboardData.totalCustomers}</p><p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('totalCustomers')}</p></CardContent></Card>
                    <Card className="shadow-sm border bg-card card-hover"><CardContent className="p-6 flex flex-col items-center justify-center text-center"><div className="mb-4 w-12 h-12 flex items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"><Package className="h-6 w-6" /></div><p className="text-2xl font-bold text-gray-900 dark:text-white leading-none mb-2">{dashboardData.totalStockRecords}</p><p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('stockSent')}</p></CardContent></Card>
                    <Card className="shadow-sm border bg-card card-hover"><CardContent className="p-6 flex flex-col items-center justify-center text-center"><div className="mb-4 w-12 h-12 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600"><ShoppingCart className="h-6 w-6" /></div><p className="text-2xl font-bold text-gray-900 dark:text-white leading-none mb-2">{purchases.length}</p><p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('totalPurchases')}</p></CardContent></Card>
                    <Card className="shadow-sm border bg-card card-hover"><CardContent className="p-6 flex flex-col items-center justify-center text-center"><div className="mb-4 w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"><CheckCircle2 className="h-6 w-6" /></div><p className="text-2xl font-bold text-gray-900 dark:text-white leading-none mb-2">{dashboardData.paidPayments}</p><p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('paid')}</p></CardContent></Card>
                  </div>
                  
                  <Card className="border shadow-sm bg-gray-900 border-gray-800 text-white">
                    <CardContent className="p-8">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div>
                          <p className="text-sm font-semibold tracking-wider text-gray-400 uppercase mb-3">{t('netProfit')}</p>
                          <div className="flex items-baseline gap-3">
                            <span className="text-5xl font-bold tracking-tight text-white">{PKR((dashboardData.totalMoneyReceived || 0) - (dashboardData.totalExpenses || 0))}</span>
                          </div>
                        </div>
                        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-gray-300">
                          <Wallet className="h-8 w-8" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card className="shadow-sm border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20"><CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2 text-blue-600"><Database className="h-5 w-5" /> {t('dataBackup')}</CardTitle></CardHeader><CardContent>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{language === 'ur' ? 'اپنے ڈیٹا کو محفوظ رکھیں۔ بیک اپ ڈاؤنلوڈ کریں۔' : 'Keep your data safe. Download a backup.'}</p>
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" className="w-full h-11 justify-start" onClick={handleDownloadBackup}><Download className="h-4 w-4 mr-2" />{t('downloadBackup')}</Button>
                        <div className="relative">
                          <input type="file" title="Upload Backup (JSON)" accept=".json" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = async (ev) => {
                              try {
                                if (!user) return;
                                const data = JSON.parse(ev.target?.result as string);
                                if (await store.restoreBackup(data, user.id)) {
                                  toast({ title: t('updated'), description: t('backupRestored') });
                                  setTimeout(() => window.location.reload(), 1000);
                                } else {
                                  toast({ title: t('error'), description: t('operationFailed'), variant: 'destructive' });
                                }
                              } catch {
                                toast({ title: t('error'), description: t('invalidJson'), variant: 'destructive' });
                              }
                            };
                            reader.readAsText(file);
                            e.target.value = '';
                          }} />
                          <Button variant="outline" className="w-full h-11 justify-start pointer-events-none"><Upload className="h-4 w-4 mr-2" />{language === 'ur' ? 'بیک اپ اپلوڈ کریں' : 'Upload Backup (JSON)'}</Button>
                        </div>
                      </div>
                    </CardContent></Card>
                    <Card className="shadow-sm border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20"><CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2 text-orange-600"><AlertCircle className="h-5 w-5" /> {t('fifteenDaysReminders')}</CardTitle></CardHeader><CardContent>
                      <ScrollArea className="h-64 pr-4"><div className="space-y-3">
                        {customers.filter(c => c.totalRemaining > 0).length === 0 ? <p className="text-gray-500 text-center py-8">{t('noCustomersFound')}</p> : customers.filter(c => c.totalRemaining > 0).map(c => (
                          <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-white dark:bg-gray-900 shadow-sm gap-2">
                            <div><p className="font-bold">{c.name}</p><p className="text-sm text-gray-500">{c.phone}</p></div>
                            <div className="flex items-center gap-3">
                              <span className="text-red-600 font-bold">{PKR(c.totalRemaining)}</span>
                              <Button size="sm" variant="outline" className="text-green-600 border-green-300 bg-green-50 hover:bg-green-100" onClick={() => openWhatsApp(c.phone, c.name, c.totalRemaining)}><MessageCircle className="h-4 w-4 mr-1" /> WhatsApp</Button>
                            </div>
                          </div>
                        ))}
                      </div></ScrollArea>
                    </CardContent></Card>
                    <Card className="shadow-sm"><CardHeader><CardTitle className="text-lg">{t('paymentStatus')}</CardTitle></CardHeader><CardContent>
                      <div className="h-48 flex items-center justify-center"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: t('paid'), value: dashboardData.paidPayments }, { name: t('halfPaid'), value: customers.filter(c => c.totalPaid > 0 && c.totalRemaining > 0).length }, { name: t('notPaid'), value: customers.filter(c => c.totalPaid <= 0 && c.totalRemaining > 0).length }].filter(d => d.value > 0)} cx="50%" cy="50%" outerRadius={70} dataKey="value" label><Cell fill="#22c55e" /><Cell fill="#f59e0b" /><Cell fill="#ef4444" /></Pie><Tooltip /></PieChart></ResponsiveContainer></div>
                      <div className="flex justify-center gap-4 mt-2 flex-wrap"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /><span className="text-sm">{t('paid')}</span></div><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-sm">{t('halfPaid')}</span></div><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-sm">{t('notPaid')}</span></div></div>
                    </CardContent></Card>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card className="shadow-sm"><CardHeader><CardTitle className="text-lg">{t('monthlyWasooliChart')}</CardTitle></CardHeader><CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={dashboardData.monthlyData}><CartesianGrid strokeDasharray="3 3" className="opacity-30" /><XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} /><Tooltip formatter={(v: number) => PKR(v)} /><Bar dataKey="wasooli" fill="#22c55e" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
                    <Card className="shadow-sm"><CardHeader><CardTitle className="text-lg">{t('stockSentVsExpenses')}</CardTitle></CardHeader><CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={dashboardData.monthlyData}><CartesianGrid strokeDasharray="3 3" className="opacity-30" /><XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} /><Tooltip formatter={(v: number) => PKR(v)} /><Line type="monotone" dataKey="stockSent" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} /><Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></div></CardContent></Card>
                  </div>
                  <div className="grid md:grid-cols-1 gap-6">
                    <Card className="shadow-sm md:col-span-2"><CardHeader><CardTitle className="text-lg">{t('recentActivity')}</CardTitle></CardHeader><CardContent>
                      <ScrollArea className="h-64"><div className="space-y-3">
                        {dashboardData.recentActivity.map((a, i) => (
                          <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${a.type === 'payment' ? 'bg-green-100 dark:bg-green-900 text-green-600' : a.type === 'stock' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'bg-orange-100 dark:bg-orange-900 text-orange-600'}`}>
                              {a.type === 'payment' ? <DollarSign className="h-4 w-4" /> : a.type === 'stock' ? <Package className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{a.description}</p>{a.customerName && <p className="text-xs text-gray-500">{a.customerName}</p>}<p className="text-xs text-gray-500">{new Date(a.date).toLocaleDateString('en-PK')}</p></div>
                          </div>
                        ))}
                        {dashboardData.recentActivity.length === 0 && <p className="text-center text-gray-400 py-8">{t('noActivityYet')}</p>}
                      </div></ScrollArea>
                    </CardContent></Card>
                  </div>
                  <Card className="shadow-sm"><CardContent className="p-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div><p className="text-sm text-gray-500 mb-1">{t('totalExpenses')}</p><p className="text-2xl font-bold text-red-600">{PKR(dashboardData.totalExpenses)}</p></div>
                      <Separator orientation="vertical" className="h-12" />
                      <div><p className="text-sm text-gray-500 mb-1">{t('netProfit')}</p><p className={`text-2xl font-bold ${dashboardData.totalMoneyReceived - dashboardData.totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>{PKR(dashboardData.totalMoneyReceived - dashboardData.totalExpenses)}</p></div>
                      <Separator orientation="vertical" className="h-12 hidden md:block" />
                      <div className="hidden md:block"><p className="text-sm text-gray-500 mb-1">{t('totalStockValue')}</p><p className="text-2xl font-bold text-blue-600">{PKR(stockRecords.reduce((s, r) => s + r.totalAmount, 0))}</p></div>
                    </div>
                  </CardContent></Card>
                  </>
                  )}
                </div>
              )}

              {/* CUSTOMERS */}
              {activeTab === 'customers' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input placeholder={t('searchCustomers')} className="h-12 text-base" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="h-12 w-full sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t('all')}</SelectItem><SelectItem value="unpaid">{t('notPaid')}</SelectItem><SelectItem value="half">{t('halfPaid')}</SelectItem><SelectItem value="paid">{t('paid')}</SelectItem></SelectContent></Select>
                    <Button className="h-12 text-base px-6 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditingCustomer(null); resetCustForm(); setShowCustomerDialog(true); }}><Plus className="h-5 w-5 mr-2" />{t('addCustomer')}</Button>
                  </div>
                  <div className="grid gap-4">
                    {getFilteredCustomers().map(customer => (
                      <motion.div key={customer.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <Card className="shadow-sm hover:shadow-md transition-all"><CardContent className="p-4 md:p-5">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-lg font-bold">{customer.name}</h3>
                                {customer.totalRemaining <= 0 ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">{t('paid')}</Badge> : customer.totalPaid > 0 ? <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">{t('halfPaid')}</Badge> : <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">{t('notPaid')}</Badge>}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500"><span className="flex items-center gap-1"><Phone className="h-3 w-3" />{customer.phone}</span>{customer.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{customer.city}</span>}</div>
                              <div className="flex gap-4 mt-2 text-sm"><span className="text-green-600 font-semibold">{t('paid')}: {PKR(customer.totalPaid)}</span><span className="text-red-600 font-semibold">{t('remaining')}: {PKR(customer.totalRemaining)}</span></div>
                            </div>
                            <div className="flex items-center gap-2">
                              {customer.totalRemaining > 0 && <Button variant="outline" size="sm" className="text-green-600 border-green-300 hover:bg-green-50" onClick={() => openWhatsApp(customer.phone, customer.name, customer.totalRemaining)}><MessageCircle className="h-4 w-4 mr-1" />{t('whatsapp')}</Button>}
                              <Button variant="outline" size="sm" onClick={() => { setSelectedCustomer(customer); setShowCustomerDetail(true); }}><Eye className="h-4 w-4 mr-1" />{t('details')}</Button>
                              <Button variant="outline" size="sm" onClick={() => { setEditingCustomer(customer); setCustForm({ name: customer.name, phone: customer.phone, city: customer.city, address: customer.address, notes: customer.notes }); setShowCustomerDialog(true); }}><Edit2 className="h-4 w-4" /></Button>
                              <Button variant="outline" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => handleDeleteCustomer(customer.id)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        </CardContent></Card>
                      </motion.div>
                    ))}
                    {getFilteredCustomers().length === 0 && <Card className="shadow-sm"><CardContent className="p-12 text-center text-gray-400"><Users className="h-12 w-12 mx-auto mb-3 opacity-50" /><p className="text-lg">{t('noCustomersFound')}</p></CardContent></Card>}
                  </div>
                </div>
              )}

              {/* STOCK RECORDS */}
              {activeTab === 'stock' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input placeholder={t('searchStock')} className="h-12 text-base" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="h-12 w-full sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t('all')}</SelectItem><SelectItem value="unpaid">{t('notPaid')}</SelectItem><SelectItem value="half">{t('halfPaid')}</SelectItem><SelectItem value="paid">{t('paid')}</SelectItem></SelectContent></Select>
                    <Button className="h-12 text-base px-6 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditingStock(null); resetStockForm(); setShowStockDialog(true); }}><Plus className="h-5 w-5 mr-2" />{t('addStock')}</Button>
                  </div>
                  <div className="grid gap-3">
                    {getFilteredStock().map(record => (
                      <Card key={record.id} className="shadow-sm"><CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-lg">{record.itemName}</h3>
                              {record.itemCategory && <Badge variant="secondary">{record.itemCategory}</Badge>}
                              <Badge className={record.remainingAmount <= 0 ? 'bg-green-100 text-green-700' : record.paidAmount > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>
                                {record.remainingAmount <= 0 ? t('paid') : record.paidAmount > 0 ? t('partial') : t('unpaid')}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">{t('customer')}: {record.customer?.name}</p>
                            <div className="flex flex-wrap gap-3 mt-2 text-sm"><span className="flex items-center gap-1"><Weight className="h-3 w-3" />{record.weight} {record.weightUnit}</span><span>{t('total')}: {PKR(record.totalAmount)}</span><span className="text-green-600">{t('paid')}: {PKR(record.paidAmount)}</span><span className="text-red-600">{t('remaining')}: {PKR(record.remainingAmount)}</span></div>
                            <p className="text-xs text-gray-400 mt-1">{new Date(record.date).toLocaleDateString('en-PK')}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => { setEditingStock(record); setStockForm({ customerId: record.customerId, date: record.date?.split('T')[0] || '', itemName: record.itemName, itemCategory: record.itemCategory, weight: String(record.weight), weightUnit: record.weightUnit, pricePerUnit: String(record.pricePerUnit), totalAmount: String(record.totalAmount), paidAmount: String(record.paidAmount), paymentMethod: 'Cash', bankName: '', notes: record.notes }); setShowStockDialog(true); }}><Edit2 className="h-4 w-4" /></Button>
                            <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDeleteStock(record.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </CardContent></Card>
                    ))}
                    {getFilteredStock().length === 0 && <Card className="shadow-sm"><CardContent className="p-12 text-center text-gray-400"><Package className="h-12 w-12 mx-auto mb-3 opacity-50" /><p className="text-lg">{t('noStockRecordsFound')}</p></CardContent></Card>}
                  </div>
                </div>
              )}

              {/* PURCHASES */}
              {activeTab === 'purchases' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input placeholder={t('searchPurchases')} className="h-12 text-base" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="h-12 w-full sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t('all')}</SelectItem><SelectItem value="unpaid">{t('notPaid')}</SelectItem><SelectItem value="half">{t('halfPaid')}</SelectItem><SelectItem value="paid">{t('paid')}</SelectItem></SelectContent></Select>
                    <Button className="h-12 text-base px-6 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditingPurchase(null); resetPurchaseForm(); setShowPurchaseDialog(true); }}><Plus className="h-5 w-5 mr-2" />{t('addPurchase')}</Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Card className="shadow-sm"><CardContent className="p-4 text-center"><ShoppingCart className="h-6 w-6 mx-auto mb-2 text-orange-600" /><p className="text-2xl font-bold">{purchases.length}</p><p className="text-sm text-gray-500">{t('totalPurchases')}</p></CardContent></Card>
                    <Card className="shadow-sm"><CardContent className="p-4 text-center"><TrendingDown className="h-6 w-6 mx-auto mb-2 text-red-600" /><p className="text-xl font-bold">{PKR(purchases.reduce((s, p) => s + p.totalAmount, 0))}</p><p className="text-sm text-gray-500">{t('totalSpent')}</p></CardContent></Card>
                    <Card className="shadow-sm"><CardContent className="p-4 text-center"><AlertCircle className="h-6 w-6 mx-auto mb-2 text-amber-600" /><p className="text-xl font-bold">{PKR(purchases.reduce((s, p) => s + p.remainingAmount, 0))}</p><p className="text-sm text-gray-500">{t('remainingToPay')}</p></CardContent></Card>
                  </div>
                  <div className="grid gap-3">
                    {getFilteredPurchases().map(p => (
                      <Card key={p.id} className="shadow-sm"><CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-lg">{p.supplierName}</h3>
                              {p.itemCategory && <Badge variant="secondary">{p.itemCategory}</Badge>}
                              <Badge className={p.remainingAmount <= 0 ? 'bg-green-100 text-green-700' : p.paidAmount > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>
                                {p.remainingAmount <= 0 ? t('paid') : p.paidAmount > 0 ? t('partial') : t('unpaid')}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">{p.supplierCity && `${p.supplierCity} • `}{p.supplierPhone}</p>
                            <div className="flex flex-wrap gap-3 mt-2 text-sm"><span>{t('itemName')}: {p.itemName}</span><span>{p.weight} {p.weightUnit}</span><span>{t('total')}: {PKR(p.totalAmount)}</span><span className="text-green-600">{t('paid')}: {PKR(p.paidAmount)}</span><span className="text-red-600">{t('remaining')}: {PKR(p.remainingAmount)}</span></div>
                            <p className="text-xs text-gray-400 mt-1">{new Date(p.date).toLocaleDateString('en-PK')}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => { setEditingPurchase(p); setPurchaseForm({ supplierName: p.supplierName, supplierPhone: p.supplierPhone, supplierCity: p.supplierCity, date: p.date?.split('T')[0] || '', itemName: p.itemName, itemCategory: p.itemCategory, weight: String(p.weight), weightUnit: p.weightUnit, pricePerUnit: String(p.pricePerUnit), totalAmount: String(p.totalAmount), paidAmount: String(p.paidAmount), paymentMethod: 'Cash', bankName: '', notes: p.notes }); setShowPurchaseDialog(true); }}><Edit2 className="h-4 w-4" /></Button>
                            <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDeletePurchase(p.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </CardContent></Card>
                    ))}
                    {getFilteredPurchases().length === 0 && <Card className="shadow-sm"><CardContent className="p-12 text-center text-gray-400"><ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" /><p className="text-lg">{t('noPurchasesFound')}</p></CardContent></Card>}
                  </div>
                </div>
              )}

              {/* WASOOLI */}
              {activeTab === 'wasooli' && (() => {
                const filteredPayments = payments.filter(p => {
                  const matchDate = (!dateFrom || p.date >= dateFrom) && (!dateTo || p.date <= dateTo);
                  const matchSearch = p.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.customer?.phone?.toLowerCase().includes(searchQuery.toLowerCase());
                  return matchDate && matchSearch;
                });
                const halfPaidCustomers = customers.filter(c => c.totalPaid > 0 && c.totalRemaining > 0);
                const fullyUnpaidCustomers = customers.filter(c => c.totalPaid <= 0 && c.totalRemaining > 0);
                return (
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-3">
                    <Input placeholder={t('searchCustomers')} className="h-12 text-base flex-1" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    <div className="flex gap-2">
                       <Input type="date" className="h-12 w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                       <Input type="date" className="h-12 w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                       {(dateFrom || dateTo) && <Button variant="ghost" onClick={() => { setDateFrom(''); setDateTo(''); }} className="h-12 px-3 text-red-500 hover:bg-red-50">{t('clear')}</Button>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="shadow-sm card-hover"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-green-500" /><span className="text-sm text-gray-600 dark:text-gray-400">{t('totalWasooliReceived')}</span></div><p className="text-xl font-bold text-green-600">{PKR(filteredPayments.reduce((s, p) => s + p.amount, 0))}</p></CardContent></Card>
                    <Card className="shadow-sm card-hover"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><AlertCircle className="h-4 w-4 text-red-500" /><span className="text-sm text-gray-600 dark:text-gray-400">{t('pendingPaymentsLabel')}</span></div><p className="text-xl font-bold text-red-600">{PKR(customers.reduce((s, c) => s + c.totalRemaining, 0))}</p></CardContent></Card>
                    <Card className="shadow-sm card-hover"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Calendar className="h-4 w-4 text-blue-500" /><span className="text-sm text-gray-600 dark:text-gray-400">{t('thisMonthWasooli')}</span></div><p className="text-xl font-bold text-blue-600">{PKR(filteredPayments.filter(p => { const d = new Date(p.date); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).reduce((s, p) => s + p.amount, 0))}</p></CardContent></Card>
                  </div>
                  <Button className="h-12 text-base px-6 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditingPayment(null); resetPaymentForm(); setShowPaymentDialog(true); }}><Plus className="h-5 w-5 mr-2" />{t('addPayment')}</Button>

                  {/* Thora Udhar (Half Paid) Customers */}
                  {halfPaidCustomers.length > 0 && (
                  <Card className="shadow-sm border-amber-200 dark:border-amber-800"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><AlertCircle className="h-5 w-5 text-amber-500" />{t('halfPaid')}</CardTitle></CardHeader><CardContent>
                    <div className="space-y-3">
                      {halfPaidCustomers.map(c => {
                        const cStocks = stockRecords.filter(s => s.customerId === c.id);
                        const totalAmount = c.totalPaid + c.totalRemaining;
                        const paidPercent = totalAmount > 0 ? Math.round((c.totalPaid / totalAmount) * 100) : 0;
                        return (
                          <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-amber-200 dark:border-amber-800 gap-3 bg-amber-50/50 dark:bg-amber-900/10">
                            <div className="flex-1"><div className="flex items-center gap-2"><p className="font-bold">{c.name}</p><Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs">{t('halfPaid')}</Badge></div><p className="text-sm text-gray-500">{c.phone} • {language === 'ur' ? 'ادا شدہ' : 'Paid'}: {PKR(c.totalPaid)} ({paidPercent}%)</p><Progress value={paidPercent} className="h-1.5 mt-1" /></div>
                            <div className="flex items-center gap-3">
                              <span className="text-amber-600 font-bold text-lg">{PKR(c.totalRemaining)}</span>
                              <Button size="sm" variant="outline" className="text-green-600 border-green-300" onClick={() => openWhatsApp(c.phone, c.name, c.totalRemaining)}><MessageCircle className="h-4 w-4 mr-1" />{t('remind')}</Button>
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditingPayment(null); resetPaymentForm(); setPaymentForm(f => ({ ...f, customerId: c.id })); setShowPaymentDialog(true); }}><Plus className="h-3 w-3 mr-1" />{t('addPayment')}</Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent></Card>
                  )}

                  {/* Mukammal Udhar (Not Paid) Customers */}
                  {fullyUnpaidCustomers.length > 0 && (
                  <Card className="shadow-sm border-red-200 dark:border-red-800"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><AlertCircle className="h-5 w-5 text-red-500" />{t('notPaid')}</CardTitle></CardHeader><CardContent>
                    <div className="space-y-3">
                      {fullyUnpaidCustomers.map(c => {
                        const cStocks = stockRecords.filter(s => s.customerId === c.id && s.remainingAmount > 0);
                        return (
                          <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-red-200 dark:border-red-800 gap-3 bg-red-50/50 dark:bg-red-900/10">
                            <div><div className="flex items-center gap-2"><p className="font-bold">{c.name}</p><Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-xs">{t('unpaid')}</Badge></div><p className="text-sm text-gray-500">{c.phone} • {cStocks.length} {t('itemsPending')}</p></div>
                            <div className="flex items-center gap-3">
                              <span className="text-red-600 font-bold text-lg">{PKR(c.totalRemaining)}</span>
                              <Button size="sm" variant="outline" className="text-green-600 border-green-300" onClick={() => openWhatsApp(c.phone, c.name, c.totalRemaining)}><MessageCircle className="h-4 w-4 mr-1" />{t('remind')}</Button>
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditingPayment(null); resetPaymentForm(); setPaymentForm(f => ({ ...f, customerId: c.id })); setShowPaymentDialog(true); }}><Plus className="h-3 w-3 mr-1" />{t('addPayment')}</Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent></Card>
                  )}

                  {halfPaidCustomers.length === 0 && fullyUnpaidCustomers.length === 0 && (
                  <Card className="shadow-sm"><CardContent className="p-8 text-center"><CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" /><p className="text-lg font-medium text-green-600">{t('allPaymentsReceived')}</p></CardContent></Card>
                  )}
                  <Card className="shadow-sm"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><CreditCard className="h-5 w-5 text-green-500" />{t('paymentHistory')}</CardTitle></CardHeader><CardContent>
                    <ScrollArea className="max-h-96"><div className="space-y-3">
                      {filteredPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div><p className="font-medium">{p.customer?.name || 'Unknown'}</p><p className="text-sm text-gray-500">{p.paymentMethod} • {new Date(p.date).toLocaleDateString('en-PK')}</p>{p.transactionNote && <p className="text-xs text-gray-400">{p.transactionNote}</p>}</div>
                          <div className="flex items-center gap-3"><span className="text-green-600 font-bold">{PKR(p.amount)}</span><Button variant="outline" size="sm" onClick={() => { setEditingPayment(p); setPaymentForm({ customerId: p.customerId, amount: String(p.amount), date: p.date?.split('T')[0] || '', paymentMethod: p.paymentMethod, bankName: p.bankName, transactionNote: p.transactionNote }); setShowPaymentDialog(true); }}><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeletePayment(p.id)}><Trash2 className="h-4 w-4" /></Button></div>
                        </div>
                      ))}
                      {filteredPayments.length === 0 && <p className="text-center text-gray-400 py-4">{t('noPaymentsRecorded')}</p>}
                    </div></ScrollArea>
                  </CardContent></Card>
                </div>
              );})()}

              {/* BANK PAYMENTS */}
              {activeTab === 'bank' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="shadow-sm card-hover"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-green-500" /><span className="text-sm text-gray-600 dark:text-gray-400">{t('totalBankIn')}</span></div><p className="text-xl font-bold text-green-600">{PKR(bankPayments.filter(b => b.paymentAmount > 0).reduce((s, b) => s + b.paymentAmount, 0))}</p></CardContent></Card>
                    <Card className="shadow-sm card-hover"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><CreditCard className="h-4 w-4 text-blue-500" /><span className="text-sm text-gray-600 dark:text-gray-400">{t('totalTransactions')}</span></div><p className="text-xl font-bold text-blue-600">{bankPayments.length}</p></CardContent></Card>
                    <Card className="shadow-sm card-hover"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Building2 className="h-4 w-4 text-orange-500" /><span className="text-sm text-gray-600 dark:text-gray-400">{t('banksUsed')}</span></div><p className="text-xl font-bold text-orange-600">{new Set(bankPayments.map(b => b.bankName).filter(Boolean)).size}</p></CardContent></Card>
                  </div>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <Button className="h-12 text-base px-6 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditingBankPayment(null); resetBankForm(); setShowBankPaymentDialog(true); }}><Plus className="h-5 w-5 mr-2" />{t('addBankPayment')}</Button>
                    <div className="flex gap-1.5 bg-gray-100 dark:bg-gray-800/80 p-1.5 rounded-xl overflow-x-auto w-full md:w-auto">
                      {['All', 'Bank Transfer', 'Cheque', 'Online'].map(f => (
                        <Button key={f} size="sm" variant="ghost" className={`rounded-lg whitespace-nowrap transition-all ${filterTypeBank === f ? 'bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-400 font-semibold shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-700/50'}`} onClick={() => setFilterTypeBank(f)}>{f === 'All' ? 'All Records' : f}</Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {bankPayments.filter(bp => filterTypeBank === 'All' ? true : bp.paymentMethod === filterTypeBank).map(bp => (
                      <Card key={bp.id} className="shadow-sm"><CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1"><Building2 className="h-4 w-4 text-blue-500" /><h3 className="font-bold">{bp.bankName || bp.paymentMethod}</h3><Badge variant="secondary">{bp.paymentMethod}</Badge></div>
                            <p className="text-sm text-gray-500">{t('customer')}: {bp.customer?.name || 'N/A'}{bp.accountType && ` | ${bp.accountType}`}</p>
                            {bp.transactionNote && <p className="text-xs text-gray-400 mt-1">{bp.transactionNote}</p>}
                            <p className="text-xs text-gray-400 mt-1">{new Date(bp.paymentDate).toLocaleDateString('en-PK')}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-green-600 font-bold text-lg">{PKR(bp.paymentAmount)}</span>
                            <Button variant="outline" size="sm" onClick={() => { setEditingBankPayment(bp); setBankForm({ customerId: bp.customerId, paymentDate: bp.paymentDate?.split('T')[0] || '', paymentAmount: String(bp.paymentAmount), bankName: bp.bankName, accountType: bp.accountType, transactionNote: bp.transactionNote, paymentMethod: bp.paymentMethod }); setShowBankPaymentDialog(true); }}><Edit2 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteBankPayment(bp.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </CardContent></Card>
                    ))}
                    {bankPayments.length === 0 && <Card className="shadow-sm"><CardContent className="p-12 text-center text-gray-400"><Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" /><p className="text-lg">{t('noBankPaymentsRecorded')}</p></CardContent></Card>}
                  </div>
                </div>
              )}

              {/* EXPENSES */}
              {activeTab === 'expenses' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="shadow-sm card-hover"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Receipt className="h-4 w-4 text-red-500" /><span className="text-sm text-gray-600 dark:text-gray-400">{t('totalExpenses')}</span></div><p className="text-xl font-bold text-red-600">{PKR(expenses.reduce((s, e) => s + e.amount, 0))}</p></CardContent></Card>
                    <Card className="shadow-sm card-hover"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Calendar className="h-4 w-4 text-orange-500" /><span className="text-sm text-gray-600 dark:text-gray-400">{t('thisMonthExpenses')}</span></div><p className="text-xl font-bold text-orange-600">{PKR(expenses.filter(e => { const d = new Date(e.date); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).reduce((s, e) => s + e.amount, 0))}</p></CardContent></Card>
                    <Card className="shadow-sm card-hover"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Filter className="h-4 w-4 text-blue-500" /><span className="text-sm text-gray-600 dark:text-gray-400">{t('categoriesUsed')}</span></div><p className="text-xl font-bold text-blue-600">{new Set(expenses.map(e => e.category)).size}</p></CardContent></Card>
                  </div>
                  <Button className="h-12 text-base px-6 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditingExpense(null); resetExpenseForm(); setShowExpenseDialog(true); }}><Plus className="h-5 w-5 mr-2" />{t('addExpense')}</Button>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {EXPENSE_CATEGORIES.slice(0, 4).map(cat => { const tot = expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0); return (<Card key={cat} className="shadow-sm"><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">{cat}</p><p className="text-xl font-bold text-red-600">{PKR(tot)}</p></CardContent></Card>); })}
                  </div>
                  <Card className="shadow-sm"><CardContent className="p-4"><div className="flex justify-between items-center"><span className="text-lg font-bold">{t('totalExpenses')}</span><span className="text-2xl font-bold text-red-600">{PKR(expenses.reduce((s, e) => s + e.amount, 0))}</span></div></CardContent></Card>
                  <div className="grid gap-3">
                    {expenses.map(exp => (
                      <Card key={exp.id} className="shadow-sm"><CardContent className="p-4 flex items-center justify-between">
                        <div><div className="flex items-center gap-2"><h3 className="font-bold">{exp.description}</h3><Badge variant="secondary">{exp.category}</Badge></div><p className="text-sm text-gray-500">{new Date(exp.date).toLocaleDateString('en-PK')}{exp.notes ? ` | ${exp.notes}` : ''}</p></div>
                        <div className="flex items-center gap-3"><span className="text-red-600 font-bold">{PKR(exp.amount)}</span><Button variant="outline" size="sm" onClick={() => { setEditingExpense(exp); setExpenseForm({ description: exp.description, amount: String(exp.amount), category: exp.category, date: exp.date?.split('T')[0] || '', notes: exp.notes }); setShowExpenseDialog(true); }}><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteExpense(exp.id)}><Trash2 className="h-4 w-4" /></Button></div>
                      </CardContent></Card>
                    ))}
                    {expenses.length === 0 && <Card className="shadow-sm"><CardContent className="p-12 text-center text-gray-400"><Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" /><p className="text-lg">{t('noExpensesRecorded')}</p></CardContent></Card>}
                  </div>
                </div>
              )}

              {/* INVOICES */}
              {activeTab === 'invoices' && (
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <h2 className="text-xl font-bold">{t('invoices')}</h2>
                    <div className="flex gap-1.5 bg-gray-100 dark:bg-gray-800/80 p-1.5 rounded-xl overflow-x-auto w-full md:w-auto">
                      {['All', 'sale', 'purchase', 'expense'].map(f => (
                        <Button key={f} size="sm" variant="ghost" className={`capitalize rounded-lg whitespace-nowrap transition-all ${filterTypeInvoice === f ? 'bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-400 font-semibold shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-700/50'}`} onClick={() => setFilterTypeInvoice(f)}>{f === 'All' ? 'All Records' : f + ' Invoices'}</Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {invoices.filter(inv => filterTypeInvoice === 'All' ? true : inv.type === filterTypeInvoice).map(inv => (
                      <Card key={inv.id} className="shadow-sm"><CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1"><h3 className="font-bold">{inv.invoiceNumber}</h3><Badge className={inv.type === 'sale' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'}>{inv.type === 'sale' ? t('sale') : t('purchase')}</Badge><Badge className={inv.status === 'paid' ? 'bg-green-100 text-green-700' : inv.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>{inv.status === 'paid' ? t('paid') : inv.status === 'partial' ? t('partial') : t('unpaid')}</Badge></div>
                            <p className="text-sm text-gray-500">{inv.partyName}{inv.partyCity && ` • ${inv.partyCity}`}</p>
                            <div className="flex flex-wrap gap-3 mt-2 text-sm"><span>{inv.itemName}</span><span>{t('total')}: {PKR(inv.totalAmount)}</span><span className="text-green-600">{t('paid')}: {PKR(inv.paidAmount)}</span><span className="text-red-600">{t('remaining')}: {PKR(inv.remainingAmount)}</span></div>
                            <p className="text-xs text-gray-400 mt-1">{new Date(inv.date).toLocaleDateString('en-PK')}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => { setSelectedInvoice(inv); setShowInvoiceDialog(true); }}><Eye className="h-4 w-4 mr-1" />{t('viewInvoice')}</Button>
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteInvoice(inv.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </CardContent></Card>
                    ))}
                    {invoices.length === 0 && <Card className="shadow-sm"><CardContent className="p-12 text-center text-gray-400"><FileText className="h-12 w-12 mx-auto mb-3 opacity-50" /><p className="text-lg">{t('noInvoicesFound')}</p></CardContent></Card>}
                  </div>
                </div>
              )}

              {/* SEARCH */}
              {activeTab === 'search' && (
                <div className="space-y-4">
                  <Input placeholder={t('searchAnything')} className="h-14 text-lg" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="h-11 w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t('all')}</SelectItem><SelectItem value="paid">{t('paid')}</SelectItem><SelectItem value="unpaid">{t('notPaid')}</SelectItem><SelectItem value="half">{t('halfPaid')}</SelectItem></SelectContent></Select>
                  <Tabs defaultValue="customers">
                    <TabsList className="grid w-full grid-cols-4 h-12">
                      <TabsTrigger value="customers" className="text-sm">{t('customers')}</TabsTrigger>
                      <TabsTrigger value="stock" className="text-sm">{t('stockSent')}</TabsTrigger>
                      <TabsTrigger value="payments" className="text-sm">{t('wasooli')}</TabsTrigger>
                      <TabsTrigger value="purchases" className="text-sm">{t('purchases')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="customers" className="mt-4"><div className="space-y-2">{getFilteredCustomers().map(c => <Card key={c.id} className="shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"><CardContent className="p-3 flex justify-between items-center"><div><p className="font-bold">{c.name}</p><p className="text-sm text-gray-500">{c.phone} • {c.city}</p></div><div className="text-right"><p className="text-red-600 font-semibold">{PKR(c.totalRemaining)}</p><p className="text-sm text-gray-400">{t('remaining')}</p></div></CardContent></Card>)}</div></TabsContent>
                    <TabsContent value="stock" className="mt-4"><div className="space-y-2">{getFilteredStock().map(s => <Card key={s.id} className="shadow-sm"><CardContent className="p-3"><div className="flex justify-between items-start"><div><p className="font-bold">{s.itemName} - {s.customer?.name}</p><p className="text-sm text-gray-500">{s.weight} {s.weightUnit} • {t('total')}: {PKR(s.totalAmount)}</p><p className="text-sm text-red-600">{t('remaining')}: {PKR(s.remainingAmount)}</p></div><Badge variant="outline" className={s.remainingAmount <= 0 ? 'bg-green-50 text-green-700' : s.paidAmount > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}>{s.remainingAmount <= 0 ? t('paid') : s.paidAmount > 0 ? t('partial') : t('unpaid')}</Badge></div></CardContent></Card>)}</div></TabsContent>
                    <TabsContent value="payments" className="mt-4"><div className="space-y-2">{payments.filter(p => { if (!searchQuery) return true; const q = searchQuery.toLowerCase(); return (p.customer?.name || '').toLowerCase().includes(q); }).map(p => <Card key={p.id} className="shadow-sm"><CardContent className="p-3"><p className="font-bold">{p.customer?.name} - {PKR(p.amount)}</p><p className="text-sm text-gray-500">{p.paymentMethod} • {new Date(p.date).toLocaleDateString('en-PK')}</p></CardContent></Card>)}</div></TabsContent>
                    <TabsContent value="purchases" className="mt-4"><div className="space-y-2">{getFilteredPurchases().map(p => <Card key={p.id} className="shadow-sm"><CardContent className="p-3"><div className="flex justify-between items-start"><div><p className="font-bold">{p.supplierName} - {p.itemName}</p><p className="text-sm text-gray-500">{p.weight} {p.weightUnit} • {t('total')}: {PKR(p.totalAmount)}</p><p className="text-sm text-red-600">{t('remaining')}: {PKR(p.remainingAmount)}</p></div><Badge variant="outline" className={p.remainingAmount <= 0 ? 'bg-green-50 text-green-700' : p.paidAmount > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}>{p.remainingAmount <= 0 ? t('paid') : p.paidAmount > 0 ? t('partial') : t('unpaid')}</Badge></div></CardContent></Card>)}</div></TabsContent>
                  </Tabs>
                </div>
              )}

              {/* SETTINGS */}
              {activeTab === 'settings' && (
                <div className="space-y-6 max-w-lg">
                  <Card className="shadow-sm"><CardContent className="p-6 space-y-6">
                    <div className="flex items-center justify-between"><div><h3 className="font-bold text-lg">{t('darkMode')}</h3><p className="text-sm text-gray-500">Light / Dark theme</p></div><Switch checked={darkMode} onCheckedChange={setDarkMode} /></div>
                    <Separator />
                    <div><h3 className="font-bold text-lg mb-3">{t('customBranding')}</h3>
                      <div className="space-y-4">
                        <div><Label className="text-sm">{t('appNameLabel')}</Label><Input value={branding.appName} onChange={e => setBranding({...branding, appName: e.target.value})} className="mt-1.5 h-11" /></div>
                        <div><Label className="text-sm">{t('logoLabel')}</Label><Input value={branding.logoUrl || ''} placeholder="e.g. 💼 or https://..." onChange={e => setBranding({...branding, logoUrl: e.target.value})} className="mt-1.5 h-11" /></div>
                        <div><Label className="text-sm block mb-2">{t('themeColorLabel')}</Label>
                          <div className="flex gap-3">
                            {['#059669', '#2563eb', '#dc2626', '#d97706', '#9333ea', '#0f172a'].map(color => (
                              <button key={color} type="button" onClick={() => setBranding({...branding, primaryColor: color})} className={`w-8 h-8 rounded-full border-2 transition-transform ${branding.primaryColor === color ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: color }} />
                            ))}
                          </div>
                        </div>
                        <Button className="w-full h-11 text-white font-medium hover:opacity-90 btn-premium" style={{ backgroundColor: branding.primaryColor }} onClick={async () => { if (user) { await store.saveBranding(user.id, branding); try { localStorage.setItem('fintracker_branding', JSON.stringify(branding)); } catch {} toast({ title: t('updated'), description: t('brandingSaved') }); } }}>{t('saveBranding')}</Button>
                      </div>
                    </div>
                    <Separator />
                    <div><h3 className="font-bold text-lg mb-1">{t('yourAccount')}</h3><p className="text-sm text-gray-500">{user?.email}</p><p className="text-sm text-gray-500">{t('name')}: {user?.name}</p></div>
                    <Separator />
                    <div><h3 className="font-bold text-lg mb-3">{t('currency')}</h3><Badge className="text-base px-4 py-1">PKR - Pakistani Rupees</Badge></div>
                    <Separator />
                    <div><h3 className="font-bold text-lg mb-3">{t('dataBackup')}</h3><p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{language === 'ur' ? 'آپ کا ڈیٹا خودکار محفوظ ہوتا ہے۔' : 'Your data is saved automatically.'}</p>
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" className="w-full h-11" onClick={handleDownloadBackup}><Download className="h-4 w-4 mr-2" />{t('downloadBackup')}</Button>
                        <div className="relative">
                          <input type="file" title="Upload Backup (JSON)" accept=".json" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = async (ev) => {
                              try {
                                if (!user) return;
                                const data = JSON.parse(ev.target?.result as string);
                                if (await store.restoreBackup(data, user.id)) {
                                  toast({ title: t('updated'), description: 'Backup restored successfully' });
                                  setTimeout(() => window.location.reload(), 1000);
                                } else {
                                  toast({ title: t('error'), description: 'Failed to restore backup', variant: 'destructive' });
                                }
                              } catch {
                                toast({ title: t('error'), description: 'Invalid JSON file', variant: 'destructive' });
                              }
                            };
                            reader.readAsText(file);
                            e.target.value = '';
                          }} />
                          <Button variant="outline" className="w-full h-11 pointer-events-none"><Upload className="h-4 w-4 mr-2" />Upload Backup (JSON)</Button>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="pt-2"><Button variant="destructive" className="w-full h-11" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" />{t('logout')}</Button></div>
                  </CardContent></Card>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Customer Dialog */}
      <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{editingCustomer ? t('editCustomer') : t('addNewCustomer')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label className="text-base">{t('name')} *</Label><Input className="h-12 text-base mt-1" value={custForm.name} onChange={e => setCustForm({ ...custForm, name: e.target.value })} /></div>
          <div><Label className="text-base">{t('phone')} *</Label><Input className="h-12 text-base mt-1" placeholder="03XX-XXXXXXX" value={custForm.phone} onChange={e => setCustForm({ ...custForm, phone: e.target.value })} /></div>
          <div>
            <Label className="text-base">{t('city')}</Label>
            <Select value={custForm.city} onValueChange={v => setCustForm({ ...custForm, city: v })}>
              <SelectTrigger className="h-12 text-base mt-1">
                <SelectValue placeholder={t('selectCity') || 'Select City'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None / Any</SelectItem>
                <SelectItem value="Lahore">Lahore</SelectItem>
                <SelectItem value="Karachi">Karachi</SelectItem>
                <SelectItem value="Islamabad">Islamabad</SelectItem>
                <SelectItem value="Rawalpindi">Rawalpindi</SelectItem>
                <SelectItem value="Faisalabad">Faisalabad</SelectItem>
                <SelectItem value="Multan">Multan</SelectItem>
                <SelectItem value="Peshawar">Peshawar</SelectItem>
                <SelectItem value="Quetta">Quetta</SelectItem>
                <SelectItem value="Gujranwala">Gujranwala</SelectItem>
                <SelectItem value="Sialkot">Sialkot</SelectItem>
                <SelectItem value="Abbottabad">Abbottabad</SelectItem>
                <SelectItem value="Bahawalpur">Bahawalpur</SelectItem>
                <SelectItem value="Sargodha">Sargodha</SelectItem>
                <SelectItem value="Sukkur">Sukkur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-base">{t('address')}</Label><Textarea className="mt-1" value={custForm.address} onChange={e => setCustForm({ ...custForm, address: e.target.value })} /></div>
          <div><Label className="text-base">{t('notes')}</Label><Textarea className="mt-1" value={custForm.notes} onChange={e => setCustForm({ ...custForm, notes: e.target.value })} /></div>
          <Button className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveCustomer}>{editingCustomer ? t('updateCustomer') : t('addCustomer')}</Button>
        </div>
      </DialogContent></Dialog>

      {/* Stock Dialog */}
      <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editingStock ? t('editStockRecord') : t('sendStockToCustomer')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label className="text-base">{t('customer')} *</Label><Select value={stockForm.customerId} onValueChange={v => setStockForm({ ...stockForm, customerId: v })}><SelectTrigger className="h-12 text-base mt-1"><SelectValue placeholder={t('selectCustomer')} /></SelectTrigger><SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-base">{t('date')}</Label><Input type="date" className="h-12 text-base mt-1" value={stockForm.date} onChange={e => setStockForm({ ...stockForm, date: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-base">{t('itemName')} *</Label>
              <Combobox value={stockForm.itemName} onChange={val => setStockForm({ ...stockForm, itemName: val })} options={ITEM_CATEGORIES} placeholder="Type or Select..." />
            </div>
            <div>
              <Label className="text-base">{t('category')}</Label>
              <Combobox value={stockForm.itemCategory} onChange={val => setStockForm({ ...stockForm, itemCategory: val })} options={MAIN_CATEGORIES} placeholder="Type or Select..." />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-base">{t('weight')}</Label><Input type="number" className="h-12 text-base mt-1" value={stockForm.weight} onChange={e => { const w = e.target.value; setStockForm(f => ({ ...f, weight: w, totalAmount: calculateAmount(w, f.pricePerUnit, f.weightUnit) || f.totalAmount })); }} /></div>
            <div><Label className="text-base">Unit</Label><Select value={stockForm.weightUnit} onValueChange={v => setStockForm(f => ({ ...f, weightUnit: v, totalAmount: calculateAmount(f.weight, f.pricePerUnit, v) || f.totalAmount }))}><SelectTrigger className="h-12 text-base mt-1"><SelectValue /></SelectTrigger><SelectContent>{WEIGHT_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-base">{t('price')} (KG)</Label><Input type="number" className="h-12 text-base mt-1" value={stockForm.pricePerUnit} onChange={e => { const p = e.target.value; setStockForm(f => ({ ...f, pricePerUnit: p, totalAmount: calculateAmount(f.weight, p, f.weightUnit) || f.totalAmount })); }} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-base">Total Amount</Label><Input type="number" className="h-12 text-base mt-1" value={stockForm.totalAmount} onChange={e => setStockForm({ ...stockForm, totalAmount: e.target.value })} /></div>
            <div><Label className="text-base">Paid Amount</Label><Input type="number" className="h-12 text-base mt-1" value={stockForm.paidAmount} onChange={e => setStockForm({ ...stockForm, paidAmount: e.target.value })} /></div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800"><div className="flex justify-between text-base"><span className="text-gray-500">{t('remainingAmountLabel')}</span><span className="font-bold text-red-600">{PKR((parseFloat(stockForm.totalAmount) || 0) - (parseFloat(stockForm.paidAmount) || 0))}</span></div></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-base">{t('paymentMethod')}</Label><Select value={stockForm.paymentMethod} onValueChange={v => setStockForm({ ...stockForm, paymentMethod: v, bankName: v === 'Cash' ? '' : stockForm.bankName })}><SelectTrigger className="h-12 text-base mt-1"><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
            {stockForm.paymentMethod !== 'Cash' && <div><Label className="text-base">{t('bankName')}</Label><Select value={stockForm.bankName} onValueChange={v => setStockForm({ ...stockForm, bankName: v })}><SelectTrigger className="h-12 text-base mt-1"><SelectValue /></SelectTrigger><SelectContent>{PAKISTANI_BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>}
          </div>
          <div><Label className="text-base">{t('notes')}</Label><Textarea className="mt-1" value={stockForm.notes} onChange={e => setStockForm({ ...stockForm, notes: e.target.value })} /></div>
          <Button className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveStock}>{editingStock ? t('updateStock') : t('sendStock')}</Button>
        </div>
      </DialogContent></Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{editingPayment ? t('editPayment') : t('addPaymentWasooli')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label className="text-base">{t('customer')} *</Label><Select value={paymentForm.customerId} onValueChange={v => setPaymentForm({ ...paymentForm, customerId: v })}><SelectTrigger className="h-12 text-base mt-1"><SelectValue placeholder={t('selectCustomer')} /></SelectTrigger><SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.totalRemaining > 0 ? `(${t('remaining')}: ${PKR(c.totalRemaining)})` : `(${t('paid')})`}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-base">{t('amount')} (PKR) *</Label><Input type="number" className="h-12 text-base mt-1" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></div>
          <div><Label className="text-base">{t('date')}</Label><Input type="date" className="h-12 text-base mt-1" value={paymentForm.date} onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })} /></div>
          <div><Label className="text-base">{t('paymentMethod')}</Label><Select value={paymentForm.paymentMethod} onValueChange={v => setPaymentForm({ ...paymentForm, paymentMethod: v })}><SelectTrigger className="h-12 text-base mt-1"><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
          {paymentForm.paymentMethod !== 'Cash' && <div><Label className="text-base">{t('bankName')}</Label><Select value={paymentForm.bankName} onValueChange={v => setPaymentForm({ ...paymentForm, bankName: v })}><SelectTrigger className="h-12 text-base mt-1"><SelectValue /></SelectTrigger><SelectContent>{PAKISTANI_BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>}
          <div><Label className="text-base">{t('transactionNote')}</Label><Textarea className="mt-1" value={paymentForm.transactionNote} onChange={e => setPaymentForm({ ...paymentForm, transactionNote: e.target.value })} /></div>
          <Button className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700" onClick={handleSavePayment}>{editingPayment ? t('savePayment') : t('addPayment')}</Button>
        </div>
      </DialogContent></Dialog>

      {/* Bank Payment Dialog */}
      <Dialog open={showBankPaymentDialog} onOpenChange={setShowBankPaymentDialog}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{editingBankPayment ? t('editBankPayment') : t('addBankPaymentRecord')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label className="text-base">{t('customer')} (Optional)</Label><Select value={bankForm.customerId} onValueChange={v => setBankForm({ ...bankForm, customerId: v })}><SelectTrigger className="h-12 text-base mt-1"><SelectValue placeholder={t('selectCustomer')} /></SelectTrigger><SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-base">{t('amount')} (PKR) *</Label><Input type="number" className="h-12 text-base mt-1" value={bankForm.paymentAmount} onChange={e => setBankForm({ ...bankForm, paymentAmount: e.target.value })} /></div>
          <div><Label className="text-base">{t('date')}</Label><Input type="date" className="h-12 text-base mt-1" value={bankForm.paymentDate} onChange={e => setBankForm({ ...bankForm, paymentDate: e.target.value })} /></div>
          <div><Label className="text-base">{t('paymentMethod')}</Label><Select value={bankForm.paymentMethod} onValueChange={v => setBankForm({ ...bankForm, paymentMethod: v })}><SelectTrigger className="h-12 text-base mt-1"><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-base">{t('bankName')}</Label><Select value={bankForm.bankName} onValueChange={v => setBankForm({ ...bankForm, bankName: v })}><SelectTrigger className="h-12 text-base mt-1"><SelectValue /></SelectTrigger><SelectContent>{PAKISTANI_BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-base">{t('accountType')}</Label><Input className="h-12 text-base mt-1" value={bankForm.accountType} onChange={e => setBankForm({ ...bankForm, accountType: e.target.value })} /></div>
          <div><Label className="text-base">{t('transactionNote')}</Label><Textarea className="mt-1" value={bankForm.transactionNote} onChange={e => setBankForm({ ...bankForm, transactionNote: e.target.value })} /></div>
          <Button className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveBankPayment}>{editingBankPayment ? t('saveBankPayment') : t('addBankPayment')}</Button>
        </div>
      </DialogContent></Dialog>

      {/* Expense Dialog */}
      <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{editingExpense ? t('editExpense') : t('addNewExpense')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label className="text-base">{t('description')} *</Label><Input className="h-12 text-base mt-1" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} /></div>
          <div><Label className="text-base">{t('amount')} (PKR) *</Label><Input type="number" className="h-12 text-base mt-1" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} /></div>
          <div><Label className="text-base">{t('category')}</Label><Select value={expenseForm.category} onValueChange={v => setExpenseForm({ ...expenseForm, category: v })}><SelectTrigger className="h-12 text-base mt-1"><SelectValue /></SelectTrigger><SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-base">{t('date')}</Label><Input type="date" className="h-12 text-base mt-1" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} /></div>
          <div><Label className="text-base">{t('notes')}</Label><Textarea className="mt-1" value={expenseForm.notes} onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })} /></div>
          <Button className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveExpense}>{editingExpense ? t('saveExpense') : t('addExpense')}</Button>
        </div>
      </DialogContent></Dialog>

      {/* Purchase Dialog */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editingPurchase ? t('editPurchase') : t('addNewPurchase')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label className="text-base">{t('supplierName')} *</Label><Input className="h-12 text-base mt-1" value={purchaseForm.supplierName} onChange={e => setPurchaseForm({ ...purchaseForm, supplierName: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-base">{t('phone')}</Label><Input className="h-12 text-base mt-1" value={purchaseForm.supplierPhone} onChange={e => setPurchaseForm({ ...purchaseForm, supplierPhone: e.target.value })} /></div>
            <div>
              <Label className="text-base">{t('city')}</Label>
              <Select value={purchaseForm.supplierCity} onValueChange={v => setPurchaseForm({ ...purchaseForm, supplierCity: v })}>
                <SelectTrigger className="h-12 text-base mt-1">
                  <SelectValue placeholder={t('selectCity') || 'Select City'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None / Any</SelectItem>
                  <SelectItem value="Lahore">Lahore</SelectItem>
                  <SelectItem value="Karachi">Karachi</SelectItem>
                  <SelectItem value="Islamabad">Islamabad</SelectItem>
                  <SelectItem value="Rawalpindi">Rawalpindi</SelectItem>
                  <SelectItem value="Faisalabad">Faisalabad</SelectItem>
                  <SelectItem value="Multan">Multan</SelectItem>
                  <SelectItem value="Peshawar">Peshawar</SelectItem>
                  <SelectItem value="Quetta">Quetta</SelectItem>
                  <SelectItem value="Gujranwala">Gujranwala</SelectItem>
                  <SelectItem value="Sialkot">Sialkot</SelectItem>
                  <SelectItem value="Abbottabad">Abbottabad</SelectItem>
                  <SelectItem value="Bahawalpur">Bahawalpur</SelectItem>
                  <SelectItem value="Sargodha">Sargodha</SelectItem>
                  <SelectItem value="Sukkur">Sukkur</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-base">{t('date')}</Label><Input type="date" className="h-12 text-base mt-1" value={purchaseForm.date} onChange={e => setPurchaseForm({ ...purchaseForm, date: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-base">{t('itemName')} *</Label>
              <Combobox value={purchaseForm.itemName} onChange={val => setPurchaseForm({ ...purchaseForm, itemName: val })} options={ITEM_CATEGORIES} placeholder="Type or Select..." />
            </div>
            <div>
              <Label className="text-base">{t('category')}</Label>
              <Combobox value={purchaseForm.itemCategory} onChange={val => setPurchaseForm({ ...purchaseForm, itemCategory: val })} options={MAIN_CATEGORIES} placeholder="Type or Select..." />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-base">{t('weight')}</Label><Input type="number" className="h-12 text-base mt-1" value={purchaseForm.weight} onChange={e => { const w = e.target.value; setPurchaseForm(f => ({ ...f, weight: w, totalAmount: calculateAmount(w, f.pricePerUnit, f.weightUnit) || f.totalAmount })); }} /></div>
            <div><Label className="text-base">Unit</Label><Select value={purchaseForm.weightUnit} onValueChange={v => setPurchaseForm(f => ({ ...f, weightUnit: v, totalAmount: calculateAmount(f.weight, f.pricePerUnit, v) || f.totalAmount }))}><SelectTrigger className="h-12 text-base mt-1"><SelectValue /></SelectTrigger><SelectContent>{WEIGHT_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-base">{t('price')} (KG)</Label><Input type="number" className="h-12 text-base mt-1" value={purchaseForm.pricePerUnit} onChange={e => { const p = e.target.value; setPurchaseForm(f => ({ ...f, pricePerUnit: p, totalAmount: calculateAmount(f.weight, p, f.weightUnit) || f.totalAmount })); }} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-base">Total Amount</Label><Input type="number" className="h-12 text-base mt-1" value={purchaseForm.totalAmount} onChange={e => setPurchaseForm({ ...purchaseForm, totalAmount: e.target.value })} /></div>
            <div><Label className="text-base">Paid Amount</Label><Input type="number" className="h-12 text-base mt-1" value={purchaseForm.paidAmount} onChange={e => setPurchaseForm({ ...purchaseForm, paidAmount: e.target.value })} /></div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800"><div className="flex justify-between text-base"><span className="text-gray-500">{t('remainingAmountLabel')}</span><span className="font-bold text-red-600">{PKR((parseFloat(purchaseForm.totalAmount) || 0) - (parseFloat(purchaseForm.paidAmount) || 0))}</span></div></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-base">{t('paymentMethod')}</Label><Select value={purchaseForm.paymentMethod} onValueChange={v => setPurchaseForm({ ...purchaseForm, paymentMethod: v, bankName: v === 'Cash' ? '' : purchaseForm.bankName })}><SelectTrigger className="h-12 text-base mt-1"><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
            {purchaseForm.paymentMethod !== 'Cash' && <div><Label className="text-base">{t('bankName')}</Label><Select value={purchaseForm.bankName} onValueChange={v => setPurchaseForm({ ...purchaseForm, bankName: v })}><SelectTrigger className="h-12 text-base mt-1"><SelectValue /></SelectTrigger><SelectContent>{PAKISTANI_BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>}
          </div>
          <div><Label className="text-base">{t('notes')}</Label><Textarea className="mt-1" value={purchaseForm.notes} onChange={e => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} /></div>
          <Button className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700" onClick={handleSavePurchase}>{editingPurchase ? t('savePurchase') : t('addPurchase')}</Button>
        </div>
      </DialogContent></Dialog>

      {/* Customer Detail Dialog */}
      <Dialog open={showCustomerDetail} onOpenChange={setShowCustomerDetail}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{t('customerDetails')} - {selectedCustomer?.name}</DialogTitle></DialogHeader>
        {selectedCustomer && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card className="shadow-sm bg-emerald-50 dark:bg-emerald-900/20"><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">{t('paid')}</p><p className="text-xl font-bold text-green-600">{PKR(selectedCustomer.totalPaid)}</p></CardContent></Card>
              <Card className="shadow-sm bg-red-50 dark:bg-red-900/20"><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">{t('remaining')}</p><p className="text-xl font-bold text-red-600">{PKR(selectedCustomer.totalRemaining)}</p></CardContent></Card>
            </div>
            <div className="space-y-2 text-sm">
              <p><strong>{t('phone')}:</strong> {selectedCustomer.phone}</p>
              <p><strong>{t('city')}:</strong> {selectedCustomer.city || 'N/A'}</p>
              <p><strong>{t('address')}:</strong> {selectedCustomer.address || 'N/A'}</p>
              <p><strong>{t('notes')}:</strong> {selectedCustomer.notes || 'N/A'}</p>
            </div>
            <Separator />
            <div><h3 className="font-bold text-lg mb-3">{t('paymentTimeline')}</h3><div className="space-y-1 mt-4">
              {(() => {
                const cStocks = stockRecords.filter(s => s.customerId === selectedCustomer.id).map(s => ({ type: 'sale', date: s.date, createdAt: s.createdAt, title: `Sale: ${s.itemName} (${s.weight} ${s.weightUnit})`, amount: s.totalAmount, record: s }));
                const cPayments = payments.filter(p => p.customerId === selectedCustomer.id).map(p => ({ type: 'payment', date: p.date, createdAt: p.createdAt, title: p.stockRecordId ? `Payment (Sale Downpayment)` : `Wasooli (${p.paymentMethod})`, amount: p.amount, record: p }));
                const history = [...cStocks, ...cPayments].sort((a, b) => {
                  if (a.date !== b.date) return new Date(a.date).getTime() - new Date(b.date).getTime();
                  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                });
                
                let balance = 0;
                if (history.length === 0) return <p className="text-sm text-gray-500 text-center py-4">{t('noTransactionsFound')}</p>;
                return history.map((h, i) => {
                  if (h.type === 'sale') balance += h.amount;
                  else balance -= h.amount;
                  
                  return (
                    <div key={`${h.type}-${h.record.id}`} className="relative pl-6 pb-2 border-l-2 border-gray-200 dark:border-gray-800 last:border-transparent last:pb-0">
                      <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-gray-950 ${h.type === 'sale' ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between bg-gray-50/50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800 ml-2 mb-3">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            {h.title}
                            <Badge variant="outline" className={h.type === 'sale' ? 'h-5 px-1.5 text-[10px] border-orange-200 text-orange-600 bg-orange-50' : 'h-5 px-1.5 text-[10px] border-emerald-200 text-emerald-600 bg-emerald-50'}>{h.type === 'sale' ? 'DEBT (+)' : 'CREDIT (-)'}</Badge>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{new Date(h.date).toLocaleDateString('en-PK')} • {new Date(h.createdAt).toLocaleTimeString('en-PK', {hour: '2-digit', minute:'2-digit'})}</p>
                        </div>
                        <div className="text-right mt-2 sm:mt-0">
                          <p className={`font-bold ${h.type === 'sale' ? 'text-orange-600' : 'text-emerald-600'}`}>{PKR(h.amount)}</p>
                          <p className="text-xs text-gray-500 font-medium whitespace-nowrap mt-1">Bal: {PKR(Math.max(0, balance))}</p>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div></div>
            {selectedCustomer.totalRemaining > 0 && <Button className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700" onClick={() => { setShowCustomerDetail(false); setEditingPayment(null); resetPaymentForm(); setPaymentForm(f => ({ ...f, customerId: selectedCustomer.id })); setShowPaymentDialog(true); }}><Plus className="h-4 w-4 mr-2" />{t('quickAddPayment')}</Button>}
          </div>
        )}
      </DialogContent></Dialog>

      {/* Invoice View Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{t('invoiceDetails')}</DialogTitle></DialogHeader>
        {selectedInvoice && (
          <div id="invoice-print" className="space-y-6">
            <div className="text-center border-b pb-4">
              <h2 className="text-2xl font-bold text-emerald-700">Finance Tracker</h2>
              <p className="text-gray-500">Business & Finance Manager</p>
              <p className="mt-2 text-lg font-mono font-bold">{selectedInvoice.invoiceNumber}</p>
              <div className="flex justify-center gap-3 mt-2"><Badge className={selectedInvoice.type === 'sale' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}>{selectedInvoice.type === 'sale' ? t('sale') : t('purchase')}</Badge><Badge className={selectedInvoice.status === 'paid' ? 'bg-green-100 text-green-700' : selectedInvoice.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>{selectedInvoice.status === 'paid' ? t('paid') : selectedInvoice.status === 'partial' ? t('partial') : t('unpaid')}</Badge></div>
            </div>
            <div><h3 className="font-bold text-lg mb-2">{t('partyDetails')}</h3><div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div><p className="text-sm text-gray-500">{t('name')}</p><p className="font-semibold">{selectedInvoice.partyName || 'N/A'}</p></div>
              <div><p className="text-sm text-gray-500">{t('phone')}</p><p className="font-semibold">{selectedInvoice.partyPhone || 'N/A'}</p></div>
              <div><p className="text-sm text-gray-500">{t('city')}</p><p className="font-semibold">{selectedInvoice.partyCity || 'N/A'}</p></div>
            </div></div>
            <div><h3 className="font-bold text-lg mb-2">{t('itemDetails')}</h3><div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
              <div className="flex justify-between"><span className="text-gray-500">{t('itemName')}</span><span className="font-semibold">{selectedInvoice.itemName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t('category')}</span><span>{selectedInvoice.itemCategory || 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t('weight')}</span><span>{selectedInvoice.weight} {selectedInvoice.weightUnit}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t('price')}</span><span>{PKR(selectedInvoice.pricePerUnit)}</span></div>
            </div></div>
            <div><h3 className="font-bold text-lg mb-2">{t('amountBreakdown')}</h3><div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg space-y-2">
              <div className="flex justify-between text-lg"><span>Total</span><span className="font-bold">{PKR(selectedInvoice.totalAmount)}</span></div>
              <div className="flex justify-between text-lg"><span className="text-green-600">{t('paid')}</span><span className="font-bold text-green-600">{PKR(selectedInvoice.paidAmount)}</span></div>
              <Separator />
              <div className="flex justify-between text-xl"><span className="text-red-600">{t('remaining')}</span><span className="font-bold text-red-600">{PKR(selectedInvoice.remainingAmount)}</span></div>
            </div></div>
            <div className="flex gap-3 no-print"><Button className="flex-1 h-12 btn-premium" style={{ backgroundColor: branding.primaryColor || '#059669' }} onClick={handleInvoicePrint}><Printer className="h-4 w-4 mr-2" />{t('printInvoice')}</Button><Button variant="outline" className="flex-1 h-12" onClick={() => setShowInvoiceDialog(false)}>{t('cancel')}</Button></div>
          </div>
        )}
      </DialogContent></Dialog>

      <Dialog open={showPrintHintDialog} onOpenChange={setShowPrintHintDialog}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>{t('printRestricted')}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-gray-500">{t('printPreviewRestricted')}</p>
          <div className="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-lg flex items-start gap-3 border border-emerald-100 dark:border-emerald-800">
            <ExternalLink className="w-5 h-5 text-emerald-600 mt-0.5" />
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">{t('openInNewTabHint')}</p>
          </div>
          <Button className="w-full h-11" onClick={() => setShowPrintHintDialog(false)}>{t('close')}</Button>
        </div>
      </DialogContent></Dialog>

      {/* Calculator Dialog */}
      <Dialog open={showCalculator} onOpenChange={setShowCalculator}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>{t('simpleCalculator')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-right"><p className="text-3xl font-bold">{calcDisplay}</p></div>
          <div className="grid grid-cols-4 gap-2">
            {['7','8','9','/','4','5','6','*','1','2','3','-','0','.','=','+','C'].map(key => (
              <Button key={key} variant={key === '=' ? 'default' : 'outline'} className={`h-14 text-lg font-bold ${key === 'C' ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900 dark:text-red-300' : ''} ${key === '=' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`} onClick={() => handleCalc(key)}>{key}</Button>
            ))}
          </div>
        </div>
      </DialogContent></Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConf} onOpenChange={(open) => !open && setDeleteConf(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('confirmDeletion')}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('confirmDeleteMsg')}</p>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteConf(null)}>{t('cancelBtn')}</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? t('deletingBtn') : t('deleteBtn')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Action Button (Mobile) */}
      <div className="fixed bottom-6 right-6 lg:hidden no-print z-30">
        {activeTab === 'customers' && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Button size="lg" className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-xl" onClick={() => { setEditingCustomer(null); resetCustForm(); setShowCustomerDialog(true); }}><Plus className="h-8 w-8" /></Button></motion.div>}
        {activeTab === 'stock' && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Button size="lg" className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-xl" onClick={() => { setEditingStock(null); resetStockForm(); setShowStockDialog(true); }}><Plus className="h-8 w-8" /></Button></motion.div>}
        {activeTab === 'purchases' && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Button size="lg" className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-xl" onClick={() => { setEditingPurchase(null); resetPurchaseForm(); setShowPurchaseDialog(true); }}><Plus className="h-8 w-8" /></Button></motion.div>}
        {activeTab === 'wasooli' && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Button size="lg" className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-xl" onClick={() => { setEditingPayment(null); resetPaymentForm(); setShowPaymentDialog(true); }}><Plus className="h-8 w-8" /></Button></motion.div>}
        {activeTab === 'bank' && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Button size="lg" className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-xl" onClick={() => { setEditingBankPayment(null); resetBankForm(); setShowBankPaymentDialog(true); }}><Plus className="h-8 w-8" /></Button></motion.div>}
        {activeTab === 'expenses' && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Button size="lg" className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-xl" onClick={() => { setEditingExpense(null); resetExpenseForm(); setShowExpenseDialog(true); }}><Plus className="h-8 w-8" /></Button></motion.div>}
      </div>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
