import { firebaseConfig } from './firebase-config.js';
import { normalizeText } from './excel/workbook-utils.js';
import {
    openSubjectModalView,
    closeSubjectModalView
} from './ui/subject-renderer.js';
import { renderLogsHtml } from './ui/log-renderer.js';
import { showCustomMessage } from './ui/toast.js';
import { createEmptyGlobalData } from './state/app-state.js';
import { createAnalysisController } from './app/analysis-controller.js';
import { createDashboardController } from './app/dashboard-controller.js';
import { createPlannerController } from './app/planner-controller.js';
import { createNotificationController } from './app/notification-controller.js';
import { createReportController } from './app/report-controller.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, serverTimestamp, doc, getDoc, query, orderBy, limit, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Initialize Firebase for this page
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let firebaseUser = null;

let globalData = createEmptyGlobalData();

const dashboardController = createDashboardController({
    globalData,
    normalizeText,
    renderLogsTab: () => renderLogsTab()
});

const plannerController = createPlannerController({
    globalData,
    renderStudentsTab: dashboardController.renderStudentsTab
});

const notificationController = createNotificationController({
    globalData,
    getFirebaseUser: () => firebaseUser,
    firestore: {
        collection: path => collection(db, path),
        serverTimestamp,
        doc: (...args) => args.length === 1 ? doc(args[0]) : doc(db, ...args),
        getDoc,
        writeBatch: () => writeBatch(db)
    },
    showCustomMessage
});

const reportController = createReportController({ globalData, showCustomMessage });

const analysisController = createAnalysisController({
    globalData,
    showCustomMessage,
    onDataChanged: dashboardController.renderDashboard
});

// Initialize events on page load
window.addEventListener('DOMContentLoaded', () => {
    analysisController.setupDragAndDrop();

    // --- GẮN CÁC HÀM VÀO WINDOW ĐỂ HTML CÓ THỂ GỌI ---
    window.startAnalysis = analysisController.startAnalysis;
    window.loadDemoData = analysisController.loadDemoData;
    window.exportToExcel = reportController.exportToExcel;
    window.exportSummaryToExcel = reportController.exportSummaryToExcel;
    window.exportClassOpeningReport = reportController.exportClassOpeningReport;
    window.switchTab = dashboardController.switchTab;
    window.renderStudentsTab = dashboardController.renderStudentsTab;
    window.renderSubjectsTab = dashboardController.renderSubjectsTab;
    window.toggleAccordion = dashboardController.toggleAccordion;
    window.openSubjectModal = openSubjectModal;
    window.closeSubjectModal = closeSubjectModal;
    window.exportSubjectStudentsToExcel = reportController.exportSubjectStudentsToExcel;
    window.openSendModal = notificationController.openSendModal;
    window.closeSendModal = notificationController.closeSendModal;
    window.logNotification = notificationController.logNotification;
    window.renderLogsTab = renderLogsTab;
    window.parseFrameworkWorkbook = analysisController.parseFrameworkWorkbook;
    
    // Planner functions
    window.openPlannerModal = plannerController.openPlannerModal;
    window.closePlannerModal = plannerController.closePlannerModal;
    window.switchPlannerTab = plannerController.switchPlannerTab;
    window.updatePlannerSemester = plannerController.updatePlannerSemester;
    window.printPlanner = plannerController.printPlanner;
    window.resetApp = analysisController.resetApp;

    // Attach listeners for file select
    const studentInput = document.getElementById('studentFileInput');
    const frameworkInput = document.getElementById('frameworkFileInput');
    
    studentInput.addEventListener('change', (e) => analysisController.handleFileSelect(e, 'student'));
    frameworkInput.addEventListener('change', (e) => analysisController.handleFileSelect(e, 'framework'));

    // Listen for Firebase auth state
    onAuthStateChanged(auth, (user) => {
        if (user) {
            firebaseUser = user;
            showCustomMessage(`Đã xác thực người dùng: ${user.email}`, 'success');
        } else {
            firebaseUser = null;
            showCustomMessage("Chưa đăng nhập! Đăng nhập ở trang chính để lưu nhật ký thông báo.", "info");
        }
    });

    // Render the initial upload screen view
    dashboardController.renderDashboard();
});


function openSubjectModal(encodedName) {
    openSubjectModalView(globalData, encodedName);
}

function closeSubjectModal() {
    closeSubjectModalView();
}

async function renderLogsTab() {
    const container = document.getElementById('logsContainer');
    container.innerHTML = `
        <div class="text-center py-10">
            <div class="w-8 h-8 border-4 border-brand-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p class="mt-3 text-sm text-slate-500 font-medium">Đang tải nhật ký từ Firebase...</p>
        </div>
    `;

    if (!firebaseUser) {
        container.innerHTML = `<div class="text-center py-10 text-rose-600 font-medium">Vui lòng đăng nhập để xem nhật ký.</div>`;
        return;
    }

    try {
        const q = query(collection(db, "communication_logs"), orderBy("sentAt", "desc"), limit(50));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            container.innerHTML = `
                <div class="text-center py-12 bg-white rounded-3xl border border-slate-100">
                    <i class="fa-solid fa-comment-slash text-4xl text-slate-300 mb-3"></i>
                    <p class="text-slate-500 font-medium">Chưa có nhật ký thông báo nào được ghi lại.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = renderLogsHtml(
            querySnapshot.docs.map(docSnap => docSnap.data())
        );
    } catch (error) {
        console.error("Error fetching logs:", error);
        container.innerHTML = `<div class="text-center py-10 text-rose-600 font-medium">Đã xảy ra lỗi khi tải nhật ký: ${error.message}</div>`;
    }
}
