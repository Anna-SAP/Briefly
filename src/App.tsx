import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, FileText, ArrowRight, Loader2, Bookmark, AlertCircle, Copy, Check, RefreshCw } from 'lucide-react';
import ChatUI from './components/ChatUI';

export default function App() {
  const [mode, setMode] = useState<'url' | 'text'>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<{ conclusion: string; keyTakeaways: string[], articleContext: string } | null>(null);
  const [isPaywall, setIsPaywall] = useState(false);

  const handleReset = () => {
    setUrl('');
    setText('');
    setError('');
    setSummary(null);
    setIsPaywall(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSummary(null);
    setIsPaywall(false);
    
    if (mode === 'url' && !url) {
      setError('Please enter a URL');
      return;
    }
    if (mode === 'text' && !text) {
      setError('Please paste the article text');
      return;
    }

    setLoading(true);

    try {
      const endpoint = mode === 'url' ? '/api/summarize-url' : '/api/summarize-text';
      const body = mode === 'url' ? { url } : { text };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      let data;
      try {
        data = await response.clone().json();
      } catch (parseError) {
        // If we can't parse JSON, it's likely an HTML error page from a proxy timeout or crash
        const text = await response.text();
        console.error("Non-JSON response received:", text.substring(0, 200));
        throw new Error('PAYWALL_OR_TIMEOUT');
      }

      if (!response.ok) {
        if (data.error === 'PAYWALL_DETECTED') {
          throw new Error('PAYWALL_DETECTED');
        }
        throw new Error(data.message || data.error || 'Failed to summarize');
      }

      setSummary(data);
    } catch (err: any) {
      if (err.message === 'PAYWALL_DETECTED' || err.message === 'PAYWALL_OR_TIMEOUT' || err.message.includes('Unexpected token')) {
        setIsPaywall(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500/30 selection:text-indigo-900">
      <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-6 mx-auto shadow-lg shadow-indigo-600/20">
            <Bookmark className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
            Briefly
          </h1>
          <p className="text-base text-slate-600 max-w-xl mx-auto font-medium">
            Extract concise conclusions and key takeaways from long articles. No fluff, just the essence.
          </p>
        </motion.div>

        {/* Main Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6 md:p-8 shadow-sm"
        >
          {/* Tabs and Reset */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div className="flex space-x-2 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/50 w-full sm:w-auto">
              <button
                onClick={() => { setMode('url'); setError(''); setSummary(null); setIsPaywall(false); }}
                className={`flex-1 sm:flex-none sm:w-32 flex items-center justify-center space-x-2 py-3 rounded-lg font-bold transition-all ${
                  mode === 'url' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <Link className="w-4 h-4" />
                <span>URL</span>
              </button>
              <button
                onClick={() => { setMode('text'); setError(''); setSummary(null); setIsPaywall(false); }}
                className={`flex-1 sm:flex-none sm:w-36 flex items-center justify-center space-x-2 py-3 rounded-lg font-bold transition-all ${
                  mode === 'text' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Paste Text</span>
              </button>
            </div>
            
            {(url || text || summary || error) && (
              <button
                onClick={handleReset}
                className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 transition-all border border-transparent hover:border-slate-200 self-end sm:self-auto"
                title="Reset everything"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {isPaywall ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-6"
            >
              <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200 shadow-sm">
                <AlertCircle className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Login Required</h3>
              <p className="text-slate-600 mb-6 font-medium max-w-md mx-auto leading-relaxed">
                We couldn't access the full article. It seems to be protected by a login wall (like Medium or Substack).
              </p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-left mb-6">
                <h4 className="font-bold text-slate-900 mb-4 uppercase tracking-widest text-xs">How to summarize this:</h4>
                <ol className="space-y-4">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                    <p className="text-sm text-slate-700 font-medium pt-0.5">Open the article and log in with your account.</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                    <p className="text-sm text-slate-700 font-medium pt-0.5">Copy all the text (Ctrl+A, Ctrl+C) or use the Bookmarklet below.</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                    <p className="text-sm text-slate-700 font-medium pt-0.5">Switch to the "Paste Text" tab here and paste it.</p>
                  </li>
                </ol>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                 <button onClick={() => window.open(url, '_blank')} className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-lg transition-colors border border-slate-200 shadow-sm flex items-center justify-center gap-2">
                   Open Article
                 </button>
                 <button onClick={() => { setMode('text'); setIsPaywall(false); }} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-sm shadow-indigo-600/20 flex items-center justify-center gap-2">
                   Switch to Paste Text
                 </button>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="wait">
              {mode === 'url' ? (
                <motion.div
                  key="url-input"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Article URL</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <Link className="w-5 h-5 text-slate-400" />
                    </div>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com/article..."
                      className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-600 placeholder:text-slate-400"
                      disabled={loading}
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="text-input"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Article Content</label>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste the full article text here..."
                    rows={6}
                    className="w-full px-4 py-4 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-600 placeholder:text-slate-400 resize-none"
                    disabled={loading}
                  />
                  <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start space-x-3 text-sm text-indigo-700">
                    <Bookmark className="w-5 h-5 shrink-0 mt-0.5 text-indigo-600" />
                    <div>
                      <span className="font-bold text-indigo-900">Pro tip: Bookmarklet</span>
                      <p className="mt-1 opacity-90 font-medium text-indigo-800">
                        Drag this button to your bookmarks bar to easily extract text from paywalled sites:
                      </p>
                      <a 
                        href="javascript:(function(){const t=document.body.innerText;navigator.clipboard.writeText(t).then(()=>alert('Article text copied to clipboard! Paste it into Briefly.')).catch(()=>alert('Failed to copy. Please manually copy the text.'));})();"
                        className="inline-flex mt-3 bg-indigo-100 hover:bg-indigo-200 border border-indigo-200 text-indigo-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"
                        onClick={(e) => e.preventDefault()}
                      >
                        Copy Article Text
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                className="overflow-hidden"
              >
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-3 text-red-700">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-900">Error</p>
                    <p className="text-sm mt-1 font-medium text-red-800">{error}</p>
                  </div>
                </div>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || (mode === 'url' ? !url : !text)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl flex items-center justify-center space-x-2 transition-colors shadow-lg shadow-slate-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Summarizing...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 hidden" />
                  <span>Generate Summary</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
          )}
        </motion.div>

        {/* Results */}
        <AnimatePresence>
          {summary && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 space-y-6"
            >
              <div className="glass rounded-2xl p-6 md:p-8 shadow-sm flex flex-col">
                <div className="mb-4">
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase rounded tracking-wide">
                    Conclusion (结论)
                  </span>
                </div>
                <p className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight tracking-tight">
                  {summary.conclusion}
                </p>
              </div>

              <div className="glass rounded-2xl p-6 md:p-8 shadow-sm flex flex-col">
                <div className="mb-6">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded tracking-wide">
                    Key Takeaways (核心重点)
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  {summary.keyTakeaways.map((point, index) => (
                    <div key={index} className="flex gap-4">
                      <span className="flex-shrink-0 w-6 h-6 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-xs font-bold ring-1 ring-slate-200">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <p className="text-slate-600 leading-relaxed font-medium">
                        {point}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat UI */}
              <ChatUI articleContext={summary.articleContext} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
