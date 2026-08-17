// UI renderer for the overview dashboard and debt chart.

export function renderOverviewTabView(globalData, currentChart, ChartCtor = Chart) {
    if (globalData.students.length === 0) return;

    const totalStudents = globalData.students.length;
    const debtStudents = globalData.students.filter(s => s.debts.length > 0);
    const debtStudentCount = debtStudents.length;

    const totalDebtsCount = globalData.students.reduce((acc, s) => acc + s.debts.length, 0);

    const allSubjectKeys = Object.keys(globalData.subjectsMap);
    const totalSubjects = allSubjectKeys.length;
    const subjectsWithDebt = allSubjectKeys.filter(k => globalData.subjectsMap[k].totalDebts > 0).length;

    const ratioPercent = totalStudents > 0 ? ((debtStudentCount / totalStudents) * 100).toFixed(1) : 0;
    const avgDebts = debtStudentCount > 0 ? (totalDebtsCount / debtStudentCount).toFixed(1) : 0;

    document.getElementById('kpiTotalStudents').innerText = totalStudents;
    document.getElementById('kpiClassDetail').innerText = `${globalData.classList.length} Lớp / Sheet`;

    document.getElementById('kpiDebtStudents').innerText = debtStudentCount;
    document.getElementById('kpiDebtRatio').innerText = `${ratioPercent}% tổng số SV`;

    document.getElementById('kpiTotalSubjects').innerText = totalSubjects;
    document.getElementById('kpiSubjectsWithDebt').innerText = globalData.frameworkCourses.length > 0
        ? `Khung: ${globalData.frameworkCourses.length} môn / ${globalData.frameworkMetadata.totalCredits} TC • ${subjectsWithDebt} môn có SV nợ`
        : `${subjectsWithDebt} môn có SV nợ`;

    document.getElementById('kpiTotalDebts').innerText = totalDebtsCount;
    document.getElementById('kpiAvgDebts').innerText = `TB ${avgDebts} môn / SV nợ`;

    const classListContainer = document.getElementById('classListContainer');
    classListContainer.innerHTML = globalData.classList.map(cls => {
        const studentsInClass = globalData.students.filter(s => s.className === cls);
        const debtInClass = studentsInClass.filter(s => s.debts.length > 0);
        const classRatio = studentsInClass.length > 0 ? ((debtInClass.length / studentsInClass.length) * 100).toFixed(1) : 0;
        const totalClassDebts = studentsInClass.reduce((a, b) => a + b.debts.length, 0);

        return `
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                    <div class="font-bold text-slate-800 text-sm">${cls}</div>
                    <div class="text-xs text-slate-500 mt-0.5">${studentsInClass.length} SV • <span class="text-rose-600 font-medium">${debtInClass.length} SV đang nợ môn</span></div>
                </div>
                <div class="text-right">
                    <span class="text-xs font-bold px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg">${classRatio}% nợ</span>
                    <div class="text-[11px] text-slate-400 mt-1">${totalClassDebts} lượt nợ</div>
                </div>
            </div>
        `;
    }).join('');

    return renderTopSubjectsChart(globalData, currentChart, ChartCtor);
}
function renderTopSubjectsChart(globalData, currentChart, ChartCtor = Chart) {
    const ctx = document.getElementById('topSubjectsChart').getContext('2d');

    const sortedSubjects = Object.values(globalData.subjectsMap)
        .filter(s => s.totalDebts > 0)
        .sort((a, b) => b.totalDebts - a.totalDebts)
        .slice(0, 10);

    const labels = sortedSubjects.map(s => s.name.length > 25 ? s.name.substring(0, 22) + '...' : s.name);
    const dataValues = sortedSubjects.map(s => s.totalDebts);

    if (currentChart) currentChart.destroy();

    const nextChart = new ChartCtor(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Số sinh viên đang nợ môn',
                data: dataValues,
                backgroundColor: 'rgba(242, 111, 33, 0.85)', // Phenikaa Orange
                borderColor: 'rgba(214, 85, 9, 1)',
                borderWidth: 1.5,
                borderRadius: 10,
                hoverBackgroundColor: 'rgba(214, 85, 9, 0.95)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#00205b', // Phenikaa Navy Blue
                    padding: 12,
                    titleFont: { size: 13, weight: 'bold' },
                    bodyFont: { size: 12 },
                    cornerRadius: 12
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' },
                    ticks: { precision: 0 }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11 } }
                }
            }
        }
    });
    return nextChart;
}
