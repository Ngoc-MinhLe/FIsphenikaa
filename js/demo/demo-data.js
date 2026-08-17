const demoFrameworkCourses = [
    { blockId: 'A1', blockName: 'Khối kiến thức giáo dục đại cương', courseCode: 'FFS703002', courseName: 'Triết học Mác - Lê nin', credits: 3 },
    { blockId: 'A1', blockName: 'Khối kiến thức giáo dục đại cương', courseCode: 'FFS702003', courseName: 'Kinh tế chính trị Mác - Lênin', credits: 2 },
    { blockId: 'A1', blockName: 'Khối kiến thức giáo dục đại cương', courseCode: 'FFS702001', courseName: 'Pháp luật đại cương', credits: 2 },
    { blockId: 'A1', blockName: 'Khối kiến thức giáo dục đại cương', courseCode: 'FFS703007', courseName: 'Đại số tuyến tính', credits: 3 },
    { blockId: 'A1', blockName: 'Khối kiến thức giáo dục đại cương', courseCode: 'FFS703008', courseName: 'Giải tích', credits: 3 },
    { blockId: 'A2', blockName: 'Khối kiến thức cơ sở toán - lý', courseCode: 'FFS703013', courseName: 'Vật lý 1', credits: 3 },
    { blockId: 'A2', blockName: 'Khối kiến thức cơ sở toán - lý', courseCode: 'CSE703024', courseName: 'Toán rời rạc', credits: 3 },
    { blockId: 'A2', blockName: 'Khối kiến thức cơ sở toán - lý', courseCode: 'CSE703057', courseName: 'Tối ưu hóa', credits: 3 },
    { blockId: 'B1', blockName: 'Khối kiến thức cơ sở ngành', courseCode: 'CSE703107', courseName: 'Cơ sở lập trình', credits: 3 },
    { blockId: 'B1', blockName: 'Khối kiến thức cơ sở ngành', courseCode: 'CSE703029', courseName: 'Lập trình hướng đối tượng', credits: 3 },
    { blockId: 'B1', blockName: 'Khối kiến thức cơ sở ngành', courseCode: 'CSE703006', courseName: 'Cấu trúc dữ liệu và thuật toán', credits: 3 },
    { blockId: 'B1', blockName: 'Khối kiến thức cơ sở ngành', courseCode: 'CSE703008', courseName: 'Cơ sở dữ liệu', credits: 3 },
    { blockId: 'B2', blockName: 'Khối kiến thức chuyên ngành', courseCode: 'CSE703064', courseName: 'Xây dựng ứng dụng web', credits: 3 },
    { blockId: 'B2', blockName: 'Khối kiến thức chuyên ngành', courseCode: 'CSE703048', courseName: 'Phân tích và thiết kế phần mềm', credits: 3 },
    { blockId: 'B2', blockName: 'Khối kiến thức chuyên ngành', courseCode: 'CSE703110', courseName: 'Kiến trúc phần mềm', credits: 3 }
];

const demoSubjects = [
    'Giải tích - FFS703008',
    'Đại số tuyến tính - FFS703007',
    'Vật lý 1 - FFS703013',
    'Toán rời rạc - CSE703024',
    'Cơ sở lập trình - CSE703107',
    'Cấu trúc dữ liệu và thuật toán - CSE703006',
    'Lập trình hướng đối tượng - CSE703029'
];

const demoStudents = [
    {
        id: '23010342',
        name: 'Nguyễn Duy Anh',
        cls: 'K17-KTPM(EL)_1',
        dob: '25/04/2005',
        taken: {
            'FFS703002': { passed: true, tkhp: '8.0', diemChu: 'B+' },
            'FFS702003': { passed: true, tkhp: '7.5', diemChu: 'B' },
            'FFS702001': { passed: true, tkhp: '9.0', diemChu: 'A' },
            'FFS703007': { passed: true, tkhp: '8.5', diemChu: 'A' },
            'FFS703008': { passed: false, tkhp: '3.0', diemChu: 'F' },
            'FFS703013': { passed: true, tkhp: '6.5', diemChu: 'C+' },
            'CSE703024': { passed: true, tkhp: '7.0', diemChu: 'B' }
        }
    },
    {
        id: '23010357',
        name: 'Nguyễn Quang Anh',
        cls: 'K17-KTPM(EL)_1',
        dob: '11/05/2005',
        taken: {
            'FFS703002': { passed: true, tkhp: '7.0', diemChu: 'B' },
            'FFS702003': { passed: true, tkhp: '6.5', diemChu: 'C+' },
            'FFS702001': { passed: true, tkhp: '8.0', diemChu: 'B+' },
            'FFS703007': { passed: true, tkhp: '5.5', diemChu: 'C' },
            'FFS703008': { passed: true, tkhp: '8.5', diemChu: 'A' },
            'FFS703013': { passed: false, tkhp: '3.5', diemChu: 'F' },
            'CSE703024': { passed: true, tkhp: '7.5', diemChu: 'B' }
        }
    },
    {
        id: '23010442',
        name: 'Vũ Đức Anh',
        cls: 'K17-KTPM(EL)_1',
        dob: '14/02/2005',
        taken: {
            'FFS703002': { passed: true, tkhp: '6.0', diemChu: 'C' },
            'FFS702003': { passed: false, tkhp: '2.5', diemChu: 'F' },
            'FFS702001': { passed: true, tkhp: '7.5', diemChu: 'B' },
            'FFS703007': { passed: false, tkhp: '3.4', diemChu: 'F' },
            'FFS703008': { passed: true, tkhp: '7.0', diemChu: 'B' },
            'FFS703013': { passed: true, tkhp: '6.0', diemChu: 'C' },
            'CSE703107': { passed: true, tkhp: '8.0', diemChu: 'B+' }
        }
    },
    {
        id: '23010283',
        name: 'Trần Ngọc An',
        cls: 'K17-KTPM(EL)_1',
        dob: '25/04/2005',
        taken: {
            'FFS703002': { passed: true, tkhp: '8.5', diemChu: 'A' },
            'FFS702003': { passed: true, tkhp: '8.0', diemChu: 'B+' },
            'FFS702001': { passed: true, tkhp: '9.5', diemChu: 'A+' },
            'FFS703007': { passed: true, tkhp: '8.0', diemChu: 'B+' },
            'FFS703008': { passed: true, tkhp: '7.5', diemChu: 'B' },
            'FFS703013': { passed: true, tkhp: '8.0', diemChu: 'B+' },
            'CSE703024': { passed: true, tkhp: '9.0', diemChu: 'A' },
            'CSE703107': { passed: true, tkhp: '8.5', diemChu: 'A' },
            'CSE703029': { passed: true, tkhp: '8.0', diemChu: 'B+' },
            'CSE703006': { passed: true, tkhp: '7.5', diemChu: 'B' }
        }
    }
];

function createSubjectsMap() {
    return Object.fromEntries(
        demoSubjects.map(name => [name, { name, totalDebts: 0, debtStudents: [] }])
    );
}

function normalizeDemoStudents(subjectsMap) {
    return demoStudents.map((student, index) => {
        const coursesTaken = Object.fromEntries(
            Object.entries(student.taken).map(([courseCode, grade]) => [courseCode, { ...grade }])
        );
        const debts = [];

        Object.entries(coursesTaken).forEach(([courseCode, grade]) => {
            if (grade.passed) return;

            const subjectName = demoSubjects.find(subject => subject.includes(courseCode)) || `${courseCode} - Học lại`;
            const debt = {
                subjectName,
                tkhp: grade.tkhp,
                diemChu: grade.diemChu,
                danhGia: 'HỌC LẠI',
                reason: `TKHP: ${grade.tkhp}`
            };

            if (!subjectsMap[subjectName]) {
                subjectsMap[subjectName] = { name: subjectName, totalDebts: 0, debtStudents: [] };
            }

            debts.push(debt);
            subjectsMap[subjectName].totalDebts++;
            subjectsMap[subjectName].debtStudents.push({
                id: student.id,
                name: student.name,
                className: student.cls,
                reason: debt.reason,
                tkhp: grade.tkhp,
                diemChu: grade.diemChu
            });
        });

        return {
            stt: index + 1,
            id: student.id,
            name: student.name,
            dob: student.dob,
            email: `${student.id}@phenikaa-uni.edu.vn`,
            className: student.cls,
            debts,
            coursesTaken,
            studyPlan: {}
        };
    });
}

export function createDemoData() {
    const subjectsMap = createSubjectsMap();

    return {
        sheets: ['K17-KTPM(EL)_1', 'K17-KTPM(EL)_2'],
        students: normalizeDemoStudents(subjectsMap),
        subjectsMap,
        classList: ['K17-KTPM(EL)_1', 'K17-KTPM(EL)_2'],
        frameworkCourses: demoFrameworkCourses.map(course => ({ ...course })),
        frameworkMetadata: { totalCredits: 40 }
    };
}
