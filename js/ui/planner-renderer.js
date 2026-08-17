// UI renderers for the graduation planner modal.

export function renderRoadmapTabView(roadmapGroups) {
    const container = document.getElementById('plannerTabContent-roadmap');
    container.innerHTML = '';

    if (Object.keys(roadmapGroups).length === 0) {
        container.innerHTML = `<div class="text-center py-6 text-slate-400">Không có dữ liệu đối sánh.</div>`;
        return;
    }

    Object.entries(roadmapGroups).forEach(([blockId, block]) => {
        let rowsHtml = block.courses.map(c => {
            let statusBadge = '';
            let rowBg = '';

            if (c.status === 'PASSED') {
                statusBadge = '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md"><i class="fa-solid fa-circle-check mr-1"></i>Đã đạt</span>';
                rowBg = 'bg-white';
            } else if (c.status === 'DEBT') {
                statusBadge = '<span class="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-md"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Đang nợ</span>';
                rowBg = 'bg-rose-50/20';
            } else if (c.status === 'EXCESS') {
                statusBadge = '<span class="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md"><i class="fa-solid fa-circle-info mr-1"></i>Da hoc vuot</span>';
                rowBg = 'bg-amber-50/30';
            } else if (c.status === 'NOT_REQUIRED') {
                statusBadge = '<span class="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-semibold rounded-md"><i class="fa-solid fa-minus mr-1"></i>Khong tinh</span>';
                rowBg = 'bg-slate-50/50';
            } else {
                statusBadge = '<span class="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded-md"><i class="fa-solid fa-circle-minus mr-1"></i>Chưa học</span>';
                rowBg = 'bg-white';
            }

            return `
                <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors ${rowBg}">
                    <td class="py-2.5 px-3 font-semibold text-slate-500">${c.courseCode}</td>
                    <td class="py-2.5 px-3 font-bold text-slate-800 text-xs sm:text-sm">${c.courseName}</td>
                    <td class="py-2.5 px-3 text-center font-bold text-slate-600">${c.credits}</td>
                    <td class="py-2.5 px-3 text-center">${statusBadge}</td>
                    <td class="py-2.5 px-3 font-semibold text-slate-500 text-right">${c.gradeDesc}</td>
                </tr>
            `;
        }).join('');

        const electiveSummary = block.electiveSummary;
        const summaryHtml = electiveSummary
            ? `<span class="ml-2 px-2 py-1 rounded-lg bg-brand-50 text-brand-700 text-[10px] font-bold">${electiveSummary.earnedCredits}/${electiveSummary.requiredCredits} TC tu chon</span>`
            : '';
        if (block.courses.length === 0) {
            rowsHtml = `<tr><td colspan="5" class="py-5 px-3 text-center text-slate-400 italic">Nhom nay con ${electiveSummary?.remainingCredits || 0} TC; khung chua liet ke hoc phan cu the.</td></tr>`;
        }

        container.innerHTML += `
            <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <h4 class="font-extrabold text-slate-800 text-sm mb-3 flex items-center gap-2">
                    <span class="w-2.5 h-4 bg-brand-700 rounded-sm"></span>
                    ${blockId} - ${block.name} ${summaryHtml}
                </h4>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                <th class="py-2 px-3 w-28">Mã Học Phần</th>
                                <th class="py-2 px-3">Tên Học Phần</th>
                                <th class="py-2 px-3 text-center w-16">Tín Chỉ</th>
                                <th class="py-2 px-3 text-center w-24">Trạng Thái</th>
                                <th class="py-2 px-3 text-right w-28">Điểm / Ghi Chú</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });
}

export function printPlannerView(student, frameworkCourses, semesterOptions) {
    if (!student) return;

    const printArea = document.getElementById('printablePlanArea');
    printArea.innerHTML = '';

    const semesters = semesterOptions;
    let plannedTablesHtml = '';

    semesters.forEach(semName => {
        let plannedCourses = [];
        let plannedCredits = 0;

        Object.entries(student.studyPlan).forEach(([code, sem]) => {
            if (sem === semName) {
                const cObj = frameworkCourses.find(c => c.courseCode === code);
                if (cObj) {
                    plannedCourses.push(cObj);
                    plannedCredits += cObj.credits;
                }
            }
        });

        let rows = plannedCourses.map((c, idx) => `
            <tr>
                <td style="text-align: center; border: 1px solid #ddd; padding: 8px;">${idx + 1}</td>
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${c.courseCode}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${c.courseName}</td>
                <td style="text-align: center; border: 1px solid #ddd; padding: 8px; font-weight: bold;">${c.credits}</td>
            </tr>
        `).join('');

        if (plannedCourses.length === 0) {
            rows = `<tr><td colspan="4" style="text-align: center; border: 1px solid #ddd; padding: 12px; color: #777; font-style: italic;">Chưa lên kế hoạch đăng ký học phần</td></tr>`;
        }

        plannedTablesHtml += `
            <div style="margin-top: 25px;">
                <h3 style="font-size: 14px; font-weight: bold; border-bottom: 1.5px solid #00205b; padding-bottom: 5px; color: #00205b;">${semName} (Tổng số: ${plannedCredits} Tín chỉ)</h3>
                <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px;">
                    <thead>
                        <tr style="background-color: #f9fafb;">
                            <th style="border: 1px solid #ddd; padding: 8px; width: 50px; text-align: center;">STT</th>
                            <th style="border: 1px solid #ddd; padding: 8px; width: 120px; text-align: left;">Mã Học Phần</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Tên Học Phần</th>
                            <th style="border: 1px solid #ddd; padding: 8px; width: 80px; text-align: center;">Tín Chỉ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    });

    const dateStr = new Date().toLocaleDateString('vi-VN');

    // Create a beautiful printable layout
    printArea.innerHTML = `
        <div style="font-family: 'Inter', Arial, sans-serif; padding: 40px; color: #333; max-w-4xl mx-auto;">
            <!-- Header School with logo -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 25px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <img src="https://www.phenikaa.com/logo192.png" style="width: 65px; height: auto;" alt="Logo">
                    <div>
                        <div style="font-weight: bold; font-size: 15px; text-transform: uppercase;">Trường Đại Học Phenikaa</div>
                        <div style="font-size: 12px; color: #555;">Khoa Công nghệ thông tin</div>
                    </div>
                </div>
                <div style="text-align: right; font-size: 12px;">
                    <div>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div style="font-weight: bold;">Độc lập - Tự do - Hạnh phúc</div>
                </div>
            </div>

            <!-- Title -->
            <h2 style="text-align: center; font-size: 18px; font-weight: 800; text-transform: uppercase; margin-bottom: 5px; color: #00205b;">KẾ HOẠCH HỌC TẬP & LỘ TRÌNH TỐT NGHIỆP</h2>
            <p style="text-align: center; font-size: 12px; color: #666; margin-bottom: 25px;">(Xây dựng dựa trên Khung đào tạo K16/K17 khoa Công nghệ thông tin)</p>

            <!-- Student info -->
            <div style="background-color: #f9fafb; border: 1px solid #eee; padding: 15px; border-radius: 8px; font-size: 13px; line-height: 1.6; margin-bottom: 25px;">
                <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 10px;">
                    <div>Họ và tên sinh viên: <strong style="font-size: 14px;">${student.name}</strong></div>
                    <div>Mã số sinh viên: <strong>${student.id}</strong></div>
                    <div>Lớp / Sheet: <strong>${student.className}</strong></div>
                    <div>Ngày sinh: <strong>${student.dob || '-'}</strong></div>
                </div>
                <div style="margin-top: 10px; border-t: 1px dashed #ddd; padding-top: 10px;">
                    Tiến độ hoàn thành: <strong>${student.stats?.progressPercent}%</strong> (${student.stats?.passedCredits} / ${student.stats?.totalFrameworkCredits} Tín chỉ khung).
                    Còn lại: Đang nợ <strong>${student.stats?.failedCount} môn</strong>, Chưa học <strong>${student.stats?.unstudiedCount} môn</strong>.
                </div>
            </div>

            <!-- Planned Semesters -->
            <h3 style="font-size: 15px; font-weight: bold; color: #00205b; text-transform: uppercase; margin-top: 30px;">Kế Hoạch Các Học Kỳ Tương Lai</h3>
            ${plannedTablesHtml}

            <!-- Signature Section -->
            <div style="margin-top: 50px; display: flex; justify-content: space-between; font-size: 13px;">
                <div style="text-align: center; width: 250px;">
                    <div style="font-style: italic;">Sinh viên ký tên</div>
                    <div style="margin-top: 70px; font-weight: bold;">${student.name}</div>
                </div>
                <div style="text-align: center; width: 250px;">
                    <div style="font-style: italic;">Hà Nội, ngày ${dateStr}</div>
                    <div style="font-weight: bold; margin-top: 5px;">Xác nhận của Khoa</div>
                    <div style="margin-top: 65px; color: #bbb;">(Ký và ghi rõ họ tên)</div>
                </div>
            </div>
        </div>
    `;

    // Trigger printing
    window.print();
}




export function renderPlannerTabView(student, assessment, semesterOptions) {
    const container = document.getElementById('plannerTabContent-planner');
    container.innerHTML = '';

    const remainingCourses = assessment.remainingCourses;
    const groupsWithoutOptions = assessment.electiveGroups.filter(group =>
        group.remainingCredits > 0 && group.options.length === 0
    );

    if (remainingCourses.length === 0) {
        if (groupsWithoutOptions.length > 0) {
            container.innerHTML = `
                <div class="text-center py-10 bg-amber-50 rounded-3xl border border-amber-200">
                    <i class="fa-solid fa-circle-info text-4xl text-amber-500 mb-3"></i>
                    <h4 class="font-bold text-slate-800 text-lg">Con nhom tin chi chua co danh sach mon cu the</h4>
                    <p class="text-slate-600 text-xs mt-2">Khung chuong trinh con ${groupsWithoutOptions.reduce((sum, group) => sum + group.remainingCredits, 0)} TC tu chon, nhung file khung khong liet ke ma hoc phan de chon.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="text-center py-12 bg-white rounded-3xl border border-slate-200">
                <i class="fa-solid fa-graduation-cap text-4xl text-emerald-500 mb-3"></i>
                <h4 class="font-bold text-slate-800 text-lg">Chúc mừng! Sinh viên đã hoàn thành tất cả môn học</h4>
                <p class="text-slate-500 text-xs mt-1">Đã tích lũy đủ 100% tín chỉ khung chương trình đào tạo.</p>
            </div>
        `;
        return;
    }

    const manualElectiveNoticeHtml = groupsWithoutOptions.length > 0
        ? `<div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800"><i class="fa-solid fa-circle-info mr-1"></i>Con ${groupsWithoutOptions.reduce((sum, group) => sum + group.remainingCredits, 0)} TC tu chon chua co danh sach mon cu the trong khung.</div>`
        : '';

    // Grid of planning interface: Left column is selector, Right column is visual semesters
    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <!-- Left panel: courses selector -->
            <div class="lg:col-span-3 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <h4 class="font-extrabold text-slate-800 text-sm border-b pb-2"><i class="fa-solid fa-list-ul mr-1.5 text-phenikaa-orange"></i>Phân Bổ Học Phần Còn Thiếu</h4>
                ${manualElectiveNoticeHtml}
                <div class="space-y-3 custom-scrollbar overflow-y-auto max-h-96 pr-1" id="plannerSelectorsList">
                    <!-- Dynamic select lists -->
                </div>
            </div>

            <!-- Right panel: visual semester columns summary -->
            <div class="lg:col-span-2 space-y-4" id="plannerSemestersSummary">
                <!-- Semester summary cards -->
            </div>
        </div>
    `;

    // Render selector lists
    const selectorContainer = document.getElementById('plannerSelectorsList');

    remainingCourses.forEach(c => {
        const currentSemester = student.studyPlan[c.courseCode] || '';
        const isDebt = c.status === 'DEBT';
        const courseTypeLabel = c.courseType === 'elective'
            ? `<span class="text-brand-700 font-bold">Tu chon ${c.electiveGroup || ''}</span>`
            : '<span class="text-slate-500 font-medium">Bat buoc</span>';

        const selectHtml = `
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                        <span class="font-bold text-slate-800 text-xs sm:text-sm truncate">${c.courseName}</span>
                        <span class="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded font-semibold text-slate-600 shrink-0">${c.credits} TC</span>
                    </div>
                    <div class="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <span>Code: ${c.courseCode}</span> •
                        ${courseTypeLabel} · ${isDebt
                            ? '<span class="text-rose-600 font-bold"><i class="fa-solid fa-triangle-exclamation mr-0.5"></i>Nợ F</span>'
                            : '<span class="text-slate-500 font-medium">Chưa học</span>'}
                    </div>
                </div>
                <div class="shrink-0">
                    <select onchange="updatePlannerSemester('${c.courseCode}', this.value)" class="bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-700">
                        <option value="">-- Chọn kỳ --</option>
                        ${semesterOptions.map(opt => `
                            <option value="${opt}" ${currentSemester === opt ? 'selected' : ''}>${opt}</option>
                        `).join('')}
                    </select>
                </div>
            </div>
        `;
        selectorContainer.insertAdjacentHTML('beforeend', selectHtml);
    });

}


export function renderSemesterSummaryView(student, frameworkCourses, semesterOptions) {
    if (!student) return;

    const semesters = semesterOptions;
    const container = document.getElementById('plannerSemestersSummary');
    container.innerHTML = '';


    semesters.forEach(semName => {
        // Find courses planned for this semester
        let plannedCourses = [];
        let plannedCredits = 0;

        Object.entries(student.studyPlan).forEach(([code, sem]) => {
            if (sem === semName) {
                const cObj = frameworkCourses.find(c => c.courseCode === code);
                if (cObj) {
                    plannedCourses.push(cObj);
                    plannedCredits += cObj.credits;
                }
            }
        });

        const listHtml = plannedCourses.map(c => `
            <div class="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-b-0">
                <span class="font-medium text-slate-700 truncate max-w-[200px]">${c.courseName}</span>
                <span class="font-bold text-slate-500 shrink-0">${c.credits} TC</span>
            </div>
        `).join('');

        const warningMsg = plannedCredits > 20
            ? '<div class="text-[10px] text-rose-600 font-bold mt-2"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Vượt quá số TC khuyên dùng (tối đa 20 TC)</div>'
            : '';

        const cardHtml = `
            <div class="bg-white p-4 rounded-2xl border ${plannedCredits > 20 ? 'border-rose-300' : 'border-slate-200/80'} shadow-sm">
                <div class="flex items-center justify-between border-b pb-2 mb-2">
                    <h5 class="font-extrabold text-slate-800 text-xs sm:text-sm">${semName}</h5>
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-black ${plannedCredits > 20 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-brand-50 text-brand-700'}">
                        ${plannedCredits} TC
                    </span>
                </div>
                <div class="space-y-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                    ${plannedCourses.length > 0 ? listHtml : '<p class="text-xs text-slate-400 italic py-2">Chưa phân bổ học phần nào...</p>'}
                </div>
                ${warningMsg}
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHtml);
    });
}
