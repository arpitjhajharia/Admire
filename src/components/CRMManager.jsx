import React, { useState, useEffect, useMemo } from 'react';
import { db, appId } from '../lib/firebase';
import {
    Plus, Trash2, Edit2, X, Save, Search, Filter,
    ChevronDown, ChevronUp, ArrowUpDown, Phone, Mail,
    Building2, MapPin, TrendingUp, Users, DollarSign, Star,
    MessageSquare, Clock, CheckCircle, AlertCircle, Circle,
    Calendar, Tag, BarChart2, Kanban, List, Eye, Activity,
    FileText, Send, RefreshCw
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────
const STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];

const STAGE_COLORS = {
    Lead:        { bg: 'bg-slate-100 dark:bg-slate-700',       text: 'text-slate-600 dark:text-slate-300',  dot: 'bg-slate-400'   },
    Qualified:   { bg: 'bg-blue-100 dark:bg-blue-900/40',      text: 'text-blue-700 dark:text-blue-300',    dot: 'bg-blue-500'    },
    Proposal:    { bg: 'bg-amber-100 dark:bg-amber-900/40',    text: 'text-amber-700 dark:text-amber-300',  dot: 'bg-amber-500'   },
    Negotiation: { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300',dot: 'bg-purple-500'  },
    Won:         { bg: 'bg-teal-100 dark:bg-teal-900/40',     text: 'text-teal-700 dark:text-teal-300',    dot: 'bg-teal-500'    },
    Lost:        { bg: 'bg-red-100 dark:bg-red-900/40',       text: 'text-red-700 dark:text-red-300',      dot: 'bg-red-500'     },
};

const PRIORITY_COLORS = {
    Low:    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    Normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    High:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    Urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const ACTIVITY_TYPES = ['Call', 'Email', 'Meeting', 'Demo', 'Follow-up', 'Note'];

const ACTIVITY_ICONS = {
    Call:       <Phone size={12} />,
    Email:      <Mail size={12} />,
    Meeting:    <Users size={12} />,
    Demo:       <Star size={12} />,
    'Follow-up':<RefreshCw size={12} />,
    Note:       <MessageSquare size={12} />,
};

const emptyLead = () => ({
    companyName: '', contactName: '', email: '', phone: '', location: '',
    stage: 'Lead', priority: 'Normal', source: '',
    dealValue: '', currency: 'INR', tags: '',
    notes: '', assignedTo: '',
    createdAt: null, updatedAt: null, createdBy: '',
});

const todayStr = () => new Date().toISOString().split('T')[0];

const fmtCurrency = (val, currency = 'INR') => {
    const n = Number(val);
    if (!val || isNaN(n)) return '-';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
};

const fmtDate = (ts) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
};

// ─── Sub-components ────────────────────────────────────────────────────────

const StageBadge = ({ stage }) => {
    const c = STAGE_COLORS[stage] || STAGE_COLORS.Lead;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${c.bg} ${c.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
            {stage}
        </span>
    );
};

const SortableHeader = ({ label, columnKey, sortConfig, onSort, className = '' }) => {
    const active = sortConfig.key === columnKey;
    return (
        <th
            scope="col"
            className={`px-2 py-2 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] whitespace-nowrap cursor-pointer hover:bg-slate-800/80 group transition-colors select-none ${className}`}
            onClick={() => onSort(columnKey)}
        >
            <div className="flex items-center gap-1">
                {label}
                {active
                    ? sortConfig.direction === 'asc' ? <ChevronUp size={11} className="text-teal-400" /> : <ChevronDown size={11} className="text-teal-400" />
                    : <ArrowUpDown size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                }
            </div>
        </th>
    );
};

// ─── Lead Form Modal ────────────────────────────────────────────────────────

const LeadFormModal = ({ lead, onSave, onClose, usersList }) => {
    const [form, setForm] = useState(lead ? { ...lead } : emptyLead());
    const [saving, setSaving] = useState(false);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        if (!form.companyName.trim() && !form.contactName.trim()) return;
        setSaving(true);
        await onSave(form);
        setSaving(false);
    };

    const inputCls = 'w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 text-slate-900 dark:text-white transition-colors';
    const labelCls = 'block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                            {lead ? 'Edit Lead' : 'New Lead'}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Fill in the deal information below</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Company */}
                    <div className="sm:col-span-2">
                        <label className={labelCls}>Company Name <span className="text-red-400">*</span></label>
                        <input type="text" value={form.companyName} onChange={e => set('companyName', e.target.value)}
                            className={inputCls} placeholder="Acme Corporation" autoFocus />
                    </div>

                    {/* Contact */}
                    <div>
                        <label className={labelCls}>Contact Person</label>
                        <input type="text" value={form.contactName} onChange={e => set('contactName', e.target.value)}
                            className={inputCls} placeholder="John Doe" />
                    </div>

                    {/* Email */}
                    <div>
                        <label className={labelCls}>Email</label>
                        <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                            className={inputCls} placeholder="john@acme.com" />
                    </div>

                    {/* Phone */}
                    <div>
                        <label className={labelCls}>Phone</label>
                        <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                            className={inputCls} placeholder="+91 98765 43210" />
                    </div>

                    {/* Location */}
                    <div>
                        <label className={labelCls}>Location / City</label>
                        <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
                            className={inputCls} placeholder="Mumbai" />
                    </div>

                    {/* Stage */}
                    <div>
                        <label className={labelCls}>Stage</label>
                        <select value={form.stage} onChange={e => set('stage', e.target.value)} className={inputCls}>
                            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* Priority */}
                    <div>
                        <label className={labelCls}>Priority</label>
                        <select value={form.priority} onChange={e => set('priority', e.target.value)} className={inputCls}>
                            {['Low', 'Normal', 'High', 'Urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    {/* Deal Value */}
                    <div>
                        <label className={labelCls}>Deal Value</label>
                        <div className="flex gap-2">
                            <select value={form.currency} onChange={e => set('currency', e.target.value)}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 text-slate-900 dark:text-white">
                                <option value="INR">₹ INR</option>
                                <option value="USD">$ USD</option>
                                <option value="AED">AED</option>
                            </select>
                            <input type="number" value={form.dealValue} onChange={e => set('dealValue', e.target.value)}
                                className={inputCls} placeholder="0" />
                        </div>
                    </div>

                    {/* Source */}
                    <div>
                        <label className={labelCls}>Lead Source</label>
                        <select value={form.source} onChange={e => set('source', e.target.value)} className={inputCls}>
                            <option value="">– Select –</option>
                            {['Referral', 'Website', 'LinkedIn', 'Exhibition', 'Cold Call', 'Email Campaign', 'Partner', 'Other'].map(s =>
                                <option key={s} value={s}>{s}</option>
                            )}
                        </select>
                    </div>

                    {/* Assigned To */}
                    <div>
                        <label className={labelCls}>Assigned To</label>
                        <select value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)} className={inputCls}>
                            <option value="">– Unassigned –</option>
                            {usersList.map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                        </select>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className={labelCls}>Tags (comma separated)</label>
                        <input type="text" value={form.tags} onChange={e => set('tags', e.target.value)}
                            className={inputCls} placeholder="outdoor, large-screen, govt" />
                    </div>

                    {/* Notes */}
                    <div className="sm:col-span-2">
                        <label className={labelCls}>Notes</label>
                        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                            rows={3} className={`${inputCls} resize-none`} placeholder="Any additional context…" />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 dark:border-slate-700">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || (!form.companyName.trim() && !form.contactName.trim())}
                        className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                    >
                        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        {lead ? 'Update Lead' : 'Create Lead'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Activity Log Panel ─────────────────────────────────────────────────────

const ActivityPanel = ({ lead, onClose, user, activities, onAdd, onDelete }) => {
    const [type, setType] = useState('Note');
    const [note, setNote] = useState('');
    const [date, setDate] = useState(todayStr());

    const handleAdd = async () => {
        if (!note.trim()) return;
        await onAdd({ type, note: note.trim(), date, leadId: lead.id, leadName: lead.companyName });
        setNote('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-800 w-full md:w-[540px] max-h-[85vh] rounded-t-2xl md:rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
                            <Activity size={16} className="text-purple-500" />
                            Activity Log
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">{lead.companyName || lead.contactName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Add Activity */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex-shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="flex gap-2 mb-2">
                        {ACTIVITY_TYPES.map(t => (
                            <button key={t} onClick={() => setType(t)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-colors ${type === t ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'}`}>
                                {ACTIVITY_ICONS[t]}{t}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input type="date" value={date} onChange={e => setDate(e.target.value)}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/40 text-slate-700 dark:text-white" />
                        <input
                            type="text" value={note} onChange={e => setNote(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 text-slate-900 dark:text-white"
                            placeholder="Add a note…"
                        />
                        <button onClick={handleAdd} disabled={!note.trim()}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold disabled:opacity-40 transition-colors flex items-center gap-1">
                            <Send size={13} />
                        </button>
                    </div>
                </div>

                {/* Activity List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {activities.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                            <MessageSquare size={36} className="mb-2 opacity-30" />
                            <p className="text-sm">No activities yet</p>
                        </div>
                    )}
                    {activities.map((a, i) => (
                        <div key={a.id || i} className="group flex gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50">
                            <div className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400`}>
                                {ACTIVITY_ICONS[a.type] || <MessageSquare size={12} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">{a.type}</span>
                                    <span className="text-[10px] text-slate-400">{a.date}</span>
                                    <span className="text-[10px] text-slate-400">· {a.createdBy || 'unknown'}</span>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-200">{a.note}</p>
                            </div>
                            <button onClick={() => onDelete(a.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500 flex-shrink-0 mt-1">
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─── Kanban View ─────────────────────────────────────────────────────────────

const KanbanView = ({ leads, onEdit, onStageChange }) => {
    const byStage = useMemo(() => {
        const map = {};
        STAGES.forEach(s => map[s] = []);
        leads.forEach(l => {
            if (map[l.stage]) map[l.stage].push(l);
        });
        return map;
    }, [leads]);

    const stagesToShow = STAGES.filter(s => s !== 'Lost' || byStage['Lost']?.length > 0);

    return (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
            {stagesToShow.map(stage => {
                const c = STAGE_COLORS[stage];
                const stageLeads = byStage[stage];
                const total = stageLeads.reduce((sum, l) => sum + (Number(l.dealValue) || 0), 0);
                return (
                    <div key={stage} className="flex-shrink-0 w-60">
                        {/* Column Header */}
                        <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border-b-2 ${c.bg} border-current`}>
                            <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${c.text}`}>
                                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                                {stage}
                                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>
                                    {stageLeads.length}
                                </span>
                            </div>
                            {total > 0 && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                                    {fmtCurrency(total, stageLeads[0]?.currency || 'INR')}
                                </span>
                            )}
                        </div>

                        {/* Cards */}
                        <div className="space-y-2 pt-2 min-h-[100px]">
                            {stageLeads.map(lead => (
                                <div key={lead.id} onClick={() => onEdit(lead)}
                                    className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 cursor-pointer hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition-all">
                                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{lead.companyName || lead.contactName}</p>
                                    {lead.contactName && lead.companyName && (
                                        <p className="text-xs text-slate-400 truncate mt-0.5">{lead.contactName}</p>
                                    )}
                                    <div className="flex items-center justify-between mt-2">
                                        {lead.dealValue ? (
                                            <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                                                {fmtCurrency(lead.dealValue, lead.currency)}
                                            </span>
                                        ) : <span />}
                                        {lead.priority && lead.priority !== 'Normal' && (
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${PRIORITY_COLORS[lead.priority]}`}>
                                                {lead.priority}
                                            </span>
                                        )}
                                    </div>
                                    {lead.assignedTo && (
                                        <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                                            <Users size={10} />{lead.assignedTo}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ─── Main Component ─────────────────────────────────────────────────────────

const CRMManager = ({ user, userRole }) => {
    const [leads, setLeads] = useState([]);
    const [activities, setActivities] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [viewMode, setViewMode] = useState('list'); // list | kanban | analytics
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStage, setFilterStage] = useState('All');
    const [filterAssignee, setFilterAssignee] = useState('All');
    const [sortConfig, setSortConfig] = useState({ key: 'updatedAt', direction: 'desc' });
    const [expandedGroups, setExpandedGroups] = useState({});

    // Modal State
    const [editingLead, setEditingLead] = useState(null); // null = closed, {} = new, lead obj = edit
    const [showForm, setShowForm] = useState(false);
    const [activityLead, setActivityLead] = useState(null);

    const isAdmin = ['super_admin', 'admin'].includes(userRole);
    const baseRef = () => db.collection('artifacts').doc(appId).collection('public').doc('data');

    // ── Firestore Listeners ──
    useEffect(() => {
        if (!user || !db) return;

        const unsubLeads = baseRef().collection('crm_leads')
            .orderBy('updatedAt', 'desc')
            .onSnapshot(snap => {
                setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoading(false);
            }, err => { console.error(err); setLoading(false); });

        const unsubActivities = baseRef().collection('crm_activities')
            .orderBy('createdAt', 'desc')
            .onSnapshot(snap => {
                setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            }, err => console.error(err));

        const unsubUsers = baseRef().collection('user_roles')
            .onSnapshot(snap => {
                setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.username || '').localeCompare(b.username || '')));
            });

        return () => { unsubLeads(); unsubActivities(); unsubUsers(); };
    }, [user]);

    // ── CRUD ──
    const handleSaveLead = async (form) => {
        const data = {
            companyName: form.companyName?.trim() || '',
            contactName: form.contactName?.trim() || '',
            email: form.email?.trim() || '',
            phone: form.phone?.trim() || '',
            location: form.location?.trim() || '',
            stage: form.stage || 'Lead',
            priority: form.priority || 'Normal',
            source: form.source || '',
            dealValue: form.dealValue ? String(form.dealValue) : '',
            currency: form.currency || 'INR',
            tags: form.tags?.trim() || '',
            notes: form.notes?.trim() || '',
            assignedTo: form.assignedTo || '',
            updatedAt: new Date(),
        };

        const ref = baseRef().collection('crm_leads');
        if (editingLead?.id) {
            await ref.doc(editingLead.id).update(data);
        } else {
            data.createdAt = new Date();
            data.createdBy = user.username || user.email;
            await ref.add(data);
        }
        setShowForm(false);
        setEditingLead(null);
    };

    const handleDeleteLead = async (id) => {
        if (!window.confirm('Delete this lead? This cannot be undone.')) return;
        await baseRef().collection('crm_leads').doc(id).delete();
    };

    const handleStageChange = async (leadId, newStage) => {
        await baseRef().collection('crm_leads').doc(leadId).update({ stage: newStage, updatedAt: new Date() });
    };

    const handleAddActivity = async (actData) => {
        await baseRef().collection('crm_activities').add({
            ...actData,
            createdAt: new Date(),
            createdBy: user.username || user.email,
        });
    };

    const handleDeleteActivity = async (id) => {
        await baseRef().collection('crm_activities').doc(id).delete();
    };

    // ── Sorting & Filtering ──
    const handleSort = (key) => {
        setSortConfig(c => ({ key, direction: c.key === key && c.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const filteredLeads = useMemo(() => {
        let result = [...leads];

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(l =>
                (l.companyName || '').toLowerCase().includes(q) ||
                (l.contactName || '').toLowerCase().includes(q) ||
                (l.email || '').toLowerCase().includes(q) ||
                (l.tags || '').toLowerCase().includes(q) ||
                (l.location || '').toLowerCase().includes(q)
            );
        }

        if (filterStage !== 'All') result = result.filter(l => l.stage === filterStage);
        if (filterAssignee !== 'All') result = result.filter(l => l.assignedTo === filterAssignee);

        result.sort((a, b) => {
            let av = a[sortConfig.key], bv = b[sortConfig.key];
            if (av === undefined || av === null) av = '';
            if (bv === undefined || bv === null) bv = '';
            if (sortConfig.key === 'updatedAt' || sortConfig.key === 'createdAt') {
                av = av?.toMillis?.() || 0;
                bv = bv?.toMillis?.() || 0;
            } else if (sortConfig.key === 'dealValue') {
                av = Number(av) || 0;
                bv = Number(bv) || 0;
            } else {
                av = String(av).toLowerCase();
                bv = String(bv).toLowerCase();
            }
            if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
            if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [leads, searchQuery, filterStage, filterAssignee, sortConfig]);

    // ── Analytics ──
    const analytics = useMemo(() => {
        const total = leads.length;
        const pipeline = leads.filter(l => !['Won', 'Lost'].includes(l.stage));
        const won = leads.filter(l => l.stage === 'Won');
        const lost = leads.filter(l => l.stage === 'Lost');
        const totalValue = pipeline.reduce((s, l) => s + (Number(l.dealValue) || 0), 0);
        const wonValue = won.reduce((s, l) => s + (Number(l.dealValue) || 0), 0);
        const winRate = (won.length + lost.length) > 0
            ? Math.round((won.length / (won.length + lost.length)) * 100)
            : 0;
        const byStage = {};
        STAGES.forEach(s => { byStage[s] = leads.filter(l => l.stage === s).length; });
        return { total, pipeline: pipeline.length, totalValue, wonValue, winRate, byStage };
    }, [leads]);

    // ── Lead activities filter ──
    const leadActivities = (leadId) => activities.filter(a => a.leadId === leadId);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-300 pb-12">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Users size={22} className="text-purple-500" />
                        CRM
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage your sales pipeline and customer relationships</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* View Switcher */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg">
                        {[{ id: 'list', icon: List, label: 'List' }, { id: 'kanban', icon: Kanban, label: 'Board' }, { id: 'analytics', icon: BarChart2, label: 'Analytics' }].map(v => (
                            <button key={v.id} onClick={() => setViewMode(v.id)}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === v.id ? 'bg-white dark:bg-slate-600 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>
                                <v.icon size={13} />{v.label}
                            </button>
                        ))}
                    </div>

                    <button onClick={() => { setEditingLead(null); setShowForm(true); }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold transition-colors shadow-sm">
                        <Plus size={15} />New Lead
                    </button>
                </div>
            </div>

            {/* ── Analytics Cards (always visible) ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                    { label: 'Total Leads', value: analytics.total, icon: Users, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
                    { label: 'In Pipeline', value: analytics.pipeline, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                    { label: 'Pipeline Value', value: fmtCurrency(analytics.totalValue, 'INR'), icon: DollarSign, color: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-900/20' },
                    { label: 'Win Rate', value: `${analytics.winRate}%`, icon: Star, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                ].map(card => (
                    <div key={card.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${card.bg} ${card.color}`}>
                            <card.icon size={18} />
                        </div>
                        <div>
                            <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wide">{card.label}</p>
                            <p className="text-xl font-bold text-slate-800 dark:text-white leading-tight">{card.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Analytics Detail View ── */}
            {viewMode === 'analytics' && (
                <div className="space-y-6">
                    {/* Stage Funnel */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                            <BarChart2 size={15} className="text-purple-500" /> Pipeline by Stage
                        </h3>
                        <div className="space-y-3">
                            {STAGES.map(stage => {
                                const count = analytics.byStage[stage] || 0;
                                const pct = analytics.total > 0 ? (count / analytics.total) * 100 : 0;
                                const c = STAGE_COLORS[stage];
                                return (
                                    <div key={stage} className="flex items-center gap-3">
                                        <span className={`w-20 text-xs font-bold ${c.text}`}>{stage}</span>
                                        <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                            <div className={`h-2 rounded-full ${c.dot}`} style={{ width: `${pct}%`, transition: 'width 0.6s ease' }} />
                                        </div>
                                        <span className="text-xs font-bold text-slate-500 w-6 text-right">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Recent Activities */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                            <Activity size={15} className="text-purple-500" /> Recent Activities
                        </h3>
                        {activities.length === 0
                            ? <p className="text-sm text-slate-400 text-center py-6">No activities logged yet.</p>
                            : activities.slice(0, 15).map(a => (
                                <div key={a.id} className="flex items-start gap-3 py-2.5 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                                    <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        {ACTIVITY_ICONS[a.type] || <MessageSquare size={11} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex gap-2 text-[10px] text-slate-400 mb-0.5">
                                            <span className="font-bold text-purple-500 uppercase">{a.type}</span>
                                            <span>·</span>
                                            <span className="truncate font-semibold text-slate-600 dark:text-slate-300">{a.leadName}</span>
                                            <span>·</span>
                                            <span>{a.date}</span>
                                        </div>
                                        <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{a.note}</p>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}

            {/* ── Kanban View ── */}
            {viewMode === 'kanban' && (
                <KanbanView leads={filteredLeads} onEdit={(lead) => { setEditingLead(lead); setShowForm(true); }} onStageChange={handleStageChange} />
            )}

            {/* ── List View ── */}
            {viewMode === 'list' && (
                <>
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-slate-800 dark:text-white"
                                placeholder="Search companies, contacts, tags…"
                            />
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30">
                                <option value="All">All Stages</option>
                                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>

                            <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30">
                                <option value="All">All Assignees</option>
                                {usersList.map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                            </select>

                            <span className="text-xs text-slate-400">{filteredLeads.length} result{filteredLeads.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>

                    {/* TABLE */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-[0_1px_3px_rgba(0,0,0,0.04)] bg-white dark:bg-slate-800">
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-900 dark:bg-slate-950 border-b border-slate-700">
                                    <SortableHeader label="Company" columnKey="companyName" sortConfig={sortConfig} onSort={handleSort} className="min-w-[140px]" />
                                    <SortableHeader label="Contact" columnKey="contactName" sortConfig={sortConfig} onSort={handleSort} className="min-w-[120px] hidden md:table-cell" />
                                    <SortableHeader label="Stage" columnKey="stage" sortConfig={sortConfig} onSort={handleSort} />
                                    <SortableHeader label="Priority" columnKey="priority" sortConfig={sortConfig} onSort={handleSort} className="hidden lg:table-cell" />
                                    <SortableHeader label="Deal Value" columnKey="dealValue" sortConfig={sortConfig} onSort={handleSort} className="hidden sm:table-cell" />
                                    <SortableHeader label="Source" columnKey="source" sortConfig={sortConfig} onSort={handleSort} className="hidden xl:table-cell" />
                                    <SortableHeader label="Assigned" columnKey="assignedTo" sortConfig={sortConfig} onSort={handleSort} className="hidden md:table-cell" />
                                    <SortableHeader label="Updated" columnKey="updatedAt" sortConfig={sortConfig} onSort={handleSort} className="hidden lg:table-cell" />
                                    <th scope="col" className="px-2 py-2 text-right text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] whitespace-nowrap w-24">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                                {filteredLeads.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="p-12 text-center text-slate-400">
                                            {leads.length === 0 ? 'No leads yet. Click "New Lead" to get started.' : 'No results match your filters.'}
                                        </td>
                                    </tr>
                                )}
                                {filteredLeads.map((lead, idx) => (
                                    <tr key={lead.id}
                                        className={`group cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/60 dark:bg-slate-800/50'} hover:bg-purple-50/40 dark:hover:bg-purple-900/10`}
                                        onClick={() => { setEditingLead(lead); setShowForm(true); }}>

                                        {/* Company */}
                                        <td className="px-3 py-2 min-w-[140px]">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                    {(lead.companyName || lead.contactName || '?')[0].toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{lead.companyName || '–'}</p>
                                                    {lead.location && <p className="text-[10px] text-slate-400 flex items-center gap-0.5"><MapPin size={8} />{lead.location}</p>}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Contact */}
                                        <td className="px-2 py-2 hidden md:table-cell">
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{lead.contactName || '–'}</p>
                                            {lead.email && <p className="text-[10px] text-slate-400 truncate">{lead.email}</p>}
                                        </td>

                                        {/* Stage */}
                                        <td className="px-2 py-2"><StageBadge stage={lead.stage} /></td>

                                        {/* Priority */}
                                        <td className="px-2 py-2 hidden lg:table-cell">
                                            {lead.priority && lead.priority !== 'Normal' ? (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${PRIORITY_COLORS[lead.priority]}`}>{lead.priority}</span>
                                            ) : <span className="text-xs text-slate-400">–</span>}
                                        </td>

                                        {/* Deal Value */}
                                        <td className="px-2 py-2 hidden sm:table-cell">
                                            <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                                                {fmtCurrency(lead.dealValue, lead.currency)}
                                            </span>
                                        </td>

                                        {/* Source */}
                                        <td className="px-2 py-2 hidden xl:table-cell">
                                            <span className="text-xs text-slate-500 dark:text-slate-400">{lead.source || '–'}</span>
                                        </td>

                                        {/* Assigned */}
                                        <td className="px-2 py-2 hidden md:table-cell">
                                            <span className="text-xs text-slate-600 dark:text-slate-300 capitalize">{lead.assignedTo || '–'}</span>
                                        </td>

                                        {/* Updated */}
                                        <td className="px-2 py-2 hidden lg:table-cell">
                                            <span className="text-xs text-slate-400 tabular-nums">{fmtDate(lead.updatedAt)}</span>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-2 py-2 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* Stage Quick Change */}
                                                <select
                                                    value={lead.stage}
                                                    onClick={e => e.stopPropagation()}
                                                    onChange={e => { e.stopPropagation(); handleStageChange(lead.id, e.target.value); }}
                                                    className="text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-400"
                                                >
                                                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>

                                                <button
                                                    onClick={e => { e.stopPropagation(); setActivityLead(lead); }}
                                                    className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                                                    title="Activity Log">
                                                    <Activity size={12} />
                                                </button>
                                                {(isAdmin || lead.assignedTo === user.username || lead.createdBy === user.username) && (
                                                    <button
                                                        onClick={e => { e.stopPropagation(); handleDeleteLead(lead.id); }}
                                                        className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ── Lead Form Modal ── */}
            {showForm && (
                <LeadFormModal
                    lead={editingLead}
                    usersList={usersList}
                    onSave={handleSaveLead}
                    onClose={() => { setShowForm(false); setEditingLead(null); }}
                />
            )}

            {/* ── Activity Panel ── */}
            {activityLead && (
                <ActivityPanel
                    lead={activityLead}
                    user={user}
                    activities={leadActivities(activityLead.id)}
                    onAdd={handleAddActivity}
                    onDelete={handleDeleteActivity}
                    onClose={() => setActivityLead(null)}
                />
            )}
        </div>
    );
};

export default CRMManager;
