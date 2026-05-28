// ==================== 表格渲染 ====================
function getHeaderRow(sheet) {
    if (!sheet || sheet.rows.length === 0) return [];
    return sheet.rows[0].cells;
}
function getDisplayHeaders(sheet, displayCols) {
    var headers = getHeaderRow(sheet);
    var result = [];
    for (var i = 0; i < displayCols.length; i++) {
        var colIdx = displayCols[i];
        var header = (headers[colIdx] !== undefined && headers[colIdx] !== '') ? headers[colIdx] : '列' + (colIdx + 1);
        result.push(header);
    }
    return result;
}
function isCodeContent(str) {
    if (!str) return false;
    var codePattern = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$|^\d{2}-\d{2}-\d{2}-\d{2}$|^\d+-\d+-\d+-\d+$|^[A-Za-z0-9]{3,}$|^\d+$|^[A-Za-z]+$)/i;
    return codePattern.test(str.trim());
}
function renderTable(containerId, headers, displayRows, selectedRowId, searchKeyword, totalCount, displayLimit) {
    if (displayLimit === undefined) displayLimit = 200;
    var container = document.getElementById(containerId);
    if (!container) {
        return { totalCount: 0, isTruncated: false };
    }
    
    if (!headers || headers.length === 0 || !displayRows || displayRows.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无数据</div>';
        return { totalCount: 0, isTruncated: false };
    }
    
    var showRows = displayRows.slice(0, displayLimit);
    var isTruncated = totalCount > displayLimit;
    
    var html = '<div class="result-table-wrapper">';
    html += '<table class="result-table">';
    html += '<thead>';
    html += '<tr>';
    for (var i = 0; i < headers.length; i++) {
        var h = headers[i];
        html += '<th>' + (h || '') + '</th>';
    }
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';
    
    for (var r = 0; r < showRows.length; r++) {
        var row = showRows[r];
        var rowId = row.rowId;
        var isSelected = (selectedRowId === rowId);
        var rowStyle = isSelected ? 'background: rgba(30,136,229,0.2);' : '';
        html += '<tr style="' + rowStyle + '" data-rowid="' + escapeHtml(rowId || '') + '">';
        
        for (var c = 0; c < row.cells.length; c++) {
            var cellValue = row.cells[c] || '';
            var displayValue = cellValue;
            
            if (searchKeyword && searchKeyword.trim()) {
                var kw = searchKeyword.toLowerCase();
                var val = String(cellValue).toLowerCase();
                if (val.indexOf(kw) !== -1) {
                    var regex = new RegExp('(' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
                    displayValue = String(cellValue).replace(regex, '<mark style="background:#ffeb3b;color:#000;padding:0 2px;">$1</mark>');
                } else {
                    displayValue = escapeHtml(cellValue);
                }
            } else {
                displayValue = escapeHtml(cellValue);
            }
            
            var dataTypeAttr = isCodeContent(cellValue) ? ' data-type="code"' : '';
            html += '<td' + dataTypeAttr + ' data-col="' + c + '">' + displayValue + '</td>';
        }
        html += '</tr>';
    }
    
    html += '</tbody>';
    html += '</table>';
    html += '</div>';
    
    container.innerHTML = html;
    
    return { totalCount: totalCount, isTruncated: isTruncated };
}
function updateStatTip(statTipId, totalCount, isTruncated) {
    var el = document.getElementById(statTipId);
    if (!el) return;
    var msg = '共筛选出 ' + totalCount + ' 条数据';
    if (isTruncated) msg = msg + '（仅显示前 200 条）';
    el.innerHTML = msg;
}
function bindTableEvents(onRowSelect, onCellEdit) {
    var rows = document.querySelectorAll('.result-table tbody tr');
    
    for (var i = 0; i < rows.length; i++) {
        var tr = rows[i];
        
        tr.onclick = (function(t) {
            return function(e) {
                var rowId = t.getAttribute('data-rowid');
                if (rowId && onRowSelect) {
                    onRowSelect(rowId);
                    if (e) e.stopPropagation();
                }
            };
        })(tr);
        
        tr.ondblclick = (function(t) {
            return function(e) {
                var td = e.target.closest ? e.target.closest('td') : (function(el) {
                    while (el && el.tagName !== 'TD') el = el.parentNode;
                    return el;
                })(e.target);
                if (!td) return;
                var rowId = t.getAttribute('data-rowid');
                var colIndex = parseInt(td.getAttribute('data-col'));
                if (rowId && !isNaN(colIndex) && onCellEdit) {
                    onCellEdit(rowId, colIndex);
                }
            };
        })(tr);
    }
}