// ==================== 文件管理（导入/导出/备份） ====================

// 工具函数：Blob 转 Base64
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function importExcelFile(onSuccess, onError) {
    console.log('导入函数被调用');
    
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    
    input.onchange = function(e) {
        console.log('文件已选择');
        var file = e.target.files[0];
        if (!file) {
            console.log('没有选择文件');
            return;
        }
        
        console.log('文件名:', file.name);
        
        var loadingTip = document.getElementById('loadingTip');
        if (loadingTip) loadingTip.style.display = 'block';
        
        var reader = new FileReader();
        reader.onload = function(ev) {
            console.log('文件读取完成');
            try {
                var data = new Uint8Array(ev.target.result);
                console.log('数据长度:', data.length);
                
                if (typeof XLSX === 'undefined') {
                    alert('XLSX库未加载，请刷新页面重试');
                    if (loadingTip) loadingTip.style.display = 'none';
                    return;
                }
                
                var workbook = XLSX.read(data, { type: 'array' });
                console.log('workbook读取成功, 子表数:', workbook.SheetNames.length);
                
                var baseName = file.name.replace(/\.(xlsx|xls|csv)$/i, '');
                console.log('表格名:', baseName);
                
                (async function() {
                    try {
                        await initDatabase();
                        console.log('数据库已就绪');
                        
                        var existingTables = await loadAllTables();
                        console.log('已有表格数:', existingTables.length);
                        
                        var tableName = baseName;
                        var exists = existingTables.some(function(t) { return t.name === tableName; });
                        
                        if (exists) {
                            // 使用自定义确认框（确认/取消）
                            showConfirmDialog('表格 "' + tableName + '" 已存在，是否导入为副本？', async function() {
                                var newName = baseName;
                                var i = 1;
                                while (existingTables.some(function(t) { return t.name === newName; })) {
                                    newName = baseName + '_' + i;
                                    i++;
                                }
                                tableName = newName;
                                console.log('使用新名称:', tableName);
                                
                                var tableModel = workbookToModel(workbook, tableName);
                                if (!tableModel) {
                                    throw new Error('转换数据模型失败');
                                }
                                
                                console.log('表格模型创建成功, sheets数:', tableModel.sheets.length);
                                await saveTable(tableModel);
                                console.log('保存成功');
                                
                                showToast('✅ 导入成功！共 ' + tableModel.sheets.length + ' 个子表');
                                if (onSuccess) onSuccess(tableModel);
                                if (loadingTip) loadingTip.style.display = 'none';
                            }, function() {
                                console.log('用户取消导入');
                                if (loadingTip) loadingTip.style.display = 'none';
                            });
                            return;
                        }
                        
                        var tableModel = workbookToModel(workbook, tableName);
                        if (!tableModel) {
                            throw new Error('转换数据模型失败');
                        }
                        
                        console.log('表格模型创建成功, sheets数:', tableModel.sheets.length);
                        await saveTable(tableModel);
                        console.log('保存成功');
                        
                        showToast('✅ 导入成功！共 ' + tableModel.sheets.length + ' 个子表');
                        if (onSuccess) onSuccess(tableModel);
                        
                    } catch (err) {
                        console.error('保存错误:', err);
                        alert('❌ 保存失败: ' + err.message);
                        if (onError) onError(err);
                    } finally {
                        if (loadingTip && !exists) loadingTip.style.display = 'none';
                    }
                })();
                
            } catch (err) {
                console.error('解析错误:', err);
                alert('❌ 导入失败：文件格式不支持或损坏\n' + err.message);
                if (loadingTip) loadingTip.style.display = 'none';
                if (onError) onError(err);
            }
        };
        
        reader.onerror = function() {
            console.error('文件读取错误');
            alert('文件读取失败');
            if (loadingTip) loadingTip.style.display = 'none';
            if (onError) onError();
        };
        
        reader.readAsArrayBuffer(file);
    };
    
    input.click();
    console.log('文件选择框已弹出');
}

// ==================== 导出 Excel（支持 Capacitor 原生保存） ====================
async function exportToExcel(headers, displayRows, fileName) {
    console.log('=== 导出开始 ===');
    
    if (!headers || headers.length === 0) {
        showToast('没有表头数据，无法导出');
        return;
    }
    
    if (!displayRows || displayRows.length === 0) {
        showToast('没有数据可导出');
        return;
    }
    
    try {
        var exportData = [headers];
        
        for (var i = 0; i < displayRows.length; i++) {
            var row = displayRows[i];
            if (row.cells) {
                exportData.push(row.cells);
            } else if (Array.isArray(row)) {
                exportData.push(row);
            } else {
                exportData.push([]);
            }
        }
        
        if (typeof XLSX === 'undefined') {
            showToast('XLSX库未加载');
            return;
        }
        
        var ws = XLSX.utils.aoa_to_sheet(exportData);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '筛选结果');
        
        var excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        var blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        var now = new Date();
        var dateStr = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
        var defaultFileName = fileName + '_筛选结果_' + dateStr + '.xlsx';
        
        // 检查是否在 Capacitor 原生环境
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            try {
                // 使用 Capacitor 文件保存（弹出系统保存对话框）
                const { CapawesomeFilePicker } = await import('@capawesome/capacitor-file-picker');
                const base64 = await blobToBase64(blob);
                
                // 调用原生文件选择器，让用户选择保存位置
                const result = await CapawesomeFilePicker.saveFile({
                    data: base64,
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    fileName: defaultFileName
                });
                
                if (result && result.filePath) {
                    showToast('✅ 导出成功！');
                } else {
                    showToast('✅ 导出成功');
                }
            } catch (capErr) {
                console.warn('CapawesomeFilePicker 失败，尝试备用方案', capErr);
                // 备用方案：写入 Documents 目录
                const { Filesystem } = await import('@capacitor/filesystem');
                const base64 = await blobToBase64(blob);
                await Filesystem.writeFile({
                    path: defaultFileName,
                    data: base64,
                    directory: 'Documents'
                });
                showToast('✅ 导出成功，文件保存在 Documents 目录');
            }
        } else {
            // 浏览器环境：原有下载方式
            XLSX.writeFile(wb, defaultFileName);
            showToast('✅ 导出成功！');
        }
        
    } catch (err) {
        console.error('导出错误:', err);
        showToast('❌ 导出失败: ' + err.message);
    }
}

// ==================== 导出备份（支持 Capacitor 原生保存） ====================
async function exportBackup() {
    try {
        await initDatabase();
        var tables = await loadAllTables();
        var backupStr = JSON.stringify(tables, null, 2);
        var blob = new Blob([backupStr], { type: 'application/json' });
        var defaultFileName = '表格备份_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.json';
        
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            try {
                const { CapawesomeFilePicker } = await import('@capawesome/capacitor-file-picker');
                const base64 = await blobToBase64(blob);
                
                const result = await CapawesomeFilePicker.saveFile({
                    data: base64,
                    mimeType: 'application/json',
                    fileName: defaultFileName
                });
                
                if (result && result.filePath) {
                    showToast('✅ 备份导出成功！');
                } else {
                    showToast('✅ 备份导出成功');
                }
            } catch (capErr) {
                console.warn('CapawesomeFilePicker 失败，尝试备用方案', capErr);
                const { Filesystem } = await import('@capacitor/filesystem');
                const base64 = await blobToBase64(blob);
                await Filesystem.writeFile({
                    path: defaultFileName,
                    data: base64,
                    directory: 'Documents'
                });
                showToast('✅ 备份导出成功，文件保存在 Documents 目录');
            }
        } else {
            // 浏览器环境：原有下载方式
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = defaultFileName;
            a.click();
            URL.revokeObjectURL(url);
            showToast('✅ 备份导出成功');
        }
        
    } catch (err) {
        console.error('备份错误:', err);
        showToast('❌ 备份失败: ' + err.message);
    }
}

function importBackup(onSuccess) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async function(e) {
        var file = e.target.files[0];
        if (!file) return;
        
        var reader = new FileReader();
        reader.onload = async function(ev) {
            try {
                var imported = JSON.parse(ev.target.result);
                if (Array.isArray(imported)) {
                    await initDatabase();
                    for (var i = 0; i < imported.length; i++) {
                        var table = imported[i];
                        if (table.id && table.name && table.sheets) {
                            await saveTable(table);
                        }
                    }
                    showToast('✅ 恢复备份成功');
                    if (onSuccess) onSuccess();
                } else {
                    alert('备份文件格式错误');
                }
            } catch (e) {
                console.error('解析错误:', e);
                alert('解析备份文件失败');
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

// 复制结果到剪贴板（去掉 alert，改用 toast）
async function copyResultToClipboard(headers, displayRows) {
    if (!displayRows || displayRows.length === 0) {
        showToast('没有数据可复制');
        return;
    }
    
    var text = '';
    for (var i = 0; i < displayRows.length; i++) {
        var row = displayRows[i];
        text += '【记录 ' + (i + 1) + '】\n';
        for (var j = 0; j < headers.length; j++) {
            var header = headers[j];
            var value = row.cells[j] || '';
            text += header + ': ' + value + '\n';
        }
        if (i < displayRows.length - 1) {
            text += '\n';
        }
    }
    
    try {
        await navigator.clipboard.writeText(text);
        showToast(`✅ 已复制 ${displayRows.length} 条记录`);
    } catch (e) {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast(`✅ 已复制 ${displayRows.length} 条记录`);
    }
}