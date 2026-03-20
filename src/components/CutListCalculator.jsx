import React, { useState } from 'react';
import {
    Layout,
    Layers,
    Plus,
    Trash2,
    Download,
    Upload,
    Calculator,
    Maximize,
    Minimize,
    RotateCw,
    Settings,
    FileSpreadsheet,
    Box,
    BarChart3,
    ArrowRightCircle,
    Copy,
    Save,
    RefreshCw,
    X,
    Scissors
} from 'lucide-react';
import { optimizeLinear, optimizeSheet } from '../utils/cutOptimizer';
import { importFromExcel, downloadTemplate } from '../utils/excelImport';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { db } from '../lib/firebase';

const CutListCalculator = () => {
    const [mode, setMode] = useState('2D');
    const [projectName, setProjectName] = useState('Untitled Project');
    const [saving, setSaving] = useState(false);
    const [kerf, setKerf] = useState(3.5);

    const [stock, setStock] = useState([
        { id: 101, length: 2440, width: 1220, quantity: 5, remarks: 'Standard Plywood' }
    ]);

    const [required, setRequired] = useState([
        { id: 201, length: 1200, width: 600, quantity: 4, remarks: 'Side Panel' },
        { id: 202, length: 800, width: 400, quantity: 6, remarks: 'Drawer Bottom' }
    ]);

    const [results, setResults] = useState(null);
    const [calculating, setCalculating] = useState(false);

    const addStockRow = () => setStock([...stock, { id: Date.now(), length: '', width: '', quantity: 1, remarks: '' }]);
    const addRequiredRow = () => setRequired([...required, { id: Date.now(), length: '', width: '', quantity: 1, remarks: '' }]);

    const updateRow = (setData, data, id, field, value) => {
        setData(data.map(row => row.id === id ? { ...row, [field]: value } : row));
    };

    const deleteRow = (setData, data, id) => {
        setData(data.filter(row => row.id !== id));
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const { cuttingList, materialList } = await importFromExcel(file);

            if (cuttingList.length > 0) {
                setRequired(cuttingList.map((d, i) => ({
                    id: Date.now() + i + 1000,
                    length: d.length,
                    width: d.width,
                    quantity: d.quantity,
                    remarks: d.remarks
                })));
            }

            if (materialList.length > 0) {
                setStock(materialList.map((d, i) => ({
                    id: Date.now() + i + 5000,
                    length: d.length,
                    width: d.width,
                    quantity: d.quantity,
                    remarks: d.remarks
                })));
            }
        } catch (err) {
            alert("Error importing file. Please check the 'Format' template for column alignment.");
        }
    };

    const handleCalculate = () => {
        setCalculating(true);
        setTimeout(() => {
            if (mode === '2D') {
                const res = optimizeSheet(stock, required, kerf);
                setResults(res);
            } else {
                const res = optimizeLinear(stock, required, kerf);
                setResults(res);
            }
            setCalculating(false);
            document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 300);
    };

    const handleSave = async () => {
        if (!results) return alert('No results to save. Calculate first.');
        setSaving(true);
        try {
            await db.collection('cut_lists').add({
                projectName,
                mode,
                stock,
                required,
                kerf,
                results,
                timestamp: new Date().toISOString()
            });
            alert('Cut list saved successfully!');
        } catch (err) {
            console.error(err);
            alert('Error saving cut list.');
        } finally {
            setSaving(false);
        }
    };

    // ─── PDF Export ────────────────────────────────────────────────────────────
    const handleExportPDF = async () => {
        if (!results) return;

        try {
            const margin = 10;

            // A4 dimensions
            const A4_P = { w: 210, h: 297 }; // portrait
            const A4_L = { w: 297, h: 210 }; // landscape

            // ── Step 1: Pre-render all layout cards to canvas ───────────────
            // We do this BEFORE creating the PDF so we can inspect each card's
            // aspect ratio and decide the best page orientation for it.
            const layoutEls = document.querySelectorAll('.layout-card');
            const renderedCards = await Promise.all(
                Array.from(layoutEls).map(async (el) => {
                    const canvas = await html2canvas(el, {
                        scale: 1.5,
                        useCORS: true,
                        backgroundColor: '#ffffff',
                        logging: false,
                    });
                    const imgData = canvas.toDataURL('image/jpeg', 0.85);
                    const aspectRatio = canvas.width / canvas.height; // >1 = landscape card
                    return { imgData, canvas, aspectRatio };
                })
            );

            // ── Step 2: Determine starting orientation ──────────────────────
            // Use portrait for the cover/summary page (it's always text).
            // Cards will switch orientation per-page as needed.
            const pdf = new jsPDF('p', 'mm', 'a4');
            let orientation = 'p';
            let pageW = A4_P.w;
            let pageH = A4_P.h;
            let usableW = pageW - margin * 2;
            let cursorY = margin;

            // Helper: recalculate page dimensions after orientation switch
            const getDims = (ori) => ({
                pageW: ori === 'l' ? A4_L.w : A4_P.w,
                pageH: ori === 'l' ? A4_L.h : A4_P.h,
                usableW: (ori === 'l' ? A4_L.w : A4_P.w) - margin * 2,
            });

            // Helper: add a new page with a specific orientation, update dims
            const addPage = (ori) => {
                pdf.addPage('a4', ori === 'l' ? 'landscape' : 'portrait');
                orientation = ori;
                ({ pageW, pageH, usableW } = getDims(ori));
                cursorY = margin;
            };

            // Helper: ensure space on current page, switching orientation if needed
            const ensureSpace = (neededMM, preferredOri = orientation) => {
                if (cursorY + neededMM > pageH - margin) {
                    addPage(preferredOri);
                }
            };

            // ── 3. Cover page: Header + Stock table + Stats ─────────────────
            // Always portrait for the summary page
            const drawHeader = (pW, uw) => {
                pdf.setFillColor(79, 70, 229);
                pdf.rect(margin, cursorY, uw, 12, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(11);
                pdf.setFont('helvetica', 'bold');
                pdf.text(projectName, margin + 3, cursorY + 8);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'normal');
                const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                const modeLabel = mode === '2D' ? '2D Sheet Optimizer' : '1D Linear Optimizer';
                pdf.text(`${modeLabel}  ·  Kerf: ${kerf}mm  ·  ${dateStr}`, pW - margin - 3, cursorY + 8, { align: 'right' });
                cursorY += 16;
            };
            drawHeader(pageW, usableW);

            // Stock required table
            const stockGroups = results.bins.reduce((acc, bin) => {
                const key = mode === '2D' ? `${bin.w} × ${bin.h} mm` : `${bin.length} mm`;
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});
            const stockRows = Object.entries(stockGroups);
            const tableRowH = 7;
            const tableHeaderH = 7;

            pdf.setTextColor(40, 40, 40);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.text('STOCK REQUIRED', margin, cursorY);
            cursorY += 4;

            pdf.setFillColor(226, 232, 240);
            pdf.rect(margin, cursorY, usableW, tableHeaderH, 'F');
            pdf.setTextColor(80, 80, 80);
            pdf.setFontSize(7.5);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Stock Dimensions', margin + 3, cursorY + 4.8);
            pdf.text('Qty', pageW - margin - 3, cursorY + 4.8, { align: 'right' });
            cursorY += tableHeaderH;

            stockRows.forEach(([dim, qty], i) => {
                if (i % 2 === 0) {
                    pdf.setFillColor(248, 250, 252);
                    pdf.rect(margin, cursorY, usableW, tableRowH, 'F');
                }
                pdf.setDrawColor(226, 232, 240);
                pdf.line(margin, cursorY + tableRowH, margin + usableW, cursorY + tableRowH);
                pdf.setTextColor(30, 30, 30);
                pdf.setFontSize(8.5);
                pdf.setFont('helvetica', 'bold');
                pdf.text(dim, margin + 3, cursorY + 5);
                pdf.setFontSize(9);
                pdf.setTextColor(16, 185, 129);
                pdf.text(String(qty), pageW - margin - 3, cursorY + 5, { align: 'right' });
                cursorY += tableRowH;
            });

            pdf.setFillColor(79, 70, 229);
            pdf.rect(margin, cursorY, usableW, tableRowH, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(8.5);
            pdf.setFont('helvetica', 'bold');
            pdf.text('TOTAL', margin + 3, cursorY + 5);
            pdf.text(String(results.bins.length), pageW - margin - 3, cursorY + 5, { align: 'right' });
            cursorY += tableRowH + 4;

            pdf.setTextColor(80, 80, 80);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            const statsText = mode === '2D'
                ? `Yield: ${(100 - results.summary.wastePercent).toFixed(1)}%  |  Waste: ${results.summary.wastePercent.toFixed(1)}%  |  Total Area: ${(results.summary.totalArea / 1000000).toFixed(2)} m²`
                : `Yield: ${(100 - results.summary.wastePercent).toFixed(1)}%  |  Waste: ${results.summary.wastePercent.toFixed(1)}%  |  Total Length: ${(results.summary.totalUsedLength / 1000).toFixed(1)} m`;
            pdf.text(statsText, margin, cursorY);
            cursorY += 8;

            // ── 4. Layout cards — orientation-aware placement ───────────────
            // For each card:
            //   • aspectRatio > 1.2  → card is landscape → use landscape page
            //   • aspectRatio < 0.85 → card is portrait  → use portrait page
            //   • in between         → use portrait (fits comfortably either way)
            //
            // 2-column packing still applies but only when BOTH cards in a pair
            // share the same orientation AND each fits within 120mm at half-width.

            const HALF_PAGE_THRESHOLD = 120; // mm

            const placeCard = (card, x, y, printW) => {
                const printH = (card.canvas.height * printW) / card.canvas.width;
                pdf.addImage(card.imgData, 'JPEG', x, y, printW, printH);
                return printH;
            };

            const cardOrientation = (card) =>
                card.aspectRatio > 1.2 ? 'l' : 'p';

            if (mode === '2D') {
                let i = 0;
                while (i < renderedCards.length) {
                    const cardA = renderedCards[i];
                    const oriA = cardOrientation(cardA);
                    const dimsA = getDims(oriA);
                    const uw = dimsA.usableW;
                    const colW = (uw - 4) / 2;
                    const halfH_A = (cardA.canvas.height * colW) / cardA.canvas.width;
                    const fullH_A = (cardA.canvas.height * uw) / cardA.canvas.width;

                    // Try to pair with next card if same orientation and both compact
                    if (
                        halfH_A <= HALF_PAGE_THRESHOLD &&
                        i + 1 < renderedCards.length
                    ) {
                        const cardB = renderedCards[i + 1];
                        const oriB = cardOrientation(cardB);
                        const halfH_B = (cardB.canvas.height * colW) / cardB.canvas.width;

                        if (oriA === oriB && halfH_B <= HALF_PAGE_THRESHOLD) {
                            const rowH = Math.max(halfH_A, halfH_B);
                            // Switch orientation if needed, then check space
                            if (oriA !== orientation) {
                                addPage(oriA);
                            } else {
                                ensureSpace(rowH + 4, oriA);
                            }
                            placeCard(cardA, margin, cursorY, colW);
                            placeCard(cardB, margin + colW + 4, cursorY, colW);
                            cursorY += rowH + 4;
                            i += 2;
                            continue;
                        }
                    }

                    // Single card — full width in its preferred orientation
                    if (oriA !== orientation) {
                        addPage(oriA);
                    } else {
                        ensureSpace(fullH_A + 4, oriA);
                    }
                    placeCard(cardA, margin, cursorY, uw);
                    cursorY += fullH_A + 4;
                    i++;
                }

            } else {
                // 1D: always portrait, full width
                for (const card of renderedCards) {
                    const fullH = (card.canvas.height * usableW) / card.canvas.width;
                    ensureSpace(fullH + 3, 'p');
                    placeCard(card, margin, cursorY, usableW);
                    cursorY += fullH + 3;
                }
            }

            // ── 5. Unplaced pieces warning ──────────────────────────────────
            if (results.unplaced.length > 0) {
                ensureSpace(12);
                pdf.setFillColor(254, 242, 242);
                pdf.rect(margin, cursorY, usableW, 8, 'F');
                pdf.setTextColor(185, 28, 28);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'bold');
                pdf.text(
                    `⚠  ${results.unplaced.length} piece(s) could not be placed — insufficient stock`,
                    margin + 3,
                    cursorY + 5.5
                );
            }

            pdf.save(`${projectName.replace(/\s+/g, '_')}_CutPlan.pdf`);

        } catch (err) {
            console.error('PDF Export Error:', err);
            alert('PDF export failed. Try browser Print (Cmd+P) as a fallback.');
        }
    };
    // ── End PDF Export ─────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] p-2 md:p-4 font-sans transition-colors duration-300">

            {/* Header */}
            <header className="max-w-full mx-auto mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                        <Scissors className="text-white w-5 h-5" />
                    </div>
                    <div>
                        <input
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            className="text-xl font-black bg-transparent border-none focus:ring-0 p-0 text-slate-900 dark:text-white leading-none placeholder:text-slate-300"
                            placeholder="Project Name..."
                        />
                        <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-1">Optimizer Engine</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 p-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    {results && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-lg transition-colors border-r border-slate-200 dark:border-slate-700 pr-3 disabled:opacity-50"
                        >
                            <Save size={14} /> {saving ? 'Saving...' : 'Save List'}
                        </button>
                    )}
                    <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-0.5 mr-2">
                        <button
                            onClick={() => setMode('2D')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${mode === '2D' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Layers size={14} /> 2D
                        </button>
                        <button
                            onClick={() => setMode('1D')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${mode === '1D' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Layout size={14} /> 1D
                        </button>
                    </div>

                    <button
                        onClick={() => downloadTemplate(mode)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase text-slate-500 hover:text-indigo-600 transition-colors border-r border-slate-200 dark:border-slate-700 pr-3"
                    >
                        <FileSpreadsheet size={14} /> Download Format
                    </button>

                    <label className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase text-slate-500 hover:text-indigo-600 cursor-pointer transition-colors">
                        <Upload size={14} /> Full Import
                        <input type="file" className="hidden" accept=".xlsx" onChange={handleFileUpload} />
                    </label>
                </div>
            </header>

            <main className="max-w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">

                {/* Left: Input Panel */}
                <div className="lg:col-span-12 xl:col-span-4 flex flex-col gap-4">

                    {/* Global Settings */}
                    <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <div className="flex items-center justify-between mb-3 text-slate-400">
                            <h2 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                                <Settings size={14} /> Global Setup
                            </h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Blade Kerf (mm)</label>
                                <input
                                    type="number"
                                    value={kerf}
                                    onChange={(e) => setKerf(Number(e.target.value))}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Calculations</label>
                                <button
                                    onClick={handleCalculate}
                                    disabled={calculating}
                                    className="w-full h-[38px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm"
                                >
                                    {calculating ? <RefreshCw className="animate-spin" size={16} /> : <Calculator size={16} />}
                                    <span className="text-xs uppercase tracking-wide">{calculating ? 'Processing...' : 'Solve Layout'}</span>
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Stock Entry */}
                    <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Box size={14} /> Materials
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={addStockRow}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-100 transition-colors"
                                >
                                    <Plus size={12} /> Add Row
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-700">
                                        <th className="py-2 text-[10px] font-bold text-slate-400 uppercase">Length</th>
                                        {mode === '2D' && <th className="py-2 text-[10px] font-bold text-slate-400 uppercase">Width</th>}
                                        <th className="py-2 text-[10px] font-bold text-slate-400 uppercase">Qty</th>
                                        <th className="py-2 text-[10px] font-bold text-slate-400 uppercase">Remarks</th>
                                        <th className="py-2 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                    {stock.map(s => (
                                        <tr key={s.id} className="group">
                                            <td className="py-2">
                                                <input value={s.length} onChange={e => updateRow(setStock, stock, s.id, 'length', e.target.value)} className="w-[80px] text-sm bg-transparent border-none focus:ring-0 dark:text-white font-medium" />
                                            </td>
                                            {mode === '2D' && (
                                                <td className="py-2">
                                                    <input value={s.width} onChange={e => updateRow(setStock, stock, s.id, 'width', e.target.value)} className="w-[80px] text-sm bg-transparent border-none focus:ring-0 dark:text-white font-medium" />
                                                </td>
                                            )}
                                            <td className="py-2">
                                                <input type="number" value={s.quantity} onChange={e => updateRow(setStock, stock, s.id, 'quantity', e.target.value)} className="w-[60px] text-sm bg-transparent border-none focus:ring-0 dark:text-white font-medium" />
                                            </td>
                                            <td className="py-2">
                                                <input value={s.remarks} placeholder="Label..." onChange={e => updateRow(setStock, stock, s.id, 'remarks', e.target.value)} className="w-full text-sm bg-transparent border-none focus:ring-0 dark:text-slate-400 placeholder:text-slate-300 dark:placeholder:text-slate-600" />
                                            </td>
                                            <td className="py-2 text-right">
                                                <button onClick={() => deleteRow(setStock, stock, s.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Required Pieces Entry */}
                    <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Layers size={14} /> Cutting List
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={addRequiredRow}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-100 transition-colors"
                                >
                                    <Plus size={12} /> Add Row
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                                    <tr className="border-b border-slate-100 dark:border-slate-700">
                                        <th className="py-2 text-[10px] font-bold text-slate-400 uppercase">Length</th>
                                        {mode === '2D' && <th className="py-2 text-[10px] font-bold text-slate-400 uppercase">Width</th>}
                                        <th className="py-2 text-[10px] font-bold text-slate-400 uppercase">Qty</th>
                                        <th className="py-2 text-[10px] font-bold text-slate-400 uppercase">Remarks</th>
                                        <th className="py-2 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                    {required.map(p => (
                                        <tr key={p.id} className="group">
                                            <td className="py-2">
                                                <input value={p.length} onChange={e => updateRow(setRequired, required, p.id, 'length', e.target.value)} className="w-[80px] text-sm bg-transparent border-none focus:ring-0 dark:text-white font-medium" />
                                            </td>
                                            {mode === '2D' && (
                                                <td className="py-2">
                                                    <input value={p.width} onChange={e => updateRow(setRequired, required, p.id, 'width', e.target.value)} className="w-[80px] text-sm bg-transparent border-none focus:ring-0 dark:text-white font-medium" />
                                                </td>
                                            )}
                                            <td className="py-2">
                                                <input type="number" value={p.quantity} onChange={e => updateRow(setRequired, required, p.id, 'quantity', e.target.value)} className="w-[60px] text-sm bg-transparent border-none focus:ring-0 dark:text-white font-medium" />
                                            </td>
                                            <td className="py-2">
                                                <input value={p.remarks} placeholder="Part name..." onChange={e => updateRow(setRequired, required, p.id, 'remarks', e.target.value)} className="w-full text-sm bg-transparent border-none focus:ring-0 dark:text-slate-400 placeholder:text-slate-300 dark:placeholder:text-slate-600" />
                                            </td>
                                            <td className="py-2 text-right">
                                                <button onClick={() => deleteRow(setRequired, required, p.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                {/* Right: Results Panel */}
                <div id="results-section" className="lg:col-span-12 xl:col-span-8 flex flex-col gap-4">
                    {results ? (
                        <>
                            {/* Summary Dashboard — shown on screen only, NOT in PDF */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <SummaryBadge
                                    label="Total Needed"
                                    value={mode === '2D' ? results.summary.totalSheets : results.summary.totalStock}
                                    sub={mode === '2D' ? 'Sheets' : 'Bars'}
                                    icon={<Box size={20} className="text-indigo-500" />}
                                />
                                <SummaryBadge
                                    label="Yield"
                                    value={`${(100 - results.summary.wastePercent).toFixed(1)}%`}
                                    sub="Used Area"
                                    icon={<BarChart3 size={20} className="text-emerald-500" />}
                                    color="emerald"
                                />
                                <SummaryBadge
                                    label="Waste"
                                    value={`${results.summary.wastePercent.toFixed(1)}%`}
                                    sub="Off-cut mass"
                                    icon={<Minimize size={20} className="text-rose-500" />}
                                    color="rose"
                                />
                                <SummaryBadge
                                    label={mode === '2D' ? 'Total Area' : 'Total Length'}
                                    value={mode === '2D' ? `${(results.summary.totalArea / 1000000).toFixed(2)} m²` : `${(results.summary.totalUsedLength / 1000).toFixed(1)} m`}
                                    sub="Material Volume"
                                    icon={<Maximize size={20} className="text-amber-500" />}
                                    color="amber"
                                />
                            </div>

                            {/* Required Stocks Table */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 uppercase tracking-wider flex items-center gap-2">
                                    <Box size={16} className="text-indigo-500" /> Required Stocks
                                </h3>
                                <div className="space-y-1">
                                    <div className="grid grid-cols-2 border-b border-slate-100 dark:border-slate-700 pb-2 mb-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Stock Dimensions</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase text-right">Quantity</span>
                                    </div>
                                    {Object.entries(
                                        results.bins.reduce((acc, bin) => {
                                            const key = mode === '2D' ? `${bin.w} x ${bin.h}` : `${bin.length}mm`;
                                            acc[key] = (acc[key] || 0) + 1;
                                            return acc;
                                        }, {})
                                    ).map(([dim, qty]) => (
                                        <div key={dim} className="grid grid-cols-2 py-2 border-b border-slate-50 dark:border-slate-700/50 items-center">
                                            <span className="text-lg font-bold text-slate-700 dark:text-slate-300">{dim}</span>
                                            <span className="text-2xl font-black text-emerald-500 text-right">{qty}</span>
                                        </div>
                                    ))}
                                    <div className="grid grid-cols-2 py-3 items-center">
                                        <span className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Total</span>
                                        <span className="text-3xl font-black text-emerald-500 text-right">{results.bins.length}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Optimization Results Visualizer */}
                            <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                        Optimization Results
                                    </h2>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleExportPDF}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Download PDF"
                                        >
                                            <Download size={18} />
                                        </button>
                                        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                                            <Copy size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-100 dark:bg-[#020617] flex flex-col gap-4">
                                    {mode === '2D' ? (
                                        results.bins.reduce((acc, bin) => {
                                            const usedRectsKey = bin.usedRects.map(r => `${r.x},${r.y},${r.w},${r.h}`).join('|');
                                            const stripsKey = bin.strips.map(s => `${s.y},${s.h}`).join('|');
                                            const key = `${bin.w}-${bin.h}-${usedRectsKey}-${stripsKey}`;
                                            const existing = acc.find(item => item.key === key);
                                            if (existing) {
                                                existing.quantity++;
                                            } else {
                                                acc.push({ ...bin, key, quantity: 1, displayIndex: acc.length + 1 });
                                            }
                                            return acc;
                                        }, []).map((groupedBin, idx) => (
                                            <SheetVisualizer key={idx} bin={groupedBin} />
                                        ))
                                    ) : (
                                        <div className="space-y-6">
                                            {results.bins.reduce((acc, bin) => {
                                                const key = `${bin.length}-${bin.cuts.map(c => c.length).join(',')}`;
                                                const existing = acc.find(item => item.key === key);
                                                if (existing) {
                                                    existing.quantity++;
                                                } else {
                                                    acc.push({ ...bin, key, quantity: 1, displayIndex: acc.length + 1 });
                                                }
                                                return acc;
                                            }, []).map((groupedBin, idx) => (
                                                <LinearVisualizer key={idx} bin={groupedBin} />
                                            ))}
                                        </div>
                                    )}

                                    {results.unplaced.length > 0 && (
                                        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-4 rounded-xl">
                                            <h3 className="text-red-700 dark:text-red-400 text-xs font-bold mb-2 flex items-center gap-2">
                                                <X size={14} /> Failed to Place {results.unplaced.length} {mode === '1D' ? 'Batches' : 'Pieces'}
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                {results.unplaced.map((up, i) => (
                                                    <div key={i} className="text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border border-rose-100 dark:border-rose-900/40 text-rose-500 font-medium">
                                                        {mode === '1D' ? (
                                                            <span>{up.quantity}x {up.length} mm — Length too large for stock</span>
                                                        ) : (
                                                            <span>{up.w}×{up.h} mm — Does not fit in any stock</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
                                <Calculator className="text-slate-300 dark:text-slate-600" size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-400">No calculation results yet</h3>
                            <p className="text-slate-300 dark:text-slate-500 text-sm max-w-[280px] text-center mt-2">
                                Enter your stock measurements and required pieces to generate an optimized cut plan.
                            </p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const SummaryBadge = ({ label, value, sub, icon, color = 'indigo' }) => {
    const colorClasses = {
        indigo: 'bg-indigo-50 border-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400',
        emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400',
        rose: 'bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400',
        amber: 'bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
    };

    return (
        <div className={`p-4 rounded-xl border ${colorClasses[color]} flex flex-col items-center text-center`}>
            <div className="mb-1">{icon}</div>
            <div className="text-xl font-black">{value}</div>
            <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-80">{label}</div>
            <div className="text-[8px] opacity-60 font-medium">{sub}</div>
        </div>
    );
};

// NOTE: The "layout-card" class on the outer div is required by handleExportPDF
// to find and individually capture each layout for the PDF without page-break cutoffs.

const SheetVisualizer = ({ bin }) => {
    const isVertical = bin.h > bin.w;
    const displayW = isVertical ? bin.h : bin.w;
    const displayH = isVertical ? bin.w : bin.h;
    const containerWidth = 800;
    const scale = containerWidth / displayW;

    return (
        <div className="layout-card bg-white dark:bg-slate-900/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-2 px-1">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Layout #{bin.displayIndex} ({bin.w}×{bin.h} mm)
                    </span>
                    {bin.quantity > 1 && (
                        <span className="bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                            ×{bin.quantity} SHEETS
                        </span>
                    )}
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-800">
                    {((bin.usedRects.reduce((s, r) => s + r.w * r.h, 0) / (bin.w * bin.h)) * 100).toFixed(1)}% Yield
                </span>
            </div>

            <div
                className="relative bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 shadow-sm overflow-hidden"
                style={{ width: displayW * scale, height: displayH * scale }}
            >
                {bin.strips.map((strip, i) => (
                    <div
                        key={`strip-${i}`}
                        className={`absolute border-slate-200 dark:border-slate-800 ${isVertical ? 'border-r border-dashed h-full' : 'border-b border-dashed w-full'}`}
                        style={isVertical
                            ? { left: (strip.y + strip.h) * scale, width: 1 }
                            : { top: (strip.y + strip.h) * scale, height: 1 }
                        }
                    />
                ))}

                {bin.usedRects.map((rect, i) => {
                    const top = isVertical ? rect.x * scale : rect.y * scale;
                    const left = isVertical ? rect.y * scale : rect.x * scale;
                    const width = isVertical ? rect.h * scale : rect.w * scale;
                    const height = isVertical ? rect.w * scale : rect.h * scale;

                    return (
                        <div
                            key={i}
                            className="absolute bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-700 flex items-center justify-center overflow-hidden hover:bg-indigo-100 transition-colors"
                            style={{ left, top, width, height }}
                        >
                            <div className="flex flex-col items-center justify-center text-center px-1 w-full">
                                <span className="text-[12px] md:text-[14px] font-black text-indigo-900 dark:text-indigo-200 leading-none drop-shadow-sm">
                                    {rect.w}×{rect.h}
                                </span>
                                {rect.remarks && (
                                    <span className="text-[9px] font-bold text-indigo-400 mt-1 truncate w-full px-1">
                                        {rect.remarks}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-2 flex justify-between px-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Items: {bin.usedRects.length}</div>
                <div className="text-[10px] font-bold text-red-400 uppercase">
                    Waste: {((1 - (bin.usedRects.reduce((s, r) => s + r.w * r.h, 0) / (bin.w * bin.h))) * 100).toFixed(1)}%
                </div>
            </div>
        </div>
    );
};

const LinearVisualizer = ({ bin }) => {
    return (
        <div className="layout-card bg-white dark:bg-slate-900/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-2 px-1">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Layout #{bin.displayIndex} ({bin.length} mm)
                    </span>
                    {bin.quantity > 1 && (
                        <span className="bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                            ×{bin.quantity} QTY
                        </span>
                    )}
                </div>
                <span className="text-[10px] font-bold text-emerald-600">
                    {((bin.used / bin.length) * 100).toFixed(1)}% Yield
                </span>
            </div>

            <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex shadow-inner">
                {bin.cuts.map((cut, i) => (
                    <div
                        key={i}
                        className="h-full bg-indigo-500/20 border-r border-indigo-500/40 relative hover:bg-indigo-500/30 transition-all"
                        style={{ width: `${(cut.length / bin.length) * 100}%` }}
                    >
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1 overflow-hidden">
                            <span className="text-[10px] md:text-[12px] font-black leading-none text-indigo-900 dark:text-indigo-200">
                                {cut.length}mm
                            </span>
                            {cut.remarks && (
                                <span className="text-[8px] text-indigo-400 font-bold mt-1 truncate w-full">
                                    {cut.remarks}
                                </span>
                            )}
                        </div>
                        <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-slate-400/20" />
                    </div>
                ))}
            </div>

            <div className="mt-2 flex justify-between">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                    Usage: {bin.used} mm / {bin.length} mm
                </div>
                <div className="text-[9px] font-bold text-rose-400 uppercase tracking-tighter">
                    Waste: {bin.remaining} mm
                </div>
            </div>
        </div>
    );
};

export default CutListCalculator;