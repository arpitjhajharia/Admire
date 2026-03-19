import React, { useState, useEffect, useMemo } from 'react';
import { Package, Archive, Plus, Trash2, Edit, X, Search, Layers, ClipboardList, Info, AlertCircle, TrendingUp, TrendingDown, History, BarChart2, Copy } from 'lucide-react';
import { db, appId } from '../lib/firebase';
import { formatCurrency } from '../lib/utils';

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    // Split date to avoid timezone shifts (assumes YYYY-MM-DD from input[type=date])
    const [y, m, d] = dateStr.split('-');
    if (!y || !m || !d) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[parseInt(m, 10) - 1];
    const year = y.slice(-2);
    return `${d}-${month}-${year}`;
};

const MiscStockTracker = ({ user, userRole }) => {
    const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' or 'ledger'
    const [items, setItems] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Toggle Forms
    const [showItemForm, setShowItemForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [itemForm, setItemForm] = useState({ name: '', sku: '', vendor: '', rate: '', specs: [] });
    const [sourceItem, setSourceItem] = useState(null); // Ref for duplication check
    // For manual spec adding
    const [newSpec, setNewSpec] = useState({ name: '', value: '' });

    const [showTxForm, setShowTxForm] = useState(false);
    const [editingTx, setEditingTx] = useState(null);
    const [txForm, setTxForm] = useState({ date: new Date().toISOString().split('T')[0], type: 'in', itemId: '', qty: '', remarks: '' });

    const [searchTerm, setSearchTerm] = useState('');

    // Permission checks
    const readOnly = ['labour'].includes(userRole);

    // --- FIREBASE SUBSCRIPTIONS ---
    useEffect(() => {
        if (!db) return;
        const unsubItems = db.collection('artifacts').doc(appId).collection('public')
            .doc('data').collection('misc_inventory')
            .onSnapshot(snap => {
                setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

        const unsubTx = db.collection('artifacts').doc(appId).collection('public')
            .doc('data').collection('misc_transactions')
            .onSnapshot(snap => {
                setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

        setLoading(false);
        return () => { unsubItems(); unsubTx(); };
    }, []);

    // --- QUANTITY CALCULATION ---
    const stockData = useMemo(() => {
        const sData = {};
        
        items.forEach(item => {
            sData[item.id] = { ...item, qty: 0, value: 0 };
        });

        transactions.forEach(tx => {
            if (!sData[tx.itemId]) return;
            const item = sData[tx.itemId];
            const qty = Number(tx.qty) || 0;
            if (tx.type === 'in') {
                item.qty += qty;
            } else if (tx.type === 'out') {
                item.qty -= qty;
            }
        });

        Object.values(sData).forEach(item => {
            item.value = (Number(item.rate) || 0) * item.qty;
        });

        return sData;
    }, [items, transactions]);

    // --- HANDLERS ---
    const handleSaveItem = async () => {
        if (!itemForm.name) return alert("Product Name is required");
        
        // --- Duplicate Check ---
        if (sourceItem) {
            const isIdentical = JSON.stringify(itemForm) === JSON.stringify({
                name: sourceItem.name,
                sku: sourceItem.sku,
                vendor: sourceItem.vendor,
                rate: sourceItem.rate || '',
                specs: sourceItem.specs
            });
            if (isIdentical) return alert("Please make some changes before saving the duplicated product.");
            
            if (itemForm.sku === sourceItem.sku && itemForm.sku !== "") {
                return alert("To avoid confusion, the SKU must be different from the original product.");
            }
        }

        // --- Unique SKU check ---
        if (!editingItem && itemForm.sku) {
            const skuExists = items.some(it => it.sku === itemForm.sku);
            if (skuExists) return alert("An item with the same SKU already exists.");
        }

        try {
            const ref = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('misc_inventory');
            const data = { 
                ...itemForm, 
                rate: Number(itemForm.rate) || 0,
                updatedAt: new Date() 
            };
            if (editingItem) {
                await ref.doc(editingItem.id).update(data);
            } else {
                await ref.add({ ...data, createdAt: new Date() });
            }
            setShowItemForm(false);
            setEditingItem(null);
            setSourceItem(null);
            setItemForm({ name: '', sku: '', vendor: '', rate: '', specs: [] });
        } catch (e) { console.error(e); }
    };

    const handleSaveTx = async () => {
        if (!txForm.itemId || !txForm.qty) return alert("Select Item and Specify Quantity");
        
        try {
            const ref = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('misc_transactions');
            const data = { 
                ...txForm, 
                qty: Number(txForm.qty), 
                updatedAt: new Date() 
            };
            if (editingTx) {
                await ref.doc(editingTx.id).update(data);
                setEditingTx(null);
            } else {
                await ref.add({ ...data, createdAt: new Date() });
            }
            setShowTxForm(false);
            setTxForm({ date: new Date().toISOString().split('T')[0], type: 'in', itemId: '', qty: '', remarks: '' });
        } catch (e) { console.error(e); }
    };

    const addSpec = () => {
        if (!newSpec.name || !newSpec.value) return;
        setItemForm(prev => ({ ...prev, specs: [...prev.specs, newSpec] }));
        setNewSpec({ name: '', value: '' });
    };

    const removeSpec = (index) => {
        setItemForm(prev => ({ ...prev, specs: prev.specs.filter((_, i) => i !== index) }));
    };

    const updateSpec = (index, field, value) => {
        const updatedSpecs = [...itemForm.specs];
        updatedSpecs[index] = { ...updatedSpecs[index], [field]: value };
        setItemForm(prev => ({ ...prev, specs: updatedSpecs }));
    };

    const handleDuplicateItem = (item) => {
        const { id, createdAt, updatedAt, qty, value, avgRate, ...cleanData } = item;
        setItemForm({ ...cleanData, rate: cleanData.rate || '' });
        setSourceItem(item);
        setEditingItem(null);
        setShowItemForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleEditItem = (item) => {
        const { id, createdAt, updatedAt, qty, value, avgRate, ...cleanData } = item;
        setItemForm({ ...cleanData, rate: cleanData.rate || '' });
        setEditingItem(item);
        setSourceItem(null);
        setShowItemForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleEditTx = (tx) => {
        setTxForm(tx);
        setEditingTx(tx);
        setShowTxForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Filter Logic
    const filteredItems = Object.values(stockData).filter(item => 
        !searchTerm || 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.vendor.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedTransactions = [...transactions]
        .map(tx => ({ 
            ...tx, 
            itemName: stockData[tx.itemId]?.name || 'Unknown Item',
            itemSKU: stockData[tx.itemId]?.sku || 'NO SKU',
            itemRate: stockData[tx.itemId]?.rate || 0
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const filteredTransactions = sortedTransactions.filter(tx => 
        !searchTerm || 
        tx.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.remarks.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // --- UI CLASSES ---
    const inputCls = "px-2.5 py-1.5 text-[12px] border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600 transition-shadow";
    const labelCls = "block text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-1";

    if (loading) return null;

    return (
        <div className="p-3 md:p-4">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-700 flex items-center justify-center shadow-sm">
                        <Package className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-extrabold tracking-tight text-slate-800 dark:text-white leading-none">
                            Misc Stock Tracker
                        </h2>
                        <p className="text-[12px] font-medium text-slate-400 mt-0.5 tracking-wide uppercase">
                            {activeTab === 'inventory' ? `${filteredItems.length} Products` : `${filteredTransactions.length} Records`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Tabs switcher */}
                    <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm mr-2">
                        <button 
                            onClick={() => setActiveTab('inventory')}
                            className={`px-3 py-1.5 text-[12px] font-bold uppercase transition-all ${activeTab === 'inventory' ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white' : 'bg-white dark:bg-slate-800 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        >
                            Products
                        </button>
                        <button 
                            onClick={() => setActiveTab('ledger')}
                            className={`px-3 py-1.5 text-[12px] font-bold uppercase transition-all ${activeTab === 'ledger' ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white' : 'bg-white dark:bg-slate-800 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        >
                            Ledger
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative flex-1 sm:w-48">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                        />
                    </div>

                    {/* Add Button */}
                    {!readOnly && (
                        <button 
                            onClick={() => {
                                if (activeTab === 'inventory') {
                                    setShowItemForm(!showItemForm);
                                    setEditingItem(null);
                                    setItemForm({ name: '', sku: '', vendor: '', rate: '', specs: [] });
                                } else {
                                    setShowTxForm(!showTxForm);
                                    setEditingTx(null);
                                    setTxForm({ date: new Date().toISOString().split('T')[0], type: 'in', itemId: '', qty: '', remarks: '' });
                                }
                            }}
                            className="flex-shrink-0 bg-slate-800 dark:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 hover:bg-slate-900 transition shadow-sm"
                        >
                            {activeTab === 'inventory' ? (showItemForm ? <X size={15}/> : <Plus size={15}/>) : (showTxForm ? <X size={15}/> : <Plus size={15}/>)}
                            <span className="hidden sm:inline-block text-[12px]">{activeTab === 'inventory' ? (showItemForm ? 'Close' : 'Add Product') : (showTxForm ? 'Close' : 'Add Record')}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ── Inline Product Form ── */}
            {activeTab === 'inventory' && showItemForm && (
                <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <div className="md:col-span-1">
                            <label className={labelCls}>SKU / Model</label>
                            <input className={inputCls + " w-full"} value={itemForm.sku} onChange={e => setItemForm({...itemForm, sku: e.target.value})} placeholder="PC-001" />
                        </div>
                        <div className="md:col-span-1">
                            <label className={labelCls}>Product Name*</label>
                            <input className={inputCls + " w-full"} value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} placeholder="e.g. Master Cable" />
                        </div>
                        <div>
                            <label className={labelCls}>Vendor</label>
                            <input className={inputCls + " w-full"} value={itemForm.vendor} onChange={e => setItemForm({...itemForm, vendor: e.target.value})} placeholder="Supplier Name" />
                        </div>
                        <div>
                            <label className={labelCls}>Rate / pc (₹)</label>
                            <input type="number" className={inputCls + " w-full"} value={itemForm.rate} onChange={e => setItemForm({...itemForm, rate: e.target.value})} placeholder="0.00" />
                        </div>
                        
                        <div className="md:col-span-5 border-t border-slate-200 dark:border-slate-700 pt-3 mt-1">
                            <div className="flex items-center justify-between mb-2">
                                <label className={labelCls}>Technical Specs</label>
                                <span className="text-[12px] text-slate-400 font-bold uppercase">Editable</span>
                            </div>

                            <div className="space-y-2 mb-3">
                                {itemForm.specs.map((s, i) => (
                                    <div key={i} className="flex gap-2 items-center animate-in fade-in slide-in-from-left-2 duration-200">
                                        <input 
                                            className={inputCls + " flex-1 !py-1 !px-2.5 text-[12px] font-bold"} 
                                            value={s.name} 
                                            onChange={e => updateSpec(i, 'name', e.target.value)} 
                                            placeholder="Spec name"
                                        />
                                        <input 
                                            className={inputCls + " flex-1 !py-1 !px-2.5 text-[12px]"} 
                                            value={s.value} 
                                            onChange={e => updateSpec(i, 'value', e.target.value)} 
                                            placeholder="Value"
                                        />
                                        <button onClick={() => removeSpec(i)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                                            <Trash2 size={13}/>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2 p-2 bg-slate-100 dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                                <input className={inputCls + " flex-1 !py-1 !border-none !bg-transparent"} value={newSpec.name} onChange={e => setNewSpec({...newSpec, name: e.target.value})} placeholder="New Spec..." />
                                <input className={inputCls + " flex-1 !py-1 !border-none !bg-transparent"} value={newSpec.value} onChange={e => setNewSpec({...newSpec, value: e.target.value})} placeholder="Value..." />
                                <button onClick={addSpec} className="px-2 bg-slate-800 dark:bg-slate-700 rounded text-white hover:bg-black transition-all"><Plus size={14}/></button>
                            </div>
                        </div>

                        <div className="md:col-span-5 flex justify-end gap-2 mt-2">
                            <button onClick={() => { setShowItemForm(false); setEditingItem(null); }} className="px-4 py-1.5 text-[12px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
                            <button onClick={handleSaveItem} className="bg-slate-800 dark:bg-slate-600 text-white px-5 py-1.5 rounded-lg text-[12px] font-bold hover:bg-slate-900">
                                {editingItem ? 'Update Product' : 'Create Product'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Inline Ledger Form ── */}
            {activeTab === 'ledger' && showTxForm && (
                <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <div>
                            <label className={labelCls}>Type</label>
                            <select className={inputCls + " w-full"} value={txForm.type} onChange={e => setTxForm({...txForm, type: e.target.value})}>
                                <option value="in">Stock IN</option>
                                <option value="out">Stock OUT</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className={labelCls}>Select Product</label>
                            <select className={inputCls + " w-full"} value={txForm.itemId} onChange={e => setTxForm({...txForm, itemId: e.target.value})}>
                                <option value="">Choose item...</option>
                                {items.sort((a,b) => a.name.localeCompare(b.name)).map(i => (
                                    <option key={i.id} value={i.id}>{i.sku} | {i.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Date</label>
                            <input type="date" className={inputCls + " w-full"} value={txForm.date} onChange={e => setTxForm({...txForm, date: e.target.value})} />
                        </div>
                        <div>
                            <label className={labelCls}>Quantity</label>
                            <input type="number" className={inputCls + " w-full"} value={txForm.qty} onChange={e => setTxForm({...txForm, qty: e.target.value})} placeholder="0" />
                        </div>
                        
                        <div className="md:col-span-12 md:max-w-md">
                            <label className={labelCls}>Remarks / Ref</label>
                            <input className={inputCls + " w-full"} value={txForm.remarks} onChange={e => setTxForm({...txForm, remarks: e.target.value})} placeholder="Project, Supplier, etc." />
                        </div>

                        <div className="md:col-span-12 flex justify-end gap-2 mt-2">
                            <button onClick={() => { setShowTxForm(false); setEditingTx(null); }} className="px-4 py-1.5 text-[12px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
                            <button onClick={handleSaveTx} className="bg-slate-800 dark:bg-slate-600 text-white px-5 py-1.5 rounded-lg text-[12px] font-bold hover:bg-slate-900">
                                {editingTx ? 'Update Record' : 'Record Entry'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Table View ── */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <table className="min-w-full border-collapse text-[12px]">
                    {/* Header */}
                    <thead>
                        <tr className="bg-slate-900 dark:bg-slate-950 border-b border-slate-700">
                            {activeTab === 'inventory' ? (
                                <>
                                    <th className="px-3 py-1.5 text-left font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">SKU / Product</th>
                                    <th className="px-3 py-1.5 text-left font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Vendor</th>
                                    <th className="px-3 py-1.5 text-left font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Specs</th>
                                    <th className="px-3 py-1.5 text-center font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Stock</th>
                                    {!readOnly && <th className="px-3 py-1.5 text-right font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Rate/pc</th>}
                                    {!readOnly && <th className="px-3 py-1.5 text-right font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Value (₹)</th>}
                                </>
                            ) : (
                                <>
                                    <th className="px-3 py-1.5 text-left font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Date</th>
                                    <th className="px-3 py-1.5 text-left font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">SKU / Product</th>
                                    <th className="px-3 py-1.5 text-center font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Type</th>
                                    <th className="px-3 py-1.5 text-right font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Qty</th>
                                    <th className="px-3 py-1.5 text-right font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Rate/pc</th>
                                    <th className="px-3 py-1.5 text-left font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Remarks</th>
                                </>
                            )}
                            <th className="px-3 py-1.5 text-right font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Actions</th>
                        </tr>
                    </thead>

                    {/* Body */}
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {activeTab === 'inventory' ? (
                            filteredItems.map((item, idx) => (
                                <tr key={item.id} className={`group ${idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-800/50'} hover:bg-blue-50/50 dark:hover:bg-slate-700/60`}>
                                    <td className="px-3 py-2">
                                        <div className="flex flex-col min-w-[150px]">
                                            <span className="font-bold text-slate-800 dark:text-white truncate uppercase tracking-tight">{item.sku || 'NO SKU'}</span>
                                            <span className="text-slate-400 font-medium truncate">{item.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="text-teal-600 dark:text-teal-400 font-bold uppercase tracking-tight truncate block max-w-[120px]">
                                            {item.vendor || '-'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex flex-wrap gap-1 max-w-[250px]">
                                            {item.specs?.map((s, i) => (
                                                <span key={i} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                    {s.name}:{s.value}
                                                </span>
                                            ))}
                                            {(!item.specs || item.specs.length === 0) && <span className="text-slate-300">-</span>}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <span className={`text-[13px] font-extrabold tabular-nums tracking-tight ${item.qty <= 0 ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>
                                            {item.qty}
                                        </span>
                                    </td>
                                    {!readOnly && (
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            <span className="font-bold text-slate-600 dark:text-slate-400 tabular-nums">
                                                {formatCurrency(item.rate, 'INR', false, true)}
                                            </span>
                                        </td>
                                    )}
                                    {!readOnly && (
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            <span className="font-extrabold text-slate-800 dark:text-slate-200 tabular-nums">
                                                {formatCurrency(item.value, 'INR', false, true)}
                                            </span>
                                        </td>
                                    )}
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                        <div className="flex justify-end gap-0.5">
                                            {!readOnly && (
                                                <>
                                                    <button onClick={() => handleDuplicateItem(item)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded transition-all" title="Duplicate"><Copy size={13}/></button>
                                                    <button onClick={() => handleEditItem(item)} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-all"><Edit size={13}/></button>
                                                    <button onClick={async () => { if(confirm('Delete product?')) await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('misc_inventory').doc(item.id).delete(); }} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40 rounded transition-all"><Trash2 size={13}/></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            filteredTransactions.map((tx, idx) => (
                                <tr key={tx.id} className={`group ${idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-800/50'} hover:bg-blue-50/50 dark:hover:bg-slate-700/60`}>
                                    <td className="px-3 py-2">
                                        <span className="font-bold text-slate-400 tabular-nums uppercase whitespace-nowrap">{formatDate(tx.date)}</span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex flex-col min-w-[150px]">
                                            <span className="font-bold text-slate-800 dark:text-white truncate uppercase tracking-tight">{tx.itemSKU}</span>
                                            <span className="text-slate-400 font-medium truncate">{tx.itemName}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <span className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${tx.type === 'in' ? 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'}`}>
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <span className={`font-extrabold tabular-nums ${tx.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                                            {tx.type === 'in' ? '+' : '-'}{tx.qty}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                        <span className="font-bold text-slate-600 dark:text-slate-400 tabular-nums">
                                            {formatCurrency(tx.itemRate, 'INR', false, true)}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 max-w-[200px]">
                                        <span className="text-slate-500 font-medium truncate block">{tx.remarks || '-'}</span>
                                    </td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                        <div className="flex justify-end gap-0.5">
                                            {!readOnly && (
                                                <>
                                                    <button onClick={() => handleEditTx(tx)} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"><Edit size={13}/></button>
                                                    <button onClick={async () => { if(confirm('Delete record?')) await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('misc_transactions').doc(tx.id).delete(); }} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all"><Trash2 size={13}/></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}

                        {/* Empty States */}
                        {(activeTab === 'inventory' ? filteredItems.length === 0 : filteredTransactions.length === 0) && (
                            <tr>
                                <td colSpan={activeTab === 'inventory' ? 7 : 7} className="py-12 text-center bg-white dark:bg-slate-800 rounded-b-xl border-t border-slate-100 dark:border-slate-700">
                                    <div className="flex flex-col items-center">
                                        <Package className="w-8 h-8 text-slate-200 dark:text-slate-700 mb-2" />
                                        <p className="font-bold text-slate-400 uppercase tracking-widest">No matching {activeTab === 'inventory' ? 'products' : 'records'}</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MiscStockTracker;
