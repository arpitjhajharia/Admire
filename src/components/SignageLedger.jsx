import React, { useState } from 'react';
import { Archive, Trash2, Edit, X, Search, ClipboardList, Plus } from 'lucide-react';
import { db, appId } from '../lib/firebase';

const SignageLedger = ({ signageInventory = [], signageTransactions = [], readOnly = false }) => {
    const [newTx, setNewTx] = useState({ date: new Date().toISOString().split('T')[0], type: 'in', itemId: '', qty: '', remarks: '' });
    const [editingId, setEditingId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');

    const col = () => db.collection('artifacts').doc(appId).collection('public').doc('data').collection('signage_transactions');

    const handleAddTx = async () => {
        if (!newTx.itemId || !newTx.qty) return alert('Select Item and Qty');
        try {
            if (editingId) {
                await col().doc(editingId).update({ ...newTx, qty: Number(newTx.qty), updatedAt: new Date() });
                setEditingId(null);
                setShowForm(false);
            } else {
                await col().add({ ...newTx, qty: Number(newTx.qty), createdAt: new Date() });
            }
            setNewTx({ date: new Date().toISOString().split('T')[0], type: 'in', itemId: '', qty: '', remarks: '' });
        } catch (e) { console.error(e); }
    };

    const handleEdit = (tx) => {
        setNewTx({ ...tx, qty: tx.qty });
        setEditingId(tx.id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancel = () => {
        setEditingId(null);
        setShowForm(false);
        setNewTx({ date: new Date().toISOString().split('T')[0], type: 'in', itemId: '', qty: '', remarks: '' });
    };

    const handleDelete = async (id) => {
        if (confirm('Delete record?')) {
            await col().doc(id).delete();
        }
    };

    const getItemLabel = (item) => {
        if (!item) return '—';
        return item.brand ? `${item.brand} ${item.model}` : item.model;
    };

    const getItemSubSpec = (item) => {
        if (!item) return '';
        if (item.type === 'profile') return item.profileType || '';
        if (item.type === 'led') return item.ledType || '';
        if (item.type === 'smps') return item.environment || '';
        if (item.type === 'acp') return item.acpThickness ? `${item.acpThickness}` : '';
        return '';
    };

    const sortedTx = [...signageTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    const filteredTx = sortedTx.filter(tx => {
        const item = signageInventory.find(i => i.id === tx.itemId) || {};
        const matchesSearch = !searchTerm.trim() ||
            `${getItemLabel(item)} ${tx.remarks || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || tx.type === filterType;
        return matchesSearch && matchesType;
    });

    const getGroupedOptions = () => {
        const groups = signageInventory.reduce((acc, item) => {
            const type = item.type || 'Other';
            if (!acc[type]) acc[type] = [];
            acc[type].push(item);
            return acc;
        }, {});
        return Object.keys(groups).sort().map(type => (
            <optgroup key={type} label={type.replace(/_/g, ' ').toUpperCase()}>
                {groups[type]
                    .sort((a, b) => getItemLabel(a).localeCompare(getItemLabel(b)))
                    .map(i => (
                        <option key={i.id} value={i.id}>{getItemLabel(i)}</option>
                    ))
                }
            </optgroup>
        ));
    };

    const inputCls = "px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500 transition-shadow";

    return (
        <div className="p-3 md:p-4">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center shadow-sm">
                        <Archive className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-extrabold tracking-tight text-slate-800 dark:text-white leading-none">
                            Signage Stock Ledger
                        </h2>
                        <p className="text-[11px] font-medium text-slate-400 mt-0.5 tracking-wide uppercase">
                            {signageTransactions.length} {signageTransactions.length === 1 ? 'transaction' : 'transactions'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Search */}
                    <div className="relative flex-1 sm:w-52">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600 placeholder:text-slate-400 transition-shadow"
                        />
                    </div>

                    {/* In/Out filter */}
                    <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                        {['all', 'in', 'out'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilterType(f)}
                                className={`px-2.5 py-2 text-[11px] font-bold uppercase transition-colors ${filterType === f
                                    ? f === 'in' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                                        : f === 'out' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                            : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                                    : 'bg-white dark:bg-slate-800 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                    }`}
                            >
                                {f === 'all' ? 'All' : f === 'in' ? 'In' : 'Out'}
                            </button>
                        ))}
                    </div>

                    {/* Add button */}
                    {!showForm && !readOnly && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="flex-shrink-0 bg-slate-800 dark:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 hover:bg-slate-900 dark:hover:bg-slate-500 transition-colors shadow-sm"
                        >
                            <Plus size={15} /> Add
                        </button>
                    )}
                </div>
            </div>

            {/* ── Add/Edit Form ── */}
            {showForm && !readOnly && (
                <div className={`p-3 rounded-xl border mb-4 transition-colors ${editingId ? 'bg-amber-50/80 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700' : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700'}`}>
                    <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-600">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{editingId ? '✏️ Edit Transaction' : '➕ New Transaction'}</h3>
                        {editingId
                            ? <button onClick={handleCancel} className="text-xs text-red-500 flex items-center gap-1 hover:text-red-700 transition-colors"><X size={14} /> Cancel</button>
                            : <button onClick={handleCancel} className="text-xs text-slate-500 flex items-center gap-1 hover:text-red-500 transition-colors"><X size={14} /> Close</button>
                        }
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Date & Action</label>
                            <div className="flex gap-1.5">
                                <input type="date" value={newTx.date} onChange={e => setNewTx({ ...newTx, date: e.target.value })} className={inputCls + " flex-1"} />
                                <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
                                    <button
                                        onClick={() => setNewTx({ ...newTx, type: 'in' })}
                                        className={`px-3 py-1.5 text-[11px] font-bold transition-colors ${newTx.type === 'in' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-white dark:bg-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                                    >+ IN</button>
                                    <button
                                        onClick={() => setNewTx({ ...newTx, type: 'out' })}
                                        className={`px-3 py-1.5 text-[11px] font-bold transition-colors ${newTx.type === 'out' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-white dark:bg-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                                    >- OUT</button>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Component</label>
                            <select value={newTx.itemId} onChange={e => setNewTx({ ...newTx, itemId: e.target.value })} className={inputCls + " w-full"}>
                                <option value="">Select Item...</option>
                                {getGroupedOptions()}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Quantity</label>
                            <input type="number" placeholder="Qty" value={newTx.qty} onChange={e => setNewTx({ ...newTx, qty: e.target.value })} className={inputCls + " w-full"} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Location / Source</label>
                            <input type="text" placeholder="Source/Loc" value={newTx.remarks} onChange={e => setNewTx({ ...newTx, remarks: e.target.value })} className={inputCls + " w-full"} />
                        </div>
                    </div>

                    <button onClick={handleAddTx} className={`w-full md:w-auto text-white px-5 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm ${editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-800 dark:bg-slate-600 hover:bg-slate-900 dark:hover:bg-slate-500'}`}>
                        {editingId ? 'Update Transaction' : 'Add Transaction'}
                    </button>
                </div>
            )}

            {/* ── Transaction History ── */}
            <div className="mt-4">
                {/* Mobile Cards */}
                <div className="md:hidden space-y-2">
                    {filteredTx.map(tx => {
                        const item = signageInventory.find(i => i.id === tx.itemId) || {};
                        return (
                            <div key={tx.id} className={`bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between ${editingId === tx.id ? 'ring-2 ring-amber-300' : ''}`}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className={`px-1.5 py-px rounded text-[10px] font-bold uppercase ${tx.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {tx.type === 'in' ? 'IN' : 'OUT'}
                                        </span>
                                        <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                                            {new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')}
                                        </span>
                                    </div>
                                    <div className="font-bold text-slate-800 dark:text-white text-sm truncate">{getItemLabel(item)}</div>
                                    {tx.remarks && <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{tx.remarks}</div>}
                                </div>
                                <div className="text-right pl-3 border-l border-slate-100 dark:border-slate-700 ml-2 flex-shrink-0">
                                    <span className={`block text-base font-extrabold tabular-nums ${tx.type === 'in' ? 'text-green-600' : 'text-red-500'}`}>
                                        {tx.type === 'in' ? '+' : '-'}{tx.qty}
                                    </span>
                                    {!readOnly && (
                                        <div className="flex gap-2 justify-end mt-0.5">
                                            <button onClick={() => handleEdit(tx)} className="text-[10px] text-blue-500 hover:text-blue-700 font-medium">Edit</button>
                                            <button onClick={() => handleDelete(tx.id)} className="text-[10px] text-red-400 hover:text-red-600 font-medium">Del</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {filteredTx.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <ClipboardList className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                            <p className="text-sm text-slate-400">No transactions found.</p>
                        </div>
                    )}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-900 dark:bg-slate-950 border-b border-slate-700">
                                    <th className="px-3 py-1.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] whitespace-nowrap">Date</th>
                                    <th className="px-3 py-1.5 text-center text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] whitespace-nowrap">Type</th>
                                    <th className="px-3 py-1.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] whitespace-nowrap">Component</th>
                                    <th className="px-3 py-1.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] whitespace-nowrap">Category</th>
                                    <th className="px-3 py-1.5 text-right text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] whitespace-nowrap">Qty</th>
                                    <th className="px-3 py-1.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] whitespace-nowrap">Loc/Source</th>
                                    {!readOnly && <th className="px-2 py-1.5 text-right text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] whitespace-nowrap">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                                {filteredTx.map((tx, rowIdx) => {
                                    const item = signageInventory.find(i => i.id === tx.itemId) || {};
                                    const subSpec = getItemSubSpec(item);
                                    return (
                                        <tr key={tx.id} className={`group transition-colors duration-100 ${rowIdx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/60 dark:bg-slate-800/50'} hover:bg-blue-50/50 dark:hover:bg-slate-700/60 ${editingId === tx.id ? 'bg-amber-50/60 dark:bg-amber-900/20' : ''}`}>
                                            {/* Date */}
                                            <td className="px-3 py-1 whitespace-nowrap">
                                                <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                                    {new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')}
                                                </span>
                                            </td>

                                            {/* Type */}
                                            <td className="px-3 py-1 whitespace-nowrap text-center">
                                                <span className={`inline-block px-1 py-px rounded text-[9px] font-bold uppercase tracking-widest ${tx.type === 'in' ? 'bg-green-50 text-green-600 ring-1 ring-green-200/60 dark:bg-green-900/30' : 'bg-red-50 text-red-600 ring-1 ring-red-200/60 dark:bg-red-900/30'}`}>
                                                    {tx.type}
                                                </span>
                                            </td>

                                            {/* Component */}
                                            <td className="px-3 py-1 max-w-[200px]">
                                                <span className="text-[12px] font-semibold text-slate-800 dark:text-white truncate block">
                                                    {getItemLabel(item)}
                                                </span>
                                            </td>

                                            {/* Category */}
                                            <td className="px-3 py-1 whitespace-nowrap">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                        {item.type?.replace(/_/g, ' ') || '—'}
                                                    </span>
                                                    {subSpec && (
                                                        <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1 py-px rounded uppercase">
                                                            {subSpec}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Qty */}
                                            <td className="px-3 py-1 whitespace-nowrap text-right">
                                                <span className={`text-[13px] font-extrabold tabular-nums tracking-tight ${tx.type === 'in' ? 'text-green-600 dark:text-green-500' : 'text-red-500 dark:text-red-400'}`}>
                                                    {tx.type === 'in' ? '+' : '-'}{tx.qty}
                                                </span>
                                            </td>

                                            {/* Loc/Source */}
                                            <td className="px-3 py-1 max-w-[120px]">
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={tx.remarks}>
                                                    {tx.remarks || '—'}
                                                </div>
                                            </td>

                                            {/* Actions */}
                                            {!readOnly && (
                                                <td className="px-2 py-1 whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-0">
                                                        <button onClick={() => handleEdit(tx)} className="w-6 h-6 rounded flex items-center justify-center text-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" title="Edit">
                                                            <Edit size={12} />
                                                        </button>
                                                        <button onClick={() => handleDelete(tx.id)} className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" title="Delete">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filteredTx.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-10 text-center bg-white dark:bg-slate-800">
                            <ClipboardList className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                            <p className="text-[12px] font-medium text-slate-400 uppercase tracking-widest">
                                {searchTerm || filterType !== 'all' ? 'No matching transactions' : 'No transactions recorded'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SignageLedger;
