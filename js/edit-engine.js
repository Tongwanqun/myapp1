// ==================== 编辑引擎 ====================

// 编辑单元格（通过 rowId 定位，不会错行）
async function editCellByRowId(sheet, rowId, colIndex, newValue, saveCallback) {
    const row = sheet.rows.find(r => r.rowId === rowId);
    if (!row) {
        showToast('无法定位数据行');
        return false;
    }
    
    const oldValue = row.cells[colIndex];
    if (oldValue === newValue) return false;
    
    row.cells[colIndex] = newValue;
    
    if (saveCallback) {
        await saveCallback();
    }
    
    return true;
}

// 删除行（通过 rowId 定位）
async function deleteRowByRowId(sheet, rowId, saveCallback) {
    // 找到行索引（跳过表头？表头是索引0，不能删）
    const rowIndex = sheet.rows.findIndex(r => r.rowId === rowId);
    
    if (rowIndex === -1) {
        showToast('找不到要删除的行');
        return false;
    }
    
    if (rowIndex === 0) {
        showToast('不能删除表头行');
        return false;
    }
    
    sheet.rows.splice(rowIndex, 1);
    
    if (saveCallback) {
        await saveCallback();
    }
    
    return true;
}

// 新增行
async function addNewRowToSheet(sheet, saveCallback) {
    const maxCols = getSheetMaxCols(sheet);
    const newRow = {
        rowId: generateId(),
        cells: new Array(maxCols).fill('')
    };
    
    sheet.rows.push(newRow);
    
    if (saveCallback) {
        await saveCallback();
    }
    
    return newRow;
}

// 撤销历史管理
class UndoManager {
    constructor(maxHistory = 20) {
        this.history = [];
        this.maxHistory = maxHistory;
        this.isUndoing = false;
    }
    
    push(state) {
        if (this.isUndoing) return;
        this.history.push(deepCopy(state));
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }
    
    canUndo() {
        return this.history.length > 0;
    }
    
    undo(currentState, restoreCallback) {
        if (this.history.length === 0) return false;
        
        this.isUndoing = true;
        const lastState = this.history.pop();
        
        if (lastState && restoreCallback) {
            restoreCallback(lastState);
        }
        
        this.isUndoing = false;
        return true;
    }
    
    clear() {
        this.history = [];
    }
}