# Tài liệu chức năng – Module Thống kê nợ môn

## 1. Mục đích

Module **Thống kê nợ môn** dùng để đọc bảng điểm Excel, xác định tình trạng học tập của sinh viên và hỗ trợ:

- Biết sinh viên nào đang nợ môn nào.
- Biết mỗi môn có bao nhiêu sinh viên cần học lại hoặc thi lại.
- Đối chiếu bảng điểm với khung chương trình đào tạo.
- Lập danh sách nhu cầu mở lớp.
- Xuất danh sách sinh viên theo từng môn để phục vụ tổ chức lớp.
- Theo dõi tiến độ hoàn thành chương trình và hỗ trợ lập kế hoạch tốt nghiệp.

Module hiện tại chạy trên trình duyệt, dữ liệu được đọc trực tiếp từ các file Excel người dùng tải lên.

## 2. Dữ liệu đầu vào

### 2.1. File bảng điểm

File bảng điểm chứa thông tin sinh viên, lớp, môn học, điểm và lịch sử kết quả học tập. Module sử dụng dữ liệu này để:

- Nhận diện sinh viên.
- Nhận diện môn học.
- Xác định kết quả đạt hoặc chưa đạt.
- Tính số lượt nợ môn.
- Gom danh sách sinh viên nợ theo từng môn.

Có thể tải bảng điểm tổng hợp hoặc bảng điểm chi tiết tùy theo định dạng dữ liệu thực tế.

### 2.2. File khung chương trình đào tạo

File khung được dùng để đối chiếu, không phải là nguồn duy nhất để xác định môn đang nợ. Khung cung cấp thêm:

- Mã học phần.
- Tên học phần.
- Số tín chỉ.
- Khối kiến thức.
- Môn bắt buộc hoặc tự chọn.
- Nhóm tự chọn.
- Học kỳ dự kiến nếu file có thông tin này.
- Tổng số tín chỉ của chương trình.

Module hiện hỗ trợ cách đọc nhiều dạng khung, trong đó có khung thông thường và khung BM2 có cấu trúc nhiều dòng hoặc nhiều cột kế hoạch.

### 2.3. Dữ liệu mẫu

Có thể nạp dữ liệu mẫu để kiểm tra giao diện, biểu đồ, lập kế hoạch và xuất báo cáo mà không cần tải file thật.

## 3. Quy trình xử lý dữ liệu

```text
Tải file Excel
      ↓
Đọc các sheet và chuẩn hóa dữ liệu
      ↓
Phân tích điểm và lịch sử học phần
      ↓
Xác định môn đạt / môn nợ / môn chưa học
      ↓
Đối chiếu với khung chương trình nếu có
      ↓
Tạo thống kê theo sinh viên, môn học và lớp
      ↓
Hiển thị dashboard và xuất báo cáo Excel
```

Việc đối chiếu được ưu tiên theo **mã học phần**. Vì vậy, mã môn trong bảng điểm và mã môn trong khung cần được ghi đúng và nhất quán.

## 4. Các chức năng hiện có

### 4.1. Nạp và quản lý dữ liệu

- Tải file bảng điểm từ máy tính.
- Tải file khung chương trình đào tạo tùy chọn.
- Kéo thả file vào vùng tải dữ liệu.
- Hiển thị trạng thái file đã tải.
- Nạp dữ liệu mẫu.
- Xóa dữ liệu và bắt đầu lại phiên phân tích.
- Hỗ trợ nhiều sheet/lớp trong cùng một file.

### 4.2. Tổng quan và biểu đồ

Dashboard tổng quan hiển thị:

- Tổng số sinh viên.
- Số sinh viên đang nợ môn.
- Tổng số môn xuất hiện trong bảng điểm.
- Tổng số lượt nợ hiện tại.
- Số môn trong khung chương trình nếu đã tải khung.
- Top 10 môn có nhiều sinh viên nợ nhất.
- Phân bố tình trạng nợ theo lớp hoặc sheet.

#### Lưu ý về số lượng môn

Số môn trong khung và số môn trong bảng điểm có thể khác nhau là bình thường.

Ví dụ:

- Khung K16 có 75 học phần và 201 tín chỉ.
- Bảng điểm K16 có thể ghi nhận 78 mã học phần.

Ba môn chênh lệch có thể là môn phát sinh ngoài khung, môn được cập nhật sau, môn thay thế hoặc môn chỉ xuất hiện trong lịch sử bảng điểm. Module cần tách riêng nhóm này để người dùng kiểm tra, không tự động coi đó là lỗi.

### 4.3. Thống kê theo sinh viên

Tab **Thống kê theo sinh viên** hỗ trợ:

- Tìm kiếm theo họ tên hoặc mã sinh viên.
- Lọc theo lớp/sheet.
- Lọc sinh viên có nợ hoặc không có nợ.
- Xem chi tiết từng môn đang nợ.
- Xem điểm tổng kết học phần và điểm chữ nếu có.
- Xem lý do nợ môn theo dữ liệu bảng điểm.
- Mở lộ trình và kế hoạch học tập khi đã có khung chương trình.
- Gửi thông báo cho một sinh viên.

### 4.4. Thống kê theo môn học

Tab **Thống kê theo môn học** hỗ trợ:

- Tìm kiếm tên hoặc mã môn.
- Xem số sinh viên đang nợ từng môn.
- Xem danh sách sinh viên nợ môn.
- Xuất Excel danh sách chi tiết sinh viên của từng môn.
- Gửi thông báo cho toàn bộ sinh viên đang nợ một môn.
- Phân biệt môn có sinh viên nợ và môn tất cả sinh viên đã đạt.

Ví dụ: nếu môn Giáo dục thể chất có 52 sinh viên nợ, chức năng xuất Excel sẽ tạo danh sách gồm mã sinh viên, họ tên, lớp/sheet, ngày sinh, email và thông tin kết quả liên quan.

### 4.5. Lộ trình và kế hoạch tốt nghiệp

Khi có file khung chương trình, module có thể phân tích cho từng sinh viên:

- Số tín chỉ đã hoàn thành.
- Số tín chỉ đang nợ.
- Số tín chỉ chưa học.
- Môn bắt buộc chưa học.
- Môn tự chọn còn thiếu.
- Tiến độ hoàn thành chương trình.
- Gợi ý các học kỳ dự kiến để xử lý môn còn thiếu.

Kế hoạch có thể được điều chỉnh theo từng học kỳ và in ra để tham khảo.

### 4.6. Xuất báo cáo Excel

Module hiện có các nhóm xuất báo cáo sau:

- Báo cáo tổng hợp danh sách sinh viên nợ môn.
- Báo cáo chi tiết sinh viên của một môn.
- Báo cáo tổng hợp thông tin phục vụ gửi email/thông báo.
- Báo cáo nhu cầu mở lớp theo khung chương trình.
- Báo cáo danh sách sinh viên theo từng môn cần mở.

Báo cáo nhu cầu mở lớp có thể gồm các sheet:

- `NhuCauMoLop`: số sinh viên nợ, chưa học và nhu cầu dự kiến.
- `NhomTuChon`: tình trạng thiếu tín chỉ theo nhóm tự chọn.
- `ChiTietNhuCau`: chi tiết nhu cầu theo từng sinh viên.
- `SinhVienTheoMon`: danh sách sinh viên theo từng học phần.
- `NgoaiKhung`: các môn có trong bảng điểm nhưng không có trong khung đối chiếu.
- `TongHopSinhVien`: tiến độ tổng hợp theo sinh viên.

### 4.7. Thông báo và nhật ký

Module hỗ trợ:

- Gửi thông báo cho một sinh viên.
- Gửi theo lớp.
- Gửi theo môn học.
- Tạo nội dung từ mẫu có các biến như họ tên, mã sinh viên, số môn nợ và danh sách môn nợ.
- Lưu nhật ký gửi thông báo lên Firebase khi người dùng đã đăng nhập.
- Xem nhật ký thông báo trong tab nhật ký.

## 5. Cấu trúc kỹ thuật hiện tại

File [thongkenomon.js](js/thongkenomon.js) hiện đóng vai trò khởi tạo ứng dụng và kết nối các module.

### 5.1. Controller

- `js/app/analysis-controller.js`: tải file, phân tích, nạp dữ liệu mẫu và reset.
- `js/app/dashboard-controller.js`: tổng quan, tab sinh viên và tab môn học.
- `js/app/planner-controller.js`: lộ trình và kế hoạch tốt nghiệp.
- `js/app/notification-controller.js`: gửi thông báo và ghi nhật ký.
- `js/app/report-controller.js`: xuất các loại báo cáo Excel.

### 5.2. Đọc và phân tích Excel

- `js/excel/workbook-utils.js`: tiện ích đọc và chuẩn hóa workbook.
- `js/excel/score-parser.js`: đọc bảng điểm.
- `js/excel/framework-parser.js`: đọc khung chương trình.
- `js/excel/framework-analysis.js`: đối chiếu và phân tích nhu cầu.
- `js/excel/report-exporter.js`: tạo dữ liệu cho các báo cáo Excel.

### 5.3. Giao diện, dữ liệu mẫu và dịch vụ

- `js/ui/`: các renderer cho dashboard, sinh viên, môn học, kế hoạch, thông báo và nhật ký.
- `js/state/app-state.js`: cấu trúc dữ liệu dùng chung.
- `js/services/notification-service.js`: chọn đối tượng nhận và tạo log thông báo.
- `js/demo/demo-data.js`: dữ liệu mẫu.

## 6. Những việc chưa thuộc phạm vi hiện tại

Hiện module chưa tự động:

- Mở lớp thật trên hệ thống đào tạo.
- Xếp giảng viên, phòng học và lịch học.
- Kiểm tra sĩ số tối thiểu/tối đa theo quy định của nhà trường.
- Đồng bộ trực tiếp với hệ thống quản lý đào tạo.
- Tự động quyết định môn tương đương hoặc môn thay thế nếu chỉ khác tên.
- Khẳng định một sinh viên đủ điều kiện tốt nghiệp theo quy chế nếu dữ liệu đầu vào chưa đầy đủ.

Các kết quả hiện tại là cơ sở phân tích và hỗ trợ ra quyết định; người phụ trách đào tạo vẫn cần kiểm tra các trường hợp đặc biệt.

## 7. Ý tưởng phát triển trong tương lai

### Ưu tiên 1 – Bảo đảm độ chính xác

- Tạo bộ kiểm thử cố định từ các file K16 thật.
- Lưu kết quả chuẩn: số môn, số tín chỉ, số sinh viên, số lượt nợ và danh sách mã môn chênh lệch.
- Hiển thị bảng cảnh báo đối chiếu giữa bảng điểm và khung.
- Cảnh báo mã môn trùng, thiếu mã, tên môn khác nhau hoặc sinh viên trùng mã.
- Cho phép người dùng xem lý do một môn được xác định là nợ.

### Ưu tiên 2 – Hoàn thiện báo cáo mở lớp

- Lọc nhu cầu theo lớp, khóa, ngành và học kỳ.
- Chọn học kỳ dự kiến mở lớp.
- Đặt ngưỡng đề xuất mở lớp, ví dụ từ 5 hoặc 10 sinh viên.
- Tách nhóm chắc chắn phải mở và nhóm có thể mở.
- Gộp các lớp có thể học chung.
- Thêm cột trạng thái: đề xuất, đã duyệt, đã mở, đã hoàn thành.
- Xuất phiếu đề xuất mở lớp theo mẫu của đơn vị.

### Ưu tiên 3 – Theo dõi tiến độ sinh viên

- Xác định nhóm sinh viên có nguy cơ không tốt nghiệp đúng hạn.
- Lọc sinh viên còn thiếu ít tín chỉ.
- Ưu tiên môn bắt buộc, môn tiên quyết và môn có lịch mở hạn chế.
- Cảnh báo khi kế hoạch học tập bị trùng hoặc vượt tải tín chỉ.
- Cho phép lưu nhiều phương án kế hoạch cho một sinh viên.

### Ưu tiên 4 – Quản lý dữ liệu và phân quyền

- Lưu các phiên phân tích để xem lại sau này.
- Gắn thời điểm, người tải file và tên file vào báo cáo.
- Phân quyền người xem, người phân tích và người duyệt mở lớp.
- Thiết lập Firebase Security Rules chặt chẽ.
- Cho phép xóa dữ liệu phiên cũ theo quyền người dùng.

### Ưu tiên 5 – Hiệu năng và trải nghiệm

- Xử lý file Excel lớn bằng Web Worker để giao diện không bị đứng.
- Hiển thị tiến độ đọc và phân tích theo từng bước.
- Cho phép hủy quá trình phân tích.
- Lưu bộ lọc gần nhất trong phiên làm việc.
- Thêm thông báo lỗi dễ hiểu khi file sai định dạng.
- Thêm chế độ xem nhanh trước khi xuất Excel.

## 8. Lộ trình đề xuất

```text
Giai đoạn 1: Kiểm thử và cảnh báo đối chiếu
        ↓
Giai đoạn 2: Hoàn thiện báo cáo nhu cầu mở lớp
        ↓
Giai đoạn 3: Theo dõi sinh viên có nguy cơ chậm tốt nghiệp
        ↓
Giai đoạn 4: Lưu phiên phân tích và phân quyền
        ↓
Giai đoạn 5: Tích hợp hệ thống đào tạo và quản lý mở lớp
```

## 9. Quy trình sử dụng đề xuất hiện tại

1. Tải file bảng điểm.
2. Tải file khung chương trình nếu cần đối chiếu tiến độ và nhu cầu mở lớp.
3. Bấm phân tích dữ liệu.
4. Kiểm tra tổng quan số sinh viên, số môn và số lượt nợ.
5. Mở tab sinh viên để xem từng người còn nợ gì.
6. Mở tab môn học để xem môn nào cần tổ chức học lại hoặc thi lại.
7. Xuất danh sách sinh viên theo từng môn.
8. Xuất báo cáo nhu cầu mở lớp để gửi đơn vị phụ trách xem xét.
9. Kiểm tra riêng các môn ngoài khung trước khi đưa ra quyết định cuối cùng.

---

**Trạng thái tài liệu:** mô tả theo phiên bản cấu trúc hiện tại của module Thống kê nợ môn.
