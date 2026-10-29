import { normalizeText, sheetToMatrix } from './workbook-utils.js';

const DEFAULT_CONFIG = { rule: 'course-status' };
const CREDIT_BLOCK_CODES = ['A1', 'B1', 'C1', 'D1', 'E1', 'E2', 'A2', 'C2', 'D2.1'];

function text(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function parseNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const raw = text(value).replace(/\s/g, '');
    if (!raw) return null;

    const cleaned = raw.replace(/TC|HP|TÍNCHỈ|HỌCPHẦN/gi, '').replace(/[^0-9,.-]/g, '');
    if (!cleaned) return null;

    const commaCount = (cleaned.match(/,/g) || []).length;
    const dotCount = (cleaned.match(/\./g) || []).length;
    let normalized = cleaned;
    if (commaCount === 1 && dotCount === 0) normalized = cleaned.replace(',', '.');
    else if (commaCount > 0 && dotCount > 0) normalized = cleaned.replace(/\./g, '').replace(',', '.');
    else if (commaCount > 1) normalized = cleaned.replace(/,/g, '');
    else if (dotCount > 1) normalized = cleaned.replace(/\./g, '');

    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
}

function findColumn(headerRows, aliases, { exact = false } = {}) {
    const normalizedAliases = aliases.map(normalizeText);
    const maxColumns = Math.max(...headerRows.map(row => row?.length || 0), 0);
    const columnValues = Array.from({ length: maxColumns }, (_, col) => normalizeText(
        headerRows.map(row => row?.[col]).filter(Boolean).join(' ')
    ));

    // Ưu tiên alias cụ thể hơn trước. Nếu quét theo thứ tự cột, "TC thiếu"
    // của từng khối (A1/B1/...) sẽ bị chọn trước "Tổng TC còn thiếu (A–E)".
    for (const alias of normalizedAliases) {
        const col = columnValues.findIndex(value => value && (exact ? value === alias : value.includes(alias)));
        if (col >= 0) return col;
    }
    return -1;
}

function findHeaderRow(matrix) {
    let best = { index: -1, score: -1 };
    const limit = Math.min(matrix.length, 50);
    for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
        const value = normalizeText((matrix[rowIndex] || []).join(' '));
        let score = 0;
        if (value.includes('MA SV') || value.includes('MSSV') || value.includes('MA SINH VIEN')) score += 5;
        if (value.includes('STT')) score += 2;
        if (value.includes('TONG TC CON THIEU') || value.includes('TC CON THIEU')) score += 5;
        if (value.includes('SO HP') || value.includes('SO MON')) score += 3;
        if (value.includes('MA HP') || value.includes('TEN HOC PHAN') || value.includes('SO TC')) score += 3;
        if (value.includes('LOP')) score += 2;
        if (value.includes('KHOA') || value.includes('FACULTY')) score += 2;
        if (score > best.score) best = { index: rowIndex, score };
    }
    return best.score >= 5 ? best.index : -1;
}

function deriveFaculty(sheetName, className) {
    const genericSheet = /^(TONG HOP|CHI TIET|DANH SACH|DATA|SHEET\s*\d+)$/i.test(normalizeText(sheetName));
    if (!genericSheet) return sheetName;
    const match = text(className).match(/K\s*\d+\s*[-_]\s*([^_\-/\s]+)/i);
    return match?.[1] || sheetName;
}

function getCreditBlockCode(value) {
    const normalized = normalizeText(value);
    return CREDIT_BLOCK_CODES.find(code => normalized.includes(code)) || '';
}

function getHeaderRows(matrix, headerRowIndex) {
    const rows = [matrix[headerRowIndex] || []];
    const nextRow = matrix[headerRowIndex + 1] || [];
    const nextValue = normalizeText(nextRow.join(' '));
    if (nextValue.includes('DA TL') || nextValue.includes('THIEU') || nextValue.includes('DIEM') || nextValue.includes('DANH GIA')) {
        rows.push(nextRow);
    }
    return rows;
}

function parseDetailRows(matrix, headerRowIndex, headerRows, sheetName) {
    const idCol = findColumn(headerRows, ['MA SV', 'MSSV', 'MA SINH VIEN', 'MA SO SINH VIEN']);
    const nameCol = findColumn(headerRows, ['HO VA TEN', 'HO TEN', 'TEN SINH VIEN']);
    const familyNameCol = findColumn(headerRows, ['HO DEM', 'HO VA DEM', 'HO']);
    const givenNameCol = findColumn(headerRows, ['TEN'], { exact: true });
    const classCol = findColumn(headerRows, ['LOP']);
    const courseCodeCol = findColumn(headerRows, ['MA HP', 'MA HOC PHAN', 'MA MON']);
    const courseNameCol = findColumn(headerRows, ['TEN HOC PHAN', 'TEN MON']);
    const creditsCol = findColumn(headerRows, ['SO TC', 'TIN CHI', 'TC'], { exact: true });
    const blockCodeCol = findColumn(headerRows, ['MA KHOI', 'KHOI']);
    const courseTypeCol = findColumn(headerRows, ['LOAI']);
    const noteCol = findColumn(headerRows, ['GHI CHU', 'TRANG THAI', 'LY DO']);

    if (idCol < 0 || (courseCodeCol < 0 && courseNameCol < 0) || creditsCol < 0) return [];

    const details = [];
    for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
        const row = matrix[rowIndex] || [];
        const id = text(row[idCol]);
        if (!id || normalizeText(id).includes('MA SV')) continue;
        const familyName = text(familyNameCol >= 0 ? row[familyNameCol] : '');
        const givenName = text(givenNameCol >= 0 ? row[givenNameCol] : '');
        const name = text(nameCol >= 0 ? row[nameCol] : '') || `${familyName} ${givenName}`.trim() || id;
        const className = text(classCol >= 0 ? row[classCol] : '');
        const courseCode = text(courseCodeCol >= 0 ? row[courseCodeCol] : '');
        const courseName = text(courseNameCol >= 0 ? row[courseNameCol] : '') || courseCode;
        const credits = parseNumber(row[creditsCol]);
        if (!courseName || credits === null) continue;

        details.push({
            id,
            name,
            className,
            faculty: deriveFaculty(sheetName, className),
            blockCode: text(blockCodeCol >= 0 ? row[blockCodeCol] : ''),
            courseType: text(courseTypeCol >= 0 ? row[courseTypeCol] : ''),
            courseCode,
            courseName,
            credits,
            note: text(noteCol >= 0 ? row[noteCol] : ''),
            sourceSheet: sheetName
        });
    }
    return details;
}

function parseSummaryRows(matrix, headerRowIndex, headerRows, sheetName) {
    const maxColumns = Math.max(...headerRows.map(row => row.length), 0);
    const idCol = findColumn(headerRows, ['MA SV', 'MSSV', 'MA SINH VIEN', 'MA SO SINH VIEN']);
    const familyNameCol = findColumn(headerRows, ['HO DEM', 'HO VA DEM', 'HO']);
    const givenNameCol = findColumn(headerRows, ['TEN SINH VIEN', 'TEN'], { exact: true });
    const fullNameCol = findColumn(headerRows, ['HO VA TEN', 'HO TEN']);
    const dobCol = findColumn(headerRows, ['NGAY SINH', 'N SINH']);
    const classCol = findColumn(headerRows, ['LOP']);
    const facultyCol = findColumn(headerRows, ['KHOA', 'DON VI', 'FACULTY', 'DEPARTMENT']);
    const missingCreditsCol = findColumn(headerRows, [
        'TONG TC CON THIEU', 'SO TC CON THIEU', 'TC CON THIEU', 'TC THIEU'
    ]);
    const missingCoursesCol = findColumn(headerRows, [
        'SO HP BAT BUOC CHUA HOAN THANH', 'SO HP CHUA HOAN THANH',
        'SO HP CON THIEU', 'SO MON CON THIEU', 'SO MON NO', 'SO DK CHUA DAT'
    ]);
    const completedCreditsCol = findColumn(headerRows, ['SO TCTL', 'TC DA TICH LUY', 'TC DA DAT']);
    const gpaCol = findColumn(headerRows, ['DTBTL', 'DIEM TRUNG BINH TICH LUY']);
    const fallbackMissingCreditCols = [];

    if (missingCreditsCol < 0) {
        for (let col = 0; col < maxColumns; col += 1) {
            const joined = normalizeText(headerRows.map(row => row?.[col]).filter(Boolean).join(' '));
            if (joined.includes('THIEU') && !joined.includes('HP') && !joined.includes('HOAN')) {
                fallbackMissingCreditCols.push(col);
            }
        }
    }

    if (idCol < 0 || (missingCreditsCol < 0 && missingCoursesCol < 0 && fallbackMissingCreditCols.length === 0)) {
        return [];
    }

    const students = [];
    for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
        const row = matrix[rowIndex] || [];
        const id = text(row[idCol]);
        const familyName = text(familyNameCol >= 0 ? row[familyNameCol] : '');
        const givenName = text(givenNameCol >= 0 ? row[givenNameCol] : '');
        const fullName = fullNameCol >= 0 ? text(row[fullNameCol]) : `${familyName} ${givenName}`.trim();
        if (!id && !fullName) continue;
        if (normalizeText(id).includes('MA SV') || normalizeText(fullName).includes('HO TEN')) continue;

        const missingCredits = missingCreditsCol >= 0
            ? parseNumber(row[missingCreditsCol])
            : fallbackMissingCreditCols.reduce((sum, col) => sum + (parseNumber(row[col]) || 0), 0);
        const missingCourses = missingCoursesCol >= 0 ? parseNumber(row[missingCoursesCol]) : null;
        const missingCreditsByBlock = {};
        for (let col = 0; col < maxColumns; col += 1) {
            const blockCode = getCreditBlockCode(headerRows.map(header => header?.[col]).filter(Boolean).join(' '));
            const subheader = normalizeText(headerRows[1]?.[col] || '');
            if (blockCode && subheader.includes('THIEU')) {
                missingCreditsByBlock[blockCode] = parseNumber(row[col]) ?? 0;
            }
        }
        const rawFaculty = text(facultyCol >= 0 ? row[facultyCol] : '');
        const faculty = rawFaculty && !(/^[-+]?\d+(?:[.,]\d+)?$/).test(rawFaculty)
            ? rawFaculty
            : deriveFaculty(sheetName, text(classCol >= 0 ? row[classCol] : ''));

        students.push({
            id,
            name: fullName || id,
            dob: text(dobCol >= 0 ? row[dobCol] : ''),
            className: text(classCol >= 0 ? row[classCol] : ''),
            faculty,
            completedCredits: parseNumber(completedCreditsCol >= 0 ? row[completedCreditsCol] : null),
            missingCredits: missingCredits ?? 0,
            missingCourses: missingCourses ?? 0,
            missingCreditsByBlock,
            gpa: parseNumber(gpaCol >= 0 ? row[gpaCol] : null),
            missingCourseDetails: [],
            sourceSheet: sheetName
        });
    }
    return students;
}

function getRowsForSheet(matrix, sheetName) {
    const headerRowIndex = findHeaderRow(matrix);
    if (headerRowIndex < 0) return { students: [], details: [] };
    const headerRows = getHeaderRows(matrix, headerRowIndex);
    const summaryRows = parseSummaryRows(matrix, headerRowIndex, headerRows, sheetName);
    if (summaryRows.length) return { students: summaryRows, details: [] };
    return { students: [], details: parseDetailRows(matrix, headerRowIndex, headerRows, sheetName) };
}

function buildFacultySummary(students) {
    const faculties = new Map();
    students.forEach(student => {
        if (!faculties.has(student.faculty)) {
            faculties.set(student.faculty, {
                faculty: student.faculty,
                total: 0,
                green: 0,
                yellow: 0,
                red: 0,
                averageMissingCredits: 0,
                averageMissingCourses: 0
            });
        }
        const item = faculties.get(student.faculty);
        item.total += 1;
        item[student.group] += 1;
        item.averageMissingCredits += student.missingCredits || 0;
        item.averageMissingCourses += student.missingCourses || 0;
    });

    return [...faculties.values()]
        .map(item => ({
            ...item,
            averageMissingCredits: item.total ? item.averageMissingCredits / item.total : 0,
            averageMissingCourses: item.total ? item.averageMissingCourses / item.total : 0
        }))
        .sort((a, b) => a.faculty.localeCompare(b.faculty, 'vi'));
}

function classifyStudent(student) {
    if ((student.missingCourses || 0) === 0 && (student.missingCredits || 0) === 0) return 'green';
    if ((student.missingCourses || 0) >= 2 && (student.missingCourses || 0) <= 3) return 'yellow';
    return 'red';
}

export function parseFacultyWorkbook(workbook) {
    const summaryStudents = [];
    const detailRows = [];
    (workbook.SheetNames || []).forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return;
        const parsed = getRowsForSheet(sheetToMatrix(sheet), sheetName);
        summaryStudents.push(...parsed.students);
        detailRows.push(...parsed.details);
    });

    const detailsByStudent = new Map();
    detailRows.forEach(detail => {
        if (!detailsByStudent.has(detail.id)) detailsByStudent.set(detail.id, new Map());
        const key = detail.courseCode || detail.courseName;
        detailsByStudent.get(detail.id).set(key, detail);
    });

    const deduped = new Map();
    summaryStudents.forEach(student => {
        const key = `${student.faculty}::${student.id || student.name}::${student.className}`;
        const details = [...(detailsByStudent.get(student.id)?.values() || [])];
        const enriched = {
            ...student,
            missingCourseDetails: details,
            missingCourses: student.missingCourses ?? details.length,
            missingCredits: student.missingCredits ?? details.reduce((sum, item) => sum + item.credits, 0)
        };
        if (!deduped.has(key)) deduped.set(key, enriched);
    });

    if (!deduped.size && detailRows.length) {
        const grouped = new Map();
        detailRows.forEach(detail => {
            if (!grouped.has(detail.id)) grouped.set(detail.id, { ...detail, missingCourseDetails: [] });
            grouped.get(detail.id).missingCourseDetails.push(detail);
        });
        grouped.forEach(detail => deduped.set(`${detail.faculty}::${detail.id}::${detail.className}`, {
            ...detail,
            name: detail.name || detail.id,
            missingCourses: detail.missingCourseDetails.length,
            missingCredits: detail.missingCourseDetails.reduce((sum, item) => sum + item.credits, 0),
            completedCredits: null,
            gpa: null
        }));
    }

    return [...deduped.values()];
}

export function buildFacultyReport(records, inputConfig = {}) {
    const config = { ...DEFAULT_CONFIG, ...inputConfig };
    const students = (records || []).map(student => {
        const group = classifyStudent(student);
        return {
            ...student,
            metricValue: student.missingCourses || 0,
            group,
            recommendation: group === 'green'
                ? 'Đúng hạn: không còn học phần/tín chỉ thiếu'
                : group === 'yellow'
                    ? 'Ưu tiên hỗ trợ 2–3 học phần còn thiếu'
                    : 'Cần lập kế hoạch hỗ trợ và cảnh báo sớm'
        };
    });

    const summary = {
        total: students.length,
        green: students.filter(student => student.group === 'green').length,
        yellow: students.filter(student => student.group === 'yellow').length,
        red: students.filter(student => student.group === 'red').length,
        facultyCount: new Set(students.map(student => student.faculty)).size
    };

    return {
        records: students,
        summary,
        faculties: buildFacultySummary(students),
        config,
        sourceSheets: [...new Set(students.map(student => student.sourceSheet))]
    };
}

export function createFacultyReport(workbook, inputConfig = {}) {
    const records = parseFacultyWorkbook(workbook);
    if (!records.length) {
        throw new Error('Không tìm thấy bảng dữ liệu sinh viên có cột Mã SV/MSSV và thông tin tín chỉ hoặc học phần còn thiếu.');
    }
    return buildFacultyReport(records, inputConfig);
}

export { DEFAULT_CONFIG };
