export function setupFileDropZones(onFileSelected, documentRef = document) {
    const studentZone = documentRef.getElementById('studentDropZone');
    const frameworkZone = documentRef.getElementById('frameworkDropZone');

    if (!studentZone || !frameworkZone) return;

    studentZone.addEventListener('click', () => documentRef.getElementById('studentFileInput').click());
    frameworkZone.addEventListener('click', () => documentRef.getElementById('frameworkFileInput').click());

    [studentZone, frameworkZone].forEach((zone, index) => {
        const type = index === 0 ? 'student' : 'framework';

        ['dragenter', 'dragover'].forEach(eventName => {
            zone.addEventListener(eventName, event => {
                event.preventDefault();
                event.stopPropagation();
                zone.classList.add('drop-active');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            zone.addEventListener(eventName, event => {
                event.preventDefault();
                event.stopPropagation();
                zone.classList.remove('drop-active');
            }, false);
        });

        zone.addEventListener('drop', event => {
            const files = event.dataTransfer?.files;
            if (files && files.length > 0) onFileSelected(files[0], type);
        });
    });
}

export async function loadWorkbookFile(file, type, {
    readWorkbookFromFile,
    onStudentWorkbook,
    onFrameworkWorkbook,
    showCustomMessage,
    documentRef = document
}) {
    try {
        const workbook = await readWorkbookFromFile(file);

        if (type === 'student') {
            onStudentWorkbook(workbook);
            const status = documentRef.getElementById('studentFileStatus');
            status.innerText = `Đã chọn: ${file.name}`;
            status.className = 'mt-4 px-3.5 py-1 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold';
            documentRef.getElementById('btnAnalyze').disabled = false;
            showCustomMessage('Đã nạp bảng điểm sinh viên thành công!', 'success');
        } else {
            onFrameworkWorkbook(workbook);
            const status = documentRef.getElementById('frameworkFileStatus');
            status.innerText = `Đã chọn: ${file.name}`;
            status.className = 'mt-4 px-3.5 py-1 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold';
            showCustomMessage('Đã nạp khung chương trình đào tạo thành công!', 'success');
        }
    } catch (error) {
        console.error('Error reading file:', error);
        showCustomMessage(`Lỗi đọc file Excel ${type}: ${error.message}`, 'error');
    }
}
