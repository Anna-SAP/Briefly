import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, FileText, ArrowRight, Loader2, Bookmark, AlertCircle, Copy, Check, RefreshCw, ChevronDown, ChevronUp, Settings, X, Key } from 'lucide-react';
import ChatUI from './components/ChatUI';

export default function App() {
  const [mode, setMode] = useState<'url' | 'text'>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<{ conclusion: string; keyTakeaways: string[], articleContext: string, integrityDiagnosis?: string } | null>(null);
  const [isPaywall, setIsPaywall] = useState(false);
  const [showRaw, setShowRaw] = useState(true);
  const [preFetchWarning, setPreFetchWarning] = useState<{domain: string, url: string} | null>(null);
  
  // Cookie Sync State
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [platformCookies, setPlatformCookies] = useState<Record<string, string>>({});
  const [tempCookieDomain, setTempCookieDomain] = useState('medium.com');
  const [tempCookieValue, setTempCookieValue] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('platform_cookies');
    if (saved) {
      try {
        setPlatformCookies(JSON.parse(saved));
      } catch (e) {}
    }
    
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');

    if (modeParam === 'text') {
      setMode('text');
    }
  }, []);

  const saveCookie = () => {
    if (!tempCookieDomain.trim()) return;
    const updated = { ...platformCookies, [tempCookieDomain.trim()]: tempCookieValue.trim() };
    if (!tempCookieValue.trim()) {
      delete updated[tempCookieDomain.trim()];
    }
    setPlatformCookies(updated);
    localStorage.setItem('platform_cookies', JSON.stringify(updated));
    setTempCookieDomain('medium.com');
    setTempCookieValue('');
  };

  const removeCookie = (domain: string) => {
    const updated = { ...platformCookies };
    delete updated[domain];
    setPlatformCookies(updated);
    localStorage.setItem('platform_cookies', JSON.stringify(updated));
  };

  const PAYWALL_DOMAINS = [
    'medium.com', 'substack.com', 'bloomberg.com', 'nytimes.com', 'wsj.com', 'ft.com', 
    'theatlantic.com', 'economist.com', 'businessinsider.com', 'wired.com', 'newyorker.com', 
    'hbr.org', 'mp.weixin.qq.com', 'zhihu.com', 'towardsdatascience.com', 'towardsdeeplearning.com'
  ];

  const handleReset = () => {
    setUrl('');
    setText('');
    setError('');
    setSummary(null);
    setIsPaywall(false);
    setPreFetchWarning(null);
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

    if (mode === 'url') {
      try {
        const domain = new URL(url).hostname.replace(/^www\./, '');
        // If we have a cookie for this domain, we don't need the warning!
        const hasCookie = Object.keys(platformCookies).some(d => domain.includes(d));
        if (!hasCookie && PAYWALL_DOMAINS.some(d => domain.includes(d))) {
          setPreFetchWarning({ domain, url });
          return;
        }
      } catch (err) {
        // Ignore URL parsing errors
      }
    }

    await executeFetch();
  };

  const executeFetch = async (forceAnonymous = false) => {
    setPreFetchWarning(null);
    setError('');
    setSummary(null);
    setIsPaywall(false);
    setLoading(true);

    try {
      const endpoint = mode === 'url' ? '/api/summarize-url' : '/api/summarize-text';
      const body = mode === 'url' ? { url, cookies: platformCookies } : { text };

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
      
      {/* Settings / Cookie Sync Button */}
      <div className="absolute top-6 right-6">
        <button 
          onClick={() => setShowCookieModal(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-bold transition-all shadow-sm ${
            Object.keys(platformCookies).length > 0 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          {Object.keys(platformCookies).length > 0 ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Cookie Sync Active
            </>
          ) : (
            <>
              <Settings className="w-4 h-4" />
              Settings
            </>
          )}
        </button>
      </div>

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

          {preFetchWarning ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-2"
            >
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-indigo-900">Content Access Authorization</h3>
                    <p className="text-sm font-medium text-indigo-700">Target Platform: <span className="font-bold">{preFetchWarning.domain}</span></p>
                  </div>
                </div>

                <p className="text-indigo-800 mb-6 font-medium leading-relaxed">
                  This platform often restricts full article access for anonymous requests. To ensure we capture the complete article without truncation, please choose an authorization method:
                </p>

                <div className="space-y-4">
                  <div className="bg-white p-5 rounded-xl border border-indigo-100 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-500" />
                          PRO Account / Cookie Sync (Recommended)
                        </h4>
                        <p className="text-sm text-slate-600 font-medium max-w-md">Sync your session cookie in the Settings to seamlessly fetch paywalled content in the background.</p>
                        
                        <div className="mt-4">
                           <button 
                             onClick={() => setShowCookieModal(true)}
                             className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm"
                           >
                             <Settings className="w-4 h-4" />
                             Configure Cookie Sync
                           </button>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 self-end">
                        <button onClick={() => { setMode('text'); setPreFetchWarning(null); }} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-lg transition-colors border border-slate-200 text-sm flex items-center justify-center gap-2 whitespace-nowrap">
                          Or Paste Text
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/50 p-5 rounded-xl border border-indigo-100/50">
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-slate-700 mb-1">Anonymous Server Fetch</h4>
                        <p className="text-sm text-slate-500 font-medium max-w-md">Attempt to fetch directly. Note: The content may be truncated to just the introduction if a paywall is active.</p>
                      </div>
                      <button 
                        onClick={() => executeFetch(true)}
                        className="px-4 py-2 bg-transparent hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition-colors text-sm flex-shrink-0 border border-indigo-200"
                      >
                        Fetch Anyway
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : isPaywall ? (
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
                    <p className="text-sm text-slate-700 font-medium pt-0.5">Click the <button onClick={() => setShowCookieModal(true)} className="text-indigo-600 font-bold hover:underline">Settings</button> button in the top right to open the Cookie Vault.</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                    <p className="text-sm text-slate-700 font-medium pt-0.5">Provide your session cookie for this platform.</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                    <p className="text-sm text-slate-700 font-medium pt-0.5">Try fetching the URL again, or manually switch to "Paste Text" and copy-paste the content.</p>
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
                    <Key className="w-5 h-5 shrink-0 mt-0.5 text-indigo-600" />
                    <div>
                      <span className="font-bold text-indigo-900">Pro tip: Seamless Fetching</span>
                      <p className="mt-1 opacity-90 font-medium text-indigo-800">
                        Did you know you can set up Cookie Sync in the Settings? It allows Briefly to seamlessly bypass login walls for supported platforms.
                      </p>
                      <button 
                        onClick={() => setShowCookieModal(true)}
                        className="inline-flex mt-3 bg-indigo-100 hover:bg-indigo-200 border border-indigo-200 text-indigo-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"
                      >
                        Open Settings
                      </button>
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
              {/* Raw Fetched Content */}
              <div className="glass rounded-2xl p-6 md:p-8 shadow-sm flex flex-col">
                <div 
                  className="flex items-center justify-between cursor-pointer group"
                  onClick={() => setShowRaw(!showRaw)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded tracking-wide border border-slate-200">
                      📥 实际抓取到的网页内容 (Raw Fetched Content)
                    </span>
                    {summary.integrityDiagnosis && (
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded tracking-wide border ${summary.integrityDiagnosis.includes('完整') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                         {summary.integrityDiagnosis.includes('完整') ? '✓ 内容完整' : '⚠️ 可能截断'}
                      </span>
                    )}
                  </div>
                  <button className="text-slate-400 group-hover:text-slate-600 transition-colors p-1 bg-slate-50 hover:bg-slate-100 rounded-lg">
                    {showRaw ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
                
                <AnimatePresence>
                  {showRaw && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0, marginTop: 0 }}
                      animate={{ height: 'auto', opacity: 1, marginTop: '1rem' }}
                      exit={{ height: 0, opacity: 0, marginTop: 0 }}
                      className="overflow-hidden"
                    >
                      {summary.integrityDiagnosis && !summary.integrityDiagnosis.includes('完整') && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl font-medium">
                          <span className="font-bold">诊断提示：</span>{summary.integrityDiagnosis}
                        </div>
                      )}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-64 overflow-y-auto text-sm text-slate-600 font-mono whitespace-pre-wrap leading-relaxed shadow-inner">
                        {summary.articleContext}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

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

      {/* Cookie Sync Modal */}
      <AnimatePresence>
        {showCookieModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-4 right-4">
                <button onClick={() => setShowCookieModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 border border-indigo-100">
                  <Key className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Cookie Vault</h2>
                <p className="text-slate-500 font-medium text-sm leading-relaxed">
                  Provide your session cookie to automatically fetch paywalled articles from your favorite platforms. Your cookies are stored locally in your browser.
                </p>
              </div>

              {Object.keys(platformCookies).length > 0 && (
                <div className="mb-6 space-y-2">
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Active Integrations</h3>
                  <div className="space-y-2">
                    {Object.entries(platformCookies).map(([domain, cookie]) => (
                      <div key={domain} className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                        <div className="flex flex-col">
                          <span className="font-bold text-emerald-800 text-sm">{domain}</span>
                          <span className="text-emerald-600/70 text-xs font-mono truncate max-w-[200px]">{cookie}</span>
                        </div>
                        <button 
                          onClick={() => removeCookie(domain)}
                          className="text-emerald-600 hover:text-emerald-800 text-sm font-bold bg-white/50 px-3 py-1.5 rounded-lg border border-emerald-200/50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Add Integration</h3>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Domain</label>
                  <select 
                    value={tempCookieDomain}
                    onChange={(e) => setTempCookieDomain(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  >
                    <option value="medium.com">medium.com</option>
                    <option value="substack.com">substack.com</option>
                    <option value="bloomberg.com">bloomberg.com</option>
                    <option value="nytimes.com">nytimes.com</option>
                    <option value="custom">Other (Custom Domain)</option>
                  </select>
                </div>
                
                {tempCookieDomain === 'custom' && (
                  <div>
                    <input 
                      type="text"
                      placeholder="e.g. wsj.com"
                      onChange={(e) => setTempCookieDomain(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Raw Cookie String</label>
                  <input 
                    type="text"
                    value={tempCookieValue}
                    onChange={(e) => setTempCookieValue(e.target.value)}
                    placeholder="uid=123; sid=abc..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-mono text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  />
                  <p className="text-xs text-slate-400 mt-2 font-medium">Copy this from your browser's Developer Tools (Network tab - Request Headers).</p>
                </div>

                <button 
                  onClick={saveCookie}
                  disabled={!tempCookieDomain || !tempCookieValue}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:bg-slate-300"
                >
                  Save Integration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
