import { readWorkbookFromFile } from '../excel/workbook-utils.js';
import { parseScoreWorkbook } from '../excel/score-parser.js';
import { parseFrameworkWorkbook as parseFrameworkWorkbookData } from '../excel/framework-parser.js';
import { createDemoData } from '../demo/demo-data.js';
import { createEmptyGlobalData } from '../state/app-state.js';
import { setupFileDropZones, loadWorkbookFile } from '../ui/file-importer.js';

export function createAnalysisController({ globalData, showCustomMessage, onDataChanged }) {
    let loadedStudentWorkbook = null;
    let loadedFrameworkWorkbook = null;

    function setupDragAndDrop() {
        setupFileDropZones((file, type) => loadExcelFile(file, type));
    }

    function handleFileSelect(event, type) {
        const file = event.target.files[0];
        if (file) loadExcelFile(file, type);
    }

    function loadExcelFile(file, type) {
        return loadWorkbookFile(file, type, {
            readWorkbookFromFile,
            showCustomMessage,
            onStudentWorkbook: workbook => {
                loadedStudentWorkbook = workbook;
            },
            onFrameworkWorkbook: workbook => {
                loadedFrameworkWorkbook = workbook;
            }
        });
    }

    function startAnalysis() {
        if (!loadedStudentWorkbook) {
            showCustomMessage('Vui lòng tải lên bảng điểm sinh viên trước!', 'error');
            return;
        }

        document.getElementById('loadingSpinner').classList.remove('hidden');

        setTimeout(() => {
            try {
                if (loadedFrameworkWorkbook) {
                    parseFrameworkWorkbook(loadedFrameworkWorkbook);
                    document.getElementById('frameworkLoadedBadge').classList.remove('hidden');
                } else {
                    globalData.frameworkCourses = [];
                    globalData.frameworkMetadata = { totalCredits: 0 };
                    document.getElementById('frameworkLoadedBadge').classList.add('hidden');
                }

                parseWorkbook(loadedStudentWorkbook);
                onDataChanged();
                showCustomMessage('Phân tích bóc tách và đối sánh nợ môn thành công!', 'success');
            } catch (err) {
                console.error('Analysis Error:', err);
                showCustomMessage(`Có lỗi xảy ra khi phân tích dữ liệu: ${err.message}`, 'error');
            } finally {
                document.getElementById('loadingSpinner').classList.add('hidden');
            }
        }, 50);
    }

    function resetApp() {
        loadedStudentWorkbook = null;
        loadedFrameworkWorkbook = null;
        Object.assign(globalData, createEmptyGlobalData());

        document.getElementById('studentFileStatus').innerText = 'Chưa tải lên';
        document.getElementById('studentFileStatus').className = 'mt-4 px-3.5 py-1 bg-slate-200/60 text-slate-600 rounded-xl text-xs font-bold';
        document.getElementById('frameworkFileStatus').innerText = 'Chưa tải lên (Tùy chọn)';
        document.getElementById('frameworkFileStatus').className = 'mt-4 px-3.5 py-1 bg-slate-200/60 text-slate-600 rounded-xl text-xs font-bold';
        document.getElementById('btnAnalyze').disabled = true;
        document.getElementById('studentFileInput').value = '';
        document.getElementById('frameworkFileInput').value = '';

        onDataChanged();
    }

    function parseFrameworkWorkbook(workbook) {
        const parsedFramework = parseFrameworkWorkbookData(workbook);
        globalData.frameworkCourses = parsedFramework.courses;
        globalData.frameworkMetadata = parsedFramework.metadata;

        console.log(
            `Framework loaded: ${parsedFramework.frameworkType}, ${parsedFramework.courses.length} courses, ${parsedFramework.metadata.totalCredits} credits.`
        );
    }

    function parseWorkbook(workbook) {
        const parsedData = parseScoreWorkbook(workbook);
        globalData.sheets = parsedData.sheets;
        globalData.students = parsedData.students;
        globalData.subjectsMap = parsedData.subjectsMap;
        globalData.classList = parsedData.classList;
        populateFilters();
    }

    function loadDemoData() {
        Object.assign(globalData, createDemoData());
        document.getElementById('frameworkLoadedBadge').classList.remove('hidden');
        populateFilters();
        onDataChanged();
        showCustomMessage('Đã nạp dữ liệu mẫu đối sánh lộ trình tốt nghiệp!');
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
        if (badge) badge.innerText = `${globalData.sheets.length} Sheet / Lớp`;
    }

    return {
        setupDragAndDrop,
        handleFileSelect,
        loadExcelFile,
        startAnalysis,
        resetApp,
        parseFrameworkWorkbook,
        loadDemoData,
        populateFilters
    };
}
