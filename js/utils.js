// ==================== 工具函数 ====================

function showToast(msg) {
    var toast = document.querySelector('.toast');
    if (toast) toast.remove();
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 2000);
}

function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    var s = String(str);
    return s.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function generateId() {
    return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// ========== 通用自定义确认对话框（带确定/取消按钮） ==========
function showConfirmDialog(message, onConfirm, onCancel) {
    // 创建遮罩层
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    
    // 创建弹窗内容
    var modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.style.maxWidth = '280px';
    
    var header = document.createElement('div');
    header.className = 'modal-header';
    header.innerText = '提示';
    
    var body = document.createElement('div');
    body.className = 'modal-body';
    body.style.textAlign = 'center';
    body.style.padding = '16px';
    body.innerText = message;
    
    var footer = document.createElement('div');
    footer.className = 'modal-footer';
    
    var cancelBtn = document.createElement('button');
    cancelBtn.innerText = '取消';
    cancelBtn.className = 'btn-secondary';
    cancelBtn.onclick = function() {
        document.body.removeChild(overlay);
        if (onCancel) onCancel();
    };
    
    var confirmBtn = document.createElement('button');
    confirmBtn.innerText = '确认';
    confirmBtn.className = 'btn-primary';
    confirmBtn.onclick = function() {
        document.body.removeChild(overlay);
        if (onConfirm) onConfirm();
    };
    
    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}