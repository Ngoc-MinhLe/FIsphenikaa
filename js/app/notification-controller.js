import {
    openSendModalView,
    closeSendModalView
} from '../ui/notification-renderer.js';
import {
    selectNotificationTargets,
    buildNotificationLog
} from '../services/notification-service.js';

export function createNotificationController({
    globalData,
    getFirebaseUser,
    firestore,
    showCustomMessage
}) {
    const { collection, serverTimestamp, doc, getDoc, writeBatch } = firestore;

    function openSendModal(studentId = null, subjectName = null) {
        openSendModalView(
            { globalData, showCustomMessage },
            studentId,
            subjectName
        );
    }

    function closeSendModal() {
        closeSendModalView();
    }

    async function logNotification() {
        const firebaseUser = getFirebaseUser();
        if (!firebaseUser) {
            return showCustomMessage('Bạn cần đăng nhập để thực hiện hành động này.', 'error');
        }

        const modal = document.getElementById('sendNotificationModal');
        const mode = modal.dataset.mode;
        const studentId = modal.dataset.studentId;
        const subjectName = modal.dataset.subjectName;
        const subject = document.getElementById('sendModalSubject').value;
        const bodyTemplate = document.getElementById('sendModalBody').value;
        const type = document.querySelector('input[name="sendType"]:checked').value;
        const logsCollection = collection('communication_logs');

        const classFilter = mode === 'bulk_filter'
            ? document.getElementById('classFilterSelect').value
            : 'ALL';
        const targets = selectNotificationTargets({
            mode,
            studentId,
            subjectName,
            classFilter,
            students: globalData.students,
            subjectsMap: globalData.subjectsMap
        });

        if (targets.length === 0) {
            return showCustomMessage('Không có sinh viên nào phù hợp để gửi thông báo.', 'error');
        }

        showCustomMessage(`Đang tạo ${targets.length} log thông báo...`);

        let senderName = firebaseUser.email.split('@')[0];
        try {
            const userProfileSnap = await getDoc(doc('user_profiles', firebaseUser.uid));
            if (userProfileSnap.exists() && userProfileSnap.data().displayName) {
                senderName = userProfileSnap.data().displayName;
            }
        } catch (error) {
            console.error('Could not fetch sender profile:', error);
        }

        const maxBatchSize = 500;
        let batch = writeBatch();
        let operationCount = 0;

        try {
            for (let index = 0; index < targets.length; index++) {
                const student = targets[index];
                const newLogRef = doc(logsCollection);
                batch.set(newLogRef, buildNotificationLog({
                    student,
                    type,
                    subject,
                    bodyTemplate,
                    senderUid: firebaseUser.uid,
                    senderName,
                    sentAt: serverTimestamp()
                }));
                operationCount++;

                if (operationCount === maxBatchSize || index === targets.length - 1) {
                    await batch.commit();
                    batch = writeBatch();
                    operationCount = 0;
                }
            }
        } catch (error) {
            console.error('Error writing batch to Firebase:', error);
            showCustomMessage(`Lỗi khi lưu hàng loạt: ${error.message}`, 'error');
            return;
        }

        showCustomMessage(`Đã lưu thành công ${targets.length} log thông báo!`, 'success');
        closeSendModal();
    }

    return { openSendModal, closeSendModal, logNotification };
}
