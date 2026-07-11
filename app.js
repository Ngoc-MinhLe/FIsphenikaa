import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, updateDoc, setDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCET0_R6120tj389v5C62NhSLrBIk2CbIw",
    authDomain: "qlylaodong-dev.firebaseapp.com",
    projectId: "qlylaodong-dev",
    storageBucket: "qlylaodong-dev.firebasestorage.app",
    messagingSenderId: "789374516793",
    appId: "1:789374516793:web:29fb38ad0913f8b62e17e8",
    measurementId: "G-M2PJEBLMJF"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// -------------------------------------------------------------
// CẤU HÌNH PHÂN QUYỀN TRƯỞNG KHOA / QUẢN TRỊ VIÊN
// -------------------------------------------------------------
const ADMIN_EMAILS = [
    'binh.trinhthanh@phenikaa-uni.edu.vn',
    'minhln@dhhp.edu.vn',
];

let currentUser = null;
let isAdmin = false; 
let allSchedules = []; 
let userProfiles = {}; // Lưu trữ số điện thoại của Giảng viên
let currentWeekOffset = 0; 
let unsubscribeSchedules = null;
let unsubscribeProfiles = null;
let reportSummaryPage = 1;
let reportDetailPage = 1;
const REPORT_PAGE_SIZE = 10;
let lastReportSummaryRows = [];
let lastReportDetailRows = [];

const overlayLogin = document.getElementById('login-overlay');
const appContainer = document.getElementById('app-container');
const adminModuleCard = document.getElementById('admin-module-card'); 

// Lắng nghe đăng nhập
onAuthStateChanged(auth, (user) => {
    if (user) {
        const email = user.email.toLowerCase();
        if (email.endsWith('@phenikaa-uni.edu.vn') || email.endsWith('@dhhp.edu.vn') || email.endsWith('@gmail.com')) { 
            currentUser = user;
            
            isAdmin = ADMIN_EMAILS.includes(email);
            if (isAdmin) {
                adminModuleCard.classList.remove('hidden'); 
            } else {
                adminModuleCard.classList.add('hidden'); 
            }

            const emailPrefix = email.split('@')[0];
            currentUser.shortName = "T." + emailPrefix;

            // Nếu đã có tên trong profile thì hiển thị tên đó ngay
            // Lưu ý: userProfiles có thể chưa load kịp ở đây, sẽ cập nhật lại trong onSnapshot
            
            // Điền thông tin vào form cá nhân
            document.getElementById('my-display-name').value = currentUser.shortName;

            document.getElementById('user-name').textContent = currentUser.shortName;
            document.getElementById('user-email').textContent = email;
            
            if(user.photoURL) {
                document.getElementById('user-avatar').src = user.photoURL;
                document.getElementById('user-avatar').classList.remove('hidden');
                document.getElementById('user-avatar-default').classList.add('hidden');
            }

            document.getElementById('login-error').classList.add('hidden');
            overlayLogin.classList.add('hidden');
            appContainer.classList.remove('hidden');
            
            const date = new Date();
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

            document.getElementById('filter-start').value = startOfMonth;
            document.getElementById('filter-end').value = endOfMonth;
            
            document.getElementById('my-filter-start').value = startOfMonth;
            document.getElementById('my-filter-end').value = endOfMonth;

            // Giới hạn input-date không cho chọn ngày quá khứ (tối thiểu là hôm nay)
            const d = new Date();
            const todayStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            document.getElementById('input-date').setAttribute('min', todayStr);

            window.showView('dashboard');
            fetchAllData(); 
        } else {
            signOut(auth);
            document.getElementById('error-message').innerText = `Tài khoản không hợp lệ. Chỉ chấp nhận email trường.`;
            document.getElementById('login-error').classList.remove('hidden');
        }
    } else {
        currentUser = null;
        isAdmin = false;
        appContainer.classList.add('hidden');
        overlayLogin.classList.remove('hidden');
        adminModuleCard.classList.add('hidden');
        if(unsubscribeSchedules) unsubscribeSchedules();
        if(unsubscribeProfiles) unsubscribeProfiles();
    }
});

document.getElementById('btn-google-login').addEventListener('click', async () => {
    document.getElementById('login-text').innerText = "Đang kết nối...";
    try { await signInWithPopup(auth, provider); } catch (e) { console.error(e); }
    document.getElementById('login-text').innerText = "Đăng nhập với Google";
});

document.getElementById('btn-logout').addEventListener('click', () => {
    if(confirm('Đăng xuất?')) signOut(auth);
});

window.showView = function(viewId) {
    if (viewId === 'admin' && !isAdmin) {
        alert("Bạn không có quyền truy cập chức năng Trưởng Khoa!");
        return;
    }

    document.getElementById('view-dashboard').classList.add('hidden');
    document.getElementById('view-schedule').classList.add('hidden');
    document.getElementById('view-admin').classList.add('hidden');
    document.getElementById('view-' + viewId).classList.remove('hidden');
    
    if(viewId === 'schedule') {
        renderWeeklyGrid();
    }
};

// ==========================================
// DATA FETCHING (Schedules & User Profiles)
// ==========================================
function fetchAllData() {
    if (!currentUser) return;
    document.getElementById('loading-schedule').classList.remove('hidden');
    
    // Lắng nghe dữ liệu Số điện thoại
    unsubscribeProfiles = onSnapshot(collection(db, 'user_profiles'), (snapshot) => {
        userProfiles = {};
        snapshot.forEach(docSnap => {
            userProfiles[docSnap.id] = docSnap.data();
        });
        
        // Cập nhật lại tên hiển thị của user hiện tại nếu có trong DB
        const myProfile = userProfiles[currentUser.uid];
        if (myProfile) {
            if (myProfile.displayName) {
                currentUser.shortName = myProfile.displayName;
                document.getElementById('user-name').textContent = currentUser.shortName;
                document.getElementById('my-display-name').value = currentUser.shortName;
            }
            // Tự động điền số điện thoại nếu có
            if (myProfile.phone) document.getElementById('my-phone-number').value = myProfile.phone;
        }

        renderWeeklyGrid();
        
        // Cập nhật lại các thành phần khác nếu là Admin để đảm bảo tên hiển thị đồng bộ ngay lập tức
        if(isAdmin) {
            renderPhoneManagement();
            renderPendingApprovals();
            // Nếu bảng báo cáo đang mở, hãy render lại nó để cập nhật tên mới
            if(!document.getElementById('report-container').classList.contains('hidden')) {
                window.generateReport();
            }
        }
    });

    // Lắng nghe dữ liệu Lịch trực
    unsubscribeSchedules = onSnapshot(collection(db, 'schedules'), (snapshot) => {
        allSchedules = [];
        snapshot.forEach((docSnap) => {
            allSchedules.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        window.renderMyScheduleTable();
        renderWeeklyGrid();
        
        if (isAdmin) {
            renderPendingApprovals();
            populateLecturerDropdown();
            renderPhoneManagement();
        }
    });
}

// ==========================================
// 0. CHỨC NĂNG CẬP NHẬT THÔNG TIN CÁ NHÂN (USER)
// ==========================================
window.saveMyProfile = async function() {
    const newName = document.getElementById('my-display-name').value.trim();
    const newPhone = document.getElementById('my-phone-number').value.trim();
    if(!newName) return alert("Vui lòng nhập tên hiển thị!");

    try {
        await setDoc(doc(db, "user_profiles", currentUser.uid), { displayName: newName, phone: newPhone }, { merge: true });
        alert("Cập nhật thông tin thành công!");
    } catch(e) {
        alert("Lỗi: " + e.message);
    }
}

// ==========================================
// 1. CHỨC NĂNG LỊCH CÁ NHÂN & IN THỐNG KÊ
// ==========================================
window.renderMyScheduleTable = function() {
    document.getElementById('loading-schedule').classList.add('hidden');
    const tbody = document.getElementById('my-schedule-body');
    const emptyState = document.getElementById('empty-schedule');
    tbody.innerHTML = '';

    const startDate = document.getElementById('my-filter-start').value;
    const endDate = document.getElementById('my-filter-end').value;

    let mySchedules = allSchedules.filter(s => s.userId === currentUser.uid);

    if (startDate) mySchedules = mySchedules.filter(s => s.date >= startDate);
    if (endDate) mySchedules = mySchedules.filter(s => s.date <= endDate);

    mySchedules.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (mySchedules.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        mySchedules.forEach(item => {
            const dateStr = item.date.split('-').reverse().join('/');
            const statusClass = item.status === 'Đã duyệt' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
            const statusIcon = item.status === 'Đã duyệt' ? 'fa-check' : 'fa-clock';
            
            tbody.innerHTML += `
                <tr class="hover:bg-gray-50 border-b border-gray-100">
                    <td class="p-3 font-medium text-gray-800">${dateStr}</td>
                    <td class="p-3 text-phenikaa-blue font-semibold">${item.shift}</td>
                    <td class="p-3 text-gray-600 text-sm">${item.note}</td>
                    <td class="p-3">
                        <span class="${statusClass} text-xs font-bold px-2 py-1 rounded-full inline-flex items-center">
                            <i class="fas ${statusIcon} mr-1"></i> ${item.status}
                        </span>
                    </td>
                    <td class="p-3 text-center">
                        <button onclick="window.deleteSchedule('${item.id}', '${item.userId}')" class="text-red-400 hover:text-red-600 p-1" title="Xóa lịch">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    }
};

// Hàm in báo cáo thống kê cá nhân
window.printMySchedule = function() {
    const startDate = document.getElementById('my-filter-start').value;
    const endDate = document.getElementById('my-filter-end').value;

    // Chỉ lấy các ca của người này và đã được duyệt để in
    let mySchedules = allSchedules.filter(s => s.userId === currentUser.uid && s.status === 'Đã duyệt');

    if (startDate) mySchedules = mySchedules.filter(s => s.date >= startDate);
    if (endDate) mySchedules = mySchedules.filter(s => s.date <= endDate);

    mySchedules.sort((a, b) => new Date(a.date) - new Date(b.date));

    if(mySchedules.length === 0) {
        alert("Không có lịch trực nào (Đã duyệt) trong khoảng thời gian này để in.");
        return;
    }

    const printTbody = document.getElementById('print-table-body');
    printTbody.innerHTML = '';
    let totalHours = 0;

    mySchedules.forEach((item, idx) => {
        const dateStr = item.date.split('-').reverse().join('/');
        const hours = 4;
        totalHours += hours;
        
        printTbody.innerHTML += `
            <tr>
                <td>${idx + 1}</td>
                <td style="text-align: left;">Ngày ${dateStr} - Ca ${item.shift}</td>
                <td>1</td>
                <td>${hours}</td>
                <td>${item.note || ''}</td>
            </tr>
        `;
    });
    
    // Hàng tính tổng
    printTbody.innerHTML += `
        <tr style="font-weight: bold; background-color: #f9fafb;">
            <td colspan="2" style="text-align: right;">Tổng cộng:</td>
            <td>${mySchedules.length}</td>
            <td>${totalHours}</td>
            <td></td>
        </tr>
    `;

    // Thay đổi Tiêu đề và Cột cho phù hợp bản in cá nhân
    document.getElementById('print-col-2-title').innerText = "chi tiết ca trực";
    document.getElementById('print-title-text').innerText = "Thống kê lịch trực cá nhân";
    
    const sStr = startDate ? startDate.split('-').reverse().join('/') : '...';
    const eStr = endDate ? endDate.split('-').reverse().join('/') : '...';
    document.getElementById('print-date-range').innerHTML = `Từ ngày: ${sStr} - Đến ngày: ${eStr}<br><span style="font-size: 15px;">(Giảng viên: ${currentUser.shortName})</span>`;
    
    // Thiết lập vùng chữ ký cho bản in cá nhân
    const signatureArea = document.getElementById('print-signature-area');
    const today = new Date();
    signatureArea.innerHTML = `
        <p style="text-align: right; padding-right: 50px;">Hà Nội, Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}</p>
        <div style="display: flex; justify-content: space-between; margin-top: 20px; padding: 0 50px;">
            <div style="text-align: center;">
                <p style="font-weight: bold; margin-bottom: 60px;">NGƯỜI LẬP BẢNG</p>
                <p style="font-weight: bold;">${currentUser.shortName}</p>
            </div>
            <div style="text-align: center;">
                <p style="font-weight: bold; margin-bottom: 60px;">TRƯỞNG KHOA</p>
                <p style="font-weight: bold;">TRỊNH THANH BÌNH</p>
            </div>
        </div>
    `;

    window.print();
}

// Hàm xuất Excel cá nhân (Mới)
window.exportMyScheduleToExcel = function() {
    const startDate = document.getElementById('my-filter-start').value;
    const endDate = document.getElementById('my-filter-end').value;

    let mySchedules = allSchedules.filter(s => s.userId === currentUser.uid);
    if (startDate) mySchedules = mySchedules.filter(s => s.date >= startDate);
    if (endDate) mySchedules = mySchedules.filter(s => s.date <= endDate);
    mySchedules.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (mySchedules.length === 0) return alert("Không có dữ liệu để xuất Excel!");

    // --- ĐỊNH DẠNG STYLE ---
    const titleStyle = { font: { bold: true, sz: 14, color: { rgb: "00205B" } }, alignment: { horizontal: "center" } };
    const headerStyle = { 
        font: { bold: true, color: { rgb: "FFFFFF" } }, 
        fill: { fgColor: { rgb: "00205B" } }, 
        alignment: { horizontal: "center", vertical: "center" }, 
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } 
    };
    const cellStyle = { border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
    const centerStyle = { ...cellStyle, alignment: { horizontal: "center" } };

    // --- CHUẨN BỊ DỮ LIỆU ---
    const sStr = startDate ? startDate.split('-').reverse().join('/') : '...';
    const eStr = endDate ? endDate.split('-').reverse().join('/') : '...';
    
    const data = [
        [{ v: "TRƯỜNG ĐẠI HỌC PHENIKAA", s: { font: { bold: true }, alignment: { horizontal: "center" } } }],
        [{ v: "KHOA CÔNG NGHỆ THÔNG TIN", s: { font: { bold: true }, alignment: { horizontal: "center" } } }],
        [],
        [{ v: "LỊCH TRỰC CÁ NHÂN", s: titleStyle }],
        [{ v: `Giảng viên: ${currentUser.shortName}`, s: { font: { bold: true }, alignment: { horizontal: "center" } } }],
        [{ v: `Từ ngày: ${sStr} - Đến ngày: ${eStr}`, s: { font: { italic: true }, alignment: { horizontal: "center" } } }],
        [],
        [
            { v: "STT", s: headerStyle },
            { v: "Ngày trực", s: headerStyle },
            { v: "Ca trực", s: headerStyle },
            { v: "Giờ quy đổi", s: headerStyle },
            { v: "Ghi chú", s: headerStyle },
            { v: "Trạng thái", s: headerStyle }
        ]
    ];

    let totalHours = 0;
    mySchedules.forEach((item, idx) => {
        const dateStr = item.date.split('-').reverse().join('/');
        const hours = 4;
        totalHours += hours;
        data.push([
            { v: idx + 1, t: 'n', s: centerStyle },
            { v: dateStr, t: 's', s: centerStyle },
            { v: item.shift, t: 's', s: centerStyle },
            { v: hours, t: 'n', s: centerStyle },
            { v: item.note || "", t: 's', s: cellStyle },
            { v: item.status, t: 's', s: centerStyle }
        ]);
    });

    // --- DÒNG TỔNG CỘNG ---
    const totalStyle = { font: { bold: true }, alignment: { horizontal: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
    data.push([
        { v: "Tổng cộng", s: totalStyle },
        { v: "", s: totalStyle },
        { v: "", s: totalStyle },
        { v: totalHours, t: 'n', s: totalStyle },
        { v: "", s: totalStyle },
        { v: "", s: totalStyle }
    ]);

    // --- PHẦN CHỮ KÝ ---
    const today = new Date();
    data.push([]); // Dòng trống
    data.push([]); // Dòng trống

    // Ngày tháng (Căn phải)
    data.push([
        { v: "", s: {} }, { v: "", s: {} }, { v: "", s: {} }, { v: "", s: {} },
        { v: `Hà Nội, Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`, s: { font: { italic: true }, alignment: { horizontal: "center" } } },
        { v: "", s: {} }
    ]);

    // Chức danh
    data.push([
        { v: "NGƯỜI LẬP BẢNG", s: { font: { bold: true }, alignment: { horizontal: "center" } } },
        { v: "", s: {} }, { v: "", s: {} }, { v: "", s: {} },
        { v: "TRƯỞNG KHOA", s: { font: { bold: true }, alignment: { horizontal: "center" } } },
        { v: "", s: {} }
    ]);

    // Khoảng trống ký tên
    data.push([]); data.push([]); data.push([]);

    // Tên người ký
    data.push([
        { v: currentUser.shortName, s: { font: { bold: true }, alignment: { horizontal: "center" } } },
        { v: "", s: {} }, { v: "", s: {} }, { v: "", s: {} },
        { v: "TRỊNH THANH BÌNH", s: { font: { bold: true }, alignment: { horizontal: "center" } } },
        { v: "", s: {} }
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Gộp ô (Merge)
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Trường
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Khoa
        { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } }, // Tiêu đề
        { s: { r: 4, c: 0 }, e: { r: 4, c: 5 } }, // Tên GV
        { s: { r: 5, c: 0 }, e: { r: 5, c: 5 } }, // Ngày tháng (Header)
        
        // Merge dòng Tổng cộng (3 ô đầu)
        { s: { r: data.length - 9, c: 0 }, e: { r: data.length - 9, c: 2 } },

        // Merge Chữ ký (Ngày tháng)
        { s: { r: data.length - 6, c: 4 }, e: { r: data.length - 6, c: 5 } },
        // Merge Chữ ký (Người lập bảng)
        { s: { r: data.length - 5, c: 0 }, e: { r: data.length - 5, c: 1 } },
        // Merge Chữ ký (Trưởng khoa)
        { s: { r: data.length - 5, c: 4 }, e: { r: data.length - 5, c: 5 } },
        // Merge Tên (Người lập bảng)
        { s: { r: data.length - 1, c: 0 }, e: { r: data.length - 1, c: 1 } },
        // Merge Tên (Trưởng khoa)
        { s: { r: data.length - 1, c: 4 }, e: { r: data.length - 1, c: 5 } }
    ];
    
    // Độ rộng cột
    ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 30 }, { wch: 15 }];

    XLSX.utils.book_append_sheet(wb, ws, "LichCaNhan");
    XLSX.writeFile(wb, `Lich_Ca_Nhan_${currentUser.shortName}.xlsx`);
}

document.getElementById('form-schedule').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-schedule');
    const date = document.getElementById('input-date').value;
    const shiftInput = document.getElementById('input-shift').value;
    const note = document.getElementById('input-note').value;

    // Xác định danh sách ca cần đăng ký dựa vào lựa chọn của người dùng
    const shiftsToRegister = shiftInput === 'Cả ngày' ? ['Sáng', 'Chiều'] : [shiftInput];

    // Kiểm tra trùng lịch cho TẤT CẢ các ca sắp đăng ký
    for (const s of shiftsToRegister) {
        if (allSchedules.some(sch => sch.userId === currentUser.uid && sch.date === date && sch.shift === s)) {
            alert(`Bạn đã đăng ký ca ${s} trong ngày ${date.split('-').reverse().join('/')} rồi!`); 
            return;
        }
    }

    btn.disabled = true; btn.innerHTML = 'Đang lưu...';
    try {
        // Tạo từng bản ghi riêng biệt cho từng ca để dễ duyệt/thống kê/hiển thị lưới
        for (const s of shiftsToRegister) {
            await addDoc(collection(db, "schedules"), {
                userId: currentUser.uid,
                userName: currentUser.shortName,
                shortName: currentUser.shortName,
                date: date,
                shift: s,
                note: note,
                status: 'Chờ duyệt',
                createdAt: Date.now()
            });
        }
        
        document.getElementById('form-schedule').reset();
        alert('Đăng ký lịch thành công!');
    } catch (e) { 
        alert("Lỗi: " + e.message); 
    } finally { 
        btn.disabled = false; btn.innerHTML = 'Đăng ký ngay'; 
    }
});

// Hàm xóa lịch dung chung (Bảo mật: Admin có thể xóa bất kỳ lịch nào, User chỉ xóa lịch của mình)
window.deleteSchedule = async function(docId, scheduleUserId) {
    if(confirm('Hủy/Xóa ca trực này khỏi hệ thống?')) {
        // Rào bảo mật ở client
        if(!isAdmin && scheduleUserId !== currentUser.uid) {
            alert("Bạn không có quyền xóa lịch của người khác!");
            return;
        }
        await deleteDoc(doc(db, "schedules", docId));
    }
};

// ==========================================
// 2. CHỨC NĂNG LỊCH TUẦN KHOA (Hiển thị Lưới)
// ==========================================
window.changeWeek = function(offset) {
    currentWeekOffset += offset;
    renderWeeklyGrid();
}

function renderWeeklyGrid() {
    const today = new Date();
    const currentDayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); 
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDayOfWeek + 1 + (currentWeekOffset * 7));
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const sStr = `${startOfWeek.getDate()}/${startOfWeek.getMonth()+1}`;
    const eStr = `${endOfWeek.getDate()}/${endOfWeek.getMonth()+1}/${endOfWeek.getFullYear()}`;
    document.getElementById('week-label').innerText = `Tuần ${sStr} - ${eStr}`;

    const weekDates = [];
    const daysMap = ['t2', 't3', 't4', 't5', 't6', 't7', 'cn'];
    
    for(let i=0; i<7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const isoDate = d.toISOString().split('T')[0];
        weekDates.push(isoDate);
        document.getElementById(`date-${daysMap[i]}`).innerText = `${d.getDate()}/${d.getMonth()+1}`;
    }

    const weekData = allSchedules.filter(s => weekDates.includes(s.date));
    let gridHtml = '';
    const shifts = ['Sáng', 'Chiều'];

    shifts.forEach(shift => {
        gridHtml += `<tr class="border-b border-gray-200 hover:bg-gray-50">
                        <td class="p-2 font-bold text-phenikaa-blue border-r bg-gray-50">${shift}</td>`;
        
        weekDates.forEach(date => {
            const people = weekData.filter(s => s.date === date && s.shift === shift);
            let cellContent = '';
            if(people.length > 0) {
                cellContent = people.map(p => {
                    const color = p.status === 'Đã duyệt' ? 'text-green-700 font-bold' : 'text-gray-600';
                    
                    // SỬA LỖI: Ưu tiên lấy tên từ userProfiles (tên mới cập nhật)
                    const displayName = userProfiles[p.userId]?.displayName || p.shortName || p.userName;
                    const phone = userProfiles[p.userId]?.phone;
                    const phoneStr = phone ? `<br><span class="text-xs text-gray-500 font-normal">(${phone})</span>` : '';
                    
                    // Nút xóa (chỉ hiện với Admin) - class no-print để không bị in ra giấy
                    const deleteBtn = isAdmin ? `<i class="fas fa-times-circle text-red-400 hover:text-red-600 cursor-pointer ml-1 no-print" onclick="window.deleteSchedule('${p.id}', '${p.userId}')" title="Xóa lịch này"></i>` : '';

                    return `<div class="${color} mb-2 p-1 relative">${displayName} ${deleteBtn} ${phoneStr}</div>`;
                }).join('');
            }
            gridHtml += `<td class="p-2 border-r min-h-[60px] align-top">${cellContent}</td>`;
        });
        gridHtml += `</tr>`;
    });

    document.getElementById('weekly-grid-body').innerHTML = gridHtml;
}

// ==========================================
// 3. CHỨC NĂNG TRƯỞNG KHOA (Duyệt, Thống Kê & SĐT)
// ==========================================

// Quản lý số điện thoại
function renderPhoneManagement() {
    const tbody = document.getElementById('phone-list-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    const uniqueUsers = {};
    allSchedules.forEach(s => {
        if (!uniqueUsers[s.userId]) {
            // Lấy tên hiển thị ưu tiên từ Profile, nếu không có thì lấy từ Schedule
            uniqueUsers[s.userId] = userProfiles[s.userId]?.displayName || s.shortName || s.userName;
        }
    });

    for (const [id, name] of Object.entries(uniqueUsers)) {
        const phone = userProfiles[id]?.phone || '';
        const displayName = userProfiles[id]?.displayName || name; // Tên hiện tại trong DB hoặc tên cũ
        tbody.innerHTML += `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="p-2"><input type="text" id="name-${id}" value="${displayName}" class="border border-gray-300 px-3 py-1.5 rounded-lg w-full outline-none focus:border-phenikaa-blue focus:ring-1 transition"></td>
                <td class="p-2">
                    <input type="text" id="phone-${id}" value="${phone}" placeholder="Nhập số ĐT..." class="border border-gray-300 px-3 py-1.5 rounded-lg w-full outline-none focus:border-phenikaa-blue focus:ring-1 focus:ring-phenikaa-blue transition">
                </td>
                <td class="p-2 text-center">
                    <button id="btn-save-phone-${id}" onclick="window.saveUserInfo('${id}')" class="bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white px-4 py-1.5 rounded shadow-sm transition text-sm font-semibold">
                        <i class="fas fa-save mr-1"></i> Lưu
                    </button>
                </td>
            </tr>
        `;
    }
    if(Object.keys(uniqueUsers).length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center p-4 text-gray-500">Chưa có Giảng viên nào đăng ký lịch để hiển thị danh bạ.</td></tr>`;
    }
}

window.saveUserInfo = async function(userId) {
    if(!isAdmin) return;
    const phoneVal = document.getElementById(`phone-${userId}`).value.trim();
    const nameVal = document.getElementById(`name-${userId}`).value.trim();
    const btn = document.getElementById(`btn-save-phone-${userId}`);
    const originalHtml = btn.innerHTML;
    
    try {
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>...`;
        btn.disabled = true;

        // SetDoc (merge) cho phép tạo mới document nếu chưa có, hoặc cập nhật field nếu đã tồn tại
        await setDoc(doc(db, "user_profiles", userId), { phone: phoneVal, displayName: nameVal }, { merge: true });
        
        // Hiệu ứng nút tạm thời
        btn.innerHTML = `<i class="fas fa-check"></i> Xong`;
        btn.classList.add('bg-green-600', 'text-white');
        btn.classList.remove('bg-blue-100', 'text-blue-700');
        
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('bg-green-600', 'text-white');
            btn.classList.add('bg-blue-100', 'text-blue-700');
            btn.disabled = false;
        }, 1500);
    } catch(e) {
        alert("Lỗi lưu thông tin: " + e.message);
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

function populateLecturerDropdown() {
    const select = document.getElementById('filter-lecturer');
    const currentValue = select.value; 
    select.innerHTML = '<option value="all">-- Tất cả Giảng viên --</option>';

    const uniqueUsers = {};
    allSchedules.forEach(s => {
        if (!uniqueUsers[s.userId]) {
            uniqueUsers[s.userId] = userProfiles[s.userId]?.displayName || s.shortName || s.userName;
        }
    });

    for (const [id, name] of Object.entries(uniqueUsers)) {
        select.innerHTML += `<option value="${id}">${name}</option>`;
    }
    
    if (uniqueUsers[currentValue] || currentValue === 'all') {
        select.value = currentValue;
    }
}

function renderPendingApprovals() {
    const pendingList = document.getElementById('pending-list');
    const emptyPending = document.getElementById('empty-pending');
    const pendings = allSchedules.filter(s => s.status === 'Chờ duyệt');
    
    pendingList.innerHTML = '';
    if(pendings.length === 0) {
        emptyPending.classList.remove('hidden');
    } else {
        emptyPending.classList.add('hidden');
        pendings.forEach(item => {
            const dateStr = item.date.split('-').reverse().join('/');
            const displayName = userProfiles[item.userId]?.displayName || item.shortName || item.userName;
            pendingList.innerHTML += `
                <li class="py-3 flex justify-between items-center group border-b border-gray-50 last:border-0">
                    <div>
                        <div class="font-bold text-gray-800">${displayName}</div>
                        <div class="text-sm text-gray-500">Ca ${item.shift} - Ngày ${dateStr}</div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.approveSchedule('${item.id}')" class="bg-green-100 text-green-700 hover:bg-green-600 hover:text-white px-3 py-1.5 rounded shadow-sm transition text-sm font-medium">
                            <i class="fas fa-check"></i> Duyệt
                        </button>
                        <button onclick="window.deleteSchedule('${item.id}', '${item.userId}')" class="bg-red-100 text-red-700 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded shadow-sm transition text-sm font-medium" title="Từ chối (Xóa)">
                            <i class="fas fa-times"></i> Xóa
                        </button>
                    </div>
                </li>
            `;
        });
    }
}

function renderPagination(containerId, totalItems, currentPage, pageSize, pageKey) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (totalItems <= pageSize) {
        container.innerHTML = '';
        return;
    }

    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    container.innerHTML = `
        <div class="flex flex-col sm:flex-row justify-between items-center gap-2 text-sm text-gray-600">
            <div>Hiển thị ${startItem}-${endItem} trên ${totalItems} dòng</div>
            <div class="flex items-center gap-2">
                <button onclick="window.changeReportPage('${pageKey}', -1)" class="px-3 py-1 rounded border ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-100'}" ${currentPage === 1 ? 'disabled' : ''}>Trước</button>
                <span class="px-2 py-1 rounded bg-blue-50 text-blue-700 font-semibold">${currentPage}/${totalPages}</span>
                <button onclick="window.changeReportPage('${pageKey}', 1)" class="px-3 py-1 rounded border ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-100'}" ${currentPage === totalPages ? 'disabled' : ''}>Sau</button>
            </div>
        </div>
    `;
}

function renderReportTables() {
    const tbody = document.getElementById('report-table-body');
    const detailBody = document.getElementById('report-detail-body');
    const detailContainer = document.getElementById('report-detail-container');

    tbody.innerHTML = '';
    detailBody.innerHTML = '';

    if (lastReportSummaryRows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-gray-500">Không có dữ liệu trong khoảng thời gian/tiêu chí này.</td></tr>';
        detailContainer.classList.add('hidden');
        renderPagination('report-summary-pagination', 0, 1, REPORT_PAGE_SIZE, 'summary');
        renderPagination('report-detail-pagination', 0, 1, REPORT_PAGE_SIZE, 'detail');
        return;
    }

    const summaryPageRows = lastReportSummaryRows.slice((reportSummaryPage - 1) * REPORT_PAGE_SIZE, reportSummaryPage * REPORT_PAGE_SIZE);
    const detailPageRows = lastReportDetailRows.slice((reportDetailPage - 1) * REPORT_PAGE_SIZE, reportDetailPage * REPORT_PAGE_SIZE);

    summaryPageRows.forEach((row, idx) => {
        const hours = row.count * 4;
        tbody.innerHTML += `
            <tr class="border-b">
                <td class="p-2 text-center">${(reportSummaryPage - 1) * REPORT_PAGE_SIZE + idx + 1}</td>
                <td class="p-2 font-semibold text-gray-800">${row.name}</td>
                <td class="p-2 text-center text-blue-600 font-bold">${row.count}</td>
                <td class="p-2 text-center text-phenikaa-orange font-bold">${hours}</td>
            </tr>
        `;
    });

    if (detailPageRows.length > 0) {
        detailPageRows.forEach((row) => {
            detailBody.innerHTML += `
                <tr class="border-b">
                    <td class="p-2 text-center">${row.index}</td>
                    <td class="p-2 font-semibold text-gray-800">${row.name}</td>
                    <td class="p-2 text-gray-700">${row.date}</td>
                    <td class="p-2 text-center text-blue-600 font-semibold">${row.shift}</td>
                    <td class="p-2 text-sm text-gray-600">${row.note || '-'}</td>
                </tr>
            `;
        });
        detailContainer.classList.remove('hidden');
    } else {
        detailContainer.classList.add('hidden');
    }

    renderPagination('report-summary-pagination', lastReportSummaryRows.length, reportSummaryPage, REPORT_PAGE_SIZE, 'summary');
    renderPagination('report-detail-pagination', lastReportDetailRows.length, reportDetailPage, REPORT_PAGE_SIZE, 'detail');
}

window.changeReportPage = function(pageKey, delta) {
    if (pageKey === 'summary') {
        const totalPages = Math.max(1, Math.ceil(lastReportSummaryRows.length / REPORT_PAGE_SIZE));
        reportSummaryPage = Math.min(totalPages, Math.max(1, reportSummaryPage + delta));
    } else if (pageKey === 'detail') {
        const totalPages = Math.max(1, Math.ceil(lastReportDetailRows.length / REPORT_PAGE_SIZE));
        reportDetailPage = Math.min(totalPages, Math.max(1, reportDetailPage + delta));
    }
    renderReportTables();
}

window.approveSchedule = async function(docId) {
    if (!isAdmin) {
        alert("Lỗi: Chỉ Trưởng khoa mới có quyền duyệt lịch trực!");
        return;
    }
    try {
        await updateDoc(doc(db, "schedules", docId), { status: 'Đã duyệt' });
    } catch(e) { alert("Lỗi duyệt: " + e.message); }
}

// 3.2. Bảng Thống Kê Giờ (Dành cho Admin)
window.generateReport = function() {
    const start = document.getElementById('filter-start').value;
    const end = document.getElementById('filter-end').value;
    const lecturerId = document.getElementById('filter-lecturer').value;
    const statusFilter = document.getElementById('filter-status').value;
    const printMode = document.getElementById('report-print-mode').value;
    
    if(!start || !end) { alert('Vui lòng chọn Từ ngày và Đến ngày'); return; }

    const validData = allSchedules.filter(s => {
        let isValid = (s.date >= start && s.date <= end);

        if (statusFilter === 'approved') {
            isValid = isValid && (s.status === 'Đã duyệt');
        } else if (statusFilter === 'pending') {
            isValid = isValid && (s.status === 'Chờ duyệt');
        }

        if (lecturerId !== 'all') {
            isValid = isValid && (s.userId === lecturerId);
        }
        return isValid;
    });

    const reportMap = {};
    validData.forEach(item => {
        const displayName = userProfiles[item.userId]?.displayName || item.shortName || item.userName;
        if(!reportMap[item.userId]) {
            reportMap[item.userId] = { name: displayName, count: 0, sessions: [] };
        }
        reportMap[item.userId].count += 1;
        reportMap[item.userId].sessions.push(item);
    });

    const reportArray = Object.values(reportMap);
    reportArray.forEach(row => {
        row.sessions.sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    lastReportSummaryRows = reportArray.map((row) => ({
        name: row.name,
        count: row.count,
        hours: row.count * 4
    }));

    lastReportDetailRows = [];
    reportArray.forEach((row, idx) => {
        row.sessions.forEach((item, sessionIdx) => {
            lastReportDetailRows.push({
                index: `${idx + 1}.${sessionIdx + 1}`,
                name: row.name,
                date: item.date.split('-').reverse().join('/'),
                shift: item.shift,
                note: item.note || '-'
            });
        });
    });

    reportSummaryPage = 1;
    reportDetailPage = 1;

    const printTbody = document.getElementById('print-table-body');
    printTbody.innerHTML = '';

    const printTitle = (printMode === 'detail-person' || printMode === 'detail-all')
        ? 'Chi tiết lịch trực Khoa - Khoa HTT'
        : 'Tổng hợp lịch trực Khoa - Khoa HTT';
    document.getElementById('print-title-text').innerText = printTitle;

    if(reportArray.length === 0) {
        printTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 8px;">Không có dữ liệu.</td></tr>';
    } else {
        reportArray.forEach((row, idx) => {
            const hours = row.count * 4;

            if (printMode === 'detail-person' || printMode === 'detail-all') {
                printTbody.innerHTML += `
                    <tr>
                        <td>${idx + 1}</td>
                        <td style="text-align: left;">${row.name}</td>
                        <td>${row.count}</td>
                        <td>${hours}</td>
                        <td>${row.sessions.map(s => `${s.date.split('-').reverse().join('/')} (${s.shift})`).join(' | ')}</td>
                    </tr>
                `;
            } else {
                printTbody.innerHTML += `
                    <tr>
                        <td>${idx + 1}</td>
                        <td style="text-align: left;">${row.name}</td>
                        <td>${row.count}</td>
                        <td>${hours}</td>
                        <td></td>
                    </tr>
                `;
            }
        });
    }

    renderReportTables();
    document.getElementById('report-container').classList.remove('hidden');
    
    // Thiết lập tiêu đề và chữ ký cho Bản in của Admin
    document.getElementById('print-col-2-title').innerText = (printMode === 'detail-person' || printMode === 'detail-all') ? 'chi tiết' : 'họ tên';
    
    const sStr = start.split('-').reverse().join('/');
    const eStr = end.split('-').reverse().join('/');
    
    let printHeaderExt = "";
    if(lecturerId !== 'all') {
        const lecturerName = document.querySelector(`#filter-lecturer option[value="${lecturerId}"]`).text;
        printHeaderExt = `<br><span style="font-size: 15px;">(Thống kê riêng cho: ${lecturerName})</span>`;
    }

    document.getElementById('print-date-range').innerHTML = `Từ ngày: ${sStr} - Đến ngày: ${eStr}${printHeaderExt}`;
    
    const signatureArea = document.getElementById('print-signature-area');
    const today = new Date();
    signatureArea.innerHTML = `
        <p style="text-align: right; padding-right: 50px;">Hà Nội, Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}</p>
        <div style="text-align: right; padding-right: 50px; margin-top: 20px;">
            <p style="font-weight: bold; margin-bottom: 60px;">TRƯỞNG KHOA</p>
            <p style="font-weight: bold;">TRỊNH THANH BÌNH</p>
        </div>
    `;
}

window.printReport = function() {
    window.generateReport();
    window.print();
}

// 3.3. Xuất Excel (Mới)
window.exportReportToExcel = function() {
    const start = document.getElementById('filter-start').value;
    const end = document.getElementById('filter-end').value;
    const lecturerId = document.getElementById('filter-lecturer').value;
    
    const statusFilter = document.getElementById('filter-status').value;
    const validData = allSchedules.filter(s => {
        let isValid = (s.date >= start && s.date <= end);
        if (statusFilter === 'approved') {
            isValid = isValid && (s.status === 'Đã duyệt');
        } else if (statusFilter === 'pending') {
            isValid = isValid && (s.status === 'Chờ duyệt');
        }
        if (lecturerId !== 'all') isValid = isValid && (s.userId === lecturerId);
        return isValid;
    });

    if(validData.length === 0) return alert("Không có dữ liệu để xuất Excel!");

    const reportMap = {};
    validData.forEach(item => {
        if(!reportMap[item.userId]) {
            const displayName = userProfiles[item.userId]?.displayName || item.shortName || item.userName;
            reportMap[item.userId] = { name: displayName, count: 0 };
        }
        reportMap[item.userId].count += 1; 
    });

    // --- ĐỊNH DẠNG STYLE ---
    const titleStyle = { font: { bold: true, sz: 14, color: { rgb: "00205B" } }, alignment: { horizontal: "center" } };
    const headerStyle = { 
        font: { bold: true, color: { rgb: "FFFFFF" } }, 
        fill: { fgColor: { rgb: "00205B" } }, 
        alignment: { horizontal: "center", vertical: "center" }, 
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } 
    };
    const cellStyle = { border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
    const centerStyle = { ...cellStyle, alignment: { horizontal: "center" } };

    // --- CHUẨN BỊ DỮ LIỆU ---
    const sStr = start.split('-').reverse().join('/');
    const eStr = end.split('-').reverse().join('/');
    let reportTitle = "TỔNG HỢP LỊCH TRỰC KHOA - KHOA HTT";
    let dateRangeText = `Từ ngày: ${sStr} - Đến ngày: ${eStr}`;
    if (lecturerId !== 'all') {
        const lecturerName = document.querySelector(`#filter-lecturer option[value="${lecturerId}"]`).text;
        dateRangeText += ` (Thống kê riêng cho: ${lecturerName})`;
    }

    const data = [
        [{ v: "TRƯỜNG ĐẠI HỌC PHENIKAA", s: { font: { bold: true }, alignment: { horizontal: "center" } } }],
        [{ v: "KHOA CÔNG NGHỆ THÔNG TIN", s: { font: { bold: true }, alignment: { horizontal: "center" } } }],
        [],
        [{ v: reportTitle, s: titleStyle }],
        [{ v: dateRangeText, s: { font: { italic: true }, alignment: { horizontal: "center" } } }],
        [],
        [
            { v: "STT", s: headerStyle }, 
            { v: "Họ và Tên", s: headerStyle },
            { v: "Số buổi trực", s: headerStyle }, 
            { v: "Giờ quy đổi", s: headerStyle }
        ]
    ];

    let totalShifts = 0;
    let totalHours = 0;

    Object.values(reportMap).forEach((row, idx) => {
        const hours = row.count * 4;
        totalShifts += row.count;
        totalHours += hours;
        data.push([
            { v: idx + 1, t: 'n', s: centerStyle },
            { v: row.name, t: 's', s: cellStyle },
            { v: row.count, t: 'n', s: centerStyle },
            { v: hours, t: 'n', s: centerStyle }
        ]);
    });

    // --- DÒNG TỔNG CỘNG ---
    const totalStyle = { font: { bold: true }, alignment: { horizontal: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
    data.push([
        { v: "Tổng cộng", s: totalStyle },
        { v: "", s: totalStyle },
        { v: totalShifts, t: 'n', s: totalStyle },
        { v: totalHours, t: 'n', s: totalStyle }
    ]);

    // --- PHẦN CHỮ KÝ ---
    const today = new Date();
    data.push([]); // Dòng trống
    data.push([]); // Dòng trống

    // Ngày tháng
    data.push([
        { v: "", s: {} }, { v: "", s: {} },
        { v: `Hà Nội, Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`, s: { font: { italic: true }, alignment: { horizontal: "center" } } },
        { v: "", s: {} }
    ]);

    // Chức danh
    data.push([
        { v: "", s: {} }, { v: "", s: {} },
        { v: "TRƯỞNG KHOA", s: { font: { bold: true }, alignment: { horizontal: "center" } } },
        { v: "", s: {} }
    ]);

    // Khoảng trống ký tên
    data.push([]); data.push([]); data.push([]);

    // Tên Trưởng khoa
    data.push([
        { v: "", s: {} }, { v: "", s: {} },
        { v: "TRỊNH THANH BÌNH", s: { font: { bold: true }, alignment: { horizontal: "center" } } },
        { v: "", s: {} }
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Gộp ô
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, 
        { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } }, 
        { s: { r: 4, c: 0 }, e: { r: 4, c: 3 } },
        
        // Merge dòng Tổng cộng (2 ô đầu)
        { s: { r: data.length - 9, c: 0 }, e: { r: data.length - 9, c: 1 } },

        // Merge Chữ ký (Ngày tháng)
        { s: { r: data.length - 6, c: 2 }, e: { r: data.length - 6, c: 3 } },
        // Merge Chữ ký (Trưởng khoa)
        { s: { r: data.length - 5, c: 2 }, e: { r: data.length - 5, c: 3 } },
        // Merge Tên (Trưởng khoa)
        { s: { r: data.length - 1, c: 2 }, e: { r: data.length - 1, c: 3 } }
    ];
    
    // Độ rộng cột
    ws['!cols'] = [{wch: 5}, {wch: 30}, {wch: 15}, {wch: 15}];

    XLSX.utils.book_append_sheet(wb, ws, "ThongKe");
    const fileName = `Thong_Ke_Lich_Truc_${start}_den_${end}.xlsx`;
    XLSX.writeFile(wb, fileName);
}