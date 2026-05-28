// ==================== 主应用（状态管理） ====================
// 全局状态
let currentTable = null;
let currentSheetId = null;
let currentDisplayCols = [];
let currentFilter1Selected = new Set();
let currentFilter2Selected = new Set();
let currentSearchKeyword = '';
let currentFilteredRows = [];
let currentSelectedRowId = null;
let undoManager = new UndoManager();
// 表格切换下拉
let allTablesList = [];

// 存储当前选中的子表索引（始终是原始 sheets 中的索引）
let currentSelectedSheets = [];

// 获取当前显示的 sheet（自动处理合并模式）
function getCurrentSheet() {
    if (!currentTable) return null;
    if (currentTable._isMergedMode && currentTable._mergedSheet) {
        return currentTable._mergedSheet;
    }
    let sheet = currentTable.sheets.find(s => s.id === currentSheetId);
    if (!sheet && currentTable.sheets.length > 0) {
        sheet = currentTable.sheets[0];
        currentSheetId = sheet.id;
    }
    return sheet;
}

function getDataRows(sheet) {
    if (!sheet || !sheet.rows || sheet.rows.length <= 1) return [];
    return sheet.rows.slice(1);
}

async function refreshAll() {
    if (!currentTable) return;
    
    const sheet = getCurrentSheet();
    if (!sheet) return;
    
    const dataRows = getDataRows(sheet);
    
    currentFilteredRows = applyFilters(
        dataRows,
        currentDisplayCols,
        currentFilter1Selected,
        currentFilter2Selected,
        currentSearchKeyword
    );
    
    updateFilterDisplay();
    updateFilterLabels();
    
    const headers = getDisplayHeaders(sheet, currentDisplayCols);
    const displayData = currentFilteredRows.map(row => ({
        rowId: row.rowId,
        cells: currentDisplayCols.map(colIdx => row.cells[colIdx] || '')
    }));
    
    const result = renderTable(
        'resultArea',
        headers,
        displayData,
        currentSelectedRowId,
        currentSearchKeyword,
        currentFilteredRows.length
    );
    
    const totalCount = result && typeof result.totalCount !== 'undefined' ? result.totalCount : currentFilteredRows.length;
    const isTruncated = result && result.isTruncated ? result.isTruncated : false;
    
    updateStatTip('statTip', totalCount, isTruncated);
    
    bindTableEvents(onRowSelect, onCellEdit);
}

function onRowSelect(rowId) {
    currentSelectedRowId = rowId;
    refreshAll();
    const editBtns = document.getElementById('rowEditButtons');
    if (editBtns) editBtns.style.display = 'flex';
}

async function onCellEdit(rowId, colIndex) {
    if (currentTable && currentTable._isMergedMode) {
        showToast('合并视图下不能编辑，请切换到单个子表');
        return;
    }
    const sheet = getCurrentSheet();
    const actualColIdx = currentDisplayCols[colIndex];
    
    const row = sheet.rows.find(r => r.rowId === rowId);
    if (!row) return;
    
    const oldValue = row.cells[actualColIdx] || '';
    const newValue = prompt('编辑单元格内容:', oldValue);
    
    if (newValue !== null && newValue !== oldValue) {
        undoManager.push(currentTable);
        
        const success = await editCellByRowId(sheet, rowId, actualColIdx, newValue, async () => {
            await saveTable(currentTable);
        });
        
        if (success) {
            showToast('已修改');
            await refreshAll();
            currentSelectedRowId = rowId;
            refreshAll();
        }
    }
}

function updateFilterDisplay() {
    const f1Count = currentFilter1Selected.size;
    const f2Count = currentFilter2Selected.size;
    const f1Display = document.getElementById('selected1Display');
    const f2Display = document.getElementById('selected2Display');
    if (f1Display) f1Display.innerText = f1Count === 0 ? '全部' : `已选${f1Count}项`;
    if (f2Display) f2Display.innerText = f2Count === 0 ? '全部' : `已选${f2Count}项`;
}

function updateFilterLabels() {
    const sheet = getCurrentSheet();
    if (!sheet) return;
    const headers = getDisplayHeaders(sheet, currentDisplayCols);
    const label1 = document.getElementById('labelLevel1');
    const label2 = document.getElementById('labelLevel2');
    if (label1) label1.innerText = headers[0] || '第一列';
    if (label2) label2.innerText = headers[1] || '第二列';
}

async function openFilter1() {
    const sheet = getCurrentSheet();
    if (!sheet) return;
    
    let sourceRows = currentFilteredRows;
    if (sourceRows.length === 0) {
        sourceRows = getDataRows(sheet);
    }
    
    const colIdx = currentDisplayCols[0];
    if (colIdx === undefined) {
        showToast('请先选择要筛选的列');
        return;
    }
    
    const options = getFilterOptions(sourceRows, colIdx, currentFilter1Selected);
    const title = document.getElementById('labelLevel1').innerText;
    
    showFilterModal(title, options, currentFilter1Selected, async (newSelected) => {
        currentFilter1Selected = newSelected;
        currentFilter2Selected.clear();
        await refreshAll();
    });
}

async function openFilter2() {
    const sheet = getCurrentSheet();
    if (!sheet) return;
    
    let sourceRows = currentFilteredRows;
    if (sourceRows.length === 0) {
        sourceRows = getDataRows(sheet);
    }
    
    const col1Idx = currentDisplayCols[0];
    const col2Idx = currentDisplayCols[1];
    
    if (col2Idx === undefined) {
        showToast('请先选择第二列');
        return;
    }
    
    const options = getLinkedFilterOptions(sourceRows, col1Idx, col2Idx, currentFilter1Selected);
    const title = document.getElementById('labelLevel2').innerText;
    
    showFilterModal(title, options, currentFilter2Selected, async (newSelected) => {
        currentFilter2Selected = newSelected;
        await refreshAll();
    });
}

function showFilterModal(title, options, currentSelected, onConfirm) {
    const modal = document.getElementById('filterModal');
    const body = document.getElementById('filterModalBody');
    const titleEl = document.getElementById('filterModalTitle');
    
    if (!modal || !body) return;
    
    titleEl.innerText = `📋 选择 ${title}`;
    
    let html = '';
    if (options && options.length > 0) {
        for (const opt of options) {
            const checked = currentSelected.has(opt.value) ? 'checked' : '';
            html += `
                <div class="option-item">
                    <input type="checkbox" value="${escapeHtml(opt.value)}" ${checked} id="opt_${escapeHtml(opt.value)}">
                    <label for="opt_${escapeHtml(opt.value)}">${escapeHtml(opt.value)}</label>
                    <span class="option-count">(${opt.count})</span>
                </div>
            `;
        }
    } else {
        html = '<div style="padding: 20px; text-align: center; color: #999;">暂无可选项</div>';
    }
    
    body.innerHTML = html;
    modal.style.display = 'flex';
    
    const selectAllBtn = document.getElementById('filterModalSelectAll');
    const cancelBtn = document.getElementById('filterModalCancel');
    const confirmBtn = document.getElementById('filterModalConfirm');
    
    if (selectAllBtn) {
        selectAllBtn.onclick = () => {
            body.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        };
    }
    if (cancelBtn) cancelBtn.onclick = () => modal.style.display = 'none';
    if (confirmBtn) {
        confirmBtn.onclick = () => {
            const newSelected = new Set();
            body.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
                newSelected.add(cb.value);
            });
            onConfirm(newSelected);
            modal.style.display = 'none';
        };
    }
}

async function openColSelect() {
    const sheet = getCurrentSheet();
    if (!sheet) return;
    
    const headers = getHeaderRow(sheet);
    const maxCols = getSheetMaxCols(sheet);
    
    const modal = document.getElementById('colModal');
    const body = document.getElementById('colModalBody');
    
    if (!modal || !body) return;
    
    let html = '';
    for (let i = 0; i < maxCols; i++) {
        const colName = (headers[i] || `列${i+1}`);
        const checked = currentDisplayCols.includes(i) ? 'checked' : '';
        html += `
            <div class="option-item">
                <input type="checkbox" value="${i}" ${checked} id="col_${i}">
                <label for="col_${i}">${escapeHtml(colName)}</label>
            </div>
        `;
    }
    
    body.innerHTML = html;
    modal.style.display = 'flex';
    
    const selectAllBtn = document.getElementById('colModalSelectAll');
    const cancelBtn = document.getElementById('colModalCancel');
    const confirmBtn = document.getElementById('colModalConfirm');
    
    if (selectAllBtn) {
        selectAllBtn.onclick = () => {
            body.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        };
    }
    if (cancelBtn) cancelBtn.onclick = () => modal.style.display = 'none';
    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            const newCols = [];
            body.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
                newCols.push(parseInt(cb.value));
            });
            if (newCols.length === 0) {
                showToast('至少保留一列');
                return;
            }
            newCols.sort((a, b) => a - b);
            currentDisplayCols = newCols;
            
            currentTable.displayCols = currentDisplayCols;
            await saveTable(currentTable);
            
            currentFilter1Selected.clear();
            currentFilter2Selected.clear();
            await refreshAll();
            modal.style.display = 'none';
            showToast('列显示已更新');
        };
    }
}

// ==================== 性能优化：合并视图直接引用原始行（不深拷贝） ====================
function createMergedSheetFromIndices(sheetIndices, originalSheets) {
    let headers = [];
    let mergedRows = [];
    for (let i = 0; i < sheetIndices.length; i++) {
        const sheet = originalSheets[sheetIndices[i]];
        if (!sheet || !sheet.rows) continue;
        if (i === 0) {
            headers = sheet.rows[0]?.cells || [];
        }
        // 跳过表头，直接引用原始数据行（不复制，大幅提升性能）
        const dataRows = sheet.rows.slice(1);
        // 可选：过滤掉完全空白的行（避免产生无意义空行）
        const nonEmptyRows = dataRows.filter(row => 
            row.cells && row.cells.some(cell => cell !== undefined && cell !== null && cell !== '')
        );
        mergedRows.push(...nonEmptyRows);
    }
    return {
        id: 'merged_' + Date.now(),
        name: '合并视图',
        rows: [{ cells: headers }, ...mergedRows]
    };
}

async function loadSheetsData() {
    if (!currentTable || !currentSelectedSheets || currentSelectedSheets.length === 0) return;
    
    const originalSheets = currentTable.sheets;
    
    if (currentSelectedSheets.length === 1) {
        if (currentTable._isMergedMode) {
            delete currentTable._isMergedMode;
            delete currentTable._mergedSheet;
        }
        const sheetIdx = currentSelectedSheets[0];
        currentSheetId = originalSheets[sheetIdx]?.id || originalSheets[0].id;
    } else {
        const mergedSheet = createMergedSheetFromIndices(currentSelectedSheets, originalSheets);
        currentTable._mergedSheet = mergedSheet;
        currentTable._isMergedMode = true;
        currentSheetId = mergedSheet.id;
    }
    
    currentFilter1Selected.clear();
    currentFilter2Selected.clear();
    currentSearchKeyword = '';
    currentSelectedRowId = null;
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) searchInput.value = '';
    await refreshAll();
}

async function openSheetSelect() {
    if (!currentTable) return;
    const originalSheets = currentTable.sheets;
    const sheetNames = originalSheets.map(s => s.name);
    
    let selectedIndices = currentSelectedSheets.length ? currentSelectedSheets : [0];
    
    const modal = document.getElementById('sheetSelectModal');
    const body = document.getElementById('sheetSelectBody');
    
    if (!modal || !body) return;
    
    let html = '';
    for (let i = 0; i < sheetNames.length; i++) {
        const checked = selectedIndices.includes(i) ? 'checked' : '';
        html += `
            <div class="option-item">
                <input type="checkbox" value="${i}" ${checked} id="sheet_${i}">
                <label for="sheet_${i}">${escapeHtml(sheetNames[i])}</label>
            </div>
        `;
    }
    body.innerHTML = html;
    modal.style.display = 'flex';
    
    document.getElementById('sheetModalSelectAll').onclick = () => {
        body.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    };
    
    document.getElementById('sheetModalClearAll').onclick = () => {
        body.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    };
    
    document.getElementById('sheetModalCancel').onclick = () => modal.style.display = 'none';
    
    document.getElementById('sheetModalConfirm').onclick = async () => {
        const newSelected = [];
        body.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            newSelected.push(parseInt(cb.value));
        });
        if (newSelected.length === 0) {
            showToast('请至少选择一个子表');
            return;
        }
        
        currentSelectedSheets = newSelected;
        currentTable.selectedSheets = currentSelectedSheets;
        await saveTable(currentTable);
        
        await loadSheetsData();
        
        modal.style.display = 'none';
        showToast(`已选择 ${currentSelectedSheets.length} 个子表`);
    };
}

async function clearFilter() {
    currentFilter1Selected.clear();
    currentFilter2Selected.clear();
    currentSearchKeyword = '';
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) searchInput.value = '';
    await refreshAll();
    showToast('已清空筛选条件');
}

async function onSearch() {
    const searchInput = document.getElementById('globalSearchInput');
    currentSearchKeyword = searchInput ? searchInput.value : '';
    await refreshAll();
}

async function deleteSelectedRow() {
    if (currentTable && currentTable._isMergedMode) {
        showToast('合并视图下不能删除行，请切换到单个子表');
        return;
    }
    if (!currentSelectedRowId) {
        showToast('请先单击选中一行');
        return;
    }
    
    if (!confirm('确定删除选中的这一行吗？')) return;
    
    const sheet = getCurrentSheet();
    undoManager.push(currentTable);
    
    const success = await deleteRowByRowId(sheet, currentSelectedRowId, async () => {
        await saveTable(currentTable);
    });
    
    if (success) {
        currentSelectedRowId = null;
        const editBtns = document.getElementById('rowEditButtons');
        if (editBtns) editBtns.style.display = 'none';
        await refreshAll();
        showToast('已删除');
    }
}

async function addNewRow() {
    if (currentTable && currentTable._isMergedMode) {
        showToast('合并视图下不能新增行，请切换到单个子表');
        return;
    }
    const sheet = getCurrentSheet();
    undoManager.push(currentTable);
    
    await addNewRowToSheet(sheet, async () => {
        await saveTable(currentTable);
    });
    
    await refreshAll();
    showToast('已新增空白行，双击单元格可编辑');
}

async function undo() {
    if (!undoManager.canUndo()) {
        showToast('没有可撤销的操作');
        return;
    }
    
    undoManager.undo(currentTable, async (lastState) => {
        currentTable = lastState;
        if (currentTable.selectedSheets && currentTable.selectedSheets.length > 0) {
            currentSelectedSheets = currentTable.selectedSheets;
        } else {
            currentSelectedSheets = [0];
        }
        delete currentTable._isMergedMode;
        delete currentTable._mergedSheet;
        await saveTable(currentTable);
        await loadSheetsData();
        await refreshAll();
        showToast('已撤销');
    });
}

async function copyResult() {
    const sheet = getCurrentSheet();
    if (!sheet || !currentFilteredRows || currentFilteredRows.length === 0) {
        showToast('没有数据可复制');
        return;
    }
    
    const headers = getDisplayHeaders(sheet, currentDisplayCols);
    const displayData = currentFilteredRows.map(row => ({
        cells: currentDisplayCols.map(colIdx => row.cells[colIdx] || '')
    }));
    
    await copyResultToClipboard(headers, displayData);
}

function exportExcel() {
    const sheet = getCurrentSheet();
    if (!sheet || !currentFilteredRows || currentFilteredRows.length === 0) {
        showToast('没有数据可导出');
        return;
    }
    
    const headers = getDisplayHeaders(sheet, currentDisplayCols);
    const displayData = currentFilteredRows.map(row => ({
        cells: currentDisplayCols.map(colIdx => row.cells[colIdx] || '')
    }));
    
    exportToExcel(headers, displayData, currentTable.name);
}

async function renderTableList() {
    try {
        const tables = await loadAllTables();
        allTablesList = tables;
        const container = document.getElementById('tableList');
        const searchInput = document.getElementById('tableSearchInput');
        const keyword = searchInput ? searchInput.value.toLowerCase() : '';
        
        if (!container) return;
        
        const filtered = tables.filter(t => t.name.toLowerCase().includes(keyword));
        
        if (filtered.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">还没有导入任何表格<br>点击上方按钮导入Excel</div>';
            return;
        }
        
        let html = '';
        for (const table of filtered) {
            const sheetCount = table.sheets ? table.sheets.length : 0;
            html += `
                <div style="position:relative;margin-bottom:6px;">
                    <button class="btn-table" data-id="${table.id}" style="padding-right:50px;width:100%;text-align:left;">📋 ${escapeHtml(table.name)}（${sheetCount}个子表）</button>
                    <button class="btn-delete" data-id="${table.id}">🗑</button>
                </div>
            `;
        }
        container.innerHTML = html;
        
        document.querySelectorAll('.btn-table').forEach(el => {
            el.addEventListener('click', async () => {
                const id = el.getAttribute('data-id');
                await openTable(id);
            });
        });
        document.querySelectorAll('.btn-delete').forEach(el => {
            el.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = el.getAttribute('data-id');
                // 使用自定义确认框（确认/取消）
                showConfirmDialog('确定删除这个表格吗？数据无法恢复！', async () => {
                    await deleteTableById(id);
                    await renderTableList();
                    if (currentTable && currentTable.id === id) {
                        backToList();
                    }
                });
            });
        });
    } catch (err) {
        console.error('renderTableList错误:', err);
        showToast('加载表格列表失败');
    }
}

async function openTable(tableId) {
    currentTable = await loadTableById(tableId);
    if (!currentTable) {
        showToast('表格加载失败');
        return;
    }
    
    delete currentTable._isMergedMode;
    delete currentTable._mergedSheet;
    
    if (currentTable.selectedSheets && currentTable.selectedSheets.length > 0) {
        currentSelectedSheets = currentTable.selectedSheets;
    } else {
        currentSelectedSheets = [0];
    }
    
    await loadSheetsData();
    
    const sheet = getCurrentSheet();
    const maxCols = getSheetMaxCols(sheet);
    
    if (currentTable.displayCols && currentTable.displayCols.length > 0) {
        currentDisplayCols = currentTable.displayCols;
    } else {
        currentDisplayCols = [];
        for (let i = 0; i < maxCols; i++) currentDisplayCols.push(i);
    }
    
    currentFilter1Selected.clear();
    currentFilter2Selected.clear();
    currentSearchKeyword = '';
    currentSelectedRowId = null;
    if (undoManager.clear) undoManager.clear();
    
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) searchInput.value = '';
    const editBtns = document.getElementById('rowEditButtons');
    if (editBtns) editBtns.style.display = 'none';
    
    await refreshAll();
    
    document.getElementById('listView').style.display = 'none';
    document.getElementById('detailView').style.display = 'block';
    document.getElementById('currentTableTitle').innerText = currentTable.name;
    
    updateTableDropdown();
}

function updateTableDropdown() {
    const dropdown = document.getElementById('tableDropdown');
    if (!dropdown) return;
    
    let html = '';
    for (const table of allTablesList) {
        const isActive = currentTable && currentTable.id === table.id ? 'background: rgba(30,136,229,0.1);' : '';
        html += `<div class="table-dropdown-item" style="${isActive}" data-id="${table.id}">${escapeHtml(table.name)}</div>`;
    }
    dropdown.innerHTML = html;
    
    dropdown.querySelectorAll('.table-dropdown-item').forEach(item => {
        item.addEventListener('click', async () => {
            const id = item.getAttribute('data-id');
            dropdown.classList.remove('show');
            await openTable(id);
        });
    });
}

function toggleTableDropdown() {
    const dropdown = document.getElementById('tableDropdown');
    if (!dropdown) return;
    dropdown.classList.toggle('show');
}

document.addEventListener('click', function(e) {
    const container = document.querySelector('.table-title-container');
    const dropdown = document.getElementById('tableDropdown');
    if (container && dropdown && !container.contains(e.target)) {
        dropdown.classList.remove('show');
    }
});

function backToList() {
    currentTable = null;
    currentSheetId = null;
    currentFilter1Selected.clear();
    currentFilter2Selected.clear();
    currentSelectedRowId = null;
    
    document.getElementById('detailView').style.display = 'none';
    document.getElementById('listView').style.display = 'block';
    renderTableList();
}

async function renameTable() {
    if (!currentTable) return;
    const newName = prompt('请输入新表格名称:', currentTable.name);
    if (!newName || newName.trim() === '') return;
    currentTable.name = newName.trim();
    await saveTable(currentTable);
    document.getElementById('currentTableTitle').innerText = currentTable.name;
    showToast('重命名成功');
    renderTableList();
}

function initDarkMode() {
    const isDark = localStorage.getItem('darkMode') === '1';
    if (isDark) document.body.classList.add('dark-mode');
    
    const darkModeBtn = document.getElementById('darkModeBtn');
    if (darkModeBtn) {
        darkModeBtn.onclick = () => {
            document.body.classList.toggle('dark-mode');
            const isDarkNow = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDarkNow ? '1' : '0');
        };
    }
}

async function init() {
    try {
        await initDatabase();
        await renderTableList();
        initDarkMode();
    } catch (err) {
        console.error('初始化错误:', err);
        alert('初始化失败: ' + err.message);
        return;
    }
    
    document.getElementById('importBtn').onclick = () => {
        importExcelFile(async () => {
            await renderTableList();
        });
    };
    document.getElementById('exportBackupBtn').onclick = exportBackup;
    document.getElementById('importBackupBtn').onclick = () => {
        importBackup(async () => {
            await renderTableList();
            if (document.getElementById('detailView').style.display === 'block') backToList();
        });
    };
    document.getElementById('backToListBtn').onclick = backToList;
    document.getElementById('renameTableBtn').onclick = renameTable;
    document.getElementById('selectColBtn').onclick = openColSelect;
    document.getElementById('selectSheetBtn').onclick = openSheetSelect;
    document.getElementById('filter1Btn').onclick = openFilter1;
    document.getElementById('filter2Btn').onclick = openFilter2;
    document.getElementById('clearFilterBtn').onclick = clearFilter;
    document.getElementById('globalSearchInput').oninput = onSearch;
    document.getElementById('copyResultBtn').onclick = copyResult;
    document.getElementById('exportExcelBtn').onclick = exportExcel;
    document.getElementById('deleteRowBtn').onclick = deleteSelectedRow;
    document.getElementById('addRowBtn').onclick = addNewRow;
    document.getElementById('undoBtn').onclick = undo;
    document.getElementById('tableSearchInput').oninput = () => renderTableList();
    
    const tableTitle = document.getElementById('currentTableTitle');
    if (tableTitle) {
        tableTitle.onclick = () => {
            if (document.getElementById('detailView').style.display === 'block') {
                toggleTableDropdown();
            }
        };
    }
}

init();