export function renderLogsHtml(logs = []) {
    return logs.map(log => {
        const sentAt = log.sentAt ? log.sentAt.toDate().toLocaleString('vi-VN') : 'Không rõ';
        const icon = log.type === 'email'
            ? '<i class="fa-solid fa-envelope text-sky-600"></i>'
            : '<i class="fa-solid fa-comment-sms text-green-600"></i>';

        return `
            <div class="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <div class="flex justify-between items-start gap-4">
                    <div>
                        <div class="flex items-center gap-3 mb-2">
                            <span class="font-bold text-slate-800">${log.studentName}</span>
                            <span class="text-xs bg-slate-100 font-semibold px-2 py-0.5 rounded text-slate-600">MSSV: ${log.studentId}</span>
                        </div>
                        <p class="text-xs text-slate-500">
                            ${icon} <span class="font-medium">${log.recipient}</span> • Gửi bởi: <span class="font-semibold">${log.sentBy_name}</span> • Lúc: ${sentAt}
                        </p>
                    </div>
                    <span class="text-xs font-bold px-2.5 py-1 rounded-lg ${log.type === 'email' ? 'bg-sky-50 text-sky-700' : 'bg-green-50 text-green-700'}">${log.type === 'email' ? 'EMAIL' : 'TIN NHẮN'}</span>
                </div>
                <div class="mt-4 pt-4 border-t border-slate-100">
                    <p class="text-sm font-semibold text-slate-700">${log.subject}</p>
                    <pre class="mt-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap font-mono custom-scrollbar max-h-40 overflow-y-auto">${log.body}</pre>
                </div>
            </div>
        `;
    }).join('');
}
