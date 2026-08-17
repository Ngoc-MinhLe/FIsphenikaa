import { firebaseConfig } from './firebase-config.js';
import { normalizeText, readWorkbookFromFile } from './excel/workbook-utils.js';
import { parseScoreWorkbook } from './excel/score-parser.js';
import { parseFrameworkWorkbook as parseFrameworkWorkbookData } from './excel/framework-parser.js';
import { analyzeStudentAgainstFramework, analyzeFrameworkDemand } from './excel/framework-analysis.js';
import {
    buildSubjectStudentsReport,
    buildDebtReport,
    buildDebtSummaryReport,
    buildClassOpeningReportSheets
} from './excel/report-exporter.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, query, orderBy, limit, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Initialize Firebase for this page
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let firebaseUser = null;

let globalData = {
    sheets: [],
    students: [],
    subjectsMap: {},
    classList: [],
    frameworkCourses: [], // Store list of required courses from Framework file
    frameworkMetadata: { totalCredits: 0 }
};

// State for files loaded in memory
let loadedStudentWorkbook = null;
let loadedFrameworkWorkbook = null;

let currentTab = 'overview';
let chartInstance = null;
let currentSelectedStudentForPlanner = null;
let currentPlannerTab = 'roadmap';

// Initialize events on page load
window.addEventListener('DOMContentLoaded', () => {
    setupDragAndDrop();

    // --- GẮN CÁC HÀM VÀO WINDOW ĐỂ HTML CÓ THỂ GỌI ---
    window.startAnalysis = startAnalysis;
    window.loadDemoData = loadDemoData;
    window.exportToExcel = exportToExcel;
    window.exportSummaryToExcel = exportSummaryToExcel; // Add new function to window
    window.exportClassOpeningReport = exportClassOpeningReport;
    window.switchTab = switchTab;
    window.renderStudentsTab = renderStudentsTab;
    window.renderSubjectsTab = renderSubjectsTab;
    window.toggleAccordion = toggleAccordion;
    window.openSubjectModal = openSubjectModal;
    window.closeSubjectModal = closeSubjectModal;
    window.exportSubjectStudentsToExcel = exportSubjectStudentsToExcel;
    window.openSendModal = openSendModal;
    window.closeSendModal = closeSendModal;
    window.logNotification = logNotification;
    window.renderLogsTab = renderLogsTab;
    window.parseFrameworkWorkbook = parseFrameworkWorkbook;
    
    // Planner functions
    window.openPlannerModal = openPlannerModal;
    window.closePlannerModal = closePlannerModal;
    window.switchPlannerTab = switchPlannerTab;
    window.updatePlannerSemester = updatePlannerSemester;
    window.printPlanner = printPlanner;
    window.resetApp = resetApp;

    // Attach listeners for file select
    const studentInput = document.getElementById('studentFileInput');
    const frameworkInput = document.getElementById('frameworkFileInput');
    
    studentInput.addEventListener('change', (e) => handleFileSelect(e, 'student'));
    frameworkInput.addEventListener('change', (e) => handleFileSelect(e, 'framework'));

    // Listen for Firebase auth state
    onAuthStateChanged(auth, (user) => {
        if (user) {
            firebaseUser = user;
            showCustomMessage(`Đã xác thực người dùng: ${user.email}`, 'success');
        } else {
            firebaseUser = null;
            showCustomMessage("Chưa đăng nhập! Đăng nhập ở trang chính để lưu nhật ký thông báo.", "info");
        }
    });

    // Render the initial upload screen view
    renderDashboard();
});

// Setup click and drag-drop handlers for the two slots
function setupDragAndDrop() {
    const studentZone = document.getElementById('studentDropZone');
    const frameworkZone = document.getElementById('frameworkDropZone');

    if (!studentZone || !frameworkZone) return;

    // Bind click to trigger hidden inputs
    studentZone.addEventListener('click', () => document.getElementById('studentFileInput').click());
    frameworkZone.addEventListener('click', () => document.getElementById('frameworkFileInput').click());

    // Setup drag-and-drop styles
    [studentZone, frameworkZone].forEach((zone, idx) => {
        const type = idx === 0 ? 'student' : 'framework';
        
        ['dragenter', 'dragover'].forEach(eventName => {
            zone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                zone.classList.add('drop-active');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            zone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                zone.classList.remove('drop-active');
            }, false);
        });

        zone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                loadExcelFile(files[0], type);
            }
        });
    });
}

function handleFileSelect(event, type) {
    const file = event.target.files[0];
    if (file) {
        loadExcelFile(file, type);
    }
}

// Read Excel file into memory and update UI
function loadExcelFile(file, type) {
    readWorkbookFromFile(file)
        .then(workbook => {
            
            if (type === 'student') {
                loadedStudentWorkbook = workbook;
                document.getElementById('studentFileStatus').innerText = `Đã chọn: ${file.name}`;
                document.getElementById('studentFileStatus').className = "mt-4 px-3.5 py-1 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold";
                document.getElementById('btnAnalyze').disabled = false;
                showCustomMessage("Đã nạp bảng điểm sinh viên thành công!", "success");
            } else {
                loadedFrameworkWorkbook = workbook;
                document.getElementById('frameworkFileStatus').innerText = `Đã chọn: ${file.name}`;
                document.getElementById('frameworkFileStatus').className = "mt-4 px-3.5 py-1 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold";
                showCustomMessage("Đã nạp khung chương trình đào tạo thành công!", "success");
            }
        })
        .catch(err => {
            console.error("Error reading file:", err);
            showCustomMessage(`Lỗi đọc file Excel ${type}: ` + err.message, "error");
        });
}

// Execute analysis when "Bắt Đầu Phân Tích" is clicked
function startAnalysis() {
    if (!loadedStudentWorkbook) {
        showCustomMessage("Vui lòng tải lên bảng điểm sinh viên trước!", "error");
        return;
    }

    document.getElementById('loadingSpinner').classList.remove('hidden');

    setTimeout(() => {
        try {
            // 1. Parse curricular framework if loaded
            if (loadedFrameworkWorkbook) {
                parseFrameworkWorkbook(loadedFrameworkWorkbook);
                document.getElementById('frameworkLoadedBadge').classList.remove('hidden');
            } else {
                globalData.frameworkCourses = [];
                globalData.frameworkMetadata = { totalCredits: 0 };
                document.getElementById('frameworkLoadedBadge').classList.add('hidden');
            }

            // 2. Parse student grades
            parseWorkbook(loadedStudentWorkbook);

            // 3. Update dashboard UI
            renderDashboard();
            showCustomMessage("Phân tích bóc tách và đối sánh nợ môn thành công!", "success");
        } catch (err) {
            console.error("Analysis Error:", err);
            showCustomMessage("Có lỗi xảy ra khi phân tích dữ liệu: " + err.message, "error");
        } finally {
            document.getElementById('loadingSpinner').classList.add('hidden');
        }
    }, 50);
}

function resetApp() {
    loadedStudentWorkbook = null;
    loadedFrameworkWorkbook = null;
    globalData = {
        sheets: [],
        students: [],
        subjectsMap: {},
        classList: [],
        frameworkCourses: [],
        frameworkMetadata: { totalCredits: 0 }
    };
    
    document.getElementById('studentFileStatus').innerText = "Chưa tải lên";
    document.getElementById('studentFileStatus').className = "mt-4 px-3.5 py-1 bg-slate-200/60 text-slate-600 rounded-xl text-xs font-bold";
    document.getElementById('frameworkFileStatus').innerText = "Chưa tải lên (Tùy chọn)";
    document.getElementById('frameworkFileStatus').className = "mt-4 px-3.5 py-1 bg-slate-200/60 text-slate-600 rounded-xl text-xs font-bold";
    document.getElementById('btnAnalyze').disabled = true;
    document.getElementById('studentFileInput').value = '';
    document.getElementById('frameworkFileInput').value = '';

    renderDashboard();
}

function showCustomMessage(msg, type = 'info') {
    let toast = document.getElementById('customToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'customToast';
        toast.className = 'fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 transition-all duration-300 transform translate-y-10 opacity-0';
        document.body.appendChild(toast);
    }
    const icon = type === 'error' ? 'fa-circle-xmark text-rose-400' : 
                 type === 'success' ? 'fa-circle-check text-emerald-400' : 'fa-circle-info text-indigo-400';
    toast.innerHTML = `<i class="fa-solid ${icon} text-lg"></i> <span class="text-sm font-medium">${msg}</span>`;
    
    toast.classList.remove('translate-y-10', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
    }, 4000);
}

// Parse Curricular Framework sheet
function parseFrameworkWorkbook(workbook) {
    const parsedFramework = parseFrameworkWorkbookData(workbook);

    globalData.frameworkCourses = parsedFramework.courses;
    globalData.frameworkMetadata = parsedFramework.metadata;

    console.log(
        `Framework loaded: ${parsedFramework.frameworkType}, ${parsedFramework.courses.length} courses, ${parsedFramework.metadata.totalCredits} credits.`
    );
}



// Parse Student Grades workbook
function parseWorkbook(workbook) {
    const parsedData = parseScoreWorkbook(workbook);

    globalData.sheets = parsedData.sheets;
    globalData.students = parsedData.students;
    globalData.subjectsMap = parsedData.subjectsMap;
    globalData.classList = parsedData.classList;

    populateFilters();
}



function loadDemoData() {
    // 1. Mock curricular framework
    globalData.frameworkCourses = [
        { blockId: 'A1', blockName: 'Khối kiến thức giáo dục đại cương', courseCode: 'FFS703002', courseName: 'Triết học Mác - Lê nin', credits: 3 },
        { blockId: 'A1', blockName: 'Khối kiến thức giáo dục đại cương', courseCode: 'FFS702003', courseName: 'Kinh tế chính trị Mác - Lênin', credits: 2 },
        { blockId: 'A1', blockName: 'Khối kiến thức giáo dục đại cương', courseCode: 'FFS702001', courseName: 'Pháp luật đại cương', credits: 2 },
        { blockId: 'A1', blockName: 'Khối kiến thức giáo dục đại cương', courseCode: 'FFS703007', courseName: 'Đại số tuyến tính', credits: 3 },
        { blockId: 'A1', blockName: 'Khối kiến thức giáo dục đại cương', courseCode: 'FFS703008', courseName: 'Giải tích', credits: 3 },
        { blockId: 'A2', blockName: 'Khối kiến thức cơ sở toán - lý', courseCode: 'FFS703013', courseName: 'Vật lý 1', credits: 3 },
        { blockId: 'A2', blockName: 'Khối kiến thức cơ sở toán - lý', courseCode: 'CSE703024', courseName: 'Toán rời rạc', credits: 3 },
        { blockId: 'A2', blockName: 'Khối kiến thức cơ sở toán - lý', courseCode: 'CSE703057', courseName: 'Tối ưu hóa', credits: 3 },
        { blockId: 'B1', blockName: 'Khối kiến thức cơ sở ngành', courseCode: 'CSE703107', courseName: 'Cơ sở lập trình', credits: 3 },
        { blockId: 'B1', blockName: 'Khối kiến thức cơ sở ngành', courseCode: 'CSE703029', courseName: 'Lập trình hướng đối tượng', credits: 3 },
        { blockId: 'B1', blockName: 'Khối kiến thức cơ sở ngành', courseCode: 'CSE703006', courseName: 'Cấu trúc dữ liệu và thuật toán', credits: 3 },
        { blockId: 'B1', blockName: 'Khối kiến thức cơ sở ngành', courseCode: 'CSE703008', courseName: 'Cơ sở dữ liệu', credits: 3 },
        { blockId: 'B2', blockName: 'Khối kiến thức chuyên ngành', courseCode: 'CSE703064', courseName: 'Xây dựng ứng dụng web', credits: 3 },
        { blockId: 'B2', blockName: 'Khối kiến thức chuyên ngành', courseCode: 'CSE703048', courseName: 'Phân tích và thiết kế phần mềm', credits: 3 },
        { blockId: 'B2', blockName: 'Khối kiến thức chuyên ngành', courseCode: 'CSE703110', courseName: 'Kiến trúc phần mềm', credits: 3 }
    ];
    globalData.frameworkMetadata = { totalCredits: 40 };

    // 2. Mock student data
    globalData.sheets = ['K17-KTPM(EL)_1', 'K17-KTPM(EL)_2'];
    globalData.classList = ['K17-KTPM(EL)_1', 'K17-KTPM(EL)_2'];
    globalData.students = [];
    globalData.subjectsMap = {};

    const mockSubjects = [
        'Giải tích - FFS703008',
        'Đại số tuyến tính - FFS703007',
        'Vật lý 1 - FFS703013',
        'Toán rời rạc - CSE703024',
        'Cơ sở lập trình - CSE703107',
        'Cấu trúc dữ liệu và thuật toán - CSE703006',
        'Lập trình hướng đối tượng - CSE703029'
    ];

    mockSubjects.forEach(s => {
        globalData.subjectsMap[s] = { name: s, totalDebts: 0, debtStudents: [] };
    });

    const mockStudentsRaw = [
        { 
            id: '23010342', 
            name: 'Nguyễn Duy Anh', 
            cls: 'K17-KTPM(EL)_1', 
            dob: '25/04/2005',
            taken: {
                'FFS703002': { passed: true, tkhp: '8.0', diemChu: 'B+' },
                'FFS702003': { passed: true, tkhp: '7.5', diemChu: 'B' },
                'FFS702001': { passed: true, tkhp: '9.0', diemChu: 'A' },
                'FFS703007': { passed: true, tkhp: '8.5', diemChu: 'A' },
                'FFS703008': { passed: false, tkhp: '3.0', diemChu: 'F' }, // Debt
                'FFS703013': { passed: true, tkhp: '6.5', diemChu: 'C+' },
                'CSE703024': { passed: true, tkhp: '7.0', diemChu: 'B' }
            }
        },
        { 
            id: '23010357', 
            name: 'Nguyễn Quang Anh', 
            cls: 'K17-KTPM(EL)_1', 
            dob: '11/05/2005',
            taken: {
                'FFS703002': { passed: true, tkhp: '7.0', diemChu: 'B' },
                'FFS702003': { passed: true, tkhp: '6.5', diemChu: 'C+' },
                'FFS702001': { passed: true, tkhp: '8.0', diemChu: 'B+' },
                'FFS703007': { passed: true, tkhp: '5.5', diemChu: 'C' },
                'FFS703008': { passed: true, tkhp: '8.5', diemChu: 'A' },
                'FFS703013': { passed: false, tkhp: '3.5', diemChu: 'F' }, // Debt
                'CSE703024': { passed: true, tkhp: '7.5', diemChu: 'B' }
            }
        },
        { 
            id: '23010442', 
            name: 'Vũ Đức Anh', 
            cls: 'K17-KTPM(EL)_1', 
            dob: '14/02/2005',
            taken: {
                'FFS703002': { passed: true, tkhp: '6.0', diemChu: 'C' },
                'FFS702003': { passed: false, tkhp: '2.5', diemChu: 'F' }, // Debt
                'FFS702001': { passed: true, tkhp: '7.5', diemChu: 'B' },
                'FFS703007': { passed: false, tkhp: '3.4', diemChu: 'F' }, // Debt
                'FFS703008': { passed: true, tkhp: '7.0', diemChu: 'B' },
                'FFS703013': { passed: true, tkhp: '6.0', diemChu: 'C' },
                'CSE703107': { passed: true, tkhp: '8.0', diemChu: 'B+' }
            }
        },
        { 
            id: '23010283', 
            name: 'Trần Ngọc An', 
            cls: 'K17-KTPM(EL)_1', 
            dob: '25/04/2005',
            taken: {
                'FFS703002': { passed: true, tkhp: '8.5', diemChu: 'A' },
                'FFS702003': { passed: true, tkhp: '8.0', diemChu: 'B+' },
                'FFS702001': { passed: true, tkhp: '9.5', diemChu: 'A+' },
                'FFS703007': { passed: true, tkhp: '8.0', diemChu: 'B+' },
                'FFS703008': { passed: true, tkhp: '7.5', diemChu: 'B' },
                'FFS703013': { passed: true, tkhp: '8.0', diemChu: 'B+' },
                'CSE703024': { passed: true, tkhp: '9.0', diemChu: 'A' },
                'CSE703107': { passed: true, tkhp: '8.5', diemChu: 'A' },
                'CSE703029': { passed: true, tkhp: '8.0', diemChu: 'B+' },
                'CSE703006': { passed: true, tkhp: '7.5', diemChu: 'B' }
            }
        }
    ];

    mockStudentsRaw.forEach((st, idx) => {
        let debts = [];
        Object.entries(st.taken).forEach(([code, grade]) => {
            if (!grade.passed) {
                const subName = mockSubjects.find(s => s.includes(code)) || `${code} - Học lại`;
                const dObj = {
                    subjectName: subName,
                    tkhp: grade.tkhp,
                    diemChu: grade.diemChu,
                    danhGia: 'HỌC LẠI',
                    reason: `TKHP: ${grade.tkhp}`
                };
                debts.push(dObj);
                globalData.subjectsMap[subName].totalDebts++;
                globalData.subjectsMap[subName].debtStudents.push({
                    id: st.id,
                    name: st.name,
                    className: st.cls,
                    reason: dObj.reason,
                    tkhp: grade.tkhp,
                    diemChu: grade.diemChu
                });
            }
        });

        globalData.students.push({
            stt: idx + 1,
            id: st.id,
            name: st.name,
            dob: st.dob,
            email: `${st.id}@phenikaa-uni.edu.vn`,
            className: st.cls,
            debts: debts,
            coursesTaken: st.taken,
            studyPlan: {}
        });
    });

    document.getElementById('frameworkLoadedBadge').classList.remove('hidden');
    populateFilters();
    renderDashboard();
    showCustomMessage("Đã nạp dữ liệu mẫu đối sánh lộ trình tốt nghiệp!");
}

function populateFilters() {
    const classFilter = document.getElementById('classFilterSelect');
    if (classFilter) {
        classFilter.innerHTML = '<option value="ALL">Tất cả Lớp / Sheet</option>';
        globalData.classList.forEach(cls => {
            classFilter.innerHTML += `<option value="${cls}">${cls}</option>`;
        });
    }
    const badge = document.getElementById('sheetCountBadge');
    if (badge) {
        badge.innerText = `${globalData.sheets.length} Sheet / Lớp`;
    }
}

function switchTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'text-brand-700', 'shadow-sm', 'font-bold');
        btn.classList.add('text-slate-600', 'font-semibold');
    });

    const activeBtn = document.getElementById(`tabBtn-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-white', 'text-brand-700', 'shadow-sm', 'font-bold');
        activeBtn.classList.remove('text-slate-600', 'font-semibold');
    }

    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    const contentPanel = document.getElementById(`tabContent-${tabName}`);
    if (contentPanel) {
        contentPanel.classList.remove('hidden');
    }

    if (tabName === 'overview') renderOverviewTab();
    else if (tabName === 'students') renderStudentsTab();
    else if (tabName === 'subjects') renderSubjectsTab();
    else if (tabName === 'logs') renderLogsTab();
}

function renderDashboard() {
    const hasData = globalData.students.length > 0;
    const uploadSection = document.getElementById('uploadSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const headerActions = document.getElementById('headerActions');
    const emptyStateContainer = document.getElementById('emptyStateContainer');
    const dataDependentContent = document.getElementById('dataDependentContent');

    if (hasData) {
        if (uploadSection) uploadSection.classList.add('hidden');
        if (dashboardSection) dashboardSection.classList.remove('hidden');
        if (headerActions) headerActions.classList.remove('hidden');
        if (emptyStateContainer) emptyStateContainer.classList.add('hidden');
        if (dataDependentContent) dataDependentContent.classList.remove('hidden');

        document.getElementById('tabBtn-overview').classList.remove('hidden');
        document.getElementById('tabBtn-students').classList.remove('hidden');
        document.getElementById('tabBtn-subjects').classList.remove('hidden');

        switchTab(currentTab);
    } else {
        if (uploadSection) uploadSection.classList.remove('hidden');
        if (dashboardSection) dashboardSection.classList.add('hidden');
        if (headerActions) headerActions.classList.add('hidden');
        if (emptyStateContainer) emptyStateContainer.classList.add('hidden');
        if (dataDependentContent) dataDependentContent.classList.add('hidden');
    }
}

function renderOverviewTab() {
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

    renderChart();
}

function renderChart() {
    const ctx = document.getElementById('topSubjectsChart').getContext('2d');

    const sortedSubjects = Object.values(globalData.subjectsMap)
        .filter(s => s.totalDebts > 0)
        .sort((a, b) => b.totalDebts - a.totalDebts)
        .slice(0, 10);

    const labels = sortedSubjects.map(s => s.name.length > 25 ? s.name.substring(0, 22) + '...' : s.name);
    const dataValues = sortedSubjects.map(s => s.totalDebts);

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
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
}

function renderStudentsTab() {
    if (globalData.students.length === 0) return;

    const searchQuery = normalizeText(document.getElementById('studentSearchInput').value);
    const classFilter = document.getElementById('classFilterSelect').value;
    const debtFilter = document.getElementById('debtFilterSelect').value;

    const container = document.getElementById('studentsListContainer');

    let filteredStudents = globalData.students.filter(s => {
        const matchClass = classFilter === 'ALL' || s.className === classFilter;
        const matchSearch = searchQuery === '' || normalizeText(s.name).includes(searchQuery) || normalizeText(s.id).includes(searchQuery);

        let matchDebt = true;
        if (debtFilter === 'HAS_DEBT') matchDebt = s.debts.length > 0;
        else if (debtFilter === 'NO_DEBT') matchDebt = s.debts.length === 0;

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

    container.innerHTML = filteredStudents.map((st, idx) => {
        const hasDebt = st.debts.length > 0;
        const statusBadge = hasDebt 
            ? `<span class="px-3 py-1 rounded-full bg-rose-100 text-rose-700 font-bold text-xs"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Nợ ${st.debts.length} môn</span>`
            : `<span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs"><i class="fa-solid fa-check mr-1"></i>Đạt / Sạch nợ</span>`;

        let debtsListHTML = '';
        if (hasDebt) {
            debtsListHTML = st.debts.map(d => `
                <div class="flex items-center justify-between p-3 bg-rose-50/60 rounded-xl border border-rose-100 text-xs">
                    <div>
                        <span class="font-bold text-slate-800">${d.subjectName}</span>
                        <div class="text-rose-600 mt-0.5">Trạng thái: ${d.reason}</div>
                    </div>
                    <div class="text-right">
                        <span class="font-bold text-rose-700 bg-white px-2.5 py-1 rounded-lg border border-rose-200">
                            TKHP: ${d.tkhp !== null && d.tkhp !== undefined ? d.tkhp : '-'} (${d.diemChu || '-'})
                        </span>
                    </div>
                </div>
            `).join('');
        }

        return `
            <div class="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-2xl ${hasDebt ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'} flex items-center justify-center text-lg font-bold">
                            ${st.name.charAt(0)}
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h4 class="font-bold text-slate-800 text-base">${st.name}</h4>
                                <span class="text-xs bg-slate-100 font-semibold px-2 py-0.5 rounded text-slate-600">MSSV: ${st.id}</span>
                            </div>
                            <p class="text-xs text-slate-500 mt-1">
                                <i class="fa-solid fa-school mr-1 text-slate-400"></i>${st.className} 
                                ${st.email ? `• <i class="fa-solid fa-envelope ml-2 mr-1 text-slate-400"></i>${st.email}` : ''}
                                ${st.dob ? `• <i class="fa-solid fa-cake-candles ml-2 mr-1 text-slate-400"></i>${st.dob}` : ''}
                            </p>
                        </div>
                    </div>

                    <div class="flex items-center justify-between md:justify-end gap-2.5 border-t md:border-t-0 pt-3 md:pt-0">
                        ${statusBadge}
                        <button onclick="openPlannerModal('${st.id}')" class="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5" ${hasFramework ? '' : 'disabled title="Vui lòng tải lên Khung chương trình" style="opacity: 0.5; cursor: not-allowed;"'}>
                            <i class="fa-solid fa-map-location-dot"></i>
                            <span>Lộ trình & Kế hoạch</span>
                        </button>
                        ${hasDebt ? `
                            <button onclick="openSendModal('${st.id}')" class="text-xs font-semibold text-sky-600 hover:text-sky-800 bg-sky-50 px-3 py-1.5 rounded-xl transition-colors" title="Gửi thông báo nợ môn">
                                <i class="fa-solid fa-paper-plane"></i>
                            </button>
                            <button onclick="toggleAccordion('debt-acc-${idx}')" class="text-xs font-bold text-brand-700 hover:text-brand-800 bg-brand-50 px-3 py-1.5 rounded-xl transition-colors">
                                Chi tiết nợ <i class="fa-solid fa-chevron-down ml-1"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>

                ${hasDebt ? `
                    <div id="debt-acc-${idx}" class="hidden mt-4 pt-4 border-t border-slate-100 space-y-2">
                        ${debtsListHTML}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function toggleAccordion(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden');
}

function renderSubjectsTab() {
    if (globalData.students.length === 0) return;

    const searchQuery = normalizeText(document.getElementById('subjectSearchInput').value);
    const container = document.getElementById('subjectsGridContainer');
    const subjectKeys = Object.keys(globalData.subjectsMap);
    const filteredKeys = subjectKeys.filter(k => normalizeText(k).includes(searchQuery));

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
        const subj = globalData.subjectsMap[key];
        const hasDebts = subj.totalDebts > 0;

        return `
            <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                    <div class="flex items-start justify-between gap-2 mb-3">
                        <h4 class="font-bold text-slate-800 text-sm leading-snug line-clamp-2">${subj.name}</h4>
                        <span class="px-2.5 py-1 rounded-xl text-xs font-bold ${hasDebts ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}">
                            ${subj.totalDebts} SV nợ
                        </span>
                    </div>
                </div>

                <div class="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <span class="text-xs text-slate-500">${hasDebts ? 'Cần tổ chức thi/học lại' : 'Tất cả SV đã đạt'}</span>
                    <div class="flex items-center gap-2">
                        ${hasDebts ? `
                            <button onclick="exportSubjectStudentsToExcel('${encodeURIComponent(subj.name)}')" class="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl transition-colors" title="Xuất Excel danh sách sinh viên môn này"><i class="fa-solid fa-file-excel"></i></button>
                            <button onclick="openSendModal(null, '${encodeURIComponent(subj.name)}')" class="text-xs font-semibold text-sky-600 hover:text-sky-800 bg-sky-50 px-3 py-1.5 rounded-xl transition-colors" title="Gửi thông báo cho SV nợ môn này"><i class="fa-solid fa-paper-plane"></i></button>
                            <button onclick="openSubjectModal('${encodeURIComponent(subj.name)}')" class="text-xs font-bold text-brand-700 hover:text-brand-800 bg-brand-50 px-3 py-1.5 rounded-xl transition-colors">
                                Xem danh sách SV <i class="fa-solid fa-arrow-right ml-1"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function exportSubjectStudentsToExcel(encodedName) {
    const subjectName = decodeURIComponent(encodedName);
    const subject = globalData.subjectsMap[subjectName];
    const report = buildSubjectStudentsReport(subjectName, subject, globalData.students);
    if (!report) {
        showCustomMessage('Môn học này không có sinh viên đang nợ để xuất.', 'info');
        return;
    }

    downloadReportWorkbook(report.filename, [report]);

    showCustomMessage(`Đã xuất danh sách ${report.rows.length} sinh viên nợ ${report.courseCode || subjectName.split(' - ').pop().trim()}.`, 'success');
}

function openSubjectModal(encodedName) {
    const name = decodeURIComponent(encodedName);
    const subj = globalData.subjectsMap[name];
    if (!subj) return;

    document.getElementById('modalSubjectName').innerText = subj.name;
    document.getElementById('modalSubjectSubtitle').innerText = `Tổng cộng: ${subj.totalDebts} sinh viên đang nợ môn này`;

    const modalList = document.getElementById('modalStudentList');
    modalList.innerHTML = subj.debtStudents.map((st, i) => {
        return `
            <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                <div>
                    <div class="font-bold text-slate-800">${i + 1}. ${st.name}</div>
                    <div class="text-slate-500 mt-0.5">MSSV: ${st.id} • Lớp: ${st.className}</div>
                </div>
                <div class="text-right">
                    <span class="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 font-bold">${st.reason}</span>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('subjectDetailModal').classList.remove('hidden');
}

function closeSubjectModal() {
    document.getElementById('subjectDetailModal').classList.add('hidden');
}

// Define the new semester structure for planning
const SEMESTER_PLANNING_OPTIONS = [
    "Kỳ 1.1", "Kỳ 1.2", "Kỳ 1.3",
    "Kỳ 2.1", "Kỳ 2.2", "Kỳ 2.3",
    "Kỳ 3.1", "Kỳ 3.2", "Kỳ 3.3"
];

// -------------------------------------------------------------
// GRADUATION PLANNERS & SEMESTER PLANNING FUNCTIONS
// -------------------------------------------------------------

function buildPlannerAssessment(student) {
    return analyzeStudentAgainstFramework(
        student,
        globalData.frameworkCourses || [],
        globalData.frameworkMetadata || {}
    );
}

function openPlannerModal(studentId) {
    const student = globalData.students.find(s => s.id === studentId);
    if (!student) return;

    currentSelectedStudentForPlanner = student;

    // Set header details
    document.getElementById('plannerModalStudentInfo').innerHTML = `
        Sinh viên: <span class="font-bold text-white text-sm">${student.name}</span> •
        MSSV: <span class="font-bold text-white">${student.id}</span> •
        Lớp: <span class="font-bold text-white">${student.className}</span>
    `;

    // Calculate planner status using required courses and elective groups.
    const assessment = buildPlannerAssessment(student);
    const totalFrameworkCredits = globalData.frameworkMetadata.totalCredits || 1;
    const progressPercent = Math.min(100, ((assessment.passedCredits / totalFrameworkCredits) * 100)).toFixed(1);

    document.getElementById('plannerProgressPercent').innerText = `${progressPercent}% (${assessment.passedCredits}/${totalFrameworkCredits} TC)`;
    document.getElementById('plannerProgressBar').style.width = `${progressPercent}%`;
    document.getElementById('plannerPassedCount').innerText = assessment.passedCount;
    document.getElementById('plannerFailedCount').innerText = assessment.failedCount;
    document.getElementById('plannerUnstudiedCount').innerText = assessment.unstudiedCount;

    student.plannerAssessment = assessment;
    student.stats = {
        passedCredits: assessment.passedCredits,
        failedCredits: assessment.failedCredits,
        unstudiedCredits: assessment.unstudiedCredits,
        totalFrameworkCredits,
        progressPercent,
        passedCount: assessment.passedCount,
        failedCount: assessment.failedCount,
        unstudiedCount: assessment.unstudiedCount
    };

    renderRoadmapTab(assessment.roadmapGroups);
    renderPlannerTab();



    // Reset default active tab
    switchPlannerTab('roadmap');

    document.getElementById('studentPlannerModal').classList.remove('hidden');
}

function closePlannerModal() {
    document.getElementById('studentPlannerModal').classList.add('hidden');
    currentSelectedStudentForPlanner = null;
    // Re-render students list to show updated indicators if any
    renderStudentsTab();
}

function switchPlannerTab(tabName) {
    currentPlannerTab = tabName;
    document.querySelectorAll('.planner-tab-btn').forEach(btn => {
        btn.classList.remove('bg-brand-50', 'text-brand-700', 'font-bold');
        btn.classList.add('text-slate-600', 'font-semibold');
    });

    const activeBtn = document.getElementById(`plannerTabBtn-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-brand-50', 'text-brand-700', 'font-bold');
        activeBtn.classList.remove('text-slate-600', 'font-semibold');
    }

    document.querySelectorAll('.planner-tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(`plannerTabContent-${tabName}`).classList.remove('hidden');
}

// Render matching alignment categorized by Knowledge Blocks
function renderRoadmapTab(roadmapGroups) {
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

// Render study planner for remaining courses
function renderPlannerTab() {
    const student = currentSelectedStudentForPlanner;
    const container = document.getElementById('plannerTabContent-planner');
    container.innerHTML = '';

    const assessment = student.plannerAssessment || buildPlannerAssessment(student);
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
                        ${SEMESTER_PLANNING_OPTIONS.map(opt => `
                            <option value="${opt}" ${currentSemester === opt ? 'selected' : ''}>${opt}</option>
                        `).join('')}
                    </select>
                </div>
            </div>
        `;
        selectorContainer.insertAdjacentHTML('beforeend', selectHtml);
    });

    updateSemestersSummaryView();
}

function updatePlannerSemester(courseCode, semesterVal) {
    const student = currentSelectedStudentForPlanner;
    if (!student) return;

    if (semesterVal === '') {
        delete student.studyPlan[courseCode];
    } else {
        student.studyPlan[courseCode] = semesterVal;
    }

    updateSemestersSummaryView();
}

// Calculate planned credits and update semester summary display
function updateSemestersSummaryView() {
    const student = currentSelectedStudentForPlanner;
    if (!student) return;

    const semesters = SEMESTER_PLANNING_OPTIONS;
    const container = document.getElementById('plannerSemestersSummary');
    container.innerHTML = '';

    const frameworkCourses = globalData.frameworkCourses;

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

function printPlanner() {
    const student = currentSelectedStudentForPlanner;
    if (!student) return;

    const printArea = document.getElementById('printablePlanArea');
    printArea.innerHTML = '';

    const semesters = SEMESTER_PLANNING_OPTIONS;
    let plannedTablesHtml = '';

    semesters.forEach(semName => {
        let plannedCourses = [];
        let plannedCredits = 0;

        Object.entries(student.studyPlan).forEach(([code, sem]) => {
            if (sem === semName) {
                const cObj = globalData.frameworkCourses.find(c => c.courseCode === code);
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

// -------------------------------------------------------------
// CORE NOTIFICATION & SYSTEM LOGIC
// -------------------------------------------------------------

function openSendModal(studentId = null, subjectName = null) {
    const modal = document.getElementById('sendNotificationModal');
    const title = document.getElementById('sendModalTitle');
    const studentInfo = document.getElementById('sendModalStudentInfo');
    const recipientField = document.getElementById('sendModalRecipient');
    const subjectField = document.getElementById('sendModalSubject');
    const bodyField = document.getElementById('sendModalBody');

    if (studentId) {
        // Gửi cho 1 sinh viên
        const student = globalData.students.find(s => s.id === studentId);
        if (!student) return showCustomMessage("Không tìm thấy sinh viên!", "error");

        title.innerText = "Gửi Thông Báo Tới Sinh Viên";
        studentInfo.innerHTML = `
            <span class="font-bold text-slate-800 text-sm">${student.name}</span>
            <span class="text-xs bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-500">MSSV: ${student.id}</span>
        `;
        studentInfo.classList.remove('hidden');

        recipientField.value = student.email || `${student.id}@st.phenikaa-uni.edu.vn`;
        subjectField.value = `[Thông báo] V/v kết quả học tập và các môn cần xử lý của sinh viên ${student.name}`;
        
        const debtSubjects = student.debts.map(d => `- ${d.subjectName} (Lý do: ${d.reason})`).join('\n');
        bodyField.value = `Chào em ${student.name},\n\nKhoa Công nghệ thông tin thông báo về tình hình học tập của em.\nHiện tại, hệ thống ghi nhận em đang có ${student.debts.length} môn học chưa đạt, cần phải xử lý, cụ thể:\n\n${debtSubjects}\n\nĐề nghị em theo dõi lịch của phòng Đào tạo và các thông báo của Khoa để đăng ký học lại/thi lại các học phần trên trong thời gian sớm nhất.\n\nTrân trọng,\nKhoa Công nghệ thông tin.`;

        modal.dataset.studentId = studentId;
        modal.dataset.mode = 'single';
    } else if (subjectName) {
        // Gửi hàng loạt cho những người nợ 1 môn cụ thể
        const decodedSubjectName = decodeURIComponent(subjectName);
        const subjectData = globalData.subjectsMap[decodedSubjectName];
        if (!subjectData) return showCustomMessage("Không tìm thấy môn học!", "error");

        title.innerText = "Gửi Thông Báo Hàng Loạt";
        studentInfo.innerHTML = `Gửi tới: <span class="font-bold">${subjectData.debtStudents.length} sinh viên đang nợ môn "${decodedSubjectName}"</span>`;
        studentInfo.classList.remove('hidden');

        recipientField.value = "{email_sv} hoặc +84{mssv}";
        subjectField.value = `[Thông báo] V/v xử lý học phần chưa đạt: ${decodedSubjectName}`;
        bodyField.value = `Chào em {ho_ten},\n\nKhoa Công nghệ thông tin thông báo.\nHiện tại, hệ thống ghi nhận em đang có học phần "${decodedSubjectName}" chưa đạt.\n\nĐề nghị em theo dõi lịch của phòng Đào tạo và các thông báo của Khoa để đăng ký học lại/thi lại học phần trên trong thời gian sớm nhất.\n\nTrân trọng,\nKhoa Công nghệ thông tin.`;

        modal.dataset.studentId = '';
        modal.dataset.mode = 'bulk_subject';
        modal.dataset.subjectName = subjectName;
    } else {
        // Gửi hàng loạt theo bộ lọc tab Sinh viên
        const classFilter = document.getElementById('classFilterSelect').value;
        const targetText = classFilter === 'ALL' ? 'tất cả sinh viên đang nợ môn' : `sinh viên nợ môn thuộc lớp ${classFilter}`;

        title.innerText = "Gửi Thông Báo Hàng Loạt";
        studentInfo.innerHTML = `Gửi tới: <span class="font-bold">${targetText}</span>`;
        studentInfo.classList.remove('hidden');

        recipientField.value = "{email_sv} hoặc +84{mssv}";
        subjectField.value = `[Thông báo] V/v kết quả học tập và các môn cần xử lý`;
        bodyField.value = `Chào em {ho_ten},\n\nKhoa Công nghệ thông tin thông báo về tình hình học tập của em.\nHiện tại, hệ thống ghi nhận em đang có {so_mon_no} môn học chưa đạt, cần phải xử lý, cụ thể:\n\n{danh_sach_mon_no}\n\nĐề nghị em theo dõi lịch của phòng Đào tạo và các thông báo của Khoa để đăng ký học lại/thi lại các học phần trên trong thời gian sớm nhất.\n\nTrân trọng,\nKhoa Công nghệ thông tin.`;

        modal.dataset.studentId = '';
        modal.dataset.mode = 'bulk_filter';
        modal.dataset.subjectName = '';
    }

    modal.classList.remove('hidden');
}

function closeSendModal() {
    document.getElementById('sendNotificationModal').classList.add('hidden');
}

async function logNotification() {
    if (!firebaseUser) {
        return showCustomMessage("Bạn cần đăng nhập để thực hiện hành động này.", "error");
    }

    const modal = document.getElementById('sendNotificationModal');
    const mode = modal.dataset.mode;
    const studentId = modal.dataset.studentId;
    const subjectName = modal.dataset.subjectName;
    const subject = document.getElementById('sendModalSubject').value;
    const bodyTemplate = document.getElementById('sendModalBody').value;
    const type = document.querySelector('input[name="sendType"]:checked').value;
    const logsCollection = collection(db, "communication_logs");

    let targets = [];
    if (mode === 'single') {
        const student = globalData.students.find(s => s.id === studentId);
        if (student) targets.push(student);
    } else if (mode === 'bulk_filter') {
        const classFilter = document.getElementById('classFilterSelect').value;
        targets = globalData.students.filter(s => {
            const inClass = (classFilter === 'ALL' || s.className === classFilter);
            return inClass && s.debts.length > 0;
        });
    } else if (mode === 'bulk_subject') {
        const decodedSubjectName = decodeURIComponent(subjectName);
        const studentIds = globalData.subjectsMap[decodedSubjectName]?.debtStudents.map(s => s.id) || [];
        targets = globalData.students.filter(s => studentIds.includes(s.id));
    }

    if (targets.length === 0) {
        return showCustomMessage("Không có sinh viên nào phù hợp để gửi thông báo.", "error");
    }

    showCustomMessage(`Đang tạo ${targets.length} log thông báo...`);

    let senderName = firebaseUser.email.split('@')[0];
    try {
        const userProfileSnap = await getDoc(doc(db, "user_profiles", firebaseUser.uid));
        if (userProfileSnap.exists() && userProfileSnap.data().displayName) {
            senderName = userProfileSnap.data().displayName;
        }
    } catch (e) { console.error("Could not fetch sender profile:", e); }

    // Use WriteBatch for performance
    const maxBatchSize = 500; // Firestore batch limit
    let batch = writeBatch(db);
    let operationCount = 0;

    try {
        for (let i = 0; i < targets.length; i++) {
            const student = targets[i];
            const debtListStr = student.debts.map(d => `- ${d.subjectName} (Lý do: ${d.reason})`).join('\n');
            const body = bodyTemplate
                .replace(/{ho_ten}/g, student.name)
                .replace(/{mssv}/g, student.id)
                .replace(/{so_mon_no}/g, student.debts.length)
                .replace(/{danh_sach_mon_no}/g, debtListStr);
            
            const recipient = type === 'email' 
                ? (student.email || `${student.id}@st.phenikaa-uni.edu.vn`)
                : `+84${student.id}`;

            const newLogRef = doc(logsCollection); // Create a new doc reference
            batch.set(newLogRef, {
                studentId: student.id,
                studentName: student.name,
                type: type,
                recipient: recipient,
                subject: subject.replace(/{ho_ten}/g, student.name),
                body: body,
                sentBy_uid: firebaseUser.uid,
                sentBy_name: senderName,
                sentAt: serverTimestamp()
            });
            operationCount++;

            // If batch is full or it's the last item, commit the batch
            if (operationCount === maxBatchSize || i === targets.length - 1) {
                await batch.commit();
                batch = writeBatch(db); // Start a new batch
                operationCount = 0;
            }
        }
    } catch (e) {
        console.error("Error writing batch to Firebase:", e);
        showCustomMessage(`Lỗi khi lưu hàng loạt: ${e.message}`, "error");
        return;
    }

    showCustomMessage(`Đã lưu thành công ${targets.length} log thông báo!`, "success");
    closeSendModal();
}

function downloadReportWorkbook(filename, sheets) {
    const workbook = XLSX.utils.book_new();
    sheets.forEach(sheet => {
        const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
        if (sheet.widths) {
            worksheet['!cols'] = sheet.widths.map(wch => ({ wch }));
        }
        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.sheetName || sheet.name);
    });
    XLSX.writeFile(workbook, filename);
}

function exportToExcel() {
    if (!globalData.students || globalData.students.length === 0) {
        showCustomMessage("Chưa có dữ liệu để xuất file!", "error");
        return;
    }

    const report = buildDebtReport(globalData.students);

    if (report.rows.length === 0) {
        showCustomMessage("Tất cả sinh viên đều đã đạt/sạch nợ, không có dữ liệu nợ để xuất!");
        return;
    }

    downloadReportWorkbook(report.filename, [{ ...report, name: report.sheetName }]);
    showCustomMessage("Đã xuất file báo cáo Excel thành công!");
}

function exportSummaryToExcel() {
    if (!globalData.students || globalData.students.length === 0) {
        showCustomMessage("Chưa có dữ liệu để xuất file!", "error");
        return;
    }

    const report = buildDebtSummaryReport(globalData.students);
    if (report.rows.length === 0) {
        showCustomMessage("Tất cả sinh viên đều đã đạt/sạch nợ, không có dữ liệu tổng hợp để xuất!");
        return;
    }

    downloadReportWorkbook(report.filename, [{ ...report, name: report.sheetName }]);
    showCustomMessage("Đã xuất file báo cáo tổng hợp Excel thành công!");
}

function exportClassOpeningReport() {
    if (!globalData.students || globalData.students.length === 0) {
        showCustomMessage("Chưa có dữ liệu sinh viên để xuất!", "error");
        return;
    }

    if (!globalData.frameworkCourses || globalData.frameworkCourses.length === 0) {
        showCustomMessage("Vui lòng tải lên khung chương trình trước khi xuất nhu cầu mở lớp.", "error");
        return;
    }

    const report = analyzeFrameworkDemand(
        globalData.students,
        globalData.frameworkCourses,
        globalData.frameworkMetadata || {}
    );

    const sheets = buildClassOpeningReportSheets(report, globalData.frameworkCourses);
    downloadReportWorkbook("Bao_Cao_Nhu_Cau_Mo_Lop_Theo_Khung.xlsx", sheets);
    showCustomMessage("Đã xuất báo cáo nhu cầu mở lớp theo khung chương trình!", "success");
}

async function renderLogsTab() {
    const container = document.getElementById('logsContainer');
    container.innerHTML = `
        <div class="text-center py-10">
            <div class="w-8 h-8 border-4 border-brand-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p class="mt-3 text-sm text-slate-500 font-medium">Đang tải nhật ký từ Firebase...</p>
        </div>
    `;

    if (!firebaseUser) {
        container.innerHTML = `<div class="text-center py-10 text-rose-600 font-medium">Vui lòng đăng nhập để xem nhật ký.</div>`;
        return;
    }

    try {
        const q = query(collection(db, "communication_logs"), orderBy("sentAt", "desc"), limit(50));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            container.innerHTML = `
                <div class="text-center py-12 bg-white rounded-3xl border border-slate-100">
                    <i class="fa-solid fa-comment-slash text-4xl text-slate-300 mb-3"></i>
                    <p class="text-slate-500 font-medium">Chưa có nhật ký thông báo nào được ghi lại.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = ''; // Clear loading
        querySnapshot.forEach(docSnap => {
            const log = docSnap.data();
            const sentAt = log.sentAt ? log.sentAt.toDate().toLocaleString('vi-VN') : 'Không rõ';
            const icon = log.type === 'email' 
                ? '<i class="fa-solid fa-envelope text-sky-600"></i>' 
                : '<i class="fa-solid fa-comment-sms text-green-600"></i>';

            container.innerHTML += `
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
        });
    } catch (error) {
        console.error("Error fetching logs:", error);
        container.innerHTML = `<div class="text-center py-10 text-rose-600 font-medium">Đã xảy ra lỗi khi tải nhật ký: ${error.message}</div>`;
    }
}
