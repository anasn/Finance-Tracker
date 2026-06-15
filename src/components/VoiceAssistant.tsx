import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, PlaySquare } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { toast } from '../hooks/use-toast';
import * as store from '../store';

interface VoiceAssistantProps {
  userId: string;
  customers: any[];
  onActionComplete: (message?: string) => void;
  onNavigateToTab: (tabId: string) => void;
}

export function VoiceAssistant({ userId, customers, onActionComplete, onNavigateToTab }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [message, setMessage] = useState('');
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      // Use Urdu as primary
      recognition.lang = 'ur-PK';

      recognition.onstart = () => {
        setIsListening(true);
        setMessage('Listening...');
        setTranscript('');
      };

      recognition.onresult = async (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        setTranscript(currentText);
        setMessage(currentText);

        if (finalTranscript) {
          setIsListening(false);
          recognitionRef.current?.stop();
          setMessage(`Processing: "${finalTranscript}"...`);
          await processVoiceCommand(finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setMessage('Microphone access denied. Please click the icon in your address bar to allow microphone access.');
          toast({ title: 'Microphone permission denied', description: 'Please allow microphone access to use the Voice Assistant.', variant: 'destructive' });
        } else if (event.error === 'no-speech') {
          setMessage('No speech detected.');
        } else {
          setMessage('Error listening. Try again.');
        }
        setTimeout(() => setMessage(''), 5000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("Speech Recognition API not supported in this browser.");
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [customers, userId]);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      toast({ title: 'Error', description: 'Voice recognition is not supported in this browser.', variant: 'destructive' });
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error('Error starting recognition:', e);
      }
    }
  };
  
  const findCustomerByName = (name: string) => {
    if (!name) return null;
    const lowerName = name.toLowerCase();
    
    // Exact match
    let match = customers.find(c => c.name.toLowerCase() === lowerName);
    if (match) return match;
    
    // Partial match
    const partials = customers.filter(c => c.name.toLowerCase().includes(lowerName) || lowerName.includes(c.name.toLowerCase()));
    
    // For now we just return the best match or null.
    // If multiple matches, we could ask the user, but for simplicity, return the first partial match or null.
    if (partials.length === 1) return partials[0];
    if (partials.length > 1) {
      // Find the one that matches best, or just return first
      return partials[0];
    }
    
    return null;
  };

  const processVoiceCommand = async (text: string) => {
    setIsProcessing(true);
    
    try {
      const resp = await fetch('/api/gemini/parse-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text })
      });
      
      if (!resp.ok) {
        throw new Error('Failed to parse command');
      }
      
      const data = await resp.json();
      
      if (data.intent === 'askUser') {
        speak(data.question);
        setMessage(data.question);
        setTimeout(() => setMessage(''), 5000);
        setIsProcessing(false);
        return;
      }
      
      let successMsg = '';

      if (data.intent === 'create_sale') {
        const customerMatch = findCustomerByName(data.customer);
        if (!customerMatch) {
          speak(`Customer ${data.customer} nahi mila. Pehle customer add karein.`);
          setMessage(`Customer '${data.customer}' not found.`);
          setTimeout(() => setMessage(''), 5000);
          setIsProcessing(false);
          return;
        }
        
        await store.createStockRecord({
          userId,
          customerId: customerMatch.id,
          date: data.date || new Date().toISOString().split('T')[0],
          itemName: data.product || 'Items',
          itemCategory: data.category || 'General',
          weight: data.quantity || '1',
          weightUnit: 'QTY',
          pricePerUnit: String(data.totalAmount || 0),
          totalAmount: String(data.totalAmount || 0),
          paidAmount: String(data.paidAmount || 0),
          remainingAmount: String(data.remainingAmount || data.totalAmount || 0),
          paymentMethod: 'Voice',
          bankName: '',
          notes: 'Added via Voice Assistant'
        });
        
        // Sync ledger
        await store.syncCustomerLedger(customerMatch.id, userId);
        successMsg = `Sale recorded for ${customerMatch.name}`;
      } 
      else if (data.intent === 'create_payment') {
        const customerMatch = findCustomerByName(data.customer);
        if (!customerMatch) {
          speak(`Customer ${data.customer} nahi mila.`);
          setMessage(`Customer '${data.customer}' not found.`);
          setTimeout(() => setMessage(''), 5000);
          setIsProcessing(false);
          return;
        }
        
        await store.createPayment({
          userId,
          customerId: customerMatch.id,
          date: data.date || new Date().toISOString().split('T')[0],
          amount: String(data.amount || 0),
          paymentMethod: 'Voice',
          bankName: '',
          transactionNote: 'Added via Voice Assistant'
        });
        
        // Sync ledger
        await store.syncCustomerLedger(customerMatch.id, userId);
        successMsg = `Payment of ${data.amount} recorded for ${customerMatch.name}`;
      }
      else if (data.intent === 'create_customer') {
        await store.createCustomer({
          userId,
          name: data.customer,
          phone: data.phone || '',
          city: '',
          address: '',
          notes: ''
        });
        successMsg = `Customer ${data.customer} added.`;
      }
      else if (data.intent === 'search_customer' || data.intent === 'show_balance') {
        const customerMatch = findCustomerByName(data.customer);
        if (customerMatch) {
          successMsg = `${customerMatch.name} ka remaining balance ${customerMatch.totalRemaining} rupees hai.`;
          onNavigateToTab('customers');
        } else {
          successMsg = `Customer ${data.customer} nahi mila.`;
        }
      }
      else if (data.intent === 'show_today_sales' || data.intent === 'show_today_wasooli') {
        onNavigateToTab('dashboard');
        successMsg = `Opening dashboard.`;
      }
      else if (data.intent === 'show_pending_customers') {
        onNavigateToTab('customers');
        successMsg = `Opening customers list.`;
      }
      else {
        successMsg = `Samajh nahi aaya. Dobara koshish karein.`;
      }
      
      speak(successMsg);
      setMessage(successMsg);
      toast({ title: 'Voice Assistant', description: successMsg });
      onActionComplete(successMsg);
      
      setTimeout(() => setMessage(''), 5000);
      
    } catch (error: any) {
      console.error(error);
      const err = 'Error processing voice command.';
      setMessage(err);
      toast({ title: 'Error', description: err, variant: 'destructive' });
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const speak = (text: string) => {
    // Basic TTS output
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      // Try to find a Hindi or Urdu voice, otherwise default
      const voices = window.speechSynthesis.getVoices();
      const urduVoice = voices.find(v => v.lang.startsWith('ur') || v.lang.startsWith('hi'));
      if (urduVoice) utterance.voice = urduVoice;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {message && (
        <Card className="shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300 mb-2 max-w-[250px]">
          <CardContent className="p-3 text-sm font-medium">
            {message}
          </CardContent>
        </Card>
      )}
      <Button 
        onClick={toggleListen}
        disabled={isProcessing}
        size="lg" 
        className={`h-14 w-14 rounded-full shadow-lg transition-all duration-300 ${
          isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 
          isProcessing ? 'bg-amber-500 hover:bg-amber-600' :
          'bg-indigo-600 hover:bg-indigo-700'
        }`}
      >
        {isListening ? (
          <MicOff className="h-6 w-6 text-white" />
        ) : isProcessing ? (
          <Loader2 className="h-6 w-6 text-white animate-spin" />
        ) : (
          <Mic className="h-6 w-6 text-white" />
        )}
      </Button>
    </div>
  );
}
