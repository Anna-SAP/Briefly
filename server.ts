import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add CORS headers to allow bookmarklet to POST from any domain
  app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      if (req.method === 'OPTIONS') {
          return res.sendStatus(200);
      }
      next();
  });

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
               },
               integrityDiagnosis: {
                   type: Type.STRING,
                   description: "完整性诊断：检查抓取到的内容是否存在明显的截断迹象（例如：文章以半句话结束、缺少正文只有导航栏等）。如果有问题请说明，如果内容完整则说明“文章内容读取完整”。"
               }
           },
           required: ["conclusion", "keyTakeaways", "integrityDiagnosis"]
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
          let text = '';

          // If user provided a specific cookie for this platform, fetch directly to bypass paywall
          const userCookies = req.body.cookies;
          let useDirectFetch = false;
          let directHtml = '';

          if (userCookies && typeof userCookies === 'object') {
              const domain = new URL(url).hostname.replace(/^www\./, '');
              const matchedCookie = Object.keys(userCookies).find(d => domain.includes(d));
              if (matchedCookie && userCookies[matchedCookie]) {
                  useDirectFetch = true;
                  try {
                      const res = await fetch(url, {
                          headers: {
                              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                              'Cookie': userCookies[matchedCookie]
                          }
                      });
                      directHtml = await res.text();
                      text = directHtml; // We will pass raw HTML to Gemini and let it extract the content
                  } catch (e) {
                      console.error("Direct fetch with cookies failed", e);
                  }
              }
          }

          if (!useDirectFetch) {
              const jinaUrl = `https://r.jina.ai/${url}`;
              const jinaRes = await fetch(jinaUrl);
              text = await jinaRes.text();
          }

          // Paywall heuristic detection (only if we didn't use cookies, or if the fetched text is still too short)
          const isPaywall = !useDirectFetch && (text.length < 400 || /sign in to read|paywall|subscribe to read|log in to continue|to continue reading this article/i.test(text));

          if (isPaywall) {
               res.status(403).json({ 
                   error: 'PAYWALL_DETECTED', 
                   message: 'Content seems to be behind a paywall or too short.' 
               });
               return;
          }

          const summary = await summarizeContent(text);
          res.json({ ...summary, articleContext: text });
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
          res.json({ ...summary, articleContext: text });
      } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Failed to summarize the text' });
      }
  });

  app.post('/api/chat', async (req, res) => {
      const { articleContext, history, message, attachments } = req.body;

      try {
          const contents = [];
          
          if (history && history.length > 0) {
              for (const msg of history) {
                  contents.push({
                      role: msg.role === 'user' ? 'user' : 'model',
                      parts: [{ text: msg.text }]
                  });
              }
          }

          const currentParts: any[] = [];
          
          // Add article context only to the first message if history is empty
          if (articleContext && (!history || history.length === 0)) {
              currentParts.push({ text: `[Article Context]:\n${articleContext}\n\nUser Message:\n${message}` });
          } else {
              currentParts.push({ text: message });
          }

          if (attachments && attachments.length > 0) {
              for (const att of attachments) {
                  currentParts.push({ inlineData: { data: att.data, mimeType: att.mimeType } });
              }
          }

          contents.push({ role: 'user', parts: currentParts });

          const response = await ai.models.generateContent({
              model: "gemini-3.5-flash",
              contents: contents,
              config: {
                  systemInstruction: "You are a helpful assistant. The user is asking questions about the provided article. Provide concise, clear, and insightful answers. Communicate in the same language as the user's prompt (default to Chinese if unsure)."
              }
          });

          res.json({ text: response.text });
      } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Failed to generate chat response' });
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
