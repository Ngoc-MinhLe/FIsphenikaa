import { buildFacultyReport } from '../excel/faculty-analysis.js';

const GROUP_META = {
    green: { label: 'Xanh', description: 'Có khả năng hoàn thành đúng hạn', classes: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    yellow: { label: 'Vàng', description: 'Cần hỗ trợ học phần còn thiếu', classes: 'bg-amber-50 text-amber-700 border-amber-100' },
    red: { label: 'Đỏ', description: 'Rủi ro tiến độ, cần can thiệp sớm', classes: 'bg-rose-50 text-rose-700 border-rose-100' }
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

function renderStudentRows(report, search, facultyFilter, groupFilter) {
    const query = String(search || '').trim().toLocaleLowerCase('vi');
    const filtered = report.records.filter(student => {
        const matchesSearch = !query || [student.id, student.name, student.className, student.faculty]
            .some(value => String(value || '').toLocaleLowerCase('vi').includes(query));
        const matchesFaculty = facultyFilter === 'ALL' || student.faculty === facultyFilter;
        const matchesGroup = groupFilter === 'ALL' || student.group === groupFilter;
        return matchesSearch && matchesFaculty && matchesGroup;
    });

    const rows = filtered.map((student, index) => {
        const meta = GROUP_META[student.group];
        return `
            <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td class="px-3 py-3 text-center text-slate-500">${index + 1}</td>
                <td class="px-3 py-3 font-semibold text-slate-800 whitespace-nowrap">${escapeHtml(student.id)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(student.name)}</td>
                <td class="px-3 py-3 text-slate-600">${escapeHtml(student.faculty)}</td>
                <td class="px-3 py-3 text-slate-600">${escapeHtml(student.className)}</td>
                <td class="px-3 py-3 text-center font-semibold">${formatNumber(student.missingCredits)}</td>
                <td class="px-3 py-3 text-center font-semibold">${formatNumber(student.missingCourses)}</td>
                <td class="px-3 py-3 text-center"><span class="inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold ${meta.classes}">${meta.label}</span></td>
                <td class="px-3 py-3 text-xs text-slate-500 min-w-52">${escapeHtml(student.recommendation)}</td>
            </tr>`;
    }).join('');

    return {
        count: filtered.length,
        html: rows || `<tr><td colspan="9" class="px-4 py-10 text-center text-slate-400">Không có sinh viên phù hợp.</td></tr>`
    };
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

    const config = report.config;
    const facultyFilter = document.getElementById('facultyFilterSelect')?.value || 'ALL';
    const groupFilter = document.getElementById('facultyGroupFilter')?.value || 'ALL';
    const search = document.getElementById('facultyStudentSearch')?.value || '';
    const studentTable = renderStudentRows(report, search, facultyFilter, groupFilter);
    const facultyOptions = report.faculties.map(item => `<option value="${escapeHtml(item.faculty)}">${escapeHtml(item.faculty)}</option>`).join('');

    container.innerHTML = `
        <div class="space-y-6">
            <div class="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h3 class="text-lg font-extrabold text-slate-800">Phân tích sinh viên K17 theo khoa</h3>
                    <p class="mt-1 text-xs text-slate-500">Nguồn: ${escapeHtml(report.sourceSheets.join(', '))} · ${formatNumber(report.summary.total)} sinh viên · ${formatNumber(report.summary.facultyCount)} khoa/đơn vị</p>
                </div>
                <button onclick="exportFacultyReport()" class="inline-flex items-center justify-center gap-2 rounded-xl bg-phenikaa-orange px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-orange-600">
                    <i class="fa-solid fa-file-excel"></i> Xuất báo cáo Excel
                </button>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">${renderGroupCards(report.summary)}</div>

            <div class="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <div class="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h4 class="font-extrabold text-slate-800">Thiết lập phân nhóm</h4>
                        <p class="mt-1 text-xs text-slate-500">Mặc định: Xanh ≤ 6 TC, Vàng 7–23 TC, Đỏ ≥ 24 TC. Có thể điều chỉnh theo yêu cầu của nhà trường.</p>
                    </div>
                    <span class="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600">${config.metric === 'credits' ? 'Đang tính theo TC' : 'Đang tính theo HP'}</span>
                </div>
                <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <label class="text-xs font-semibold text-slate-600">Chỉ số phân nhóm
                        <select id="facultyMetricSelect" class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">
                            <option value="credits" ${config.metric === 'credits' ? 'selected' : ''}>Tín chỉ còn thiếu</option>
                            <option value="courses" ${config.metric === 'courses' ? 'selected' : ''}>Học phần còn thiếu</option>
                        </select>
                    </label>
                    <label class="text-xs font-semibold text-slate-600">Xanh tối đa
                        <input id="facultyGreenMax" type="number" min="0" value="${config.greenMax}" class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">
                    </label>
                    <label class="text-xs font-semibold text-slate-600">Vàng tối đa
                        <input id="facultyYellowMax" type="number" min="1" value="${config.yellowMax}" class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">
                    </label>
                    <div class="flex items-end">
                        <button id="applyFacultyConfig" class="w-full rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-800">Áp dụng phân nhóm</button>
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
                        <select id="facultyGroupFilter" class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold"><option value="ALL">Tất cả nhóm</option><option value="green">Xanh</option><option value="yellow">Vàng</option><option value="red">Đỏ</option></select>
                    </div>
                </div>
                <div class="overflow-x-auto"><table class="w-full min-w-[1180px] text-left text-sm"><thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th class="px-3 py-3 text-center">STT</th><th class="px-3 py-3">MSSV</th><th class="px-3 py-3">Họ và tên</th><th class="px-3 py-3">Khoa / đơn vị</th><th class="px-3 py-3">Lớp</th><th class="px-3 py-3 text-center">TC thiếu</th><th class="px-3 py-3 text-center">HP thiếu</th><th class="px-3 py-3 text-center">Nhóm</th><th class="px-3 py-3">Khuyến nghị</th></tr></thead><tbody id="facultyStudentTableBody">${studentTable.html}</tbody></table></div>
            </div>
        </div>`;

    const facultySelect = document.getElementById('facultyFilterSelect');
    const groupSelect = document.getElementById('facultyGroupFilter');
    if (facultySelect) facultySelect.value = facultyFilter;
    if (groupSelect) groupSelect.value = groupFilter;

    const rerender = () => renderFacultyTabView({ globalData, onConfigChanged });
    document.getElementById('facultyStudentSearch')?.addEventListener('input', event => {
        const next = renderStudentRows(
            report,
            event.target.value,
            document.getElementById('facultyFilterSelect')?.value || 'ALL',
            document.getElementById('facultyGroupFilter')?.value || 'ALL'
        );
        const body = document.getElementById('facultyStudentTableBody');
        const count = document.getElementById('facultyStudentCount');
        if (body) body.innerHTML = next.html;
        if (count) count.textContent = `(${formatNumber(next.count)} kết quả)`;
    });
    ['facultyFilterSelect', 'facultyGroupFilter'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', rerender);
    });
    document.getElementById('applyFacultyConfig')?.addEventListener('click', () => {
        const nextConfig = {
            metric: document.getElementById('facultyMetricSelect').value,
            greenMax: Number(document.getElementById('facultyGreenMax').value),
            yellowMax: Number(document.getElementById('facultyYellowMax').value)
        };
        globalData.facultyReport = buildFacultyReport(globalData.facultyReport.records, nextConfig);
        onConfigChanged();
    });
}
