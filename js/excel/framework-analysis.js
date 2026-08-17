function createElectiveGroups(frameworkMetadata = {}) {
    return (frameworkMetadata.electiveGroups || [])
        .filter(group => Number(group.requiredCredits) > 0)
        .map(group => ({
            ...group,
            requiredCredits: Number(group.requiredCredits) || 0,
            earnedCredits: 0,
            remainingCredits: Number(group.requiredCredits) || 0,
            options: [],
            missingStudentIds: [],
            directDebtStudentIds: []
        }));
}

function makeGradeDescription(takenInfo) {
    if (!takenInfo) return '-';

    const score = takenInfo.tkhp || '';
    const letter = takenInfo.diemChu || (takenInfo.passed ? '' : 'F');
    return `${score} (${letter})${takenInfo.passed ? '' : ' - Nợ'}`;
}

export function analyzeStudentAgainstFramework(student, frameworkCourses = [], frameworkMetadata = {}) {
    const coursesTaken = student?.coursesTaken || {};
    const electiveGroups = createElectiveGroups(frameworkMetadata);
    const groupsById = new Map(electiveGroups.map(group => [group.id, group]));

    const courses = frameworkCourses.map(course => {
        const takenInfo = coursesTaken[course.courseCode];
        return {
            ...course,
            status: takenInfo ? (takenInfo.passed ? 'PASSED' : 'DEBT') : 'UNSTUDIED',
            gradeDesc: makeGradeDescription(takenInfo),
            countedCredits: 0,
            neededCredits: 0,
            remainingForPlan: false,
            demandType: null
        };
    });

    const requiredCourses = courses.filter(course =>
        !course.electiveGroup || !groupsById.has(course.electiveGroup)
    );

    requiredCourses.forEach(course => {
        const takenInfo = coursesTaken[course.courseCode];
        if (takenInfo?.passed) {
            course.countedCredits = course.credits;
            return;
        }

        course.remainingForPlan = true;
        course.neededCredits = course.credits;
        course.demandType = takenInfo ? 'REQUIRED_DEBT' : 'REQUIRED_UNSTUDIED';
    });

    electiveGroups.forEach(group => {
        const options = courses.filter(course => course.electiveGroup === group.id);
        group.options = options;

        let remainingCredits = group.requiredCredits;
        options.forEach(course => {
            const takenInfo = coursesTaken[course.courseCode];

            if (takenInfo?.passed) {
                course.countedCredits = Math.min(course.credits, remainingCredits);
                remainingCredits = Math.max(0, remainingCredits - course.countedCredits);
                course.status = course.countedCredits > 0 ? 'PASSED' : 'EXCESS';
                return;
            }

            if (remainingCredits > 0) {
                course.remainingForPlan = true;
                course.demandType = takenInfo ? 'ELECTIVE_DEBT' : 'ELECTIVE_OPTION';
                course.neededCredits = Math.min(course.credits, remainingCredits);
                return;
            }

            course.status = 'NOT_REQUIRED';
            course.demandType = null;
            course.gradeDesc = takenInfo
                ? `${makeGradeDescription(takenInfo)} - Vượt chỉ tiêu tự chọn`
                : 'Không cần chọn nếu nhóm đã đủ tín chỉ';
        });

        group.earnedCredits = group.requiredCredits - remainingCredits;
        group.remainingCredits = remainingCredits;
    });

    const roadmapGroups = {};
    courses.forEach(course => {
        if (!roadmapGroups[course.blockId]) {
            roadmapGroups[course.blockId] = {
                name: course.blockName,
                courses: []
            };
        }
        roadmapGroups[course.blockId].courses.push(course);
    });

    electiveGroups.forEach(group => {
        if (!roadmapGroups[group.id]) {
            roadmapGroups[group.id] = {
                name: group.name,
                courses: []
            };
        }
        roadmapGroups[group.id].electiveSummary = group;
    });

    const directDebtCourses = courses.filter(course =>
        course.demandType === 'REQUIRED_DEBT' || course.demandType === 'ELECTIVE_DEBT'
    );
    const requiredUnstudied = courses.filter(course =>
        course.demandType === 'REQUIRED_UNSTUDIED'
    );
    const incompleteGroups = electiveGroups.filter(group => group.remainingCredits > 0);

    return {
        student,
        courses,
        roadmapGroups,
        electiveGroups,
        remainingCourses: courses.filter(course => course.remainingForPlan),
        directDebtCourses,
        requiredUnstudied,
        passedCredits: courses.reduce((sum, course) => sum + course.countedCredits, 0),
        failedCredits: directDebtCourses.reduce((sum, course) => sum + course.neededCredits, 0),
        unstudiedCredits: requiredUnstudied.reduce((sum, course) => sum + course.credits, 0) +
            incompleteGroups.reduce((sum, group) => sum + group.remainingCredits, 0),
        passedCount: courses.filter(course => course.countedCredits > 0 && course.status === 'PASSED').length,
        failedCount: directDebtCourses.length,
        unstudiedCount: requiredUnstudied.length + incompleteGroups.length
    };
}

function ensureCourseDemand(map, course) {
    if (!map.has(course.courseCode)) {
        map.set(course.courseCode, {
            courseCode: course.courseCode,
            courseName: course.courseName,
            blockId: course.blockId,
            blockName: course.blockName,
            credits: course.credits,
            courseType: course.courseType || 'required',
            electiveGroup: course.electiveGroup || '',
            plannedTerms: course.plannedTerms || [],
            debtStudentIds: new Set(),
            unstudiedStudentIds: new Set(),
            electiveCandidateStudentIds: new Set()
        });
    }

    return map.get(course.courseCode);
}

function ensureGroupDemand(map, group) {
    if (!map.has(group.id)) {
        map.set(group.id, {
            groupId: group.id,
            groupName: group.name,
            requiredCredits: group.requiredCredits,
            missingStudentIds: new Set(),
            totalRemainingCredits: 0,
            directDebtStudentIds: new Set(),
            options: group.options.map(course => ({
                courseCode: course.courseCode,
                courseName: course.courseName,
                credits: course.credits
            }))
        });
    }

    return map.get(group.id);
}

function addOutsideFrameworkCourse(map, courseCode, takenInfo, student) {
    if (!map.has(courseCode)) {
        map.set(courseCode, {
            courseCode,
            courseName: takenInfo?.courseName || courseCode,
            studentIds: new Set(),
            debtStudentIds: new Set()
        });
    }

    const entry = map.get(courseCode);
    entry.studentIds.add(student.id);
    if (takenInfo && !takenInfo.passed) entry.debtStudentIds.add(student.id);
}

function finalizeSetValues(entry) {
    Object.entries(entry).forEach(([key, value]) => {
        if (value instanceof Set) entry[key] = [...value];
    });
    return entry;
}

export function analyzeFrameworkDemand(students = [], frameworkCourses = [], frameworkMetadata = {}) {
    const frameworkCodeSet = new Set(frameworkCourses.map(course => course.courseCode));
    const courseDemandMap = new Map();
    const groupDemandMap = new Map();
    const outsideFrameworkMap = new Map();
    const studentAnalyses = students.map(student =>
        analyzeStudentAgainstFramework(student, frameworkCourses, frameworkMetadata)
    );

    studentAnalyses.forEach(analysis => {
        const student = analysis.student;

        analysis.courses.forEach(course => {
            const demand = ensureCourseDemand(courseDemandMap, course);
            if (course.demandType === 'REQUIRED_DEBT' || course.demandType === 'ELECTIVE_DEBT') {
                demand.debtStudentIds.add(student.id);
            }
            if (course.demandType === 'REQUIRED_UNSTUDIED') {
                demand.unstudiedStudentIds.add(student.id);
            }
            if (course.demandType === 'ELECTIVE_OPTION') {
                demand.electiveCandidateStudentIds.add(student.id);
            }
        });

        analysis.electiveGroups.forEach(group => {
            if (group.remainingCredits <= 0) return;

            const demand = ensureGroupDemand(groupDemandMap, group);
            demand.missingStudentIds.add(student.id);
            demand.totalRemainingCredits += group.remainingCredits;

            if (group.options.some(course => course.demandType === 'ELECTIVE_DEBT')) {
                demand.directDebtStudentIds.add(student.id);
            }
        });

        Object.entries(student.coursesTaken || {}).forEach(([courseCode, takenInfo]) => {
            if (!frameworkCodeSet.has(courseCode)) {
                addOutsideFrameworkCourse(outsideFrameworkMap, courseCode, takenInfo, student);
            }
        });
    });

    const courses = [...courseDemandMap.values()].map(entry => {
        const debtCount = entry.debtStudentIds.size;
        const unstudiedCount = entry.unstudiedStudentIds.size;
        const candidateCount = entry.electiveCandidateStudentIds.size;
        return {
            ...finalizeSetValues(entry),
            debtCount,
            unstudiedCount,
            candidateCount,
            definiteNeedCount: debtCount + unstudiedCount,
            priority: debtCount > 0
                ? 'Ưu tiên xử lý nợ'
                : (entry.plannedTerms.length > 0 ? 'Theo lộ trình khung' : 'Chưa có kỳ cụ thể'),
            recommendation: entry.courseType === 'elective'
                ? (debtCount > 0 ? 'Có sinh viên cần học lại; nhu cầu chọn mới xem theo nhóm' : 'Chỉ là môn lựa chọn tham khảo')
                : 'Nhu cầu chắc chắn'
        };
    }).sort((a, b) => b.definiteNeedCount - a.definiteNeedCount || a.courseCode.localeCompare(b.courseCode));

    const groups = [...groupDemandMap.values()].map(entry => ({
        ...finalizeSetValues(entry),
        missingStudentCount: entry.missingStudentIds.length,
        directDebtStudentCount: entry.directDebtStudentIds.length
    })).sort((a, b) => b.missingStudentCount - a.missingStudentCount);

    const outsideFramework = [...outsideFrameworkMap.values()].map(entry => ({
        ...finalizeSetValues(entry),
        studentCount: entry.studentIds.length,
        debtCount: entry.debtStudentIds.length
    })).sort((a, b) => b.debtCount - a.debtCount || a.courseCode.localeCompare(b.courseCode));

    return {
        students: studentAnalyses,
        courses,
        groups,
        outsideFramework,
        summary: {
            totalStudents: students.length,
            frameworkCourseCount: frameworkCourses.length,
            frameworkTotalCredits: Number(frameworkMetadata.totalCredits) || 0,
            studentsWithFrameworkDebt: studentAnalyses.filter(analysis => analysis.failedCount > 0).length,
            studentsWithFrameworkMissing: studentAnalyses.filter(analysis =>
                analysis.failedCount > 0 || analysis.unstudiedCount > 0
            ).length
        }
    };
}
