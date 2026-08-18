// UI renderer for the notification modal.

export function openSendModalView({ globalData, showCustomMessage }, studentId = null, subjectName = null) {
    const modal = document.getElementById('sendNotificationModal');
    const title = document.getElementById('sendModalTitle');
    const studentInfo = document.getElementById('sendModalStudentInfo');
    const recipientField = document.getElementById('sendModalRecipient');
    const subjectField = document.getElementById('sendModalSubject');
    const bodyField = document.getElementById('sendModalBody');

    if (studentId) {
        // Gửi cho 1 sinh viên
        const student = globalData.students.find(s => s.id === studentId);
        if (!student) return showCustomMessage("Không tìm thấy sinh viên!", "error");

        title.innerText = "Gửi Thông Báo Tới Sinh Viên";
        studentInfo.innerHTML = `
            <span class="font-bold text-slate-800 text-sm">${student.name}</span>
            <span class="text-xs bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-500">MSSV: ${student.id}</span>
        `;
        studentInfo.classList.remove('hidden');

        recipientField.value = student.email || `${student.id}@st.phenikaa-uni.edu.vn`;
        subjectField.value = `[Thông báo] V/v kết quả học tập và các môn cần xử lý của sinh viên ${student.name}`;

        const debtSubjects = student.debts.map(d => `- ${d.subjectName} (Lý do: ${d.reason})`).join('\n');
        bodyField.value = `Chào em ${student.name},\n\nTrường Công nghệ thông tin thông báo về tình hình học tập của em.\nHiện tại, hệ thống ghi nhận em đang có ${student.debts.length} môn học chưa đạt, cần phải xử lý, cụ thể:\n\n${debtSubjects}\n\nĐề nghị em theo dõi lịch của phòng Đào tạo và các thông báo của Trường để đăng ký học lại/thi lại các học phần trên trong thời gian sớm nhất.\n\nTrân trọng,\nTrường Công nghệ thông tin.`;

        modal.dataset.studentId = studentId;
        modal.dataset.mode = 'single';
    } else if (subjectName) {
        // Gửi hàng loạt cho những người nợ 1 môn cụ thể
        const decodedSubjectName = decodeURIComponent(subjectName);
        const subjectData = globalData.subjectsMap[decodedSubjectName];
        if (!subjectData) return showCustomMessage("Không tìm thấy môn học!", "error");

        title.innerText = "Gửi Thông Báo Hàng Loạt";
        studentInfo.innerHTML = `Gửi tới: <span class="font-bold">${subjectData.debtStudents.length} sinh viên đang nợ môn "${decodedSubjectName}"</span>`;
        studentInfo.classList.remove('hidden');

        recipientField.value = "{email_sv} hoặc +84{mssv}";
        subjectField.value = `[Thông báo] V/v xử lý học phần chưa đạt: ${decodedSubjectName}`;
        bodyField.value = `Chào em {ho_ten},\n\nTrường Công nghệ thông tin thông báo.\nHiện tại, hệ thống ghi nhận em đang có học phần "${decodedSubjectName}" chưa đạt.\n\nĐề nghị em theo dõi lịch của phòng Đào tạo và các thông báo của Trường để đăng ký học lại/thi lại học phần trên trong thời gian sớm nhất.\n\nTrân trọng,\nTrường Công nghệ thông tin.`;

        modal.dataset.studentId = '';
        modal.dataset.mode = 'bulk_subject';
        modal.dataset.subjectName = subjectName;
    } else {
        // Gửi hàng loạt theo bộ lọc tab Sinh viên
        const classFilter = document.getElementById('classFilterSelect').value;
        const targetText = classFilter === 'ALL' ? 'tất cả sinh viên đang nợ môn' : `sinh viên nợ môn thuộc lớp ${classFilter}`;

        title.innerText = "Gửi Thông Báo Hàng Loạt";
        studentInfo.innerHTML = `Gửi tới: <span class="font-bold">${targetText}</span>`;
        studentInfo.classList.remove('hidden');

        recipientField.value = "{email_sv} hoặc +84{mssv}";
        subjectField.value = `[Thông báo] V/v kết quả học tập và các môn cần xử lý`;
        bodyField.value = `Chào em {ho_ten},\n\nTrường Công nghệ thông tin thông báo về tình hình học tập của em.\nHiện tại, hệ thống ghi nhận em đang có {so_mon_no} môn học chưa đạt, cần phải xử lý, cụ thể:\n\n{danh_sach_mon_no}\n\nĐề nghị em theo dõi lịch của phòng Đào tạo và các thông báo của Trường để đăng ký học lại/thi lại các học phần trên trong thời gian sớm nhất.\n\nTrân trọng,\nTrường Công nghệ thông tin.`;

        modal.dataset.studentId = '';
        modal.dataset.mode = 'bulk_filter';
        modal.dataset.subjectName = '';
    }

    modal.classList.remove('hidden');
}

export function closeSendModalView() {
    document.getElementById('sendNotificationModal').classList.add('hidden');
}
