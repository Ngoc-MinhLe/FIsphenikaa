import {
    renderSubjectsTabView
} from '../ui/subject-renderer.js';
import {
    renderStudentsTabView,
    toggleAccordionView
} from '../ui/student-renderer.js';
import { renderOverviewTabView } from '../ui/overview-renderer.js';
import { renderFacultyTabView } from '../ui/faculty-renderer.js';

export function createDashboardController({ globalData, normalizeText, renderLogsTab }) {
    let currentTab = 'overview';
    let chartInstance = null;

    function switchTab(tabName) {
        currentTab = tabName;
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('bg-white', 'text-brand-700', 'shadow-sm', 'font-bold');
            btn.classList.add('text-slate-600', 'font-semibold');
        });

        const activeBtn = document.getElementById(`tabBtn-${tabName}`);
        if (activeBtn) {
            activeBtn.classList.add('bg-white', 'text-brand-700', 'shadow-sm', 'font-bold');
            activeBtn.classList.remove('text-slate-600', 'font-semibold');
        }

        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
        const contentPanel = document.getElementById(`tabContent-${tabName}`);
        if (contentPanel) contentPanel.classList.remove('hidden');

        if (tabName === 'overview') renderOverviewTab();
        else if (tabName === 'students') renderStudentsTab();
        else if (tabName === 'subjects') renderSubjectsTab();
        else if (tabName === 'faculty') renderFacultyTab();
        else if (tabName === 'logs') renderLogsTab();
    }

    function renderDashboard() {
        const hasData = globalData.students.length > 0 || Boolean(globalData.facultyReport?.records?.length);
        const uploadSection = document.getElementById('uploadSection');
        const dashboardSection = document.getElementById('dashboardSection');
        const headerActions = document.getElementById('headerActions');
        const emptyStateContainer = document.getElementById('emptyStateContainer');
        const dataDependentContent = document.getElementById('dataDependentContent');

        if (hasData) {
            if (uploadSection) uploadSection.classList.add('hidden');
            if (dashboardSection) dashboardSection.classList.remove('hidden');
            if (headerActions) headerActions.classList.remove('hidden');
            if (emptyStateContainer) emptyStateContainer.classList.add('hidden');
            if (dataDependentContent) dataDependentContent.classList.remove('hidden');

            const hasStudents = globalData.students.length > 0;
            document.getElementById('tabBtn-overview').classList.toggle('hidden', !hasStudents && !globalData.facultyReport);
            document.getElementById('tabBtn-students').classList.toggle('hidden', !hasStudents);
            document.getElementById('tabBtn-subjects').classList.toggle('hidden', !hasStudents);
            document.getElementById('tabBtn-faculty')?.classList.toggle('hidden', !globalData.facultyReport);
            if (currentTab === 'faculty' && !globalData.facultyReport) currentTab = 'overview';
            switchTab(currentTab);
            return;
        }

        if (uploadSection) uploadSection.classList.remove('hidden');
        if (dashboardSection) dashboardSection.classList.add('hidden');
        if (headerActions) headerActions.classList.add('hidden');
        if (emptyStateContainer) emptyStateContainer.classList.add('hidden');
        if (dataDependentContent) dataDependentContent.classList.add('hidden');
    }

    function renderOverviewTab() {
        chartInstance = renderOverviewTabView(globalData, chartInstance);
    }

    function renderStudentsTab() {
        renderStudentsTabView({ globalData, normalizeText });
    }

    function toggleAccordion(id) {
        toggleAccordionView(id);
    }

    function renderSubjectsTab() {
        renderSubjectsTabView({ globalData, normalizeText });
    }

    function renderFacultyTab() {
        renderFacultyTabView({
            globalData,
            onConfigChanged: renderFacultyTab
        });
    }

    return {
        switchTab,
        renderDashboard,
        renderStudentsTab,
        renderSubjectsTab,
        renderFacultyTab,
        toggleAccordion
    };
}
