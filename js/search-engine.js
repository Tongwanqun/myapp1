// ==================== 搜索引擎 ====================

// 在筛选结果中搜索（只搜索当前显示的列）
function searchInFilteredRows(rows, displayCols, keyword) {
    if (!keyword || !keyword.trim()) {
        return rows;
    }
    
    const kw = keyword.toLowerCase().trim();
    return rows.filter(row => {
        // 只在用户选择的显示列中搜索
        for (const colIdx of displayCols) {
            const cellValue = (row.cells[colIdx] || '').toLowerCase();
            if (cellValue.includes(kw)) {
                return true;
            }
        }
        return false;
    });
}

// 高亮搜索结果（返回带高亮标记的HTML）
function highlightSearchText(text, keyword) {
    if (!keyword || !keyword.trim() || !text) {
        return escapeHtml(text);
    }
    
    const kw = keyword.toLowerCase().trim();
    const str = String(text);
    if (!str.toLowerCase().includes(kw)) {
        return escapeHtml(str);
    }
    
    // 使用正则替换，不区分大小写
    const regex = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escapeHtml(str).replace(regex, '<mark style="background:#ffeb3b; color:#000;">$1</mark>');
}

// 获取搜索建议（基于当前显示列）
function getSearchSuggestions(rows, displayCols, partialKeyword, maxSuggestions = 10) {
    if (!partialKeyword || partialKeyword.length < 1) {
        return [];
    }
    
    const kw = partialKeyword.toLowerCase();
    const suggestions = new Set();
    
    for (const row of rows) {
        for (const colIdx of displayCols) {
            const val = (row.cells[colIdx] || '').toLowerCase();
            if (val.includes(kw) && val.length > 0) {
                suggestions.add(val);
                if (suggestions.size >= maxSuggestions) break;
            }
        }
        if (suggestions.size >= maxSuggestions) break;
    }
    
    return Array.from(suggestions);
}