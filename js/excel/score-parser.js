import { getLatestAttempt, normalizeText, sheetToMatrix } from './workbook-utils.js';

/**
 * Đọc workbook bảng điểm và trả về dữ liệu đã chuẩn hóa.
 *
 * Parser không biết gì về giao diện hoặc globalData. Việc cập nhật state,
 * render màn hình và populate bộ lọc được giữ ở thongkenomon.js.
 */
export function parseScoreWorkbook(workbook) {
    const parsedData = {
        sheets: workbook.SheetNames,
        students: [],
        subjectsMap: {},
        classList: workbook.SheetNames
    };

    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return;

        const rawData = sheetToMatrix(sheet);
        if (!rawData || rawData.length < 5) return;

        // Identify the row containing the score subheaders.
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

        // Detect student information columns.
        let sttColIdx = 0;
        let idColIdx = 1;
        let hoColIdx = -1;
        let tenColIdx = -1;
        let nameColIdx = 4;
        let dobColIdx = 6;
        let emailColIdx = -1;

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

        // Extract subject names and their score columns.
        const subjectsInSheet = [];
        let maxCols = 0;
        for (let r = 0; r < Math.min(subHeaderRowIdx + 5, rawData.length); r++) {
            if (rawData[r] && rawData[r].length > maxCols) maxCols = rawData[r].length;
        }

        let currentSubjectName = '';

        for (let c = firstSubjectCol; c < maxCols; c++) {
            if (isSummaryColumn(c)) break;

            let rawSubjName = '';
            for (let r = subHeaderRowIdx - 1; r >= 0; r--) {
                const val = String(rawData[r] ? rawData[r][c] || '' : '').trim();
                const normVal = normalizeText(val);
                if (val !== '' && !normVal.includes('STT') && !normVal.includes('MSSV') && !normVal.includes('BANG DIEM') && !normVal.includes('KHOA') && normVal.length > 2) {
                    rawSubjName = val.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
                    break;
                }
            }

            const rawSubHeader = normalizeText(subHeaderRow[c] || '');

            if (rawSubjName !== '') currentSubjectName = rawSubjName;

            if (currentSubjectName) {
                const existingSubj = subjectsInSheet.find(s => s.name === currentSubjectName && s.endCol === c - 1);
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

        // Map sub-columns for each subject.
        subjectsInSheet.forEach(subject => {
            subject.colTKHP = -1;
            subject.colDiemChu = -1;
            subject.colDanhGia = -1;

            subject.cols.forEach(colObj => {
                const sub = colObj.subHeader;
                if (sub.includes('TKHP') || sub.includes('DIEM HP') || sub.includes('TONG KET') || sub.includes('THANG 10') || sub.includes('DIEM THI') || sub.includes('DIEM TKN')) {
                    if (subject.colTKHP === -1) subject.colTKHP = colObj.colIdx;
                } else if (sub.includes('DIEM CHU') || sub.includes('CHU')) {
                    if (subject.colDiemChu === -1) subject.colDiemChu = colObj.colIdx;
                } else if (sub.includes('DANH GIA') || sub.includes('GHI CHU') || sub.includes('TRANG THAI') || sub.includes('KET QUA') || sub.includes('DAT/KD') || sub.includes('DAT')) {
                    if (subject.colDanhGia === -1) subject.colDanhGia = colObj.colIdx;
                }
            });

            if (subject.colTKHP === -1 && subject.cols.length > 0) subject.colTKHP = subject.cols[0].colIdx;
            if (subject.colDiemChu === -1 && subject.cols.length > 1) subject.colDiemChu = subject.cols[1].colIdx;
            if (subject.colDanhGia === -1 && subject.cols.length > 2) subject.colDanhGia = subject.cols[2].colIdx;

            if (!parsedData.subjectsMap[subject.name]) {
                parsedData.subjectsMap[subject.name] = {
                    name: subject.name,
                    totalDebts: 0,
                    debtStudents: []
                };
            }
        });

        // Evaluate student rows and map all studied courses.
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

            if (!email && id.length >= 6 && !isNaN(Number(id))) {
                email = `${id}@st.phenikaa-uni.edu.vn`;
            }

            const parsedStt = parseInt(sttVal, 10);
            const isSttNumber = !isNaN(parsedStt) && parsedStt > 0 && String(sttVal).toLowerCase().indexOf('\u0074\u00edn ch\u1ec9') === -1;
            const isIdValid = id.length >= 6 && !id.toUpperCase().includes('MSSV') && !id.toUpperCase().includes('MÃƒ');

            if (isSttNumber && isIdValid) {
                const studentDebts = [];
                const coursesTaken = {};

                subjectsInSheet.forEach(subject => {
                    const parts = subject.name.split(' - ');
                    const courseCode = parts.length > 1 ? parts[parts.length - 1].trim() : subject.name;

                    const rawTkhp = subject.colTKHP !== -1 ? row[subject.colTKHP] : null;
                    const rawDiemChu = subject.colDiemChu !== -1 ? row[subject.colDiemChu] : null;
                    const rawDanhGia = subject.colDanhGia !== -1 ? row[subject.colDanhGia] : null;

                    if ((rawTkhp === null || rawTkhp === '') &&
                        (rawDiemChu === null || rawDiemChu === '') &&
                        (rawDanhGia === null || rawDanhGia === '')) {
                        return;
                    }

                    const latestTkhpStr = getLatestAttempt(rawTkhp);
                    const latestDiemChuStr = getLatestAttempt(rawDiemChu);
                    const latestDanhGiaStr = getLatestAttempt(rawDanhGia);
                    const normDanhGia = normalizeText(latestDanhGiaStr);
                    const normDiemChu = normalizeText(latestDiemChuStr);

                    let isDebt = false;
                    let reason = '';

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
                            reason = String(rawDanhGia || '\u0043h\u01b0a \u0111\u1ea1t / H\u1ecdc l\u1ea1i');
                        } else if (normDiemChu === 'F' || normDiemChu.startsWith('F(') || normDiemChu === 'F*' || normDiemChu === 'F+' || normDiemChu === 'KD' || normDiemChu === 'VT' || normDiemChu === 'CT') {
                            isDebt = true;
                            reason = '\u0110i\u1ec3m F';
                        } else if (latestTkhpStr !== '' && !isNaN(Number(latestTkhpStr))) {
                            const numTkhp = Number(latestTkhpStr);
                            if (numTkhp >= 0 && numTkhp < 4.0) {
                                isDebt = true;
                                reason = `TKHP: ${latestTkhpStr} (< 4.0)`;
                            }
                        }
                    }

                    coursesTaken[courseCode] = {
                        courseCode,
                        courseName: subject.name,
                        passed: !isDebt,
                        tkhp: latestTkhpStr,
                        diemChu: latestDiemChuStr,
                        danhGia: latestDanhGiaStr
                    };

                    if (isDebt) {
                        studentDebts.push({
                            subjectName: subject.name,
                            courseCode,
                            tkhp: rawTkhp,
                            diemChu: rawDiemChu,
                            danhGia: rawDanhGia,
                            reason
                        });

                        parsedData.subjectsMap[subject.name].totalDebts++;
                        parsedData.subjectsMap[subject.name].debtStudents.push({
                            id,
                            name: fullName || '\u0043h\u01b0a r\u00f5 t\u00ean',
                            className: sheetName,
                            courseCode,
                            reason,
                            tkhp: rawTkhp,
                            diemChu: rawDiemChu
                        });
                    }
                });

                parsedData.students.push({
                    stt: parsedStt,
                    id,
                    name: fullName || '\u0043h\u01b0a r\u00f5 t\u00ean',
                    dob,
                    email,
                    className: sheetName,
                    debts: studentDebts,
                    coursesTaken,
                    studyPlan: {}
                });
            }
        }
    });

    return parsedData;
}
