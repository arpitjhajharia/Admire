import ExcelJS from 'exceljs';

/**
 * Common Import: Read Excel with both Material List and Cutting List
 */
export const importFromExcel = async (file) => {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    
    if (file.name.endsWith('.csv')) {
        await workbook.csv.load(arrayBuffer);
    } else {
        await workbook.xlsx.load(arrayBuffer);
    }

    const worksheet = workbook.worksheets[0];
    const cuttingList = [];
    const materialList = [];
    
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 2) return; // Skip Titles and Column Headers
        
        // --- 1. Read Cutting List (Col 1-4: A-D) ---
        const pLen = row.getCell(1).value;
        const pQty = row.getCell(3).value;
        if (pLen && pQty) {
            cuttingList.push({
                length: Number(pLen),
                width: Number(row.getCell(2).value) || 0,
                quantity: Number(pQty),
                remarks: row.getCell(4).value ? row.getCell(4).value.toString() : ''
            });
        }

        // --- 2. Read Material List (Col 7-10: G-J) ---
        const mLen = row.getCell(7).value;
        const mQty = row.getCell(9).value;
        if (mLen && mQty) {
            materialList.push({
                length: Number(mLen),
                width: Number(row.getCell(8).value) || 0,
                quantity: Number(mQty),
                remarks: row.getCell(10).value ? row.getCell(10).value.toString() : ''
            });
        }
    });

    return { cuttingList, materialList };
};

/**
 * Generate a standard Excel template with the new "Two Block" structure
 */
export const downloadTemplate = async (mode = '2D') => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Cut List Template');

    // Headers Styling
    const titleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo-600
    const colHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; // Slate-200
    const whiteFont = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Set titles
    sheet.getCell('A1').value = 'CUTTING LIST (PARTS)';
    sheet.getCell('G1').value = 'MATERIALS LIST (STOCK)';
    
    sheet.mergeCells('A1:D1');
    sheet.mergeCells('G1:J1');
    
    ['A1', 'G1'].forEach(cell => {
        sheet.getCell(cell).fill = titleFill;
        sheet.getCell(cell).font = whiteFont;
        sheet.getCell(cell).alignment = { horizontal: 'center' };
    });

    // Set Column Headers
    const headers = ['Length (mm)', 'Width (mm)', 'Quantity', 'Remarks/Label'];
    headers.forEach((h, i) => {
        // Cutting List Headers
        const pCell = sheet.getRow(2).getCell(i + 1);
        pCell.value = h;
        if (mode === '1D' && i === 1) pCell.value = 'Width (Ignore for 1D)';
        pCell.fill = colHeaderFill;
        pCell.font = { bold: true };

        // Material List Headers
        const mCell = sheet.getRow(2).getCell(i + 7);
        mCell.value = h;
        if (mode === '1D' && i === 1) mCell.value = 'Width (Ignore for 1D)';
        mCell.fill = colHeaderFill;
        mCell.font = { bold: true };
    });

    // Column Widths
    [1, 2, 3, 4, 7, 8, 9, 10].forEach(col => {
        sheet.getColumn(col).width = 18;
    });

    // Sample Data
    sheet.getRow(3).values = [1200, 600, 4, 'Side Panel', null, null, 2440, 1220, 5, 'Plywood Sheet'];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cut_List_Format_${mode}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
};
