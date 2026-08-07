import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Initialize Firebase for this page
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let firebaseUser = null;

let globalData = {
    sheets: [],
    students: [],
    subjectsMap: {},
    classList: []
};

let currentTab = 'overview';
let chartInstance = null;

// Initialize Drag-and-Drop support on page load
window.addEventListener('DOMContentLoaded', () => {
    setupDragAndDrop();

    // --- GẮN CÁC HÀM VÀO WINDOW ĐỂ HTML CÓ THỂ GỌI ---
    // Do script được load dưới dạng module, các hàm không tự động có sẵn trên global scope.
    window.handleFileUpload = handleFileUpload;
    window.loadDemoData = loadDemoData;
    window.exportToExcel = exportToExcel;
    window.switchTab = switchTab;
    window.renderStudentsTab = renderStudentsTab;
    window.renderSubjectsTab = renderSubjectsTab;
    window.toggleAccordion = toggleAccordion;
    window.openSubjectModal = openSubjectModal;
    window.closeSubjectModal = closeSubjectModal;
    window.openSendModal = openSendModal;
    window.closeSendModal = closeSendModal;
    window.logNotification = logNotification;
    window.renderLogsTab = renderLogsTab;

    // Gắn sự kiện cho các input file
    document.getElementById('excelFileInput').addEventListener('change', handleFileUpload);
    document.getElementById('excelFileInputHeader').addEventListener('change', handleFileUpload);

    
    // Listen for Firebase auth state
    onAuthStateChanged(auth, (user) => {
        if (user) {
            firebaseUser = user;
            showCustomMessage(`Đã xác thực người dùng: ${user.email}`, 'success');
        } else {
            firebaseUser = null;
            showCustomMessage("Chưa đăng nhập! Vui lòng đăng nhập ở trang chính để sử dụng tính năng lưu log.", "error");
        }
    });

    // Render the initial view
    renderDashboard();
});

function setupDragAndDrop() {
    const dropArea = document.getElementById('uploadSection');
    if (!dropArea) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('drop-active'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('drop-active'), false);
    });

    dropArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            processFile(files[0]);
        }
    });
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

function normalizeText(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d").replace(/Đ/g, "D")
        .toUpperCase()
        .trim();
}

// Extract the latest attempt from values separated by pipe "|"
function getLatestAttempt(value) {
    if (value === null || value === undefined) return '';
    const str = String(value).trim();
    if (str.includes('|')) {
        const parts = str.split('|');
        return parts[parts.length - 1].trim(); // Get the last element
    }
    return str;
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) processFile(file);
}

function processFile(file) {
    document.getElementById('loadingSpinner').classList.remove('hidden');

    setTimeout(() => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                parseWorkbook(workbook);
                
                // Data is loaded, re-render the dashboard
                renderDashboard();
            } catch (err) {
                console.error("Error parsing Excel:", err);
                showCustomMessage("Có lỗi xảy ra khi đọc tệp Excel. Vui lòng kiểm tra lại định dạng tệp!", "error");
            } finally {
                document.getElementById('loadingSpinner').classList.add('hidden');
            }
        };
        reader.readAsArrayBuffer(file);
    }, 50);
}

function parseWorkbook(workbook) {
    globalData = {
        sheets: workbook.SheetNames,
        students: [],
        subjectsMap: {},
        classList: workbook.SheetNames
    };

    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return;

        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (!rawData || rawData.length < 5) return;

        // 1. Propagate merged cells so every cell in the span receives its header text
        if (sheet['!merges']) {
            sheet['!merges'].forEach(range => {
                const startVal = rawData[range.s.r] ? rawData[range.s.r][range.s.c] : '';
                if (startVal !== undefined && startVal !== null && String(startVal).trim() !== '') {
                    for (let r = range.s.r; r <= range.e.r; r++) {
                        if (!rawData[r]) rawData[r] = [];
                        for (let c = range.s.c; c <= range.e.c; c++) {
                            if (!rawData[r][c] || String(rawData[r][c]).trim() === '') {
                                rawData[r][c] = startVal;
                            }
                        }
                    }
                }
            });
        }

        // 2. Identify Subheader and Header Rows
        let subHeaderRowIdx = -1;
        let maxKeywordsFound = -1;

        for (let r = 0; r < Math.min(30, rawData.length); r++) {
            const row = rawData[r] || [];
            const rowStr = row.map(cell => normalizeText(cell)).join(' ');
            
            let count = 0;
            if (rowStr.includes('TKHP') || rowStr.includes('DIEM HP') || rowStr.includes('TONG KET') || rowStr.includes('DIEM THI')) count += 3;
            if (rowStr.includes('DIEM CHU') || rowStr.includes('CHU')) count += 2;
            if (rowStr.includes('DANH GIA') || rowStr.includes('GHI CHU') || rowStr.includes('KET QUA')) count += 2;
            if (rowStr.includes('STT') || rowStr.includes('MASV') || rowStr.includes('MSSV')) count += 2;

            if (count > maxKeywordsFound) {
                maxKeywordsFound = count;
                subHeaderRowIdx = r;
            }
        }

        if (subHeaderRowIdx === -1) subHeaderRowIdx = 10;

        // 3. Detect Student Info Columns
        let sttColIdx = 0, idColIdx = 1, hoColIdx = -1, tenColIdx = -1, nameColIdx = 4, dobColIdx = 6, emailColIdx = -1;

        for (let r = Math.max(0, subHeaderRowIdx - 4); r <= Math.min(rawData.length - 1, subHeaderRowIdx + 1); r++) {
            const row = rawData[r] || [];
            row.forEach((cell, cIdx) => {
                const norm = normalizeText(cell);
                if ((norm === 'STT' || norm === 'NO' || norm === 'SO TT') && cIdx < 5) sttColIdx = cIdx;
                else if ((norm.includes('MA SV') || norm.includes('MASV') || norm.includes('MSSV')) && cIdx < 8) idColIdx = cIdx;
                else if ((norm.includes('HO VA DEM') || norm.includes('HO DEM') || norm === 'HO') && cIdx < 9) hoColIdx = cIdx;
                else if ((norm === 'TEN' || norm.includes('TEN SINH VIEN')) && !norm.includes('HO') && cIdx < 9) tenColIdx = cIdx;
                else if ((norm.includes('HO TEN') || norm.includes('HO VA TEN')) && cIdx < 10) nameColIdx = cIdx;
                else if ((norm.includes('NGAY SINH') || norm === 'NS' || norm.includes('N.SINH')) && cIdx < 12) dobColIdx = cIdx;
                else if (norm.includes('EMAIL') && cIdx < 12) emailColIdx = cIdx;
            });
        }

        let lastStudentInfoCol = Math.max(sttColIdx, idColIdx, dobColIdx);
        if (nameColIdx !== -1) lastStudentInfoCol = Math.max(lastStudentInfoCol, nameColIdx);
        if (hoColIdx !== -1) lastStudentInfoCol = Math.max(lastStudentInfoCol, hoColIdx);
        if (tenColIdx !== -1) lastStudentInfoCol = Math.max(lastStudentInfoCol, tenColIdx);
        if (emailColIdx !== -1) lastStudentInfoCol = Math.max(lastStudentInfoCol, emailColIdx);

        const firstSubjectCol = lastStudentInfoCol + 1;
        const subHeaderRow = rawData[subHeaderRowIdx] || [];

        // Helper to detect summary columns at end of sheet
        const isSummaryColumn = (cIdx) => {
            for (let r = Math.max(0, subHeaderRowIdx - 3); r <= subHeaderRowIdx; r++) {
                const val = normalizeText(rawData[r] ? rawData[r][cIdx] : '');
                if (val.includes('TONG SO') || val.includes('TICH LUY') || 
                    val.includes('DIEM TRUNG BINH') || val.includes('DTB') || 
                    val.includes('XEP LOAI') || val.includes('SO HOC PHAN HOC LAI') ||
                    val.includes('SO HOC PHAN THI LAI') || val.includes('REN LUYEN') ||
                    val.includes('GHI CHU TOAN KHOA')) {
                    return true;
                }
            }
            return false;
        };

        // 4. Extract Subject Names & Column Mapping
        let subjectsInSheet = [];
        let maxCols = 0;
        for (let r = 0; r < Math.min(subHeaderRowIdx + 5, rawData.length); r++) {
            if (rawData[r] && rawData[r].length > maxCols) maxCols = rawData[r].length;
        }

        let currentSubjectName = "";

        for (let c = firstSubjectCol; c < maxCols; c++) {
            if (isSummaryColumn(c)) break;

            let rawSubjName = "";
            for (let r = subHeaderRowIdx - 1; r >= 0; r--) {
                const val = String(rawData[r] ? rawData[r][c] || '' : '').trim();
                const normVal = normalizeText(val);
                if (val !== '' && !normVal.includes('STT') && !normVal.includes('MSSV') && !normVal.includes('BANG DIEM') && !normVal.includes('KHOA') && normVal.length > 2) {
                    rawSubjName = val.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
                    break;
                }
            }

            let rawSubHeader = normalizeText(subHeaderRow[c] || '');

            if (rawSubjName !== "") {
                currentSubjectName = rawSubjName;
            }

            if (currentSubjectName) {
                let existingSubj = subjectsInSheet.find(s => s.name === currentSubjectName && s.endCol === c - 1);
                if (existingSubj) {
                    existingSubj.endCol = c;
                    existingSubj.cols.push({ colIdx: c, subHeader: rawSubHeader });
                } else {
                    subjectsInSheet.push({
                        name: currentSubjectName,
                        startCol: c,
                        endCol: c,
                        cols: [{ colIdx: c, subHeader: rawSubHeader }]
                    });
                }
            }
        }

        // Map sub-columns for each subject
        subjectsInSheet.forEach(s => {
            s.colTKHP = -1;
            s.colDiemChu = -1;
            s.colDanhGia = -1;

            s.cols.forEach(colObj => {
                const sub = colObj.subHeader;
                if (sub.includes('TKHP') || sub.includes('DIEM HP') || sub.includes('TONG KET') || sub.includes('THANG 10') || sub.includes('DIEM THI') || sub.includes('DIEM TKN')) {
                    if (s.colTKHP === -1) s.colTKHP = colObj.colIdx;
                }
                else if (sub.includes('DIEM CHU') || sub.includes('CHU')) {
                    if (s.colDiemChu === -1) s.colDiemChu = colObj.colIdx;
                }
                else if (sub.includes('DANH GIA') || sub.includes('GHI CHU') || sub.includes('TRANG THAI') || sub.includes('KET QUA') || sub.includes('DAT/KD') || sub.includes('DAT')) {
                    if (s.colDanhGia === -1) s.colDanhGia = colObj.colIdx;
                }
            });

            if (s.colTKHP === -1 && s.cols.length > 0) s.colTKHP = s.cols[0].colIdx;
            if (s.colDiemChu === -1 && s.cols.length > 1) s.colDiemChu = s.cols[1].colIdx;
            if (s.colDanhGia === -1 && s.cols.length > 2) s.colDanhGia = s.cols[2].colIdx;

            if (!globalData.subjectsMap[s.name]) {
                globalData.subjectsMap[s.name] = {
                    name: s.name,
                    totalDebts: 0,
                    debtStudents: []
                };
            }
        });

        // 5. Evaluate Student Rows accurately (Checking LATEST attempt after "|")
        for (let r = subHeaderRowIdx + 1; r < rawData.length; r++) {
            const row = rawData[r];
            if (!row || row.length === 0) continue;

            const sttVal = String(row[sttColIdx] || '').trim();
            const id = String(row[idColIdx] || '').trim();
            
            let fullName = '';
            if (hoColIdx !== -1 && tenColIdx !== -1) {
                const ho = String(row[hoColIdx] || '').trim();
                const ten = String(row[tenColIdx] || '').trim();
                fullName = (ho + ' ' + ten).trim();
            } else if (nameColIdx !== -1) {
                fullName = String(row[nameColIdx] || '').trim();
            }

            const dob = dobColIdx !== -1 ? String(row[dobColIdx] || '').trim() : '';
            let email = emailColIdx !== -1 ? String(row[emailColIdx] || '').trim() : '';

            // Auto-generate email if empty but ID is valid
            if (!email && id.length >= 6 && !isNaN(Number(id))) {
                email = `${id}@phenikaa-uni.edu.vn`;
            }

            const parsedStt = parseInt(sttVal, 10);
            const isSttNumber = !isNaN(parsedStt) && parsedStt > 0 && String(sttVal).toLowerCase().indexOf('tín chỉ') === -1;
            const isIdValid = id.length >= 6 && !id.toUpperCase().includes('MSSV') && !id.toUpperCase().includes('MÃ');

            if (isSttNumber && isIdValid) {
                let studentDebts = [];

                subjectsInSheet.forEach(subj => {
                    const rawTkhp = subj.colTKHP !== -1 ? row[subj.colTKHP] : null;
                    const rawDiemChu = subj.colDiemChu !== -1 ? row[subj.colDiemChu] : null;
                    const rawDanhGia = subj.colDanhGia !== -1 ? row[subj.colDanhGia] : null;

                    // EXTRACT LATEST ATTEMPT (AFTER "|")
                    const latestTkhpStr = getLatestAttempt(rawTkhp);
                    const latestDiemChuStr = getLatestAttempt(rawDiemChu);
                    const latestDanhGiaStr = getLatestAttempt(rawDanhGia);

                    const normDanhGia = normalizeText(latestDanhGiaStr);
                    const normDiemChu = normalizeText(latestDiemChuStr);

                    let isDebt = false;
                    let reason = '';

                    // Check if latest attempt is explicitly passed
                    const isExplicitPass = normDiemChu === 'P' || normDiemChu === 'M' || normDiemChu === 'DAT' || 
                                           normDiemChu === 'PASS' || normDanhGia === 'DAT' || normDanhGia === 'PASS' || 
                                           normDanhGia === 'MIEN' || normDanhGia === 'HOAN' ||
                                           ['A', 'A+', 'B+', 'B', 'C+', 'C', 'D+', 'D'].includes(normDiemChu);

                    if (!isExplicitPass) {
                        if (normDanhGia.includes('HOC LAI') || normDanhGia.includes('THI LAI') || 
                            normDanhGia.includes('KHONG DAT') || normDanhGia.includes('HOCLAI') || 
                            normDanhGia.includes('THILAI') || normDanhGia.includes('KDAT') || 
                            normDanhGia.includes('TRUOT') || normDanhGia.includes('CAM THI') ||
                            normDanhGia.includes('VANG THI') || normDanhGia === 'NO' || 
                            normDanhGia === 'FAIL' || normDanhGia === 'KD' || normDanhGia === 'VT' || normDanhGia === 'CT') {
                            isDebt = true;
                            reason = String(rawDanhGia || 'Chưa đạt / Học lại');
                        } 
                        else if (normDiemChu === 'F' || normDiemChu.startsWith('F(') || normDiemChu === 'F*' || normDiemChu === 'F+' || normDiemChu === 'KD' || normDiemChu === 'VT' || normDiemChu === 'CT') {
                            isDebt = true;
                            reason = `Điểm chữ: ${rawDiemChu}`;
                        } 
                        else if (latestTkhpStr !== '' && !isNaN(Number(latestTkhpStr))) {
                            const numTkhp = Number(latestTkhpStr);
                            if (numTkhp >= 0 && numTkhp < 4.0) {
                                isDebt = true;
                                reason = `TKHP: ${rawTkhp} (< 4.0)`;
                            }
                        }
                    }

                    if (isDebt) {
                        studentDebts.push({
                            subjectName: subj.name,
                            tkhp: rawTkhp,
                            diemChu: rawDiemChu,
                            danhGia: rawDanhGia,
                            reason: reason
                        });

                        globalData.subjectsMap[subj.name].totalDebts++;
                        globalData.subjectsMap[subj.name].debtStudents.push({
                            id: id,
                            name: fullName || 'Chưa rõ tên',
                            className: sheetName,
                            reason: reason,
                            tkhp: rawTkhp,
                            diemChu: rawDiemChu
                        });
                    }
                });

                globalData.students.push({
                    stt: parsedStt,
                    id: id,
                    name: fullName || 'Chưa rõ tên',
                    dob: dob,
                    email: email,
                    className: sheetName,
                    debts: studentDebts
                });
            }
        }
    });

    populateFilters();
    renderDashboard();
}

function loadDemoData() {
    globalData = {
        sheets: ['K17-KTPM(EL)_1', 'K17-KTPM(EL)_2'],
        classList: ['K17-KTPM(EL)_1', 'K17-KTPM(EL)_2'],
        students: [],
        subjectsMap: {}
    };

    const sampleSubjects = [
        'Giải tích 2 - FFS703064',
        'Đại số tuyến tính - FFS703007',
        'Vật lý 1 - FFS703013',
        'Toán rời rạc - CSE703024',
        'Cơ sở lập trình - CSE703107',
        'Cấu trúc dữ liệu và thuật toán - CSE703006'
    ];

    sampleSubjects.forEach(s => {
        globalData.subjectsMap[s] = { name: s, totalDebts: 0, debtStudents: [] };
    });

    const mockStudents = [
        { id: '23010342', name: 'Nguyễn Duy Anh', cls: 'K17-KTPM(EL)_1', debts: [{ subj: 'Giải tích 2 - FFS703064', reason: 'HOCLAI', tkhp: 0.0, diemChu: 'F' }] },
        { id: '23010357', name: 'Nguyễn Quang Anh', cls: 'K17-KTPM(EL)_1', debts: [{ subj: 'Giải tích 2 - FFS703064', reason: 'TKHP: 3.9 (< 4.0)', tkhp: 3.9, diemChu: 'F' }] },
        { id: '23010442', name: 'Vũ Đức Anh', cls: 'K17-KTPM(EL)_1', debts: [{ subj: 'Đại số tuyến tính - FFS703007', reason: 'HOCLAI', tkhp: 0.0, diemChu: 'F' }, { subj: 'Cơ sở lập trình - CSE703107', reason: 'TKHP: 3.4 (< 4.0)', tkhp: 3.4, diemChu: 'F' }] },
        { id: '23010180', name: 'Nguyễn Viết Bin', cls: 'K17-KTPM(EL)_1', debts: [{ subj: 'Vật lý 1 - FFS703013', reason: 'HOCLAI', tkhp: 0.0, diemChu: 'F' }] },
        { id: '23010283', name: 'Trần Ngọc An', cls: 'K17-KTPM(EL)_1', debts: [] }
    ];

    mockStudents.forEach((st, idx) => {
        let formattedDebts = [];
        st.debts.forEach(d => {
            formattedDebts.push({
                subjectName: d.subj,
                tkhp: d.tkhp,
                diemChu: d.diemChu,
                danhGia: d.reason,
                reason: d.reason
            });

            globalData.subjectsMap[d.subj].totalDebts++;
            globalData.subjectsMap[d.subj].debtStudents.push({
                id: st.id,
                name: st.name,
                className: st.cls,
                reason: d.reason,
                tkhp: d.tkhp,
                diemChu: d.diemChu
            });
        });

        globalData.students.push({
            stt: idx + 1,
            id: st.id,
            name: st.name,
            dob: '2003-08-15',
            email: `${st.id}@phenikaa-uni.edu.vn`,
            className: st.cls,
            debts: formattedDebts
        });
    });

    populateFilters();
    renderDashboard();
    showCustomMessage("Đã nạp dữ liệu mẫu thử nghiệm thành công!");
}

function populateFilters() {
    const classFilter = document.getElementById('classFilterSelect');
    classFilter.innerHTML = '<option value="ALL">Tất cả Lớp / Sheet</option>';
    globalData.classList.forEach(cls => {
        classFilter.innerHTML += `<option value="${cls}">${cls}</option>`;
    });

    document.getElementById('sheetCountBadge').innerText = `${globalData.sheets.length} Sheet / Lớp`;
}

function switchTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'text-brand-700', 'shadow-sm', 'font-semibold');
        btn.classList.add('text-slate-600', 'font-medium');
    });

    const activeBtn = document.getElementById(`tabBtn-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-white', 'text-brand-700', 'shadow-sm', 'font-semibold');
        activeBtn.classList.remove('text-slate-600', 'font-medium');
    }

    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    document.getElementById(`tabContent-${tabName}`).classList.remove('hidden');

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

    // Always show the dashboard, hide the initial full-page upload section
    if (uploadSection) uploadSection.classList.add('hidden');
    if (dashboardSection) dashboardSection.classList.remove('hidden');

    if (hasData) {
        if (headerActions) headerActions.classList.remove('hidden');
        // If there's data, switch to the overview tab by default
        // and ensure the empty state is hidden.
        document.getElementById('emptyStateContainer').classList.add('hidden');
        switchTab(currentTab); // Stay on current tab or switch to default
    } else {
        // If there's no data, hide data-dependent tabs and show the empty state
        if (headerActions) headerActions.classList.add('hidden');
        document.getElementById('emptyStateContainer').classList.remove('hidden');
        // Default to the logs tab if no data, as it can function independently
        switchTab('logs');
    }
}

function renderOverviewTab() {
    if (globalData.students.length === 0) return; // Don't render if no data

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
    document.getElementById('kpiSubjectsWithDebt').innerText = `${subjectsWithDebt} môn có SV nợ`;

    document.getElementById('kpiTotalDebts').innerText = totalDebtsCount;
    document.getElementById('kpiAvgDebts').innerText = `TB ${avgDebts} môn / SV nợ`;

    const classListContainer = document.getElementById('classListContainer');
    classListContainer.innerHTML = '';

    globalData.classList.forEach(cls => {
        const studentsInClass = globalData.students.filter(s => s.className === cls);
        const debtInClass = studentsInClass.filter(s => s.debts.length > 0);
        const classRatio = studentsInClass.length > 0 ? ((debtInClass.length / studentsInClass.length) * 100).toFixed(1) : 0;
        const totalClassDebts = studentsInClass.reduce((a, b) => a + b.debts.length, 0);

        classListContainer.innerHTML += `
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
    });

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
                backgroundColor: 'rgba(239, 68, 68, 0.75)',
                borderColor: 'rgba(220, 38, 38, 1)',
                borderWidth: 1.5,
                borderRadius: 10,
                hoverBackgroundColor: 'rgba(220, 38, 38, 0.9)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
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
    if (globalData.students.length === 0) return; // Don't render if no data

    const searchQuery = normalizeText(document.getElementById('studentSearchInput').value);
    const classFilter = document.getElementById('classFilterSelect').value;
    const debtFilter = document.getElementById('debtFilterSelect').value;

    const container = document.getElementById('studentsListContainer');
    container.innerHTML = '';

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

    filteredStudents.forEach((st, idx) => {
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

        container.innerHTML += `
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

                    <div class="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 pt-3 md:pt-0">
                        ${statusBadge}
                        ${hasDebt ? `
                            <button onclick="openSendModal('${st.id}')" class="text-xs font-semibold text-sky-600 hover:text-sky-800 bg-sky-50 px-3 py-1.5 rounded-xl transition-colors" title="Gửi thông báo nợ môn">
                                <i class="fa-solid fa-paper-plane"></i>
                            </button>
                            <button onclick="toggleAccordion('debt-acc-${idx}')" class="text-xs font-semibold text-brand-600 hover:text-brand-800 bg-brand-50 px-3 py-1.5 rounded-xl transition-colors">
                                Chi tiết môn nợ <i class="fa-solid fa-chevron-down ml-1"></i>
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
    });
}

function toggleAccordion(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden');
}

function renderSubjectsTab() {
    if (globalData.students.length === 0) return; // Don't render if no data

    const searchQuery = normalizeText(document.getElementById('subjectSearchInput').value);
    const container = document.getElementById('subjectsGridContainer');
    container.innerHTML = '';

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

    filteredKeys.forEach(key => {
        const subj = globalData.subjectsMap[key];
        const hasDebts = subj.totalDebts > 0;

        container.innerHTML += `
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
                            <button onclick="openSendModal(null, '${encodeURIComponent(subj.name)}')" class="text-xs font-semibold text-sky-600 hover:text-sky-800 bg-sky-50 px-3 py-1.5 rounded-xl transition-colors" title="Gửi thông báo cho SV nợ môn này"><i class="fa-solid fa-paper-plane"></i></button>
                            <button onclick="openSubjectModal('${encodeURIComponent(subj.name)}')" class="text-xs font-bold text-brand-600 hover:text-brand-800 bg-brand-50 px-3 py-1.5 rounded-xl transition-colors">
                                Xem danh sách SV <i class="fa-solid fa-arrow-right ml-1"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });
}

function openSubjectModal(encodedName) {
    const name = decodeURIComponent(encodedName);
    const subj = globalData.subjectsMap[name];
    if (!subj) return;

    document.getElementById('modalSubjectName').innerText = subj.name;
    document.getElementById('modalSubjectSubtitle').innerText = `Tổng cộng: ${subj.totalDebts} sinh viên đang nợ môn này`;

    const modalList = document.getElementById('modalStudentList');
    modalList.innerHTML = '';

    subj.debtStudents.forEach((st, i) => {
        modalList.innerHTML += `
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
    });

    document.getElementById('subjectDetailModal').classList.remove('hidden');
}

function closeSubjectModal() {
    document.getElementById('subjectDetailModal').classList.add('hidden');
}

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
            <span class="font-bold">${student.name}</span>
            <span class="text-xs bg-slate-100 px-2 py-0.5 rounded">MSSV: ${student.id}</span>
        `;
        studentInfo.classList.remove('hidden');

        recipientField.value = student.email || `{${student.id}@phenikaa-uni.edu.vn}`;
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
    // Đây là hàm DEMO, nó sẽ lưu log vào Firebase thay vì gửi thật
    // Yêu cầu phải đăng nhập
    if (!firebaseUser) {
        return showCustomMessage("Bạn cần đăng nhập để thực hiện hành động này.", "error");
    }

    const modal = document.getElementById('sendNotificationModal');
    const mode = modal.dataset.mode; // 'single', 'bulk_filter', 'bulk_subject'
    const studentId = modal.dataset.studentId;
    const subjectName = modal.dataset.subjectName;
    const subject = document.getElementById('sendModalSubject').value;
    const bodyTemplate = document.getElementById('sendModalBody').value;
    const type = document.querySelector('input[name="sendType"]:checked').value;

    let targets = [];
    if (mode === 'single') {
        const student = globalData.students.find(s => s.id === studentId);
        if (student) targets.push(student);
    } else if (mode === 'bulk_filter') { // Gửi hàng loạt theo bộ lọc
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

    // Lấy tên người gửi từ profile
    let senderName = firebaseUser.email.split('@')[0];
    try {
        const userProfileSnap = await getDoc(doc(db, "user_profiles", firebaseUser.uid));
        if (userProfileSnap.exists() && userProfileSnap.data().displayName) {
            senderName = userProfileSnap.data().displayName;
        }
    } catch (e) { console.error("Could not fetch sender profile:", e); }

    for (const student of targets) {
        const debtListStr = student.debts.map(d => `- ${d.subjectName} (Lý do: ${d.reason})`).join('\n');
        const body = bodyTemplate
            .replace(/{ho_ten}/g, student.name)
            .replace(/{mssv}/g, student.id)
            .replace(/{so_mon_no}/g, student.debts.length)
            .replace(/{danh_sach_mon_no}/g, debtListStr);
        
        const recipient = type === 'email' 
            ? (student.email || `${student.id}@phenikaa-uni.edu.vn`)
            : `+84${student.id}`; // Demo SĐT

        try {
            await addDoc(collection(db, "communication_logs"), {
                studentId: student.id,
                studentName: student.name,
                type: type, // 'email' or 'message'
                recipient: recipient,
                subject: subject.replace(/{ho_ten}/g, student.name),
                body: body,
                sentBy_uid: firebaseUser.uid,
                sentBy_name: senderName,
                sentAt: serverTimestamp()
            });
        } catch (e) {
            console.error("Error writing log to Firebase:", e);
            showCustomMessage(`Lỗi khi lưu log cho SV ${student.id}: ${e.message}`, "error");
            // Dừng lại nếu có lỗi để tránh spam lỗi
            return;
        }
    }
    showCustomMessage(`Đã lưu thành công ${targets.length} log thông báo!`, "success");
    closeSendModal();
}

function exportToExcel() {
    if (!globalData.students || globalData.students.length === 0) {
        showCustomMessage("Chưa có dữ liệu để xuất file!", "error");
        return;
    }

    let exportRows = [];
    globalData.students.forEach(st => {
        if (st.debts.length > 0) {
            st.debts.forEach(d => {
                exportRows.push({
                    "Lớp / Sheet": st.className,
                    "Mã Số Sinh Viên": st.id,
                    "Họ Và Tên": st.name,
                    "Ngày Sinh": st.dob,
                    "Email": st.email,
                    "Môn Học Nợ": d.subjectName,
                    "Lịch Sử TKHP": d.tkhp !== null && d.tkhp !== undefined ? d.tkhp : '',
                    "Lịch Sử Điểm Chữ": d.diemChu || '',
                    "Lịch Sử Đánh Giá": d.danhGia || '',
                    "Lý Do Nợ Hiện Tại": d.reason
                });
            });
        }
    });

    if (exportRows.length === 0) {
        showCustomMessage("Tất cả sinh viên đều đã đạt/sạch nợ, không có dữ liệu nợ để xuất!");
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ThongKeNoMon");

    XLSX.writeFile(workbook, "Bao_Cao_Danh_Sach_No_Mon_Sinh_Vien.xlsx");
    showCustomMessage("Đã xuất file báo cáo Excel thành công!");
}

async function renderLogsTab() {
    const container = document.getElementById('logsContainer');
    container.innerHTML = `
        <div class="text-center py-10">
            <div class="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
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