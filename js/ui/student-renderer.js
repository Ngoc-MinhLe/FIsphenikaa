export function renderStudentsTabView({ globalData, normalizeText }) {
    if (globalData.students.length === 0) return;

    const searchQuery = normalizeText(document.getElementById('studentSearchInput').value);
    const classFilter = document.getElementById('classFilterSelect').value;
    const debtFilter = document.getElementById('debtFilterSelect').value;
    const container = document.getElementById('studentsListContainer');

    const filteredStudents = globalData.students.filter(student => {
        const matchClass = classFilter === 'ALL' || student.className === classFilter;
        const matchSearch = searchQuery === '' ||
            normalizeText(student.name).includes(searchQuery) ||
            normalizeText(student.id).includes(searchQuery);

        let matchDebt = true;
        if (debtFilter === 'HAS_DEBT') matchDebt = student.debts.length > 0;
        else if (debtFilter === 'NO_DEBT') matchDebt = student.debts.length === 0;

        return matchClass && matchSearch && matchDebt;
    });

    if (filteredStudents.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 bg-white rounded-3xl border border-slate-100">
                <i class="fa-solid fa-user-slash text-4xl text-slate-300 mb-3"></i>
                <p class="text-slate-500 font-medium">Không tìm thấy sinh viên nào phù hợp bộ lọc.</p>
            </div>
        `;
        return;
    }

    const hasFramework = globalData.frameworkCourses.length > 0;

    container.innerHTML = filteredStudents.map((student, index) => {
        const hasDebt = student.debts.length > 0;
        const statusBadge = hasDebt
            ? `<span class="px-3 py-1 rounded-full bg-rose-100 text-rose-700 font-bold text-xs"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Nợ ${student.debts.length} môn</span>`
            : `<span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs"><i class="fa-solid fa-check mr-1"></i>Đạt / Sạch nợ</span>`;

        const debtsListHTML = hasDebt
            ? student.debts.map(debt => `
                <div class="flex items-center justify-between p-3 bg-rose-50/60 rounded-xl border border-rose-100 text-xs">
                    <div>
                        <span class="font-bold text-slate-800">${debt.subjectName}</span>
                        <div class="text-rose-600 mt-0.5">Trạng thái: ${debt.reason}</div>
                    </div>
                    <div class="text-right">
                        <span class="font-bold text-rose-700 bg-white px-2.5 py-1 rounded-lg border border-rose-200">
                            TKHP: ${debt.tkhp !== null && debt.tkhp !== undefined ? debt.tkhp : '-'} (${debt.diemChu || '-'})
                        </span>
                    </div>
                </div>
            `).join('')
            : '';

        return `
            <div class="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-2xl ${hasDebt ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'} flex items-center justify-center text-lg font-bold">
                            ${student.name.charAt(0)}
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h4 class="font-bold text-slate-800 text-base">${student.name}</h4>
                                <span class="text-xs bg-slate-100 font-semibold px-2 py-0.5 rounded text-slate-600">MSSV: ${student.id}</span>
                            </div>
                            <p class="text-xs text-slate-500 mt-1">
                                <i class="fa-solid fa-school mr-1 text-slate-400"></i>${student.className}
                                ${student.email ? `• <i class="fa-solid fa-envelope ml-2 mr-1 text-slate-400"></i>${student.email}` : ''}
                                ${student.dob ? `• <i class="fa-solid fa-cake-candles ml-2 mr-1 text-slate-400"></i>${student.dob}` : ''}
                            </p>
                        </div>
                    </div>

                    <div class="flex items-center justify-between md:justify-end gap-2.5 border-t md:border-t-0 pt-3 md:pt-0">
                        ${statusBadge}
                        <button onclick="openPlannerModal('${student.id}')" class="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5" ${hasFramework ? '' : 'disabled title="Vui lòng tải lên Khung chương trình" style="opacity: 0.5; cursor: not-allowed;"'}>
                            <i class="fa-solid fa-map-location-dot"></i>
                            <span>Lộ trình & Kế hoạch</span>
                        </button>
                        ${hasDebt ? `
                            <button onclick="openSendModal('${student.id}')" class="text-xs font-semibold text-sky-600 hover:text-sky-800 bg-sky-50 px-3 py-1.5 rounded-xl transition-colors" title="Gửi thông báo nợ môn">
                                <i class="fa-solid fa-paper-plane"></i>
                            </button>
                            <button onclick="toggleAccordion('debt-acc-${index}')" class="text-xs font-bold text-brand-700 hover:text-brand-800 bg-brand-50 px-3 py-1.5 rounded-xl transition-colors">
                                Chi tiết nợ <i class="fa-solid fa-chevron-down ml-1"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>

                ${hasDebt ? `
                    <div id="debt-acc-${index}" class="hidden mt-4 pt-4 border-t border-slate-100 space-y-2">
                        ${debtsListHTML}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

export function toggleAccordionView(id) {
    const element = document.getElementById(id);
    if (element) element.classList.toggle('hidden');
}
