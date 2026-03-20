import React from 'react';
import ReactDOM from 'react-dom';
import { CONFIG } from '../lib/config';

const fmt = (v) => {
    if (v === undefined || v === null || isNaN(v)) return '0';
    return Number(v).toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
};

const QuotePrintLayout = ({ quote, lead }) => {
    if (!quote) return null;

    const date = React.useMemo(() => {
        return quote.createdAt?.toDate ? quote.createdAt.toDate() : new Date(quote.createdAt || Date.now());
    }, [quote.createdAt]);
    const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const renderContent = (isPrint) => (
        <div className={`bg-white text-slate-800 font-sans text-xs ${isPrint ? 'p-0' : 'p-8 w-full shadow-lg border border-slate-200 rounded-xl'}`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-6 border-b-2 border-slate-800 pb-4">
                <div className="flex gap-4 items-center">
                    <img src="/Admire/logo.png" alt="Company Logo" className="h-16 w-auto object-contain" />
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wide">{CONFIG.COMPANY.NAME}</h1>
                        <div className="text-[10px] text-slate-600 mt-1 space-y-0.5">
                            <p>{CONFIG.COMPANY.ADDRESS_1}</p>
                            <p>{CONFIG.COMPANY.ADDRESS_2}</p>
                            <p>Email: {CONFIG.COMPANY.EMAIL} | Web: {CONFIG.COMPANY.WEB}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quote Info */}
            <div className="flex justify-between items-baseline mb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 uppercase tracking-widest border-b-2 border-violet-500 pb-1 inline-block mb-3">Quotation</h2>
                    <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-1 text-[11px]">
                        <span className="font-bold text-slate-400 uppercase tracking-wider">Client:</span>
                        <span className="font-bold text-slate-800 uppercase">{lead?.companyName || lead?.contactName || '—'}</span>
                        <span className="font-bold text-slate-400 uppercase tracking-wider">Project:</span>
                        <span className="font-bold text-slate-700">{quote.projectName || '—'}</span>
                        <span className="font-bold text-slate-400 uppercase tracking-wider">Address:</span>
                        <span className="text-slate-600 leading-tight">{lead?.billingAddress || lead?.location || '—'}</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1 text-[11px]">
                        <span className="font-bold text-slate-400 uppercase tracking-wider">Quote No:</span>
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 rounded">{quote.ref || quote.id?.slice(0, 8).toUpperCase()}</span>
                        <span className="font-bold text-slate-400 uppercase tracking-wider">Date:</span>
                        <span className="font-bold text-slate-800">{dateStr}</span>
                    </div>
                </div>
            </div>

            {/* Line Items Table */}
            <div className="mb-6">
                <table className="w-full border-collapse border border-slate-300 text-[11px]">
                    <thead className="bg-slate-800 text-white uppercase tracking-wider">
                        <tr>
                            <th className="p-2 border border-slate-600 text-center w-12">#</th>
                            <th className="p-2 border border-slate-600 text-left">Description</th>
                            <th className="p-2 border border-slate-600 text-center w-20">Qty</th>
                            <th className="p-2 border border-slate-600 text-center w-20">UOM</th>
                            <th className="p-2 border border-slate-600 text-right w-32">Rate (₹)</th>
                            <th className="p-2 border border-slate-600 text-right w-32">Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {(quote.items || []).map((it, i) => (
                            <tr key={i}>
                                <td className="p-2 border border-slate-300 text-center text-slate-400">{i + 1}</td>
                                <td className="p-2 border border-slate-300 font-bold text-slate-800 whitespace-pre-wrap leading-relaxed">{it.product || '—'}</td>
                                <td className="p-2 border border-slate-300 text-center tabular-nums">{it.qty || '0'}</td>
                                <td className="p-2 border border-slate-300 text-center uppercase text-slate-500 font-medium">{it.uom || 'Nos'}</td>
                                <td className="p-2 border border-slate-300 text-right tabular-nums text-slate-600">₹{fmt(it.rate)}</td>
                                <td className="p-2 border border-slate-300 text-right font-bold tabular-nums text-slate-800">₹{fmt(it.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold">
                        <tr>
                            <td colSpan={5} className="p-2 border border-slate-300 text-right uppercase tracking-wider text-slate-500">Subtotal</td>
                            <td className="p-2 border border-slate-300 text-right tabular-nums text-slate-800 text-sm">₹{fmt(quote.subtotal)}</td>
                        </tr>
                        {quote.gstPct > 0 && (
                            <tr>
                                <td colSpan={5} className="p-2 border border-slate-300 text-right uppercase tracking-wider text-slate-500 text-[10px]">GST ({quote.gstPct}%)</td>
                                <td className="p-2 border border-slate-300 text-right tabular-nums text-slate-600">₹{fmt(quote.taxAmount)}</td>
                            </tr>
                        )}
                        <tr className="bg-slate-100 text-sm">
                            <td colSpan={5} className="p-2 border border-slate-300 text-right uppercase tracking-widest text-slate-800 py-3">Grand Total (Incl. GST)</td>
                            <td className="p-2 border border-slate-300 text-right tabular-nums text-slate-900 text-base py-3">₹{fmt(quote.grandTotal || quote.total)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Terms & Conditions */}
            <div className="mt-12 break-inside-avoid print-break-avoid">
                <h3 className="font-bold text-slate-700 uppercase border-b-2 border-slate-200 mb-3 pb-1 tracking-widest">Terms & Conditions</h3>
                <div className="text-[10px] text-slate-600 space-y-4">
                    <div className="grid grid-cols-[110px_1fr] gap-x-6 gap-y-3 leading-relaxed">
                        <div className="font-bold text-slate-800 uppercase">PRICE</div>
                        <div className="text-slate-700 font-medium">{quote.priceBasis || CONFIG.DEFAULTS.PRICE_BASIS}</div>

                        <div className="font-bold text-slate-800 uppercase">PAYMENT</div>
                        <div className="flex items-center flex-wrap gap-x-2">
                            {(quote.paymentTerms || CONFIG.DEFAULTS.PAYMENT_TERMS).map((p, i) => (
                                <span key={i} className="flex items-center gap-1">
                                    <span className="font-bold text-slate-900">{p.percent}%</span>
                                    <span className="text-slate-600">{p.name}</span>
                                    {i < (quote.paymentTerms || CONFIG.DEFAULTS.PAYMENT_TERMS).length - 1 && <span className="text-slate-300 px-1">|</span>}
                                </span>
                            ))}
                        </div>

                        <div className="font-bold text-slate-800 uppercase">WARRANTY</div>
                        <div className="text-justify leading-snug">{quote.warranty || CONFIG.TEXT.WARRANTY}</div>

                        <div className="font-bold text-slate-800 uppercase">VALIDITY</div>
                        <div>{quote.validity || CONFIG.TEXT.VALIDITY}</div>
                    </div>
                </div>

                <div className="mt-16 pt-16 border-t border-slate-100 flex justify-between items-end">
                    <div className="text-center px-6">
                        <div className="h-14 mb-4"></div>
                        <p className="text-[10px] font-bold text-slate-800 uppercase tracking-widest border-t-2 border-slate-900 pt-2 min-w-[180px]">Client Acceptance</p>
                    </div>
                    <div className="text-center px-6">
                        <div className="h-14 mb-4"></div>
                        <p className="text-[10px] font-bold text-slate-800 uppercase tracking-widest border-t-2 border-slate-900 pt-2 min-w-[180px]">For Admire Sign & Display</p>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <React.Fragment>
            {/* portal to body for printing */}
            {ReactDOM.createPortal(
                <div className="print-only-portal">
                    {renderContent(true)}
                </div>,
                document.body
            )}
        </React.Fragment>
    );
};

export default QuotePrintLayout;
