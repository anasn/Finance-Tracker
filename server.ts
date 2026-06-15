import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import * as dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Init Gemini
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
} else {
  console.warn("GEMINI_API_KEY environment variable is not set. Voice assistant will fail.");
}

// API Routes
app.post("/api/gemini/parse-voice", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: "Gemini API key is not configured" });
    }
    
    const { transcript } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: "No transcript provided" });
    }

    const prompt = `You are an AI assistant for a financial tracking app for Landa (used clothing) businesses in Pakistan.
The user speaks in Urdu, Roman Urdu, or English.
Analyze the transcript and determine the user's intent to perform a specific action.

If all required fields are present, output a JSON object with the structured data.
If critical information is missing, output 'askUser' as the intent, and provide a 'question' in Urdu to ask the user for the missing info.

Possible intents and required fields:
- "create_sale"
  Required: customer (name), product (or itemName), totalAmount, paidAmount (can be 0 or implied), remainingAmount (can be computed).
- "create_payment" (Wasooli)
  Required: customer (name), amount
- "create_customer"
  Required: customer (name), phone (optional but good)
- "search_customer"
  Required: customer (name)
- "show_balance"
  Required: customer (name)
- "show_today_sales"
- "show_today_wasooli"
- "show_pending_customers"

Transcript: "${transcript}"

Output perfectly formatted JSON ONLY, no markdown formatting block \`\`\`json. Example for create_sale:
{
  "intent": "create_sale",
  "customer": "Muhammad Anees",
  "product": "Sweaters",
  "totalAmount": 500000,
  "paidAmount": 200000,
  "remainingAmount": 300000
}

Example for missing info:
{
  "intent": "askUser",
  "question": "Items ki total amount kitni hai?"
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    const text = response.text();
    let parsed = {};
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // Fallback cleanup if model still returns backticks
      const cleanText = text.replace(/^```json/g, "").replace(/```$/g, "").trim();
      parsed = JSON.parse(cleanText);
    }
    
    res.json(parsed);
    
  } catch (e: any) {
    console.error("Gemini Error:", e);
    res.status(500).json({ error: e.message || "Failed to process voice command" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Only serve static files if we're not running on Vercel as a pure API
    if (!process.env.VERCEL) {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*all', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  // Define how the server listens
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

// Call startServer to set up the rest
startServer();

// Export the app for Vercel
export default app;
