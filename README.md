# 📜 Nguyễn Trãi - Danh nhân văn hóa thế giới (World Cultural Celebrity)

*(Bilingual README: English & Vietnamese)*

A beautifully designed, responsive Next.js application dedicated to showcasing the life, works, and legacy of Nguyễn Trãi - a prominent Vietnamese scholar, poet, and world cultural celebrity.

Một ứng dụng Next.js giao diện đẹp mắt và tương thích mọi thiết bị, được thiết kế để trưng bày về cuộc đời, sự nghiệp và di sản của Nguyễn Trãi - danh nhân văn hóa thế giới, nhà tư tưởng, nhà thơ lớn của dân tộc Việt Nam.

---

## ✨ Features / Tính năng nổi bật

- **Elegant UI/UX**: Designed with a classic, elegant theme using the Playfair Display font and warm colors to reflect the historical significance. *(Giao diện thanh lịch, cổ điển với tông màu ấm và font chữ Playfair Display)*
- **Smart Navigation**: Features a sticky, auto-hiding navigation bar that smoothly slides out of view when scrolling down to maximize reading space, and instantly reappears when scrolling up. *(Thanh điều hướng thông minh tự động ẩn khi cuộn xuống và hiện lại khi cuộn lên)*
- **Smooth Scrolling**: Enjoy a seamless browsing experience with smooth anchor scrolling across the application. *(Trải nghiệm cuộn trang mượt mà)*
- **Content Categories**: Organized sections for his biography, literary works, and historical contributions. *(Phân loại nội dung rõ ràng: tiểu sử, tác phẩm văn học, đóng góp lịch sử)*
- **Admin Dashboard**: Built-in admin page (`/admin`) to manage content and entries. *(Trang quản trị tích hợp để quản lý nội dung)*
- **AI Integration**: Built-in AI summarization to quickly digest long historical texts and descriptions. *(Tích hợp AI tóm tắt các văn bản lịch sử dài)*
- **Responsive Design**: Flawless experience across mobile, tablet, and desktop devices. *(Tương thích hoàn hảo trên mọi thiết bị)*

---

## 🛠 Tech Stack / Công nghệ sử dụng

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animations**: Tailwind animations (`animate-in`, `fade-in`, `slide-in`)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Database**: [Upstash Redis](https://upstash.com/) (Serverless Redis) for content storage
- **AI Integration**: [OpenAI Node.js SDK](https://github.com/openai/openai-node) (Compatible with OpenAI, Mistral, or Gemini)

---

## 📁 Folder Structure / Cấu trúc thư mục

```text
/
├── app/                  # Next.js App Router pages (Các trang chính)
│   ├── page.tsx          # Homepage / Trang chủ
│   ├── admin/            # Admin Dashboard / Trang quản trị
│   ├── api/              # API Routes (Products, Summarize)
│   └── products/[id]/    # Detail Pages for specific works/events / Trang chi tiết
├── components/           # Reusable UI components (Các component dùng chung)
│   ├── Navigation.tsx    # Thanh điều hướng thông minh (Sticky Auto-hide)
│   ├── CategoryLayout.tsx# Bố cục theo danh mục
│   ├── ProductCard.tsx   # Thẻ nội dung
│   └── SummarizeButton.tsx # Nút tóm tắt AI
├── lib/                  # Utility functions (Các hàm tiện ích)
│   ├── ai.ts             # AI Client Configuration / Cấu hình AI
│   ├── redis.ts          # Upstash Redis Connection / Kết nối Upstash Redis
│   └── data.ts           # Data Fetching Logic / Logic lấy dữ liệu
```

---

## 🚀 Getting Started / Hướng dẫn cài đặt (Local)

### 1. Clone the repository (Tải mã nguồn)
```bash
git clone https://github.com/Kiy-K/NguyenTrai-Porfolio.git
cd NguyenTrai-Porfolio
```

### 2. Install dependencies (Cài đặt thư viện)
```bash
npm install
```

### 3. Configure Environment Variables (Cấu hình biến môi trường)
Copy the example environment file and add your API keys:
*(Copy file `.env.example` thành `.env` và thêm API key của bạn)*
```bash
cp .env.example .env
```
Open `.env` and set your variables:
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`: Get these from your [Upstash Console](https://console.upstash.com/).
- `OPENAI_API_KEY`: You can use OpenAI, Mistral, or Gemini's OpenAI-compatible endpoint.

*(Lưu ý: Nếu bạn chưa cấu hình Upstash Redis, ứng dụng sẽ tự động sử dụng dữ liệu mẫu (mock data) để bạn vẫn có thể chạy thử giao diện).*

### 4. Run the development server (Chạy server dev)
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. *(Mở trình duyệt và truy cập link trên)*

---

## 🌐 Deployment / Hướng dẫn triển khai (Hosting)

### Vercel (Highly Recommended / Khuyên dùng)
Vercel is the easiest way to deploy Next.js apps. *(Vercel là cách dễ nhất để deploy Next.js)*

1. Push your code to a GitHub repository. *(Đẩy code lên GitHub)*
2. Go to [Vercel.com](https://vercel.com/) and sign in with GitHub. *(Đăng nhập Vercel bằng GitHub)*
3. Click **Add New... -> Project**.
4. Import your GitHub repository. *(Nhập repo GitHub của bạn)*
5. In the **Environment Variables** section, add your `OPENAI_API_KEY` and Redis credentials. *(Thêm biến môi trường)*
6. Click **Deploy**. Your site will be live in minutes! *(Bấm Deploy và đợi vài phút)*

*(Lưu ý: Không nên sử dụng GitHub Pages cho dự án này vì GitHub Pages không hỗ trợ các API routes của Next.js cần thiết cho tính năng AI và Redis).*

---
*Tự hào tôn vinh giá trị văn hóa và lịch sử Việt Nam.*
