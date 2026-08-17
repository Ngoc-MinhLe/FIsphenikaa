import { analyzeStudentAgainstFramework } from '../excel/framework-analysis.js';
import {
    renderRoadmapTabView,
    renderPlannerTabView,
    renderSemesterSummaryView,
    printPlannerView
} from '../ui/planner-renderer.js';

const SEMESTER_PLANNING_OPTIONS = [
    'Kỳ 1.1', 'Kỳ 1.2', 'Kỳ 1.3',
    'Kỳ 2.1', 'Kỳ 2.2', 'Kỳ 2.3',
    'Kỳ 3.1', 'Kỳ 3.2', 'Kỳ 3.3'
];

export function createPlannerController({ globalData, renderStudentsTab }) {
    let currentSelectedStudentForPlanner = null;
    let currentPlannerTab = 'roadmap';

    function buildPlannerAssessment(student) {
        return analyzeStudentAgainstFramework(
            student,
            globalData.frameworkCourses || [],
            globalData.frameworkMetadata || {}
        );
    }

    function openPlannerModal(studentId) {
        const student = globalData.students.find(item => item.id === studentId);
        if (!student) return;

        currentSelectedStudentForPlanner = student;
        document.getElementById('plannerModalStudentInfo').innerHTML = `
            Sinh viên: <span class="font-bold text-white text-sm">${student.name}</span> •
            MSSV: <span class="font-bold text-white">${student.id}</span> •
            Lớp: <span class="font-bold text-white">${student.className}</span>
        `;

        const assessment = buildPlannerAssessment(student);
        const totalFrameworkCredits = globalData.frameworkMetadata.totalCredits || 1;
        const progressPercent = Math.min(100, ((assessment.passedCredits / totalFrameworkCredits) * 100)).toFixed(1);

        document.getElementById('plannerProgressPercent').innerText = `${progressPercent}% (${assessment.passedCredits}/${totalFrameworkCredits} TC)`;
        document.getElementById('plannerProgressBar').style.width = `${progressPercent}%`;
        document.getElementById('plannerPassedCount').innerText = assessment.passedCount;
        document.getElementById('plannerFailedCount').innerText = assessment.failedCount;
        document.getElementById('plannerUnstudiedCount').innerText = assessment.unstudiedCount;

        student.plannerAssessment = assessment;
        student.stats = {
            passedCredits: assessment.passedCredits,
            failedCredits: assessment.failedCredits,
            unstudiedCredits: assessment.unstudiedCredits,
            totalFrameworkCredits,
            progressPercent,
            passedCount: assessment.passedCount,
            failedCount: assessment.failedCount,
            unstudiedCount: assessment.unstudiedCount
        };

        renderRoadmapTabView(assessment.roadmapGroups);
        renderPlannerTab();
        switchPlannerTab('roadmap');
        document.getElementById('studentPlannerModal').classList.remove('hidden');
    }

    function closePlannerModal() {
        document.getElementById('studentPlannerModal').classList.add('hidden');
        currentSelectedStudentForPlanner = null;
        renderStudentsTab();
    }

    function switchPlannerTab(tabName) {
        currentPlannerTab = tabName;
        document.querySelectorAll('.planner-tab-btn').forEach(btn => {
            btn.classList.remove('bg-brand-50', 'text-brand-700', 'font-bold');
            btn.classList.add('text-slate-600', 'font-semibold');
        });

        const activeBtn = document.getElementById(`plannerTabBtn-${tabName}`);
        if (activeBtn) {
            activeBtn.classList.add('bg-brand-50', 'text-brand-700', 'font-bold');
            activeBtn.classList.remove('text-slate-600', 'font-semibold');
        }

        document.querySelectorAll('.planner-tab-content').forEach(content => content.classList.add('hidden'));
        document.getElementById(`plannerTabContent-${tabName}`).classList.remove('hidden');
    }

    function renderPlannerTab() {
        const student = currentSelectedStudentForPlanner;
        if (!student) return;

        const assessment = student.plannerAssessment || buildPlannerAssessment(student);
        renderPlannerTabView(student, assessment, SEMESTER_PLANNING_OPTIONS);
        updateSemestersSummaryView();
    }

    function updatePlannerSemester(courseCode, semesterVal) {
        const student = currentSelectedStudentForPlanner;
        if (!student) return;

        if (semesterVal === '') delete student.studyPlan[courseCode];
        else student.studyPlan[courseCode] = semesterVal;

        updateSemestersSummaryView();
    }

    function updateSemestersSummaryView() {
        const student = currentSelectedStudentForPlanner;
        if (!student) return;

        renderSemesterSummaryView(
            student,
            globalData.frameworkCourses,
            SEMESTER_PLANNING_OPTIONS
        );
    }

    function printPlanner() {
        const student = currentSelectedStudentForPlanner;
        if (!student) return;

        printPlannerView(
            student,
            globalData.frameworkCourses,
            SEMESTER_PLANNING_OPTIONS
        );
    }

    return {
        openPlannerModal,
        closePlannerModal,
        switchPlannerTab,
        updatePlannerSemester,
        printPlanner
    };
}
