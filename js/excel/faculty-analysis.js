import { normalizeText, sheetToMatrix } from './workbook-utils.js';

const DEFAULT_CONFIG = {
    metric: 'credits',
    greenMax: 6,
    yellowMax: 23
};

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
    for (let col = 0; col < headerRows[0].length; col += 1) {
        const value = normalizeText(headerRows.map(row => row?.[col]).filter(Boolean).join(' '));
        if (!value) continue;
        const matched = normalizedAliases.some(alias => exact ? value === alias : value.includes(alias));
        if (matched) return col;
    }
    return -1;
}

function findHeaderRow(matrix) {
    let best = { index: -1, score: -1 };
    const limit = Math.min(matrix.length, 50);
    for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
        const row = matrix[rowIndex] || [];
        const value = normalizeText(row.join(' '));
        let score = 0;
        if (value.includes('MA SV') || value.includes('MSSV')) score += 5;
        if (value.includes('STT')) score += 2;
        if (value.includes('TONG TC CON THIEU') || value.includes('TC CON THIEU')) score += 5;
        if (value.includes('SO HP') || value.includes('SO MON')) score += 3;
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

function getRowsForSheet(matrix, sheetName) {
    const headerRowIndex = findHeaderRow(matrix);
    if (headerRowIndex < 0) return [];

    const headerRows = [matrix[headerRowIndex] || []];
    if (matrix[headerRowIndex + 1]) headerRows.push(matrix[headerRowIndex + 1]);
    const maxColumns = Math.max(...headerRows.map(row => row.length), 0);

    const idCol = findColumn(headerRows, ['MA SV', 'MSSV', 'MA SO SINH VIEN']);
    const familyNameCol = findColumn(headerRows, ['HO DEM', 'HO VA DEM', 'HO']);
    const givenNameCol = findColumn(headerRows, ['TEN SINH VIEN', 'TEN'], { exact: true });
    const fullNameCol = findColumn(headerRows, ['HO VA TEN', 'HO TEN']);
    const dobCol = findColumn(headerRows, ['NGAY SINH', 'N SINH']);
    const classCol = findColumn(headerRows, ['LOP', 'LỚP']);
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

    if (missingCreditsCol < 0 && missingCoursesCol < 0 && fallbackMissingCreditCols.length === 0) {
        return [];
    }

    const students = [];
    for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
        const row = matrix[rowIndex] || [];
        const id = text(idCol >= 0 ? row[idCol] : '');
        const familyName = text(familyNameCol >= 0 ? row[familyNameCol] : '');
        const givenName = text(givenNameCol >= 0 ? row[givenNameCol] : '');
        const fullName = fullNameCol >= 0 ? text(row[fullNameCol]) : `${familyName} ${givenName}`.trim();
        if (!id && !fullName) continue;
        if (normalizeText(id).includes('MA SV') || normalizeText(fullName).includes('HO TEN')) continue;

        const missingCredits = missingCreditsCol >= 0
            ? parseNumber(row[missingCreditsCol])
            : fallbackMissingCreditCols.reduce((sum, col) => sum + (parseNumber(row[col]) || 0), 0);
        const missingCourses = missingCoursesCol >= 0 ? parseNumber(row[missingCoursesCol]) : null;

        students.push({
            id,
            name: fullName || id,
            familyName,
            givenName,
            dob: text(dobCol >= 0 ? row[dobCol] : ''),
            className: text(classCol >= 0 ? row[classCol] : ''),
            faculty: text(facultyCol >= 0 ? row[facultyCol] : '') || deriveFaculty(sheetName, text(classCol >= 0 ? row[classCol] : '')),
            completedCredits: parseNumber(completedCreditsCol >= 0 ? row[completedCreditsCol] : null),
            missingCredits: missingCredits ?? 0,
            missingCourses: missingCourses ?? 0,
            gpa: parseNumber(gpaCol >= 0 ? row[gpaCol] : null),
            sourceSheet: sheetName
        });
    }

    return students;
}

function groupForValue(value, config) {
    if (value <= config.greenMax) return 'green';
    if (value <= config.yellowMax) return 'yellow';
    return 'red';
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

export function parseFacultyWorkbook(workbook) {
    const students = [];
    (workbook.SheetNames || []).forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return;
        students.push(...getRowsForSheet(sheetToMatrix(sheet), sheetName));
    });

    const deduped = new Map();
    students.forEach(student => {
        const key = `${student.faculty}::${student.id || student.name}::${student.className}`;
        if (!deduped.has(key)) deduped.set(key, student);
    });
    return [...deduped.values()];
}

export function buildFacultyReport(records, inputConfig = {}) {
    const config = {
        ...DEFAULT_CONFIG,
        ...inputConfig,
        greenMax: Math.max(0, Number(inputConfig.greenMax ?? DEFAULT_CONFIG.greenMax)),
        yellowMax: Math.max(1, Number(inputConfig.yellowMax ?? DEFAULT_CONFIG.yellowMax))
    };
    if (config.yellowMax <= config.greenMax) config.yellowMax = config.greenMax + 1;

    const students = (records || []).map(student => {
        const metricValue = config.metric === 'courses' ? student.missingCourses : student.missingCredits;
        const group = groupForValue(metricValue || 0, config);
        return {
            ...student,
            metricValue: metricValue || 0,
            group,
            recommendation: group === 'green'
                ? 'Theo dõi để hoàn thành đúng hạn'
                : group === 'yellow'
                    ? 'Ưu tiên hỗ trợ các học phần còn thiếu'
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
        throw new Error('Không tìm thấy bảng dữ liệu sinh viên có cột Mã SV/MSSV và thông tin tín chỉ còn thiếu.');
    }
    return buildFacultyReport(records, inputConfig);
}

export { DEFAULT_CONFIG };
