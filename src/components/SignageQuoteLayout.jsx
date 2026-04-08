import React from 'react';
import ReactDOM from 'react-dom';
import { formatCurrency } from '../lib/utils';
import { CONFIG } from '../lib/config';

const SignageQuoteLayout = ({ state, allScreensTotal, calculation }) => {
    if (!calculation && !allScreensTotal) return null;

    const client  = state.client  || 'Valued Client';
    const project = state.project || 'Signage Project';
    const date    = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const quoteRef = state.ref || 'NEW-QUOTE';

    // Normalise to per-board calc array & screen config array
    const boardCalcs   = allScreensTotal?.calculations || [calculation];
    const screenCfgs   = state.screens || [];
    const unit         = state.unit || 'ft';
    const terms        = state.terms || {};

    const grandTotal = allScreensTotal?.totalProjectSell ?? calculation?.finalSellPrice ?? 0;

    // Convert unit dimensions to ft for display
    const toFt = (val) => {
        const n = Number(val);
        if (unit === 'ft') return n;
        if (unit === 'm')  return n * 3.28084;
        if (unit === 'mm') return n / 304.8;
        return n;
    };

    const renderContent = (isPrintVersion) => (
        <div className={`bg-white text-slate-800 font-sans text-xs ${isPrintVersion ? 'print-version-container p-0' : 'preview-version-container w-full h-full p-8'}`}>

            {/* ── Header ── */}
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

            {/* ── Client / Quote Info ── */}
            <div className="grid grid-cols-2 gap-6 mb-6 text-[11px]">
                <div>
                    <h3 className="font-bold text-slate-700 uppercase border-b border-slate-300 mb-2">Project Details</h3>
                    <div className="grid grid-cols-[80px_1fr] gap-y-1">
                        <span className="font-semibold text-slate-500">Client:</span>
                        <span className="font-bold">{client}</span>
                        <span className="font-semibold text-slate-500">Project:</span>
                        <span className="font-bold">{project}</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="bg-slate-900 text-white px-3 py-1 text-[10px] font-black uppercase mb-2 inline-block">
                        Proforma Invoice / Quote
                    </div>
                    <div className="text-[10px] space-y-0.5 font-semibold text-slate-600">
                        <p>Ref: <span className="text-slate-900 font-bold">{quoteRef}</span></p>
                        <p>Date: <span className="text-slate-900 font-bold">{date}</span></p>
                    </div>
                </div>
            </div>

            {/* ── Quote Table ── */}
            <div className="mb-6 break-inside-avoid print-break-avoid">
                <h3 className="font-bold text-slate-700 uppercase border-b border-slate-300 mb-2 pb-1">
                    Commercial Proposal — Signage Boards
                </h3>
                <table className="w-full border-collapse border border-slate-300 text-[11px]">
                    <thead className="bg-slate-800 text-white">
                        <tr>
                            <th className="p-2 border border-slate-600 text-center w-8">Sr.</th>
                            <th className="p-2 border border-slate-600 text-left">Item Description</th>
                            <th className="p-2 border border-slate-600 text-center w-32">Visual Size (ft)</th>
                            <th className="p-2 border border-slate-600 text-right w-20">Sft / Board</th>
                            <th className="p-2 border border-slate-600 text-right w-28">Rate</th>
                            <th className="p-2 border border-slate-600 text-center w-12">Qty</th>
                            <th className="p-2 border border-slate-600 text-right w-28">Total Sft</th>
                            <th className="p-2 border border-slate-600 text-right w-28">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {boardCalcs.map((calc, idx) => {
                            if (!calc) return null;
                            const scr = screenCfgs[idx];
                            if (!scr) return null;

                            const wFt     = toFt(scr.width);
                            const hFt     = toFt(scr.height);
                            const sftBrd  = calc.visualAreaSqFt ?? 0;
                            const qty     = Number(scr.screenQty) || 1;
                            const rate    = calc.finalSellPricePerScreen ?? 0;
                            const amount  = calc.finalSellPrice ?? rate * qty;
                            const totSft  = sftBrd * qty;

                            const fmtSft = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            return (
                                <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50' : ''}>
                                    <td className="p-2 border border-slate-300 text-center font-bold">{idx + 1}</td>
                                    <td className="p-2 border border-slate-300 font-bold">{scr.name || `Board ${idx + 1}`}</td>
                                    <td className="p-2 border border-slate-300 text-center whitespace-nowrap">
                                        {wFt.toFixed(2)} × {hFt.toFixed(2)}
                                    </td>
                                    <td className="p-2 border border-slate-300 text-right">{fmtSft(sftBrd)}</td>
                                    <td className="p-2 border border-slate-300 text-right font-semibold">
                                        {formatCurrency(rate, 'INR')}
                                    </td>
                                    <td className="p-2 border border-slate-300 text-center font-bold">{qty}</td>
                                    <td className="p-2 border border-slate-300 text-right whitespace-nowrap">{fmtSft(totSft)}</td>
                                    <td className="p-2 border border-slate-300 text-right font-bold">
                                        {formatCurrency(amount, 'INR')}
                                    </td>
                                </tr>
                            );
                        })}

                        {/* Subtotal row */}
                        <tr className="bg-slate-100">
                            <td colSpan={6} className="p-2 border border-slate-300 text-right font-bold uppercase">
                                Subtotal (Excl. GST)
                            </td>
                            <td className="p-2 border border-slate-300 text-right font-bold whitespace-nowrap">
                                {boardCalcs.reduce((s, c, i) => {
                                    if (!c || !screenCfgs[i]) return s;
                                    return s + (c.visualAreaSqFt ?? 0) * (Number(screenCfgs[i].screenQty) || 1);
                                }, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 border border-slate-300 text-right font-bold text-sm">
                                {formatCurrency(grandTotal, 'INR')}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* ── Terms & Conditions ── */}
            <div className="mt-6 break-inside-avoid print-break-avoid">
                <h3 className="font-bold text-slate-700 uppercase border-b border-slate-300 mb-2 pb-1">
                    Terms &amp; Conditions
                </h3>
                <div className="text-[10px] text-slate-600 space-y-3">
                    <div className="grid grid-cols-[100px_1fr] gap-y-2 gap-x-4">
                        <div className="font-bold text-slate-800 uppercase">Price</div>
                        <div className="whitespace-pre-wrap">{terms.price || 'As quoted above. GST extra as applicable.'}</div>

                        <div className="font-bold text-slate-800 uppercase">Payment</div>
                        <div className="whitespace-pre-wrap">
                            {Array.isArray(terms.payment)
                                ? terms.payment.map((p, i) => (
                                    <span key={i}>{p.percent}% {p.name}{i < terms.payment.length - 1 ? ', ' : ''}</span>
                                ))
                                : (terms.payment || '50% Advance, 50% before delivery')}
                        </div>

                        <div className="font-bold text-slate-800 uppercase">Delivery</div>
                        <div className="whitespace-pre-wrap">
                            {terms.deliveryWeeks ? `${terms.deliveryWeeks} weeks` : (terms.delivery || '—')}
                        </div>

                        <div className="font-bold text-slate-800 uppercase">GST</div>
                        <div className="whitespace-pre-wrap">Extra as applicable (currently {CONFIG.DEFAULTS?.GST_RATE ?? 18}%)</div>

                        <div className="font-bold text-slate-800 uppercase tracking-widest">Warranty</div>
                        <div className="text-justify leading-snug whitespace-pre-wrap">
                            {terms.warranty || CONFIG.TEXT?.WARRANTY || '1 Year against manufacturing defects.'}
                        </div>
                    </div>
                </div>

                {/* Client's scope — only render sections that have content */}
                {(terms.scope?.structure || terms.scope?.elec || terms.scope?.net || terms.scope?.soft || terms.scope?.perm || terms.scope?.pc) && (
                    <>
                        <h3 className="font-bold text-slate-700 uppercase border-b border-slate-300 mt-4 mb-2 pb-1 tracking-widest">
                            Client's Scope
                        </h3>
                        <div className="text-[10px] text-slate-600 grid gap-y-3">
                            {terms.scope?.structure && (
                                <div>
                                    <span className="font-bold text-slate-800 block uppercase mb-0.5">Structure:</span>
                                    <div className="whitespace-pre-wrap leading-relaxed">{terms.scope.structure}</div>
                                </div>
                            )}
                            {terms.scope?.elec && (
                                <div>
                                    <span className="font-bold text-slate-800 block uppercase mb-0.5">Electricity:</span>
                                    <div className="whitespace-pre-wrap leading-relaxed">{terms.scope.elec}</div>
                                </div>
                            )}
                            {terms.scope?.net && (
                                <div>
                                    <span className="font-bold text-slate-800 block uppercase mb-0.5">Internet:</span>
                                    <div className="whitespace-pre-wrap leading-relaxed">{terms.scope.net}</div>
                                </div>
                            )}
                            {terms.scope?.soft && (
                                <div>
                                    <span className="font-bold text-slate-800 block uppercase mb-0.5">Software:</span>
                                    <div className="whitespace-pre-wrap leading-relaxed">{terms.scope.soft}</div>
                                </div>
                            )}
                            {terms.scope?.perm && (
                                <div>
                                    <span className="font-bold text-slate-800 block uppercase mb-0.5">Permissions:</span>
                                    <div className="whitespace-pre-wrap leading-relaxed">{terms.scope.perm}</div>
                                </div>
                            )}
                            {terms.scope?.pc && (
                                <div>
                                    <span className="font-bold text-slate-800 block uppercase mb-0.5">Computer:</span>
                                    <div className="whitespace-pre-wrap leading-relaxed">{terms.scope.pc}</div>
                                </div>
                            )}
                            <div>
                                <span className="font-bold text-slate-800 block uppercase mb-0.5">Validity:</span>
                                <div className="whitespace-pre-wrap leading-relaxed">
                                    {terms.validity || CONFIG.TEXT?.VALIDITY || 'Quote valid for 7 days.'}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

{/* ── Signature Footer ── */}
            <div className="mt-8 pt-8 border-t border-slate-200 flex justify-between items-end break-inside-avoid">
                <div className="text-center">
                    <div className="h-12 mb-2" />
                    <p className="text-[10px] font-bold border-t border-slate-400 px-4 pt-1">Client Acceptance</p>
                </div>
                <div className="text-center">
                    <div className="h-12 mb-2" />
                    <p className="text-[10px] font-bold border-t border-slate-400 px-4 pt-1">
                        For {CONFIG.COMPANY.NAME}
                    </p>
                </div>
            </div>
        </div>
    );

    return (
        <React.Fragment>
            {/* A. Screen Preview */}
            <div className="screen-preview-wrapper">
                {renderContent(false)}
            </div>

            {/* B. Print Portal */}
            {typeof window !== 'undefined' && ReactDOM.createPortal(
                <div className="print-only-portal">
                    <style>{`
                        @media print {
                            body * { visibility: hidden; }
                            .print-only-portal, .print-only-portal * { visibility: visible; }
                            .print-only-portal {
                                position: absolute;
                                left: 0;
                                top: 0;
                                width: 100%;
                                background: white;
                            }
                            @page { margin: 15mm; size: A4; }
                        }
                    `}</style>
                    {renderContent(true)}
                </div>,
                document.body
            )}
        </React.Fragment>
    );
};

export default SignageQuoteLayout;
