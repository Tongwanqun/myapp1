// ==================== 数据库层 (IndexedDB) ====================

const DB_NAME = 'DataFastSearch';
const DB_VERSION = 12;
let db = null;

function initDatabase() {
    return new Promise(function(resolve, reject) {
        if (db && db.name === DB_NAME) {
            resolve(db);
            return;
        }
        
        console.log('开始初始化数据库...');
        var request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = function(event) {
            console.error('数据库打开失败:', event.target.error);
            reject(event.target.error);
        };
        
        request.onsuccess = function(event) {
            db = event.target.result;
            console.log('数据库打开成功');
            
            if (!db.objectStoreNames.contains('tables')) {
                console.error('tables 存储不存在');
                reject(new Error('tables 存储不存在'));
                return;
            }
            
            resolve(db);
        };
        
        request.onupgradeneeded = function(event) {
            var database = event.target.result;
            console.log('创建数据库结构...');
            
            if (!database.objectStoreNames.contains('tables')) {
                var store = database.createObjectStore('tables', { keyPath: 'id' });
                store.createIndex('name', 'name', { unique: false });
                store.createIndex('updatedAt', 'updatedAt', { unique: false });
                console.log('tables 存储创建成功');
            }
        };
    });
}

async function saveTable(tableData) {
    var database = await initDatabase();
    tableData.updatedAt = Date.now();
    
    return new Promise(function(resolve, reject) {
        var transaction = database.transaction(['tables'], 'readwrite');
        var store = transaction.objectStore('tables');
        var request = store.put(tableData);
        
        request.onsuccess = function() { resolve(request.result); };
        request.onerror = function() { reject(request.error); };
    });
}

async function loadAllTables() {
    var database = await initDatabase();
    
    return new Promise(function(resolve, reject) {
        var transaction = database.transaction(['tables'], 'readonly');
        var store = transaction.objectStore('tables');
        var request = store.getAll();
        
        request.onsuccess = function() {
            var result = request.result || [];
            console.log('加载表格成功, 数量:', result.length);
            resolve(result);
        };
        request.onerror = function() {
            console.error('loadAllTables错误:', request.error);
            resolve([]);
        };
    });
}

async function loadTableById(id) {
    var database = await initDatabase();
    
    return new Promise(function(resolve, reject) {
        var transaction = database.transaction(['tables'], 'readonly');
        var store = transaction.objectStore('tables');
        var request = store.get(id);
        
        request.onsuccess = function() { resolve(request.result || null); };
        request.onerror = function() { reject(request.error); };
    });
}

async function deleteTableById(id) {
    var database = await initDatabase();
    
    return new Promise(function(resolve, reject) {
        var transaction = database.transaction(['tables'], 'readwrite');
        var store = transaction.objectStore('tables');
        var request = store.delete(id);
        
        request.onsuccess = function() { resolve(); };
        request.onerror = function() { reject(request.error); };
    });
}

function workbookToModel(workbook, tableName) {
    var tableId = generateId();
    var sheets = [];
    
    if (!workbook.SheetNames) {
        console.error('workbook没有SheetNames');
        return null;
    }
    
    for (var s = 0; s < workbook.SheetNames.length; s++) {
        var sheetName = workbook.SheetNames[s];
        try {
            var sheet = workbook.Sheets[sheetName];
            var rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
            
            if (!rawData || rawData.length === 0) {
                sheets.push({ id: generateId(), name: sheetName, rows: [] });
                continue;
            }
            
            var rows = [];
            for (var i = 0; i < rawData.length; i++) {
                var rowData = rawData[i];
                var cells = [];
                for (var j = 0; j < rowData.length; j++) {
                    cells.push(rowData[j] === undefined ? '' : String(rowData[j]));
                }
                rows.push({
                    rowId: generateId(),
                    cells: cells
                });
            }
            
            sheets.push({
                id: generateId(),
                name: sheetName,
                rows: rows
            });
        } catch (err) {
            console.error('处理sheet错误:', sheetName, err);
        }
    }
    
    return {
        id: tableId,
        name: tableName,
        sheets: sheets,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
}

function getSheetMaxCols(sheet) {
    if (!sheet || !sheet.rows) return 0;
    var max = 0;
    for (var i = 0; i < sheet.rows.length; i++) {
        var row = sheet.rows[i];
        if (row.cells && row.cells.length > max) max = row.cells.length;
    }
    return max;
}

async function openDatabase() {
    return await initDatabase();
}