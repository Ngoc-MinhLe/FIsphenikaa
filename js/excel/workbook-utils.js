/**
 * Các tiện ích Excel dùng chung cho module thống kê nợ môn.
 *
 * Bước đầu chỉ tách phần đọc dữ liệu và xử lý ô gộp; các parser nghiệp vụ
 * vẫn được giữ trong thongkenomon.js để tránh thay đổi hành vi của ứng dụng.
 */

export function readWorkbookFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                resolve(XLSX.read(data, { type: 'array' }));
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(reader.error || new Error('Không thể đọc file Excel.'));
        };

        reader.readAsArrayBuffer(file);
    });
}

export function sheetToMatrix(sheet) {
    const rawData = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: ''
    });

    // Lan truyền giá trị của ô gộp để các cột bên dưới có đủ ngữ cảnh.
    if (sheet['!merges']) {
        sheet['!merges'].forEach(range => {
            const startVal = rawData[range.s.r]
                ? rawData[range.s.r][range.s.c]
                : '';

            if (startVal !== undefined && startVal !== null && String(startVal).trim() !== '') {
                for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex++) {
                    if (!rawData[rowIndex]) rawData[rowIndex] = [];

                    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex++) {
                        if (!rawData[rowIndex][colIndex] || String(rawData[rowIndex][colIndex]).trim() === '') {
                            rawData[rowIndex][colIndex] = startVal;
                        }
                    }
                }
            }
        });
    }

    return rawData;
}

export function normalizeText(str) {
    if (str === null || str === undefined) return '';

    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toUpperCase()
        .trim();
}

export function getLatestAttempt(value) {
    if (value === null || value === undefined) return '';

    const str = String(value).trim();
    if (str.includes('|')) {
        const parts = str.split('|');
        return parts[parts.length - 1].trim();
    }

    return str;
}
