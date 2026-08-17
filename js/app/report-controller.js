import { analyzeFrameworkDemand } from '../excel/framework-analysis.js';
import {
    buildSubjectStudentsReport,
    buildDebtReport,
    buildDebtSummaryReport,
    buildClassOpeningReportSheets
} from '../excel/report-exporter.js';

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

    return {
        exportSubjectStudentsToExcel,
        exportToExcel,
        exportSummaryToExcel,
        exportClassOpeningReport
    };
}
