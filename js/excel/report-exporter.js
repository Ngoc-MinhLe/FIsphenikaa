export function buildSubjectStudentsReport(subjectName, subject, students = []) {
    if (!subject || !Array.isArray(subject.debtStudents) || subject.debtStudents.length === 0) {
        return null;
    }

    const courseCode = subjectName.split(' - ').pop().trim();
    const rows = subject.debtStudents.map((debtStudent, index) => {
        const student = students.find(item => item.id === debtStudent.id) || {};
        return {
            'STT': index + 1,
            'Mã học phần': courseCode,
            'Tên học phần': subjectName,
            'MSSV': debtStudent.id,
            'Họ và tên': debtStudent.name,
            'Lớp / Sheet': debtStudent.className,
            'Ngày sinh': student.dob || '',
            'Email': student.email || '',
            'TKHP': debtStudent.tkhp ?? '',
            'Điểm chữ': debtStudent.diemChu || '',
            'Lý do': debtStudent.reason || ''
        };
    });

    return {
        courseCode,
        filename: `DanhSach_${courseCode}_NoMon.xlsx`,
        sheetName: `SV_${courseCode}`.slice(0, 31),
        rows,
        widths: [8, 18, 42, 15, 28, 22, 16, 32, 12, 12, 30]
    };
}

export function buildDebtReport(students = []) {
    const rows = [];
    students.forEach(student => {
        (student.debts || []).forEach(debt => {
            rows.push({
                'Lớp / Sheet': student.className,
                'Mã Số Sinh Viên': student.id,
                'Họ Và Tên': student.name,
                'Ngày Sinh': student.dob,
                'Email': student.email,
                'Môn Học Nợ': debt.subjectName,
                'Lịch Sử TKHP': debt.tkhp !== null && debt.tkhp !== undefined ? debt.tkhp : '',
                'Lịch Sử Điểm Chữ': debt.diemChu || '',
                'Lịch Sử Đánh Giá': debt.danhGia || '',
                'Lý Do Nợ Hiện Tại': debt.reason
            });
        });
    });

    return {
        filename: 'Bao_Cao_Danh_Sach_No_Mon_Sinh_Vien.xlsx',
        sheetName: 'ThongKeNoMon',
        rows
    };
}

export function buildDebtSummaryReport(students = []) {
    const studentsWithDebt = students.filter(student => (student.debts || []).length > 0);
    const rows = studentsWithDebt.map(student => {
        const debtSubjectsList = student.debts
            .map(debt => `- ${debt.subjectName} (Lý do: ${debt.reason})`)
            .join('\n');

        const emailSubject = `[Thông báo] V/v kết quả học tập và các môn cần xử lý của sinh viên ${student.name}`;
        const emailBody = `Chào em ${student.name},\n\nTrường Công nghệ thông tin thông báo về tình hình học tập của em.\nHiện tại, hệ thống ghi nhận em đang có ${student.debts.length} môn học chưa đạt, cần phải xử lý, cụ thể:\n\n${debtSubjectsList}\n\nĐề nghị em theo dõi lịch của phòng Đào tạo và các thông báo của Trường để đăng ký học lại/thi lại các học phần trên trong thời gian sớm nhất.\n\nTrân trọng,\nTrường Công nghệ thông tin.`;

        return {
            'Lớp / Sheet': student.className,
            'Mã Số Sinh Viên': student.id,
            'Họ Và Tên': student.name,
            'Email': student.email,
            'Tiêu đề Email': emailSubject,
            'Nội dung Email': emailBody
        };
    });

    return {
        filename: 'Bao_Cao_Tong_Hop_No_Mon_Sinh_Vien.xlsx',
        sheetName: 'TongHopNoMon',
        rows,
        widths: [15, 15, 25, 30, 50, 80]
    };
}

export function buildClassOpeningReportSheets(report, frameworkCourses = []) {
    const courseRows = report.courses.map(course => ({
        'Mã học phần': course.courseCode,
        'Tên học phần': course.courseName,
        'Khối': course.blockName,
        'Loại': course.courseType === 'elective' ? 'Tự chọn' : 'Bắt buộc',
        'Số tín chỉ': course.credits,
        'SV nợ / cần học lại': course.debtCount,
        'SV chưa học bắt buộc': course.unstudiedCount,
        'Nhu cầu chắc chắn': course.definiteNeedCount,
        'SV đang có thể chọn': course.candidateCount,
        'Kỳ dự kiến theo khung': (course.plannedTerms || []).join(', '),
        'Phân loại xử lý': course.priority,
        'Khuyến nghị': course.recommendation
    }));

    const groupRows = report.groups.map(group => ({
        'Mã nhóm': group.groupId,
        'Tên nhóm': group.groupName,
        'Tín chỉ yêu cầu': group.requiredCredits,
        'Số SV chưa đủ nhóm': group.missingStudentCount,
        'Tổng tín chỉ còn thiếu': group.totalRemainingCredits,
        'SV có môn nợ trong nhóm': group.directDebtStudentCount,
        'Danh sách môn có thể chọn': group.options.map(option =>
            option.courseCode + ' - ' + option.courseName
        ).join('; ')
    }));

    const detailRows = [];
    const subjectStudentRows = [];
    const frameworkByCode = new Map(frameworkCourses.map(course => [course.courseCode, course]));

    report.students.forEach(analysis => {
        const student = analysis.student;
        const addedCourseCodes = new Set();

        analysis.courses
            .filter(course => course.demandType === 'REQUIRED_DEBT' ||
                course.demandType === 'REQUIRED_UNSTUDIED' ||
                course.demandType === 'ELECTIVE_DEBT')
            .forEach(course => {
                const takenInfo = student.coursesTaken?.[course.courseCode] || {};
                addedCourseCodes.add(course.courseCode);
                detailRows.push({
                    'Lớp / Sheet': student.className,
                    'MSSV': student.id,
                    'Họ và tên': student.name,
                    'Loại nhu cầu': course.demandType === 'ELECTIVE_DEBT'
                        ? 'Nợ môn tự chọn'
                        : (course.status === 'DEBT' ? 'Nợ môn bắt buộc' : 'Chưa học bắt buộc'),
                    'Mã học phần': course.courseCode,
                    'Tên học phần': course.courseName,
                    'Tín chỉ': course.credits,
                    'Nhóm tự chọn': course.electiveGroup || '',
                    'Điểm / Ghi chú': course.gradeDesc
                });

                subjectStudentRows.push({
                    'Mã học phần': course.courseCode,
                    'Tên học phần': course.courseName,
                    'Khối': course.blockName,
                    'Thuộc khung': 'Có',
                    'Loại nhu cầu': course.demandType === 'ELECTIVE_DEBT'
                        ? 'Nợ môn tự chọn'
                        : (course.status === 'DEBT' ? 'Nợ môn trong khung' : 'Chưa học bắt buộc'),
                    'Tín chỉ': course.credits,
                    'Kỳ dự kiến': (course.plannedTerms || []).join(', '),
                    'MSSV': student.id,
                    'Họ và tên': student.name,
                    'Lớp / Sheet': student.className,
                    'Ngày sinh': student.dob,
                    'Email': student.email,
                    'TKHP': takenInfo.tkhp || '',
                    'Điểm chữ': takenInfo.diemChu || '',
                    'Đánh giá': takenInfo.danhGia || '',
                    'Lý do / Ghi chú': course.status === 'DEBT' ? 'Chưa đạt' : 'Chưa có kết quả'
                });
            });

        (student.debts || []).forEach(debt => {
            const courseCode = debt.courseCode || String(debt.subjectName || '').split(' - ').pop().trim();
            if (addedCourseCodes.has(courseCode)) return;

            const frameworkCourse = frameworkByCode.get(courseCode);
            subjectStudentRows.push({
                'Mã học phần': courseCode,
                'Tên học phần': frameworkCourse?.courseName || debt.subjectName,
                'Khối': frameworkCourse?.blockName || '',
                'Thuộc khung': frameworkCourse ? 'Có' : 'Không',
                'Loại nhu cầu': frameworkCourse ? 'Nợ môn trong khung' : 'Nợ ngoài khung',
                'Tín chỉ': frameworkCourse?.credits || '',
                'Kỳ dự kiến': (frameworkCourse?.plannedTerms || []).join(', '),
                'MSSV': student.id,
                'Họ và tên': student.name,
                'Lớp / Sheet': student.className,
                'Ngày sinh': student.dob,
                'Email': student.email,
                'TKHP': debt.tkhp || '',
                'Điểm chữ': debt.diemChu || '',
                'Đánh giá': debt.danhGia || '',
                'Lý do / Ghi chú': debt.reason || 'Chưa đạt'
            });
        });

        analysis.electiveGroups
            .filter(group => group.remainingCredits > 0)
            .forEach(group => {
                detailRows.push({
                    'Lớp / Sheet': student.className,
                    'MSSV': student.id,
                    'Họ và tên': student.name,
                    'Loại nhu cầu': 'Thiếu tín chỉ nhóm tự chọn',
                    'Mã học phần': '',
                    'Tên học phần': group.groupId + ' - ' + group.name,
                    'Tín chỉ': group.remainingCredits,
                    'Nhóm tự chọn': group.groupId,
                    'Điểm / Ghi chú': 'Không phân bổ vào môn cụ thể'
                });
            });
    });

    subjectStudentRows.sort((a, b) =>
        String(a['Mã học phần']).localeCompare(String(b['Mã học phần'])) ||
        String(a.MSSV).localeCompare(String(b.MSSV))
    );

    const outsideRows = report.outsideFramework.map(course => ({
        'Mã học phần': course.courseCode,
        'Tên trong bảng điểm': course.courseName,
        'Số SV đã từng có điểm': course.studentCount,
        'Số SV đang nợ': course.debtCount,
        'Ghi chú': 'Không thuộc danh sách khung đang đối chiếu'
    }));

    const studentRows = report.students.map(analysis => ({
        'Lớp / Sheet': analysis.student.className,
        'MSSV': analysis.student.id,
        'Họ và tên': analysis.student.name,
        'TC đã tính': analysis.passedCredits,
        'TC nợ cụ thể': analysis.failedCredits,
        'TC chưa hoàn thành': analysis.unstudiedCredits,
        'Môn nợ trong khung': analysis.failedCount,
        'Môn bắt buộc chưa học': analysis.requiredUnstudied.length,
        'Nhóm tự chọn chưa đủ': analysis.electiveGroups.filter(group => group.remainingCredits > 0).length,
        'Tiến độ (%)': report.summary.frameworkTotalCredits > 0
            ? ((analysis.passedCredits / report.summary.frameworkTotalCredits) * 100).toFixed(1)
            : 0
    }));

    return [
        { name: 'NhuCauMoLop', rows: courseRows, widths: [16, 40, 32, 14, 12, 18, 22, 20, 20, 24, 24, 45] },
        { name: 'NhomTuChon', rows: groupRows, widths: [14, 35, 18, 22, 24, 24, 90] },
        { name: 'ChiTietNhuCau', rows: detailRows, widths: [18, 15, 28, 28, 18, 42, 12, 16, 35] },
        { name: 'SinhVienTheoMon', rows: subjectStudentRows, widths: [18, 42, 32, 14, 24, 12, 16, 15, 28, 20, 16, 32, 12, 12, 20, 32] },
        { name: 'NgoaiKhung', rows: outsideRows, widths: [18, 42, 24, 16, 50] },
        { name: 'TongHopSinhVien', rows: studentRows, widths: [18, 15, 28, 14, 18, 22, 18, 24, 16] }
    ];
}
