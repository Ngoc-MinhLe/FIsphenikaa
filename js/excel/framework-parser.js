import { normalizeText, sheetToMatrix } from './workbook-utils.js';

const COURSE_CODE_PATTERN = /^[A-Z]{2,5}\d{5,6}$/;

function emptyFrameworkResult(frameworkType) {
    return {
        frameworkType,
        courses: [],
        metadata: {
            totalCredits: 0,
            listedCredits: 0,
            electiveGroups: [],
            frameworkType
        }
    };
}

function valueAt(row, columnIndex) {
    if (!row || columnIndex < 0 || columnIndex >= row.length) return '';
    return row[columnIndex] === null || row[columnIndex] === undefined
        ? ''
        : String(row[columnIndex]).trim();
}

function parseCredits(value) {
    const normalized = String(value ?? '').replace(',', '.').trim();
    if (!normalized) return 0;

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function isCourseCode(value) {
    return COURSE_CODE_PATTERN.test(String(value || '').trim().toUpperCase());
}

function findHeaderRow(rawData, scoreRow) {
    let best = null;

    rawData.forEach((row, rowIndex) => {
        const score = scoreRow(row);
        if (!best || score > best.score) {
            best = { rowIndex, score, row };
        }
    });

    return best && best.score > 0 ? best : null;
}

function findColumnIndexes(headerRow, aliases) {
    const columns = {};

    headerRow.forEach((cell, index) => {
        const normalized = normalizeText(cell);

        Object.entries(aliases).forEach(([key, possibleNames]) => {
            if (possibleNames.some(name => normalized === name || normalized.includes(name))) {
                if (columns[key] === undefined) columns[key] = index;
            }
        });
    });

    return columns;
}

function detectFrameworkType(rawData) {
    const hasLegacyHeader = rawData.some(row => {
        const text = (row || []).map(normalizeText).join(' ');
        return text.includes('MA KHOI') && text.includes('MA HOC PHAN');
    });

    if (hasLegacyHeader) return 'LEGACY_QLDT';

    const hasBm2Header = rawData.some(row => {
        const text = (row || []).map(normalizeText).join(' ');
        return text.includes('MA HP') && text.includes('TEN HP') && text.includes('SO TC');
    });

    return hasBm2Header ? 'BM2' : 'UNKNOWN';
}

function parseLegacyFramework(rawData) {
    const result = emptyFrameworkResult('LEGACY_QLDT');
    const header = findHeaderRow(rawData, row => {
        const text = (row || []).map(normalizeText).join(' ');
        let score = 0;
        if (text.includes('MA KHOI')) score += 2;
        if (text.includes('TEN KHOI')) score += 2;
        if (text.includes('MA HOC PHAN')) score += 3;
        if (text.includes('TEN HOC PHAN')) score += 3;
        if (text.includes('TIN CHI')) score += 2;
        return score;
    });

    if (!header) return result;

    const columns = findColumnIndexes(header.row, {
        blockId: ['MA KHOI'],
        blockName: ['TEN KHOI'],
        courseCode: ['MA HOC PHAN', 'MA HP'],
        courseName: ['TEN HOC PHAN', 'TEN HP'],
        credits: ['TIN CHI', 'SO TC', 'TC']
    });

    const blockIdColumn = columns.blockId ?? 1;
    const blockNameColumn = columns.blockName ?? 2;
    const courseCodeColumn = columns.courseCode ?? 4;
    const courseNameColumn = columns.courseName ?? 5;
    const creditsColumn = columns.credits ?? 6;

    rawData.slice(header.rowIndex + 1).forEach(row => {
        const courseCode = valueAt(row, courseCodeColumn);
        const courseName = valueAt(row, courseNameColumn);
        const credits = parseCredits(valueAt(row, creditsColumn));

        if (!isCourseCode(courseCode) || !courseName) return;

        const normalizedName = normalizeText(courseName);
        if (normalizedName.includes('TONG CONG') || normalizedName === 'CONG') return;

        result.courses.push({
            blockId: valueAt(row, blockIdColumn) || 'OTHER',
            blockName: valueAt(row, blockNameColumn) || 'Khối kiến thức khác',
            courseCode,
            courseName,
            credits,
            required: true,
            courseType: 'required'
        });
        result.metadata.listedCredits += credits;
    });

    result.metadata.totalCredits = result.metadata.listedCredits;
    return result;
}

function findBm2TotalCredits(rawData, creditsColumn) {
    for (const row of rawData) {
        const rowText = (row || []).map(normalizeText).join(' ');
        if (!rowText.includes('TONG STC')) continue;

        const directValue = parseCredits(valueAt(row, creditsColumn));
        if (directValue > 0) return directValue;

        const match = rowText.match(/(\d+(?:[.,]\d+)?)/);
        if (match) return parseCredits(match[1]);
    }

    return 0;
}

function isBlockId(value) {
    return /^[A-Z]\d(?:\.\d+)*$/i.test(String(value || '').trim());
}

function findBm2ScheduleColumns(rawData, header, creditsColumn) {
    const yearRow = rawData[header.rowIndex] || [];
    const semesterRow = rawData[header.rowIndex + 1] || [];
    const columns = [];
    let currentYear = 0;

    for (let columnIndex = creditsColumn + 1; columnIndex < yearRow.length; columnIndex++) {
        const yearValue = parseCredits(valueAt(yearRow, columnIndex));
        const semesterValue = parseCredits(valueAt(semesterRow, columnIndex));

        if (Number.isInteger(yearValue) && yearValue > 0 && yearValue <= 10) {
            currentYear = yearValue;
        }

        if (currentYear > 0 && Number.isInteger(semesterValue) && semesterValue > 0 && semesterValue <= 3) {
            columns.push({
                columnIndex,
                year: currentYear,
                semester: semesterValue,
                term: `${currentYear}.${semesterValue}`
            });
        }
    }

    return columns;
}

function parseBm2Framework(rawData) {
    const result = emptyFrameworkResult('BM2');
    const header = findHeaderRow(rawData, row => {
        const text = (row || []).map(normalizeText).join(' ');
        let score = 0;
        if (text.includes('TT')) score += 1;
        if (text.includes('MA HP')) score += 3;
        if (text.includes('TEN HP')) score += 3;
        if (text.includes('SO TC')) score += 3;
        if (text.includes('NAM HOC')) score += 1;
        return score;
    });

    if (!header || header.score < 7) return result;

    const columns = findColumnIndexes(header.row, {
        order: ['TT'],
        courseCode: ['MA HP'],
        courseName: ['TEN HP'],
        credits: ['SO TC']
    });

    const orderColumn = columns.order ?? 0;
    const courseCodeColumn = columns.courseCode ?? 1;
    const courseNameColumn = columns.courseName ?? 2;
    const creditsColumn = columns.credits ?? 3;
    const scheduleColumns = findBm2ScheduleColumns(rawData, header, creditsColumn);
    const totalCredits = findBm2TotalCredits(rawData, creditsColumn);

    let currentBlockId = 'OTHER';
    let currentBlockName = 'Khối kiến thức khác';
    let currentCourseType = 'required';
    let currentElectiveGroup = null;

    rawData.slice(header.rowIndex + 1).forEach(row => {
        const orderValue = valueAt(row, orderColumn);
        const codeValue = valueAt(row, courseCodeColumn);
        const nameValue = valueAt(row, courseNameColumn);

        if (isBlockId(orderValue) && !isCourseCode(orderValue)) {
            const blockLabel = nameValue || codeValue || currentBlockName;
            currentBlockId = orderValue;
            currentBlockName = blockLabel;
            currentCourseType = normalizeText(blockLabel).includes('TU CHON')
                ? 'elective'
                : 'required';
            currentElectiveGroup = null;

            if (currentCourseType === 'elective') {
                currentElectiveGroup = {
                    id: currentBlockId,
                    name: currentBlockName,
                    requiredCredits: parseCredits(valueAt(row, creditsColumn)),
                    courseCodes: []
                };
                result.metadata.electiveGroups.push(currentElectiveGroup);
            }
            return;
        }

        // Rows such as "A. Khối kiến thức..." are section labels, not courses.
        if (!isCourseCode(codeValue)) return;
        if (!nameValue) return;

        const credits = parseCredits(valueAt(row, creditsColumn));
        // BM2 uses code-like placeholders for elective requirements. They are
        // not concrete courses and must not appear as 0-credit subjects.
        if (credits <= 0) return;

        const plannedTerms = scheduleColumns
            .filter(schedule => parseCredits(valueAt(row, schedule.columnIndex)) > 0)
            .map(schedule => schedule.term);

        result.courses.push({
            blockId: currentBlockId,
            blockName: currentBlockName,
            courseCode: codeValue,
            courseName: nameValue,
            credits,
            required: currentCourseType === 'required',
            courseType: currentCourseType,
            electiveGroup: currentCourseType === 'elective' ? currentBlockId : null,
            plannedTerms
        });
        result.metadata.listedCredits += credits;

        if (currentElectiveGroup) {
            currentElectiveGroup.courseCodes.push(codeValue);
        }
    });

    result.metadata.totalCredits = totalCredits || result.metadata.listedCredits;
    return result;
}

export function parseFrameworkWorkbook(workbook) {
    const sheetName = workbook?.SheetNames?.[0];
    const sheet = sheetName ? workbook.Sheets[sheetName] : null;
    if (!sheet) return emptyFrameworkResult('UNKNOWN');

    const rawData = sheetToMatrix(sheet);
    if (!rawData || rawData.length < 2) return emptyFrameworkResult('UNKNOWN');

    const frameworkType = detectFrameworkType(rawData);
    if (frameworkType === 'BM2') return parseBm2Framework(rawData);
    if (frameworkType === 'LEGACY_QLDT') return parseLegacyFramework(rawData);

    return emptyFrameworkResult('UNKNOWN');
}
