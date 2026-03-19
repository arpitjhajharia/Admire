import React, { useState, useEffect } from 'react';
import { db, appId } from '../lib/firebase';
import { DollarSign, Save, Loader, RefreshCw } from 'lucide-react';
import { CONFIG } from '../lib/config';
import { backfillQuoteRefs } from '../lib/backfill';


const GlobalSettings = () => {
    const [exchangeRate, setExchangeRate] = useState(CONFIG.DEFAULTS.EXCHANGE_RATE);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const unsub = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('settings').doc('global')
            .onSnapshot(doc => {
                if (doc.exists) {
                    setExchangeRate(doc.data().exchangeRate || CONFIG.DEFAULTS.EXCHANGE_RATE);
                }
            });
        return () => unsub();
    }, []);

    const handleBackfill = async () => {
        if (!window.confirm('This will re-generate and override ALL quote references sequentially based on their creation date. This cannot be undone. Proceed?')) return;
        setLoading(true);
        setMessage('Re-generating refs... Please wait.');
        try {
            await backfillQuoteRefs();
            setMessage('Success! All quotes updated.');
        } catch (error) {
            console.error(error);
            setMessage('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!exchangeRate || isNaN(exchangeRate)) return alert('Please enter a valid exchange rate');
        setLoading(true);
        setMessage('');
        try {
            await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('settings').doc('global').set({
                exchangeRate: Number(exchangeRate),
                updatedAt: new Date().toISOString()
            }, { merge: true });
            setMessage('Saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error(error);
            setMessage('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        USD Rate:
                    </label>
                    <div className="relative flex-1 max-w-[120px]">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-slate-500 font-bold">₹</span>
                        <input
                            type="number"
                            value={exchangeRate}
                            onChange={e => setExchangeRate(e.target.value)}
                            className="w-full pl-6 pr-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-bold transition-colors shadow-sm disabled:opacity-50"
                >
                    {loading ? <Loader className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                    Save
                </button>
            </div>
            {message && (
                <p className={`mt-2 text-xs font-bold text-center ${message.includes('Error') ? 'text-red-500' : 'text-teal-500'}`}>
                    {message}
                </p>
            )}

            {/* Quote Ref Generator (One-time or occasional fix) */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Administrative Actions</p>
                        <p className="text-[11px] text-slate-500">Re-index all quote references (ASD/###/FY)</p>
                    </div>
                    <button
                        onClick={handleBackfill}
                        disabled={loading}
                        className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-bold transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader className="animate-spin w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                        Sync All Refs
                    </button>
                </div>
            </div>
        </div>

    );
};

export default GlobalSettings;
