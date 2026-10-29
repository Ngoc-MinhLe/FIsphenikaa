
const GROUP_META = {
    green: { label: 'Xanh · Đúng hạn', description: 'Không còn nợ học phần hoặc tín chỉ', classes: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    yellow: { label: 'Vàng · Có khả năng đúng hạn', description: 'Còn thiếu 2–3 học phần', classes: 'bg-amber-50 text-amber-700 border-amber-100' },
    red: { label: 'Đỏ · Cần hỗ trợ', description: 'Các trường hợp còn lại', classes: 'bg-rose-50 text-rose-700 border-rose-100' }
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatNumber(value, digits = 0) {
    return Number(value || 0).toLocaleString('vi-VN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

function renderGroupCards(summary) {
    return ['green', 'yellow', 'red'].map(group => {
        const meta = GROUP_META[group];
        return `
            <div class="rounded-2xl border ${meta.classes} p-4">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="text-xs font-extrabold uppercase tracking-wider">Nhóm ${meta.label}</div>
                        <div class="mt-1 text-[11px] opacity-80">${meta.description}</div>
                    </div>
                    <div class="text-2xl font-black">${formatNumber(summary[group])}</div>
                </div>
            </div>`;
    }).join('');
}

function renderFacultyRows(report) {
    return report.faculties.map(item => `
        <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50">
            <td class="px-4 py-3 font-bold text-slate-800">${escapeHtml(item.faculty)}</td>
            <td class="px-4 py-3 text-center font-semibold">${formatNumber(item.total)}</td>
            <td class="px-4 py-3 text-center text-emerald-700 font-bold">${formatNumber(item.green)}</td>
            <td class="px-4 py-3 text-center text-amber-700 font-bold">${formatNumber(item.yellow)}</td>
            <td class="px-4 py-3 text-center text-rose-700 font-bold">${formatNumber(item.red)}</td>
            <td class="px-4 py-3 text-center text-slate-600">${formatNumber(item.averageMissingCredits, 1)}</td>
            <td class="px-4 py-3 text-center text-slate-600">${formatNumber(item.averageMissingCourses, 1)}</td>
        </tr>`).join('');
}

function normalizeDetailType(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[Đđ]/g, 'd')
        .toLocaleLowerCase('vi');
}

function getDetailKind(detail) {
    const type = normalizeDetailType(detail.courseType);
    if (type.includes('bat buoc')) return 'mandatory';
    if (type.includes('dieu kien')) return 'condition';
    return 'elective';
}

function renderSupportDetailSection(title, details, student, { mandatory = false } = {}) {
    if (!details.length) return '';
    const grouped = new Map();
    details.forEach(detail => {
        const block = detail.blockCode || 'Khác';
        if (!grouped.has(block)) grouped.set(block, []);
        grouped.get(block).push(detail);
    });

    const blocks = [...grouped.entries()].map(([block, blockDetails]) => {
        const requiredCredits = Number(student.missingCreditsByBlock?.[block] || 0);
        const blockNote = requiredCredits > 0 ? ` · cần đạt thêm ${formatNumber(requiredCredits)} TC` : '';
        const items = [...blockDetails]
            .sort((a, b) => String(a.courseName).localeCompare(String(b.courseName), 'vi'))
            .map(detail => `
                <li class="${mandatory ? 'font-bold text-slate-800' : 'text-slate-600'}">
                    ${detail.courseCode ? `<span class="mr-1 text-slate-400">${escapeHtml(detail.courseCode)}</span>` : ''}
                    ${escapeHtml(detail.courseName)}
                    <span class="ml-1 font-normal text-slate-400">(${formatNumber(detail.credits)} TC)</span>
                </li>`).join('');
        return `<div class="mt-2"><div class="text-[11px] font-bold uppercase tracking-wide text-slate-500">${escapeHtml(block)}${blockNote}</div><ul class="mt-1 space-y-1">${items}</ul></div>`;
    }).join('');

    return `<section class="rounded-lg border border-slate-100 bg-white/70 p-2"><div class="text-xs font-extrabold ${mandatory ? 'text-rose-700' : 'text-slate-700'}">${title} (${details.length})</div>${blocks}</section>`;
}

const FACULTY_PAGE_SIZE = 20;

function renderFacultyPagination(page, totalPages) {
    if (totalPages <= 1) return '';
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    const pageButtons = [];
    for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
        pageButtons.push(`<button type="button" data-faculty-page="${pageNumber}" class="rounded-lg px-3 py-1.5 text-xs font-bold ${pageNumber === page ? 'bg-brand-700 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}">${pageNumber}</button>`);
    }
    return `<div id="facultyPagination" class="mt-4 flex flex-wrap items-center justify-between gap-3"><span class="text-xs text-slate-500">Trang ${page}/${totalPages}</span><div class="flex items-center gap-1"><button type="button" data-faculty-page="${Math.max(1, page - 1)}" class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ${page === 1 ? 'pointer-events-none opacity-40' : ''}">Trước</button>${pageButtons.join('')}<button type="button" data-faculty-page="${Math.min(totalPages, page + 1)}" class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ${page === totalPages ? 'pointer-events-none opacity-40' : ''}">Sau</button></div></div>`;
}

function renderStudentRows(report, search, facultyFilter, groupFilter, requestedPage = 1) {
    const query = String(search || '').trim().toLocaleLowerCase('vi');
    const filtered = report.records.filter(student => {
        const matchesSearch = !query || [student.id, student.name, student.className, student.faculty]
            .some(value => String(value || '').toLocaleLowerCase('vi').includes(query));
        const matchesFaculty = facultyFilter === 'ALL' || student.faculty === facultyFilter;
        const matchesGroup = groupFilter === 'ALL' || student.group === groupFilter;
        return matchesSearch && matchesFaculty && matchesGroup;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / FACULTY_PAGE_SIZE));
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    const pageRecords = filtered.slice((page - 1) * FACULTY_PAGE_SIZE, page * FACULTY_PAGE_SIZE);
    const rows = pageRecords.map((student, index) => {
        const meta = GROUP_META[student.group];
        const details = student.missingCourseDetails || [];
        const mandatoryDetails = details.filter(detail => getDetailKind(detail) === 'mandatory');
        const conditionDetails = details.filter(detail => getDetailKind(detail) === 'condition');
        const electiveDetails = details.filter(detail => getDetailKind(detail) === 'elective');
        const detailLabel = `Xem ${details.length} dòng hỗ trợ`;
        const detailNote = details.length
            ? `<p class="mt-2 text-[11px] text-slate-500">HP thiếu theo bảng tổng hợp: ${formatNumber(student.missingCourses)} · TC thiếu tổng: ${formatNumber(student.missingCredits)}. Không cộng số dòng hoặc TC của các phương án tự chọn vào TC thiếu.</p>`
            : '';
        const detailSections = [
            renderSupportDetailSection('Bắt buộc phải hoàn thành', mandatoryDetails, student, { mandatory: true }),
            renderSupportDetailSection('Điều kiện tốt nghiệp phải đạt', conditionDetails, student),
            renderSupportDetailSection('Tự chọn, sinh viên lựa chọn đủ TC', electiveDetails, student)
        ].join('');
        const courseDetailsMarkup = details.length
            ? `<details class="text-left"><summary class="cursor-pointer font-semibold text-brand-700">${detailLabel}</summary>${detailNote}<div class="mt-2 space-y-2 text-xs">${detailSections}</div></details>`
            : '<span class="text-slate-400">Chưa có chi tiết học phần</span>';
        return `
            <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td class="px-3 py-3 text-center text-slate-500">${(page - 1) * FACULTY_PAGE_SIZE + index + 1}</td>
                <td class="px-3 py-3 font-semibold text-slate-800 whitespace-nowrap">${escapeHtml(student.id)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(student.name)}</td>
                <td class="px-3 py-3 text-slate-600">${escapeHtml(student.faculty)}</td>
                <td class="px-3 py-3 text-slate-600">${escapeHtml(student.className)}</td>
                <td class="px-3 py-3 text-center font-semibold">${formatNumber(student.missingCredits)}</td>
                <td class="px-3 py-3 text-center font-semibold">${formatNumber(student.missingCourses)}</td>
                <td class="px-3 py-3 text-center"><span class="inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold ${meta.classes}">${meta.label}</span></td>
                <td class="px-3 py-3 text-xs min-w-64">${courseDetailsMarkup}</td>
                <td class="px-3 py-3 text-xs text-slate-500 min-w-52">${escapeHtml(student.recommendation)}</td>
            </tr>`;
    }).join('');

    return {
        count: filtered.length,
        page,
        totalPages,
        html: rows || `<tr><td colspan="10" class="px-4 py-10 text-center text-slate-400">Không có sinh viên phù hợp.</td></tr>`,
        paginationHtml: renderFacultyPagination(page, totalPages)
    };
}

function renderFacultyExportTargetOptions(report, scope, selectedTarget) {
    if (scope === 'all') return '<option value="">Không cần chọn</option>';
    if (scope === 'class') {
        return [...new Set(report.records.map(student => student.className).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'vi'))
            .map(className => `<option value="${escapeHtml(className)}" ${className === selectedTarget ? 'selected' : ''}>${escapeHtml(className)}</option>`)
            .join('');
    }
    return [...report.records]
        .sort((a, b) => String(a.id).localeCompare(String(b.id), 'vi'))
        .map(student => `<option value="${escapeHtml(student.id)}" ${student.id === selectedTarget ? 'selected' : ''}>${escapeHtml(student.id)} · ${escapeHtml(student.name)}</option>`)
        .join('');
}

export function renderFacultyTabView({ globalData, onConfigChanged }) {
    const container = document.getElementById('facultyAnalysisContainer');
    if (!container) return;
    const report = globalData.facultyReport;

    if (!report) {
        container.innerHTML = `
            <div class="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-brand-700"><i class="fa-solid fa-building-columns"></i></div>
                <h3 class="text-lg font-extrabold text-slate-800">Chưa có báo cáo theo khoa</h3>
                <p class="mx-auto mt-2 max-w-xl text-sm text-slate-500">Tải file Excel dữ liệu Đào tạo ở khu vực tải file, sau đó bấm “Phân tích theo khoa”.</p>
            </div>`;
        return;
    }

    const facultyFilter = document.getElementById('facultyFilterSelect')?.value || 'ALL';
    const groupFilter = document.getElementById('facultyGroupFilter')?.value || 'ALL';
    const search = document.getElementById('facultyStudentSearch')?.value || '';
    const currentPage = Number(document.getElementById('facultyPage')?.value || 1);
    const exportScope = document.getElementById('facultyExportScope')?.value || 'all';
    const exportTarget = document.getElementById('facultyExportTarget')?.value || '';
    const studentTable = renderStudentRows(report, search, facultyFilter, groupFilter, currentPage);
    const facultyOptions = report.faculties.map(item => `<option value="${escapeHtml(item.faculty)}">${escapeHtml(item.faculty)}</option>`).join('');
    const exportTargetOptions = renderFacultyExportTargetOptions(report, exportScope, exportTarget);

    container.innerHTML = `
        <div class="space-y-6">
            <div class="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h3 class="text-lg font-extrabold text-slate-800">Phân tích sinh viên K17 theo khoa</h3>
                    <p class="mt-1 text-xs text-slate-500">Nguồn: ${escapeHtml(report.sourceSheets.join(', '))} · ${formatNumber(report.summary.total)} sinh viên · ${formatNumber(report.summary.facultyCount)} khoa/đơn vị</p>
                </div>
                <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label class="text-[11px] font-bold text-slate-500">Phạm vi xuất
                        <select id="facultyExportScope" class="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold">
                            <option value="all" ${exportScope === 'all' ? 'selected' : ''}>Toàn bộ</option>
                            <option value="class" ${exportScope === 'class' ? 'selected' : ''}>Theo lớp</option>
                            <option value="student" ${exportScope === 'student' ? 'selected' : ''}>Theo sinh viên</option>
                        </select>
                    </label>
                    <label class="text-[11px] font-bold text-slate-500 ${exportScope === 'all' ? 'hidden' : ''}">Đối tượng
                        <select id="facultyExportTarget" class="mt-1 min-w-56 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold">${exportTargetOptions}</select>
                    </label>
                    <button onclick="exportFacultyReport()" class="inline-flex items-center justify-center gap-2 rounded-xl bg-phenikaa-orange px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-orange-600">
                        <i class="fa-solid fa-file-excel"></i> Xuất Excel
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">${renderGroupCards(report.summary)}</div>

            <div class="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <div class="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h4 class="font-extrabold text-slate-800">Quy tắc phân nhóm theo yêu cầu</h4>
                        <p class="mt-1 text-xs text-slate-500">Xanh: không còn thiếu học phần và tín chỉ. Vàng: còn thiếu 2–3 học phần. Đỏ: các trường hợp còn lại.</p>
                    </div>
                    <span class="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600">TC dùng để hỗ trợ</span>
                </div>
                <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <label class="text-xs font-semibold text-slate-600">Chỉ số phân nhóm
                        <select id="facultyMetricSelect" disabled class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700">
                            <option selected>Học phần còn thiếu</option>
                        </select>
                    </label>
                    <label class="text-xs font-semibold text-slate-600">Xanh tối đa
                        <input id="facultyGreenMax" type="text" value="0 HP và 0 TC" disabled class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700">
                    </label>
                    <label class="text-xs font-semibold text-slate-600">Vàng tối đa
                        <input id="facultyYellowMax" type="text" value="2–3 HP" disabled class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700">
                    </label>
                    <div class="flex items-end">
                        <div class="w-full rounded-xl bg-slate-100 px-4 py-2.5 text-center text-sm font-bold text-slate-600">Đỏ: các trường hợp còn lại</div>
                    </div>
                </div>
            </div>

            <div class="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <div class="mb-4 flex items-center justify-between"><h4 class="font-extrabold text-slate-800">Tổng hợp theo khoa</h4><span class="text-xs text-slate-500">Số liệu trung bình dùng để ưu tiên hỗ trợ</span></div>
                <div class="overflow-x-auto"><table class="w-full min-w-[760px] text-left text-sm"><thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th class="px-4 py-3">Khoa / đơn vị</th><th class="px-4 py-3 text-center">Tổng SV</th><th class="px-4 py-3 text-center text-emerald-700">Xanh</th><th class="px-4 py-3 text-center text-amber-700">Vàng</th><th class="px-4 py-3 text-center text-rose-700">Đỏ</th><th class="px-4 py-3 text-center">TB TC thiếu</th><th class="px-4 py-3 text-center">TB HP thiếu</th></tr></thead><tbody>${renderFacultyRows(report)}</tbody></table></div>
            </div>

            <div class="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <h4 class="font-extrabold text-slate-800">Danh sách sinh viên đã phân nhóm <span id="facultyStudentCount" class="text-xs font-semibold text-slate-400">(${formatNumber(studentTable.count)} kết quả)</span></h4>
                    <div class="flex flex-col gap-2 sm:flex-row">
                        <input id="facultyStudentSearch" value="${escapeHtml(search)}" placeholder="Tìm MSSV, họ tên, lớp..." class="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-700">
                        <select id="facultyFilterSelect" class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold"><option value="ALL">Tất cả khoa</option>${facultyOptions}</select>
                        <select id="facultyGroupFilter" class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold"><option value="ALL">Tất cả nhóm</option><option value="green">Xanh · Đúng hạn</option><option value="yellow">Vàng · Có khả năng đúng hạn</option><option value="red">Đỏ · Cần hỗ trợ</option></select>
                    </div>
                </div>
                <div class="overflow-x-auto"><table class="w-full min-w-[1420px] text-left text-sm"><thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th class="px-3 py-3 text-center">STT</th><th class="px-3 py-3">MSSV</th><th class="px-3 py-3">Họ và tên</th><th class="px-3 py-3">Khoa / đơn vị</th><th class="px-3 py-3">Lớp</th><th class="px-3 py-3 text-center">TC thiếu</th><th class="px-3 py-3 text-center">HP thiếu</th><th class="px-3 py-3 text-center">Nhóm</th><th class="px-3 py-3">Phương án học phần hỗ trợ</th><th class="px-3 py-3">Khuyến nghị</th></tr></thead><tbody id="facultyStudentTableBody">${studentTable.html}</tbody></table></div>
                <input id="facultyPage" type="hidden" value="${studentTable.page}">
                ${studentTable.paginationHtml}
            </div>
        </div>`;

    const facultySelect = document.getElementById('facultyFilterSelect');
    const groupSelect = document.getElementById('facultyGroupFilter');
    if (facultySelect) facultySelect.value = facultyFilter;
    if (groupSelect) groupSelect.value = groupFilter;

    const updateStudentTable = page => {
        const next = renderStudentRows(
            report,
            document.getElementById('facultyStudentSearch')?.value || '',
            document.getElementById('facultyFilterSelect')?.value || 'ALL',
            document.getElementById('facultyGroupFilter')?.value || 'ALL',
            page
        );
        const body = document.getElementById('facultyStudentTableBody');
        const count = document.getElementById('facultyStudentCount');
        const pageInput = document.getElementById('facultyPage');
        if (body) body.innerHTML = next.html;
        if (count) count.textContent = `(${formatNumber(next.count)} kết quả)`;
        if (pageInput) pageInput.value = String(next.page);
        const oldPagination = document.getElementById('facultyPagination');
        if (oldPagination) oldPagination.outerHTML = next.paginationHtml;
        document.querySelectorAll('[data-faculty-page]').forEach(button => {
            button.addEventListener('click', () => updateStudentTable(Number(button.dataset.facultyPage)));
        });
    };

    const rerender = () => renderFacultyTabView({ globalData, onConfigChanged });
    document.getElementById('facultyStudentSearch')?.addEventListener('input', () => updateStudentTable(1));
    document.getElementById('facultyExportScope')?.addEventListener('change', rerender);
    document.getElementById('facultyExportTarget')?.addEventListener('change', () => {});
    document.querySelectorAll('[data-faculty-page]').forEach(button => {
        button.addEventListener('click', () => updateStudentTable(Number(button.dataset.facultyPage)));
    });
    ['facultyFilterSelect', 'facultyGroupFilter'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', rerender);
    });
}
