import React from 'react';
import ReactDOM from 'react-dom';
import { CONFIG } from '../lib/config';

/**
 * SignageBOMLayout — Quantities-only BOM for the Signage Calculator
 *
 * Props:
 *  - state          : full SignageCalculator state { client, project, ref, unit, screens[] }
 *  - allScreensTotal: { calculations[], screenConfigs[], totalScreenQty }
 *  - calculation    : OPTIONAL – single-screen calc (fallback when allScreensTotal is absent)
 */
const SignageBOMLayout = ({ state, allScreensTotal, calculation }) => {
    // ── Guards ─────────────────────────────────────────────────────────────────
    const hasAllScreens =
        allScreensTotal &&
        allScreensTotal.calculations &&
        allScreensTotal.calculations.filter(Boolean).length > 0;

    if (!hasAllScreens && !calculation) return null;

    const isMultiBoard = hasAllScreens && allScreensTotal.calculations.filter(Boolean).length > 1;

    const calcs   = hasAllScreens ? allScreensTotal.calculations  : [calculation];
    const screens = hasAllScreens ? allScreensTotal.screenConfigs : (state?.screens ?? []);

    const clientName  = state?.client  || '';
    const projectName = state?.project || '';
    const quoteRef    = state?.ref     || '';

    // ── Category display order & badge colors ──────────────────────────────────
    const CAT_ORDER = ['Profile', 'Backing', 'Electrical', 'Other', 'Labour', 'Logistics'];
    const CAT_BADGE = {
        Profile:    'bg-slate-100 text-slate-600',
        Backing:    'bg-stone-100 text-stone-600',
        Electrical: 'bg-yellow-100 text-yellow-700',
        Other:      'bg-purple-100 text-purple-700',
        Labour:     'bg-blue-100 text-blue-700',
        Logistics:  'bg-green-100 text-green-700',
    };

    // ── Helper: format qty+uom string ──────────────────────────────────────────
    const fmtQty = (qty, uom) =>
        qty != null ? `${Number(qty).toFixed(2)} ${uom}` : '—';

    // ── Per-board BOM table ────────────────────────────────────────────────────
    const renderBoardBOM = (calc, boardIdx, screen) => {
        if (!calc || !calc.bom || calc.bom.length === 0) return null;

        const sq   = calc.screenQty || 1;
        const unit = state?.unit ?? 'ft';

        return (
            <div key={boardIdx} className="mb-8 break-inside-avoid print-break-avoid">
                {/* Board header strip */}
                <div className={`px-4 py-2 flex justify-between items-center ${isMultiBoard ? 'bg-slate-800 text-white rounded-t-lg' : 'bg-slate-100 text-slate-700 rounded-t border border-b-0 border-slate-300'}`}>
                    <h3 className="font-bold text-sm uppercase tracking-wide">
                        {isMultiBoard
                            ? `Board #${boardIdx + 1} — ${screen?.name || `Board ${boardIdx + 1}`}`
                            : (screen?.name || 'Board BOM')}
                    </h3>
                    <div className={`text-xs flex gap-6 ${isMultiBoard ? 'text-slate-300' : 'text-slate-500'}`}>
                        <span>
                            {screen?.width} × {screen?.height} {unit}
                            {calc.visualAreaSqFt ? ` (${calc.visualAreaSqFt.toFixed(2)} Sq.Ft)` : ''}
                        </span>
                        <span>{sq} {sq === 1 ? 'board' : 'boards'}</span>
                        {screen?.environment && <span>{screen.environment}</span>}
                        {calc.bufferedWattage
                            ? <span>Est. load: {calc.bufferedWattage.toFixed(0)} W</span>
                            : null}
                    </div>
                </div>

                {/* BOM Table — quantities only */}
                <table className="w-full border-collapse border border-slate-300 text-[10px]">
                    <thead className="bg-slate-700 text-white">
                        <tr>
                            <th className="p-2 border border-slate-600 text-left w-8">#</th>
                            <th className="p-2 border border-slate-600 text-left w-28">Category</th>
                            <th className="p-2 border border-slate-600 text-left">Component / Description</th>
                            <th className="p-2 border border-slate-600 text-right w-28">Qty / Board</th>
                            {sq > 1 && (
                                <th className="p-2 border border-slate-600 text-right w-28">
                                    Qty ×{sq} Boards
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {calc.bom.map((row, ri) => {
                            const catBadge = CAT_BADGE[row.category] ?? 'bg-slate-100 text-slate-600';
                            return (
                                <tr
                                    key={ri}
                                    className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                                >
                                    <td className="p-2 border border-slate-200 text-center text-slate-400">
                                        {ri + 1}
                                    </td>
                                    <td className="p-2 border border-slate-200">
                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${catBadge}`}>
                                            {row.category}
                                        </span>
                                    </td>
                                    <td className="p-2 border border-slate-200">
                                        <span className="font-semibold text-slate-800">{row.name}</span>
                                        {row.specs && (
                                            <span className="ml-2 text-slate-400 text-[9px]">({row.specs})</span>
                                        )}
                                    </td>
                                    <td className="p-2 border border-slate-200 text-right font-medium text-slate-700">
                                        {fmtQty(row.qty, row.uom)}
                                    </td>
                                    {sq > 1 && (
                                        <td className="p-2 border border-slate-200 text-right font-bold text-slate-900">
                                            {row.qty != null
                                                ? fmtQty(Number(row.qty) * sq, row.uom)
                                                : '—'}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    // ── Consolidated Project BOM (all boards merged) ───────────────────────────
    const renderConsolidatedBOM = () => {
        // Build a merged map keyed by "name|specs|uom"
        const map = {};

        calcs.forEach((calc, bIdx) => {
            if (!calc || !calc.bom) return;
            const sq = calc.screenQty || 1;
            calc.bom.forEach(row => {
                const key = `${row.name}|${row.specs ?? ''}|${row.uom ?? ''}|${row.category}`;
                if (!map[key]) {
                    map[key] = {
                        category: row.category,
                        name:     row.name,
                        specs:    row.specs ?? '',
                        uom:      row.uom   ?? '',
                        totalQty: 0,
                    };
                }
                // Total qty across all boards (qty/board × board count)
                map[key].totalQty += (Number(row.qty) || 0) * sq;
            });
        });

        // Sort by CAT_ORDER then name
        const rows = Object.values(map).sort((a, b) => {
            const ai = CAT_ORDER.indexOf(a.category);
            const bi = CAT_ORDER.indexOf(b.category);
            if (ai !== bi) return ai - bi;
            return a.name.localeCompare(b.name);
        });

        if (!rows.length) return null;

        return (
            <div className="mt-8 break-inside-avoid print-break-avoid border-t-4 border-slate-800 pt-6">
                <div className="bg-slate-800 text-white px-4 py-3 rounded-t-lg flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-base uppercase tracking-wide">
                            Consolidated Project BOM
                        </h3>
                        <p className="text-xs text-slate-300 mt-0.5">
                            Combined quantities across all {calcs.filter(Boolean).length} board config(s) · {allScreensTotal?.totalScreenQty ?? calcs.reduce((s, c) => s + (c?.screenQty || 0), 0)} boards total
                        </p>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                        {rows.length} unique line items
                    </div>
                </div>

                <table className="w-full border-collapse border border-slate-300 text-[10px]">
                    <thead className="bg-slate-700 text-white">
                        <tr>
                            <th className="p-2 border border-slate-600 text-left w-8">#</th>
                            <th className="p-2 border border-slate-600 text-left w-28">Category</th>
                            <th className="p-2 border border-slate-600 text-left">Component / Description</th>
                            <th className="p-2 border border-slate-600 text-right w-36">Total Qty (All Boards)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => {
                            const catBadge = CAT_BADGE[row.category] ?? 'bg-slate-100 text-slate-600';
                            return (
                                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                    <td className="p-2 border border-slate-200 text-center text-slate-400">
                                        {i + 1}
                                    </td>
                                    <td className="p-2 border border-slate-200">
                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${catBadge}`}>
                                            {row.category}
                                        </span>
                                    </td>
                                    <td className="p-2 border border-slate-200">
                                        <span className="font-semibold text-slate-800">{row.name}</span>
                                        {row.specs && (
                                            <span className="ml-2 text-slate-400 text-[9px]">({row.specs})</span>
                                        )}
                                    </td>
                                    <td className="p-2 border border-slate-200 text-right font-bold text-slate-900">
                                        {fmtQty(row.totalQty, row.uom)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Summary strip */}
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-b-lg flex gap-8 text-[10px]">
                    <div>
                        <span className="font-bold text-slate-600 uppercase tracking-wide">Board Configs: </span>
                        <span className="font-bold text-lg text-slate-800">{calcs.filter(Boolean).length}</span>
                    </div>
                    <div>
                        <span className="font-bold text-slate-600 uppercase tracking-wide">Total Boards: </span>
                        <span className="font-bold text-lg text-slate-800">
                            {allScreensTotal?.totalScreenQty ?? calcs.reduce((s, c) => s + (c?.screenQty || 0), 0)}
                        </span>
                    </div>
                    <div>
                        <span className="font-bold text-slate-600 uppercase tracking-wide">Unique Items: </span>
                        <span className="font-bold text-lg text-slate-800">{rows.length}</span>
                    </div>
                </div>
            </div>
        );
    };

    // ── Main render content ────────────────────────────────────────────────────
    const renderContent = (isPrintVersion) => (
        <div className={`p-8 max-w-[210mm] mx-auto bg-white min-h-screen text-slate-800 font-sans text-xs ${isPrintVersion ? 'print-version-container p-0 w-full' : ''}`}>

            {/* Header */}
            <div className="flex justify-between items-start mb-6 border-b-2 border-slate-800 pb-4">
                <div className="flex items-center gap-4">
                    <img src="/Admire/logo.png" alt="Logo" className="h-12 w-auto" />
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wide">
                            Signage Bill of Materials
                        </h1>
                        <div className="mt-1 space-y-0.5 text-[10px] text-slate-600">
                            <p>{CONFIG.COMPANY.ADDRESS_1}</p>
                            <p>{CONFIG.COMPANY.ADDRESS_2}</p>
                            <p>Email: {CONFIG.COMPANY.EMAIL} | Web: {CONFIG.COMPANY.WEB}</p>
                        </div>
                    </div>
                </div>
                <div className="text-right text-[10px] text-slate-500 space-y-1">
                    {quoteRef && <p className="font-bold text-slate-700 text-sm">Ref: {quoteRef}</p>}
                    <p className="font-bold text-slate-700">Client: {clientName || '—'}</p>
                    <p className="font-bold text-slate-700">Project: {projectName || '—'}</p>
                    <p>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    {isMultiBoard && (
                        <p className="text-slate-400">
                            {allScreensTotal.calculations.filter(Boolean).length} configs · {allScreensTotal.totalScreenQty} boards total
                        </p>
                    )}
                </div>
            </div>

            {/* Section heading for multi-board */}
            {isMultiBoard && (
                <h2 className="text-sm font-bold text-slate-700 uppercase mb-4 pb-2 border-b border-slate-300">
                    Individual Board Configurations
                </h2>
            )}

            {/* Per-board BOM tables */}
            {calcs.map((calc, idx) => renderBoardBOM(calc, idx, screens[idx]))}

            {/* Consolidated BOM */}
            {renderConsolidatedBOM()}

            {/* Footer */}
            <div className="mt-8 text-[9px] text-slate-400 border-t border-slate-200 pt-2 text-center">
                Internal Document · Generated by Admire Sign LED Calculator · {CONFIG.COMPANY.NAME}
            </div>
        </div>
    );

    // ── Dual render (preview + print portal) ──────────────────────────────────
    return (
        <React.Fragment>
            <div className="screen-preview-wrapper">
                {renderContent(false)}
            </div>
            {ReactDOM.createPortal(
                <div className="print-only-portal">
                    {renderContent(true)}
                </div>,
                document.body
            )}
        </React.Fragment>
    );
};

export default SignageBOMLayout;
