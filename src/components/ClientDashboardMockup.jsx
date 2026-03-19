import React, { useState } from 'react';
import {
    ArrowLeft, Globe, MapPin, Phone, Mail,
    Plus, Edit2, CheckCircle2, MoreVertical,
    ShoppingBag, FileText, CheckSquare, Landmark,
    Building2, User, ChevronDown, ChevronRight,
    TrendingUp, Clock, AlertCircle
} from 'lucide-react';

const statusStyles = {
    Sent: 'bg-blue-50 text-blue-600 border border-blue-100',
    Revised: 'bg-amber-50 text-amber-600 border border-amber-100',
    Expired: 'bg-slate-100 text-slate-400 border border-slate-200',
};

const priorityDot = {
    Urgent: 'bg-red-500',
    High: 'bg-orange-400',
    Normal: 'bg-sky-400',
};

const milestoneStatusStyle = {
    Paid: 'text-teal-600 bg-teal-50 border-teal-100',
    Pending: 'text-amber-600 bg-amber-50 border-amber-100',
    Upcoming: 'text-slate-400 bg-slate-50 border-slate-200',
};

export default function ClientDashboardMockup({ client, onBack }) {
    const [tasks, setTasks] = useState([
        { id: 1, title: "Coordinate site survey with Rajesh", priority: "High", due: "18 Mar", assignee: "Rajesh", done: false },
        { id: 2, title: "Finalize payment terms for PO-882", priority: "Urgent", due: "20 Mar", assignee: "Ankit", done: false },
        { id: 3, title: "Send revised specs for indoor module", priority: "Normal", due: "22 Mar", assignee: "Priya", done: true },
        { id: 4, title: "Follow up on Q-1024 approval", priority: "High", due: "19 Mar", assignee: "Ankit", done: false },
        { id: 5, title: "Update GST details in billing", priority: "Normal", due: "25 Mar", assignee: "Nandita", done: false },
    ]);

    const [quotesOpen, setQuotesOpen] = useState(false);
    const [hideCompleted, setHideCompleted] = useState(false);

    const toggleTask = (id) => setTasks(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t));

    const company = {
        registeredName: "Acme Logistics and Supply Chain Solutions Private Limited",
        city: "Mumbai",
        website: "www.acmelogistics.com",
        billingAddress: "4th Floor, Skyline Towers, BKC, Mumbai, Maharashtra 400051",
        taxId: "27AAACA1234A1Z5",
        bank: { name: "HDFC Bank", acName: "Acme Logistics Pvt Ltd", acNo: "50200012345678", ifsc: "HDFC0001234" },
    };

    const contacts = [
        { id: 1, name: "Arjun Mehta", role: "Owner", phone: "+91 98200 11223", email: "arjun@acme.com" },
        { id: 2, name: "Sneha Kapoor", role: "Purchase Manager", phone: "+91 98200 44556", email: "sneha@acme.com" },
        { id: 3, name: "Rajesh Iyer", role: "Site Supervisor", phone: "+91 98200 77889", email: "rajesh@acme.com" },
        { id: 4, name: "Vikas Khanna", role: "Accounts", phone: "+91 98200 99001", email: "vikas@acme.com" },
    ];

    const latestQuote = { id: 'Q-1024', ver: 'v3', date: '2024-03-15', amount: '₹12,45,000', amountRaw: 1245000, status: 'Sent' };
    const olderQuotes = [
        { id: 'Q-1024', ver: 'v2', date: '2024-03-10', amount: '₹14,00,000', status: 'Revised' },
        { id: 'Q-1024', ver: 'v1', date: '2024-03-05', amount: '₹15,30,000', status: 'Expired' },
    ];

    const pos = [
        {
            id: 'PO-882', product: 'P2.5 Indoor LED Screen (4×3m)',
            rate: '₹8,50,000', tax: '18% GST', total: '₹10,03,000',
            milestones: [
                { label: 'Advance (40%)', status: 'Paid', date: '01 Mar', amount: 401200 },
                { label: 'Dispatch (50%)', status: 'Pending', date: '25 Mar', amount: 501500 },
                { label: 'Installation (10%)', status: 'Upcoming', date: '05 Apr', amount: 100300 },
            ],
        },
    ];

    // Compute stats
    const salesPotential = latestQuote.amountRaw;
    const paymentPending = pos.flatMap(p => p.milestones).filter(m => m.status === 'Pending').reduce((s, m) => s + m.amount, 0);
    const paymentUpcoming = pos.flatMap(p => p.milestones).filter(m => m.status === 'Upcoming').reduce((s, m) => s + m.amount, 0);

    const fmt = (n) => '₹' + (n / 100000).toFixed(2).replace(/\.?0+$/, '') + 'L';

    const visibleTasks = hideCompleted ? tasks.filter(t => !t.done) : tasks;
    const completedCount = tasks.filter(t => t.done).length;

    // ── Sub-components ──
    const SecLabel = ({ icon: Icon, label }) => (
        <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            <Icon size={11} />{label}
        </div>
    );

    const QuoteRow = ({ q, highlighted }) => (
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg group ${highlighted ? 'bg-white border border-slate-200 shadow-sm' : 'hover:bg-slate-50'}`}>
            <span className="text-[11px] font-mono font-bold text-slate-400 w-12 shrink-0">{q.id}</span>
            <span className="px-1 py-0.5 bg-slate-100 rounded text-[11px] font-bold text-slate-500 w-6 text-center shrink-0">{q.ver}</span>
            <span className="text-[11px] text-slate-500 tabular-nums flex-1">{q.date}</span>
            <span className="text-[11px] font-semibold text-slate-700 tabular-nums shrink-0">{q.amount}</span>
            <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0 ${statusStyles[q.status]}`}>{q.status}</span>
            <button className="text-[11px] text-violet-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity shrink-0">PDF</button>
        </div>
    );

    return (
        <div className="h-screen flex flex-col bg-slate-100 overflow-hidden" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

            {/* ══ HEADER ══ */}
            <div className="shrink-0 bg-white border-b border-slate-200">
                {/* Row 1: Client name + actions */}
                <div className="px-4 pt-2.5 pb-1.5 flex items-center justify-between gap-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <button onClick={onBack} className="p-1 rounded hover:bg-slate-100 text-slate-500 transition-colors shrink-0">
                            <ArrowLeft size={14} />
                        </button>
                        <div className="w-px h-4 bg-slate-200 shrink-0" />
                        <span className="text-sm font-bold text-slate-800">Leadspace</span>
                        <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-teal-50 text-teal-600 border border-teal-200">Active</span>
                        <span className="flex items-center gap-0.5 text-[11px] text-slate-400 ml-1">
                            <MapPin size={11} /> Mumbai
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button className="flex items-center gap-0.5 px-2 py-1 border border-slate-200 text-slate-600 rounded text-[11px] font-semibold hover:bg-slate-50 transition-colors">
                            <Edit2 size={11} /> Edit
                        </button>
                        <button className="flex items-center gap-0.5 px-2.5 py-1 bg-violet-600 text-white rounded text-[11px] font-bold hover:bg-violet-700 transition-colors">
                            <Plus size={11} /> New Quote
                        </button>
                    </div>
                </div>

                {/* Row 2: Stats */}
                <div className="px-4 py-2 flex items-center gap-6">
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                            <TrendingUp size={11} className="text-violet-500" />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 leading-none">Sales Potential</p>
                            <p className="text-sm font-bold text-slate-800 tabular-nums leading-tight">{fmt(salesPotential)}</p>
                        </div>
                    </div>
                    <div className="w-px h-7 bg-slate-100 shrink-0" />
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                            <AlertCircle size={11} className="text-amber-500" />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 leading-none">Payment Pending</p>
                            <p className="text-sm font-bold text-amber-600 tabular-nums leading-tight">{fmt(paymentPending)}</p>
                        </div>
                    </div>
                    <div className="w-px h-7 bg-slate-100 shrink-0" />
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
                            <Clock size={11} className="text-sky-500" />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 leading-none">Payment Upcoming</p>
                            <p className="text-sm font-bold text-sky-600 tabular-nums leading-tight">{fmt(paymentUpcoming)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ══ 3-COLUMN BODY ══ */}
            <div className="flex-1 overflow-hidden p-3 grid gap-3" style={{ gridTemplateColumns: '1fr 1.35fr 0.85fr', minHeight: 0 }}>

                {/* ── COL 1: TASKS ── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                    {/* Task header */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 shrink-0">
                        <div className="flex items-center gap-1.5">
                            <CheckSquare size={11} className="text-violet-500" />
                            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Tasks</span>
                            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold">{tasks.length}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setHideCompleted(h => !h)}
                                className={`text-[11px] font-semibold px-1.5 py-0.5 rounded transition-colors ${hideCompleted ? 'bg-violet-100 text-violet-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {hideCompleted ? 'Show all' : `Hide done (${completedCount})`}
                            </button>
                            <button className="flex items-center gap-0.5 px-1.5 py-1 bg-violet-600 text-white rounded text-[11px] font-bold hover:bg-violet-700 transition-colors">
                                <Plus size={11} /> New
                            </button>
                        </div>
                    </div>
                    {/* Col headers */}
                    <div className="grid px-3 py-1 border-b border-slate-100 shrink-0 bg-slate-50" style={{ gridTemplateColumns: '14px 1fr 52px 40px' }}>
                        {['', 'Task', 'Assignee', 'Due'].map((h, i) => (
                            <span key={i} className={`text-[11px] font-bold uppercase tracking-wider text-slate-400 ${i > 1 ? 'text-center' : ''}`}>{h}</span>
                        ))}
                    </div>
                    {/* Rows */}
                    <div className="flex-1 overflow-y-auto">
                        {visibleTasks.map(task => (
                            <div
                                key={task.id}
                                className={`grid items-center px-3 py-1.5 border-b border-slate-50 last:border-0 cursor-pointer group transition-colors ${task.done ? 'opacity-40' : 'hover:bg-slate-50'}`}
                                style={{ gridTemplateColumns: '14px 1fr 52px 40px' }}
                                onClick={() => toggleTask(task.id)}
                            >
                                <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${task.done ? 'bg-teal-500 border-teal-500' : 'border-slate-300 group-hover:border-violet-400'}`}>
                                    {task.done && <CheckCircle2 size={7} className="text-white" />}
                                </div>
                                <div className="pl-1.5 flex items-center gap-1.5 min-w-0">
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDot[task.priority]}`} />
                                    <span className={`text-[11px] truncate ${task.done ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>{task.title}</span>
                                </div>
                                <span className="text-center text-[11px] text-slate-600 font-medium truncate px-0.5">{task.assignee}</span>
                                <span className="text-center text-[11px] text-slate-400 tabular-nums">{task.due}</span>
                            </div>
                        ))}
                        {visibleTasks.length === 0 && (
                            <div className="flex items-center justify-center h-12 text-[11px] text-slate-400">All done 🎉</div>
                        )}
                    </div>
                </div>

                {/* ── COL 2: QUOTES + PO ── */}
                <div className="flex flex-col gap-2.5 overflow-y-auto pr-0.5">

                    {/* Quotes */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 shrink-0">
                        <div className="flex items-center justify-between mb-1.5">
                            <SecLabel icon={FileText} label="Quotes Sent" />
                            <button className="text-[11px] text-violet-600 font-bold flex items-center gap-0.5 hover:underline -mt-2">
                                <Plus size={9} /> New
                            </button>
                        </div>
                        <QuoteRow q={latestQuote} highlighted />
                        <button
                            onClick={() => setQuotesOpen(o => !o)}
                            className="flex items-center gap-0.5 mt-1.5 text-[11px] text-slate-400 hover:text-slate-600 font-semibold transition-colors"
                        >
                            {quotesOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            {quotesOpen ? 'Hide' : 'Show'} older versions ({olderQuotes.length})
                        </button>
                        {quotesOpen && (
                            <div className="mt-1 pl-2 border-l-2 border-slate-100 space-y-0.5">
                                {olderQuotes.map((q, i) => <QuoteRow key={i} q={q} />)}
                            </div>
                        )}
                    </div>

                    {/* PO */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex-1">
                        <div className="flex items-center justify-between mb-2">
                            <SecLabel icon={ShoppingBag} label="Purchase Orders" />
                            <button className="text-[11px] text-violet-600 font-bold flex items-center gap-0.5 hover:underline -mt-2">
                                <Plus size={11} /> Add PO
                            </button>
                        </div>

                        {pos.map(po => (
                            <div key={po.id} className="border border-slate-200 rounded-lg overflow-hidden mb-2 last:mb-0">
                                <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
                                    <span className="text-[11px] font-bold text-violet-500 shrink-0">{po.id}</span>
                                    <span className="text-[11px] font-semibold text-slate-800 flex-1 truncate">{po.product}</span>
                                    <span className="text-[11px] text-slate-400 shrink-0">{po.rate} +{po.tax}</span>
                                    <span className="text-[11px] font-bold text-teal-600 shrink-0">{po.total}</span>
                                    <button className="p-0.5 text-slate-400 hover:text-slate-600 shrink-0"><MoreVertical size={11} /></button>
                                </div>
                                <div className="bg-slate-50 px-3 py-1 grid text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100" style={{ gridTemplateColumns: '1fr 56px 64px' }}>
                                    <span>Milestone</span>
                                    <span className="text-center">Due</span>
                                    <span className="text-center">Status</span>
                                </div>
                                {po.milestones.map((ms, i) => (
                                    <div key={i} className="grid items-center px-3 py-1.5 border-b border-slate-50 last:border-0" style={{ gridTemplateColumns: '1fr 56px 64px' }}>
                                        <span className="text-[11px] text-slate-700">{ms.label}</span>
                                        <span className="text-center text-[11px] text-slate-400 tabular-nums">{ms.date}</span>
                                        <div className="flex justify-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold border ${milestoneStatusStyle[ms.status]}`}>{ms.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── COL 3: COMPANY + BANK + CONTACTS ── */}
                <div className="flex flex-col gap-2.5 overflow-y-auto pr-0.5">

                    {/* Company */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 shrink-0">
                        <SecLabel icon={Building2} label="Company" />
                                <p className="text-[11px] text-slate-700 font-medium leading-snug">{company.registeredName}</p>
                                <p className="text-[11px] text-slate-500 leading-snug mt-1">{company.billingAddress}</p>
                        <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                <Globe size={11} className="text-violet-400 shrink-0" />
                                <a href="#" className="text-violet-500 hover:underline truncate">{company.website}</a>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">GST</span>
                                <span className="font-mono text-slate-600">{company.taxId}</span>
                            </div>
                        </div>
                    </div>

                    {/* Bank */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 shrink-0">
                        <SecLabel icon={Landmark} label="Bank Details" />
                        <div className="space-y-1">
                            {[['Bank', company.bank.name], ['A/C', company.bank.acNo], ['IFSC', company.bank.ifsc]].map(([lbl, val]) => (
                                <div key={lbl} className="flex justify-between items-center gap-2">
                                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 shrink-0">{lbl}</span>
                                    <span className="text-[11px] font-mono text-slate-700 text-right truncate">{val}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Contacts */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex-1">
                        <div className="flex items-center justify-between mb-2">
                            <SecLabel icon={User} label="Contacts" />
                            <button className="text-[11px] text-violet-600 font-bold flex items-center gap-0.5 hover:underline -mt-2 shrink-0">
                                <Plus size={11} /> Add
                            </button>
                        </div>
                        <div className="space-y-2">
                            {contacts.map(c => (
                                <div key={c.id} className="flex items-start gap-2 py-1.5 border-b border-slate-50 last:border-0">
                                    <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="text-[11px] font-bold text-violet-600">{c.name[0]}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-baseline gap-1.5 flex-wrap">
                                            <p className="text-[11px] font-semibold text-slate-800">{c.name}</p>
                                            <p className="text-[11px] text-violet-500 font-semibold shrink-0">{c.role}</p>
                                        </div>
                                        <p className="text-[11px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                                            <Phone size={11} className="shrink-0" /> {c.phone}
                                        </p>
                                        <p className="text-[11px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                                            <Mail size={11} className="shrink-0" /> {c.email}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}