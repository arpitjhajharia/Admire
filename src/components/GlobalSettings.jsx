import React, { useState, useEffect } from 'react';
import { db, appId } from '../lib/firebase';
import { DollarSign, Save, Loader } from 'lucide-react';
import { CONFIG } from '../lib/config';

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
                <p className={`mt-2 text-xs font-bold text-center ${message.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
                    {message}
                </p>
            )}
        </div>
    );
};

export default GlobalSettings;
