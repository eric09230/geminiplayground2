// 前面的代碼保持不變...

function logMessage(message, type = 'system') {
    // 如果是系統訊息且設定為不顯示，則直接返回
    if (type === 'system' && !showSystemMessages.checked) {
        return;
    }

    const logEntry = document.createElement('div');
    logEntry.classList.add('log-entry', type);

    const timestamp = document.createElement('span');
    timestamp.classList.add('timestamp');
    timestamp.textContent = new Date().toLocaleTimeString();
    logEntry.appendChild(timestamp);

    const emoji = document.createElement('span');
    emoji.classList.add('emoji');
    switch (type) {
        case 'system':
            emoji.textContent = '⚙️';
            break;
        case 'user':
            emoji.textContent = '🫵';
            break;
        case 'ai':
            emoji.textContent = '🤖';
            break;
    }
    logEntry.appendChild(emoji);

    const messageText = document.createElement('span');
    messageText.textContent = message;
    logEntry.appendChild(messageText);

    logsContainer.appendChild(logEntry);
    
    // 使用 requestAnimationFrame 確保在DOM更新後再滾動
    requestAnimationFrame(() => {
        logEntry.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
}

// 其餘代碼保持不變...