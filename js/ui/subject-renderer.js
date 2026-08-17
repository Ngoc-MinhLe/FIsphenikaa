export function renderSubjectsTabView({ globalData, normalizeText }) {
    if (globalData.students.length === 0) return;

    const searchQuery = normalizeText(document.getElementById('subjectSearchInput').value);
    const container = document.getElementById('subjectsGridContainer');
    const subjectKeys = Object.keys(globalData.subjectsMap);
    const filteredKeys = subjectKeys.filter(key => normalizeText(key).includes(searchQuery));

    document.getElementById('subjectCounterText').innerText = `Tổng số ${filteredKeys.length} môn học`;

    if (filteredKeys.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 bg-white rounded-3xl border border-slate-100">
                <i class="fa-solid fa-book-open-reader text-4xl text-slate-300 mb-3"></i>
                <p class="text-slate-500 font-medium">Không tìm thấy môn học nào phù hợp.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredKeys.map(key => {
        const subject = globalData.subjectsMap[key];
        const hasDebts = subject.totalDebts > 0;

        return `
            <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                    <div class="flex items-start justify-between gap-2 mb-3">
                        <h4 class="font-bold text-slate-800 text-sm leading-snug line-clamp-2">${subject.name}</h4>
                        <span class="px-2.5 py-1 rounded-xl text-xs font-bold ${hasDebts ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}">
                            ${subject.totalDebts} SV nợ
                        </span>
                    </div>
                </div>

                <div class="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <span class="text-xs text-slate-500">${hasDebts ? 'Cần tổ chức thi/học lại' : 'Tất cả SV đã đạt'}</span>
                    <div class="flex items-center gap-2">
                        ${hasDebts ? `
                            <button onclick="exportSubjectStudentsToExcel('${encodeURIComponent(subject.name)}')" class="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl transition-colors" title="Xuất Excel danh sách sinh viên môn này"><i class="fa-solid fa-file-excel"></i></button>
                            <button onclick="openSendModal(null, '${encodeURIComponent(subject.name)}')" class="text-xs font-semibold text-sky-600 hover:text-sky-800 bg-sky-50 px-3 py-1.5 rounded-xl transition-colors" title="Gửi thông báo cho SV nợ môn này"><i class="fa-solid fa-paper-plane"></i></button>
                            <button onclick="openSubjectModal('${encodeURIComponent(subject.name)}')" class="text-xs font-bold text-brand-700 hover:text-brand-800 bg-brand-50 px-3 py-1.5 rounded-xl transition-colors">
                                Xem danh sách SV <i class="fa-solid fa-arrow-right ml-1"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

export function openSubjectModalView(globalData, encodedName) {
    const name = decodeURIComponent(encodedName);
    const subject = globalData.subjectsMap[name];
    if (!subject) return;

    document.getElementById('modalSubjectName').innerText = subject.name;
    document.getElementById('modalSubjectSubtitle').innerText = `Tổng cộng: ${subject.totalDebts} sinh viên đang nợ môn này`;

    const modalList = document.getElementById('modalStudentList');
    modalList.innerHTML = subject.debtStudents.map((student, index) => `
        <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
            <div>
                <div class="font-bold text-slate-800">${index + 1}. ${student.name}</div>
                <div class="text-slate-500 mt-0.5">MSSV: ${student.id} • Lớp: ${student.className}</div>
            </div>
            <div class="text-right">
                <span class="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 font-bold">${student.reason}</span>
            </div>
        </div>
    `).join('');

    document.getElementById('subjectDetailModal').classList.remove('hidden');
}

export function closeSubjectModalView() {
    document.getElementById('subjectDetailModal').classList.add('hidden');
}
