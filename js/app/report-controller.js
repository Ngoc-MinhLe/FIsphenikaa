import { analyzeFrameworkDemand } from '../excel/framework-analysis.js';
import {
    buildSubjectStudentsReport,
    buildDebtReport,
    buildDebtSummaryReport,
    buildClassOpeningReportSheets
} from '../excel/report-exporter.js';

function getFacultyDetailKind(detail) {
    const type = String(detail.courseType || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[Đđ]/g, 'd')
        .toLocaleLowerCase('vi');
    if (type.includes('bat buoc')) return 'mandatory';
    if (type.includes('dieu kien')) return 'condition';
    return 'elective';
}

function formatFacultyDetails(details, kind) {
    return details
        .filter(detail => getFacultyDetailKind(detail) === kind)
        .map(detail => `${detail.blockCode ? `[${detail.blockCode}] ` : ''}${detail.courseCode ? `${detail.courseCode} - ` : ''}${detail.courseName} (${detail.credits} TC)`)
        .join('\n');
}

const ELECTIVE_BLOCK_CODES = new Set(['A2', 'C2', 'D2.1']);

function getElectiveMissingCredits(student) {
    return [...ELECTIVE_BLOCK_CODES].reduce(
        (sum, blockCode) => sum + Number(student.missingCreditsByBlock?.[blockCode] || 0),
        0
    );
}

function getFacultyCreditBreakdown(student) {
    const electiveCredits = getElectiveMissingCredits(student);
    const totalProgramCredits = Number(student.missingCredits || 0);
    const otherCredits = (student.missingCourseDetails || [])
        .filter(detail => getFacultyDetailKind(detail) === 'condition')
        .reduce((sum, detail) => sum + Number(detail.credits || 0), 0);
    return {
        mandatoryCredits: Math.max(0, totalProgramCredits - electiveCredits),
        electiveCredits,
        otherCredits
    };
}

function buildFacultyExportSummary(records) {
    const groups = new Map();
    records.forEach(student => {
        const key = student.faculty || 'Chưa xác định';
        if (!groups.has(key)) {
            groups.set(key, {
                faculty: key,
                total: 0,
                green: 0,
                yellow: 0,
                red: 0,
                averageMissingCredits: 0,
                averageMissingCourses: 0,
                averageMandatoryCredits: 0,
                averageElectiveCredits: 0,
                averageOtherCredits: 0
            });
        }
        const item = groups.get(key);
        item.total += 1;
        item[student.group] += 1;
        item.averageMissingCredits += Number(student.missingCredits || 0);
        item.averageMissingCourses += Number(student.missingCourses || 0);
        const breakdown = getFacultyCreditBreakdown(student);
        item.averageMandatoryCredits += breakdown.mandatoryCredits;
        item.averageElectiveCredits += breakdown.electiveCredits;
        item.averageOtherCredits += breakdown.otherCredits;
    });
    return [...groups.values()].map(item => ({
        'Khoa / đơn vị': item.faculty,
        'Tổng số SV': item.total,
        'Nhóm Xanh': item.green,
        'Nhóm Vàng': item.yellow,
        'Nhóm Đỏ': item.red,
        'TB TC còn thiếu': Number((item.averageMissingCredits / item.total).toFixed(1)),
        'TB HP còn thiếu': Number((item.averageMissingCourses / item.total).toFixed(1)),
        'TB TC bắt buộc thiếu': Number((item.averageMandatoryCredits / item.total).toFixed(1)),
        'TB TC tự chọn thiếu': Number((item.averageElectiveCredits / item.total).toFixed(1)),
        'TB TC nhóm khác thiếu': Number((item.averageOtherCredits / item.total).toFixed(1))
    }));
}

function safeFilenamePart(value) {
    return String(value || 'Tat_ca')
        .replace(/[<>:\"/\\|?*]+/g, '_')
        .replace(/\s+/g, '_');
}

export function createReportController({ globalData, showCustomMessage }) {
    function downloadReportWorkbook(filename, sheets) {
        const workbook = XLSX.utils.book_new();
        sheets.forEach(sheet => {
            const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
            if (sheet.widths) worksheet['!cols'] = sheet.widths.map(wch => ({ wch }));
            XLSX.utils.book_append_sheet(workbook, worksheet, sheet.sheetName || sheet.name);
        });
        XLSX.writeFile(workbook, filename);
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

    function exportToExcel() {
        if (!globalData.students || globalData.students.length === 0) {
            showCustomMessage('Chưa có dữ liệu để xuất file!', 'error');
            return;
        }

        const report = buildDebtReport(globalData.students);
        if (report.rows.length === 0) {
            showCustomMessage('Tất cả sinh viên đều đã đạt/sạch nợ, không có dữ liệu nợ để xuất!');
            return;
        }

        downloadReportWorkbook(report.filename, [{ ...report, name: report.sheetName }]);
        showCustomMessage('Đã xuất file báo cáo Excel thành công!');
    }

    function exportSummaryToExcel() {
        if (!globalData.students || globalData.students.length === 0) {
            showCustomMessage('Chưa có dữ liệu để xuất file!', 'error');
            return;
        }

        const report = buildDebtSummaryReport(globalData.students);
        if (report.rows.length === 0) {
            showCustomMessage('Tất cả sinh viên đều đã đạt/sạch nợ, không có dữ liệu tổng hợp để xuất!');
            return;
        }

        downloadReportWorkbook(report.filename, [{ ...report, name: report.sheetName }]);
        showCustomMessage('Đã xuất file báo cáo tổng hợp Excel thành công!');
    }

    function exportClassOpeningReport() {
        if (!globalData.students || globalData.students.length === 0) {
            showCustomMessage('Chưa có dữ liệu sinh viên để xuất!', 'error');
            return;
        }

        if (!globalData.frameworkCourses || globalData.frameworkCourses.length === 0) {
            showCustomMessage('Vui lòng tải lên khung chương trình trước khi xuất nhu cầu mở lớp.', 'error');
            return;
        }

        const report = analyzeFrameworkDemand(
            globalData.students,
            globalData.frameworkCourses,
            globalData.frameworkMetadata || {}
        );
        const sheets = buildClassOpeningReportSheets(report, globalData.frameworkCourses);
        downloadReportWorkbook('Bao_Cao_Nhu_Cau_Mo_Lop_Theo_Khung.xlsx', sheets);
        showCustomMessage('Đã xuất báo cáo nhu cầu mở lớp theo khung chương trình!', 'success');
    }

    function exportFacultyReport() {
        const report = globalData.facultyReport;
        if (!report || !report.records?.length) {
            showCustomMessage('Chưa có dữ liệu phân tích theo khoa để xuất.', 'error');
            return;
        }

        const groupLabel = { green: 'Xanh · Đúng hạn', yellow: 'Vàng · Có khả năng đúng hạn', red: 'Đỏ · Cần hỗ trợ' };
        const exportScope = document.getElementById('facultyExportScope')?.value || 'all';
        const exportTarget = document.getElementById('facultyExportTarget')?.value || '';
        const selectedRecords = exportScope === 'class'
            ? report.records.filter(student => student.className === exportTarget)
            : exportScope === 'student'
                ? report.records.filter(student => student.id === exportTarget)
                : report.records;

        if (!selectedRecords.length) {
            showCustomMessage('Không tìm thấy sinh viên phù hợp với phạm vi xuất đã chọn.', 'error');
            return;
        }

        const summaryRows = buildFacultyExportSummary(selectedRecords);
        const studentRows = selectedRecords.map((student, index) => {
            const creditBreakdown = getFacultyCreditBreakdown(student);
            return {
            STT: index + 1,
            MSSV: student.id,
            'Họ và tên': student.name,
            'Khoa / đơn vị': student.faculty,
            Lop: student.className,
            'TC đã tích lũy': student.completedCredits ?? '',
            'TC còn thiếu': student.missingCredits,
            'TC bắt buộc còn thiếu': creditBreakdown.mandatoryCredits,
            'TC tự chọn còn thiếu': creditBreakdown.electiveCredits,
            'TC nhóm khác/điều kiện còn thiếu': creditBreakdown.otherCredits,
            'HP còn thiếu': student.missingCourses,
            'Học phần bắt buộc phải hoàn thành': formatFacultyDetails(student.missingCourseDetails || [], 'mandatory'),
            'Điều kiện tốt nghiệp phải đạt': formatFacultyDetails(student.missingCourseDetails || [], 'condition'),
            'Môn tự chọn có thể chọn': formatFacultyDetails(student.missingCourseDetails || [], 'elective'),
            Nhom: groupLabel[student.group],
            'Khuyến nghị': student.recommendation,
            'Nguồn sheet': student.sourceSheet
            };
        });
        const scopeLabel = exportScope === 'class'
            ? `Theo lớp: ${exportTarget}`
            : exportScope === 'student'
                ? `Theo sinh viên: ${exportTarget}`
                : 'Toàn bộ sinh viên';
        const configRows = [
            { ThiếtLập: 'Quy tắc phân nhóm', GiáTrị: 'Xanh: 0 HP và 0 TC; Vàng: 2–3 HP; Đỏ: các trường hợp còn lại' },
            { ThiếtLập: 'Phạm vi xuất', GiáTrị: scopeLabel },
            { ThiếtLập: 'Tổng sinh viên', GiáTrị: selectedRecords.length }
        ];

        const detailSheetName = exportScope === 'class'
            ? `Lop_${safeFilenamePart(exportTarget)}`
            : exportScope === 'student'
                ? `SV_${safeFilenamePart(exportTarget)}`
                : 'DanhSachSinhVien';
        const filenamePart = exportScope === 'all' ? 'Tat_Ca' : safeFilenamePart(exportTarget);

        downloadReportWorkbook(`Bao_Cao_Phan_Tich_Sinh_Vien_${filenamePart}.xlsx`, [
            { name: 'TongHopKhoa', rows: summaryRows },
            { name: detailSheetName, rows: studentRows },
            { name: 'CauHinhPhanNhom', rows: configRows }
        ]);
        showCustomMessage('Đã xuất báo cáo sinh viên theo khoa và nhóm Xanh/Vàng/Đỏ.', 'success');
    }

    return {
        exportSubjectStudentsToExcel,
        exportToExcel,
        exportSummaryToExcel,
        exportClassOpeningReport,
        exportFacultyReport
    };
}
