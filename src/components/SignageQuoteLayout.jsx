import React from 'react';
import ReactDOM from 'react-dom';
import { formatCurrency } from '../lib/utils';

const SignageQuoteLayout = ({ state, allScreensTotal, calculation }) => {
    if (!calculation && !allScreensTotal) return null;

    const client = state.client || 'Valued Client';
    const project = state.project || 'Signage Project';
    const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const quoteRef = state.ref || 'NEW-QUOTE';

    // Normalise to a list of board configs
    const boardConfigs = allScreensTotal?.calculations || [calculation];
    const screenConfigs = state.screens;

    const renderHeader = () => (
        <div className="flex justify-between items-start mb-8 border-b-2 border-slate-800 pb-4">
            <div className="flex gap-4 items-center">
                <img src="/Admire/logo.png" alt="Admire" className="h-16 w-auto object-contain" />
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">ADMIRE INDUSTRIES</h1>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Premium Signage Solutions</p>
                </div>
            </div>
            <div className="text-right">
                <div className="bg-slate-900 text-white px-3 py-1 text-[10px] font-black uppercase mb-2 inline-block">Proforma Invoice / Quote</div>
                <div className="text-[10px] space-y-0.5 font-semibold text-slate-600">
                    <p>Ref: <span className="text-slate-900 font-bold">{quoteRef}</span></p>
                    <p>Date: <span className="text-slate-900 font-bold">{date}</span></p>
                </div>
            </div>
        </div>
    );

    const renderClientInfo = () => (
        <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest">Client Details</div>
                <h3 className="text-sm font-bold text-slate-900">{client}</h3>
                <p className="text-xs text-slate-600 mt-1">{project}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-right">
                <div className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest">Company Office</div>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                    Admire Industries, B-45, Phase 2<br />
                    Mayapuri, New Delhi - 110064<br />
                    Email: sales@admire.com | Web: admire.com
                </p>
            </div>
        </div>
    );

    const renderTerms = () => (
        <div className="mt-8 border-t pt-6">
            <h4 className="text-[10px] font-black uppercase text-slate-900 mb-4 tracking-widest">Terms & Conditions</h4>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-1.5 shrink-0"></div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Price Validity</p>
                        <p className="text-[10px] text-slate-800 font-semibold">{state.terms?.validity}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-1.5 shrink-0"></div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Delivery Timeline</p>
                        <p className="text-[10px] text-slate-800 font-semibold">{state.terms?.delivery}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-1.5 shrink-0"></div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Product Warranty</p>
                        <p className="text-[10px] text-slate-800 font-semibold">{state.terms?.warranty}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-1.5 shrink-0"></div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Payment Terms</p>
                        <p className="text-[10px] text-slate-800 font-semibold">{state.terms?.payment}</p>
                    </div>
                </div>
            </div>
            <div className="mt-6 p-4 bg-slate-900 rounded-xl text-white flex justify-between items-center">
                <p className="text-[9px] font-bold uppercase tracking-widest opacity-50">Grand Total (Incl. Taxes & Logistics)</p>
                <p className="text-2xl font-black">{formatCurrency(allScreensTotal?.totalProjectSell || calculation?.finalSellPrice || 0, 'INR')}</p>
            </div>
        </div>
    );

    const renderContent = (isPrint) => (
        <div className={`bg-white text-slate-800 font-sans ${isPrint ? 'p-0 w-full' : 'p-12 w-full max-w-4xl mx-auto shadow-sm rounded-2xl'}`}>
            {renderHeader()}
            {renderClientInfo()}

            <div className="mb-8">
                <div className="text-[9px] font-black uppercase text-slate-400 mb-3 tracking-widest">Signage Specifications</div>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b-2 border-slate-200">
                            <th className="py-3 text-[10px] font-black uppercase text-slate-500">Board Name</th>
                            <th className="py-3 text-[10px] font-black uppercase text-slate-500">Dimensions</th>
                            <th className="py-3 text-[10px] font-black uppercase text-slate-500 text-center">Qty</th>
                            <th className="py-3 text-[10px] font-black uppercase text-slate-500 text-right">Unit Price</th>
                            <th className="py-3 text-[10px] font-black uppercase text-slate-500 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {boardConfigs.map((calc, idx) => {
                            const scr = screenConfigs[idx];
                            if (!scr) return null;
                            return (
                                <tr key={idx} className="group">
                                    <td className="py-4">
                                        <p className="text-xs font-bold text-slate-900 leading-tight">{scr.name || `Board ${idx + 1}`}</p>
                                        <p className="text-[9px] text-slate-500 mt-0.5 font-bold uppercase">{scr.environment} Environment</p>
                                    </td>
                                    <td className="py-4">
                                        <p className="text-xs font-medium text-slate-600">{scr.width}×{scr.height} {state.unit}</p>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase">{calc.visualAreaSqFt.toFixed(1)} Sq.Ft Visual</p>
                                    </td>
                                    <td className="py-4 text-center">
                                        <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{scr.screenQty}</span>
                                    </td>
                                    <td className="py-4 text-right">
                                        <p className="text-xs font-bold text-slate-900">{formatCurrency(calc.finalSellPricePerScreen, 'INR')}</p>
                                    </td>
                                    <td className="py-4 text-right">
                                        <p className="text-xs font-black text-slate-900">{formatCurrency(calc.finalSellPrice, 'INR')}</p>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {renderTerms()}

            <div className="mt-12 flex justify-between items-end border-t border-dashed pt-8">
                <div>
                    <img src="/Admire/stamp.png" alt="Admire Stamp" className="h-12 w-auto opacity-20 grayscale" />
                    <p className="text-[8px] text-slate-300 font-bold uppercase mt-2 tracking-tighter italic">Generated by Admire Signage Calculator</p>
                </div>
                <div className="text-right">
                    <div className="mb-4 h-12 w-32 border-b border-slate-300 ml-auto"></div>
                    <p className="text-[10px] font-black uppercase text-slate-900">Authorised Signatory</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Admire Industries</p>
                </div>
            </div>
        </div>
    );

    return (
        <React.Fragment>
            {/* Standard Preview UI */}
            <div className="w-full">
                {renderContent(false)}
            </div>

            {/* Print Portal */}
            {typeof window !== 'undefined' && ReactDOM.createPortal(
                <div className="signage-print-root pointer-events-none hidden print:block print:pointer-events-auto">
                    <style>{`
                        @media print {
                            body * { visibility: hidden; }
                            .signage-print-root, .signage-print-root * { visibility: visible; }
                            .signage-print-root {
                                position: absolute;
                                left: 0;
                                top: 0;
                                width: 100%;
                                background: white;
                            }
                            @page {
                                margin: 15mm;
                                size: A4;
                            }
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
