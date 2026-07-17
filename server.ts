import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  async function summarizeContent(text: string) {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Please summarize the following article. Provide a concise, incisive conclusion and a list of key takeaways. NO fluff or filler words. Output in Chinese (Simplified).\n\nArticle Content:\n${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
           type: Type.OBJECT,
           properties: {
               conclusion: {
                   type: Type.STRING,
                   description: "言简意赅、一针见血的简短结论性总结"
               },
               keyTakeaways: {
                   type: Type.ARRAY,
                   items: { type: Type.STRING },
                   description: "核心重点列表"
               }
           },
           required: ["conclusion", "keyTakeaways"]
        }
      }
    });
    return JSON.parse(response.text || '{}');
  }

  app.post('/api/summarize-url', async (req, res) => {
      const { url } = req.body;
      if (!url) {
        res.status(400).json({ error: 'URL is required' });
        return;
      }

      try {
          const jinaUrl = `https://r.jina.ai/${url}`;
          const jinaRes = await fetch(jinaUrl);
          const text = await jinaRes.text();

          // Paywall heuristic detection
          const isPaywall = text.length < 400 || /sign in to read|paywall|subscribe to read|log in to continue|to continue reading this article/i.test(text);

          if (isPaywall) {
               res.status(403).json({ 
                   error: 'PAYWALL_DETECTED', 
                   message: 'Content seems to be behind a paywall or too short.' 
               });
               return;
          }

          const summary = await summarizeContent(text);
          res.json(summary);
      } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Failed to fetch or summarize the URL' });
      }
  });

  app.post('/api/summarize-text', async (req, res) => {
      const { text } = req.body;
      if (!text) {
        res.status(400).json({ error: 'Text is required' });
        return;
      }

      try {
          const summary = await summarizeContent(text);
          res.json(summary);
      } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Failed to summarize the text' });
      }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
