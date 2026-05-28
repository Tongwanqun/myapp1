// ==================== 筛选引擎 ====================

// 获取某一列的所有唯一值及计数 (Map<value, count>)
function getColumnStats(rows, colIndex) {
    const countMap = new Map();
    for (const row of rows) {
        let val = row.cells[colIndex] || '';
        if (val === '') val = '(空)';
        countMap.set(val, (countMap.get(val) || 0) + 1);
    }
    return countMap;
}

// 获取筛选器选项 (带计数，按数量降序)
function getFilterOptions(rows, colIndex, currentSelectedSet) {
    const countMap = getColumnStats(rows, colIndex);
    const options = Array.from(countMap.entries()).map(([value, count]) => ({ value, count }));
    options.sort((a, b) => b.count - a.count);
    return options;
}

// 联动筛选：根据第一列的选中值，获取第二列的选项
function getLinkedFilterOptions(rows, col1Index, col2Index, selectedCol1Values) {
    // 先按第一列筛选
    let filteredRows = rows;
    if (selectedCol1Values && selectedCol1Values.size > 0) {
        filteredRows = rows.filter(row => {
            const val = row.cells[col1Index] || '';
            return selectedCol1Values.has(val);
        });
    }
    // 统计第二列
    return getFilterOptions(filteredRows, col2Index, new Set());
}

// 应用筛选和搜索，返回筛选后的行
function applyFilters(rows, displayCols, filter1Selected, filter2Selected, searchKeyword) {
    let filtered = [...rows];
    
    console.log('applyFilters 开始, 总行数:', filtered.length);
    console.log('筛选器1选中:', Array.from(filter1Selected));
    console.log('筛选器2选中:', Array.from(filter2Selected));
    console.log('搜索关键词:', searchKeyword);
    console.log('显示列:', displayCols);
    
    // 筛选器1（第一显示列）
    if (filter1Selected && filter1Selected.size > 0 && displayCols[0] !== undefined) {
        const colIdx = displayCols[0];
        filtered = filtered.filter(row => {
            let val = row.cells[colIdx] || '';
            if (val === '') val = '(空)';
            return filter1Selected.has(val);
        });
        console.log('筛选器1后剩余行数:', filtered.length);
    }
    
    // 筛选器2（第二显示列）
    if (filter2Selected && filter2Selected.size > 0 && displayCols[1] !== undefined) {
        const colIdx = displayCols[1];
        filtered = filtered.filter(row => {
            let val = row.cells[colIdx] || '';
            if (val === '') val = '(空)';
            return filter2Selected.has(val);
        });
        console.log('筛选器2后剩余行数:', filtered.length);
    }
    
    // 搜索（在所有显示的列中搜索）
    if (searchKeyword && searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase().trim();
        filtered = filtered.filter(row => {
            // 在所有显示的列中搜索
            for (const colIdx of displayCols) {
                const val = (row.cells[colIdx] || '').toLowerCase();
                if (val.includes(kw)) return true;
            }
            return false;
        });
        console.log('搜索后剩余行数:', filtered.length);
    }
    
    return filtered;
}