export function showCustomMessage(msg, type = 'info', documentRef = document) {
    let toast = documentRef.getElementById('customToast');
    if (!toast) {
        toast = documentRef.createElement('div');
        toast.id = 'customToast';
        toast.className = 'fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 transition-all duration-300 transform translate-y-10 opacity-0';
        documentRef.body.appendChild(toast);
    }

    const icon = type === 'error'
        ? 'fa-circle-xmark text-rose-400'
        : type === 'success'
            ? 'fa-circle-check text-emerald-400'
            : 'fa-circle-info text-indigo-400';

    toast.innerHTML = `<i class="fa-solid ${icon} text-lg"></i> <span class="text-sm font-medium">${msg}</span>`;
    toast.classList.remove('translate-y-10', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
    }, 4000);
}
