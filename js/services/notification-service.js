export function selectNotificationTargets({
    mode,
    studentId,
    subjectName,
    classFilter,
    students = [],
    subjectsMap = {}
}) {
    if (mode === 'single') {
        const student = students.find(item => item.id === studentId);
        return student ? [student] : [];
    }

    if (mode === 'bulk_filter') {
        return students.filter(student => {
            const inClass = classFilter === 'ALL' || student.className === classFilter;
            return inClass && student.debts.length > 0;
        });
    }

    if (mode === 'bulk_subject') {
        const decodedSubjectName = decodeURIComponent(subjectName || '');
        const studentIds = subjectsMap[decodedSubjectName]?.debtStudents.map(student => student.id) || [];
        return students.filter(student => studentIds.includes(student.id));
    }

    return [];
}

export function buildNotificationLog({
    student,
    type,
    subject,
    bodyTemplate,
    senderUid,
    senderName,
    sentAt
}) {
    const debtList = student.debts
        .map(debt => `- ${debt.subjectName} (Lý do: ${debt.reason})`)
        .join('\n');
    const body = bodyTemplate
        .replace(/{ho_ten}/g, student.name)
        .replace(/{mssv}/g, student.id)
        .replace(/{so_mon_no}/g, student.debts.length)
        .replace(/{danh_sach_mon_no}/g, debtList);
    const recipient = type === 'email'
        ? (student.email || `${student.id}@st.phenikaa-uni.edu.vn`)
        : `+84${student.id}`;

    return {
        studentId: student.id,
        studentName: student.name,
        type,
        recipient,
        subject: subject.replace(/{ho_ten}/g, student.name),
        body,
        sentBy_uid: senderUid,
        sentBy_name: senderName,
        sentAt
    };
}
