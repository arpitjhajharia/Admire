/**
 * 1D Bin Packing with Setup Batch Grouping
 * Goal: Minimize distinct lengths in the cut plan to reduce machine setup changes.
 */
export const optimizeLinear = (stock, pieces, kerf = 0) => {
    // 1. Flatten pieces into individual items to preserve unique remarks
    let items = [];
    pieces.forEach(p => {
        const qty = Number(p.quantity);
        for (let i = 0; i < qty; i++) {
            items.push({ length: Number(p.length), remarks: p.remarks || '', id: p.id });
        }
    });

    // Sort descending for better packing
    items.sort((a, b) => b.length - a.length);

    // Stock management
    let availableStock = [];
    stock.forEach(s => {
        for (let i = 0; i < s.quantity; i++) {
            availableStock.push({ length: Number(s.length), id: s.id, used: 0, cuts: [], remaining: Number(s.length) });
        }
    });

    let bins = [];
    let unplaced = [];

    // Process each stock item (bin)
    for (let bin of availableStock) {
        let binModified = false;
        let changed = true;

        while (changed) {
            changed = false;
            let bestIdx = -1;
            let minWaste = Infinity;

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const needed = item.length + (bin.cuts.length > 0 ? kerf : 0);

                if (bin.remaining >= needed) {
                    const currentWaste = bin.remaining - needed;
                    // Batching heuristic: prioritize same length OR same remarks
                    const isSameLength = bin.cuts.some(c => c.length === item.length);
                    const score = isSameLength ? currentWaste - 1000 : currentWaste;

                    if (score < minWaste) {
                        minWaste = score;
                        bestIdx = i;
                    }
                }
            }

            if (bestIdx !== -1) {
                const item = items.splice(bestIdx, 1)[0];
                const actualNeeded = item.length + (bin.cuts.length > 0 ? kerf : 0);
                bin.cuts.push({ 
                    length: item.length, 
                    start: bin.used + (bin.cuts.length > 0 ? kerf : 0), 
                    remarks: item.remarks 
                });
                bin.used += actualNeeded;
                bin.remaining -= actualNeeded;
                binModified = true;
                changed = true;
            }
        }

        if (binModified) bins.push(bin);
        if (items.length === 0) break;
    }

    unplaced = items;

    const totalUsedLength = bins.reduce((sum, b) => sum + b.length, 0);
    const actualPieceLength = bins.reduce((sum, b) => sum + b.cuts.reduce((s, c) => s + c.length, 0), 0);
    const waste = totalUsedLength - actualPieceLength;

    return { 
        bins, 
        unplaced, 
        summary: {
            totalStock: bins.length,
            totalUsedLength,
            actualPieceLength,
            waste,
            wastePercent: totalUsedLength > 0 ? (waste / totalUsedLength) * 100 : 0
        }
    };
};

/**
 * 2D 2-Stage Guillotine Algorithm
 */
export const optimizeSheet = (stock, pieces, kerf = 0) => {
    let items = [];
    pieces.forEach(p => {
        const w = Number(p.width);
        const l = Number(p.length);
        const qty = Number(p.quantity);
        for (let i = 0; i < qty; i++) {
            items.push({ w, h: l, id: p.id, area: w * l, remarks: p.remarks || '' });
        }
    });

    items.sort((a, b) => b.h - a.h);

    let stockBins = [];
    stock.forEach(s => {
        for (let i = 0; i < s.quantity; i++) {
            stockBins.push({
                w: Number(s.width),
                h: Number(s.length),
                id: s.id,
                usedRects: [],
                strips: [],
                remainingH: Number(s.length)
            });
        }
    });

    let unplaced = [];

    for (let item of items) {
        let placed = false;

        for (let bin of stockBins) {
            for (let strip of bin.strips) {
                if (strip.remainingW >= item.w && strip.h >= item.h) {
                    const x = bin.w - strip.remainingW;
                    const y = strip.y;
                    bin.usedRects.push({ x, y, w: item.w, h: item.h, stripId: strip.id, remarks: item.remarks });
                    strip.remainingW -= (item.w + kerf);
                    placed = true;
                    break;
                }
                if (strip.remainingW >= item.h && strip.h >= item.w) {
                    const x = bin.w - strip.remainingW;
                    const y = strip.y;
                    bin.usedRects.push({ x, y, w: item.h, h: item.w, rotated: true, stripId: strip.id, remarks: item.remarks });
                    strip.remainingW -= (item.h + kerf);
                    placed = true;
                    break;
                }
            }

            if (placed) break;

            const neededH = item.h + (bin.strips.length > 0 ? kerf : 0);
            if (bin.remainingH >= neededH) {
                const stripY = bin.h - bin.remainingH + (bin.strips.length > 0 ? kerf : 0);
                const newStrip = { id: bin.strips.length, y: stripY, h: item.h, remainingW: bin.w - item.w };
                bin.usedRects.push({ x: 0, y: stripY, w: item.w, h: item.h, stripId: newStrip.id, remarks: item.remarks });
                bin.strips.push(newStrip);
                bin.remainingH -= neededH;
                placed = true;
                break;
            }
            
            const neededHRot = item.w + (bin.strips.length > 0 ? kerf : 0);
            if (bin.remainingH >= neededHRot) {
                const stripY = bin.h - bin.remainingH + (bin.strips.length > 0 ? kerf : 0);
                const newStrip = { id: bin.strips.length, y: stripY, h: item.w, remainingW: bin.w - item.h };
                bin.usedRects.push({ x: 0, y: stripY, w: item.h, h: item.w, rotated: true, stripId: newStrip.id, remarks: item.remarks });
                bin.strips.push(newStrip);
                bin.remainingH -= neededHRot;
                placed = true;
                break;
            }
        }

        if (!placed) unplaced.push(item);
    }

    const activeBins = stockBins.filter(b => b.usedRects.length > 0);
    const totalArea = activeBins.reduce((sum, b) => sum + b.w * b.h, 0);
    const usedArea = activeBins.reduce((sum, b) => sum + b.usedRects.reduce((s, r) => s + r.w * r.h, 0), 0);
    const waste = totalArea - usedArea;

    return {
        bins: activeBins,
        unplaced,
        summary: {
            totalSheets: activeBins.length,
            totalArea,
            usedArea,
            waste,
            wastePercent: totalArea > 0 ? (waste / totalArea) * 100 : 0
        }
    };
};
