# 🎓 Student Project Portfolio / Portfolio Dự Án Sinh Viên

*(Bilingual README: English & Vietnamese)*

A clean, simple, and responsive Next.js application designed for students to showcase their school projects and products. It includes a built-in AI integration (OpenAI-compatible) to automatically summarize project descriptions.

Một ứng dụng Next.js giao diện sạch, đơn giản và tương thích với mọi thiết bị, được thiết kế dành cho sinh viên để trưng bày các dự án và sản phẩm trên trường. Dự án có tích hợp sẵn AI (tương thích OpenAI) để tự động tóm tắt mô tả dự án.

---

## ✨ Features / Tính năng nổi bật

- **Product List Page**: Responsive grid showcasing all projects. *(Trang danh sách dự án dạng lưới)*
- **Product Detail Page**: Full description, image gallery, and video support. *(Trang chi tiết dự án với hình ảnh và video)*
- **AI Summarization**: Built-in AI button to summarize long descriptions using OpenAI, Mistral, or Gemini. *(Tích hợp AI tóm tắt mô tả dự án)*
- **About Us Page**: Introduce your team members and roles. *(Trang giới thiệu nhóm)*
- **Responsive Design**: Works perfectly on mobile, tablet, and desktop. *(Giao diện tương thích mọi thiết bị)*

---

## 🛠 Tech Stack / Công nghệ sử dụng

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Database**: [Upstash Redis](https://upstash.com/) (Serverless Redis)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **AI Integration**: [OpenAI Node.js SDK](https://github.com/openai/openai-node)

---

## 📁 Folder Structure / Cấu trúc thư mục

```text
/
├── app/                  # Next.js App Router pages (Các trang chính)
│   ├── page.tsx          # Homepage / Trang chủ
│   ├── about/            # About Us page / Trang giới thiệu
│   ├── api/products/     # API Routes for Products (GET, POST)
│   ├── api/summarize/    # AI API Endpoint / API xử lý AI
│   └── products/[id]/    # Product Detail Page / Trang chi tiết dự án
├── components/           # Reusable UI components (Các component dùng chung)
│   ├── Navigation.tsx    # Thanh điều hướng
│   ├── ProductCard.tsx   # Thẻ dự án
│   └── SummarizeButton.tsx # Nút tóm tắt AI
├── data/                 # Mock data (Dữ liệu mẫu)
│   └── products.ts       # Example product data / Dữ liệu dự án mẫu
└── lib/                  # Utility functions (Các hàm tiện ích)
    ├── ai.ts             # AI Client Configuration / Cấu hình AI
    ├── redis.ts          # Upstash Redis Connection / Kết nối Upstash Redis
    └── data.ts           # Data Fetching Logic / Logic lấy dữ liệu
```

---

## 🚀 Getting Started / Hướng dẫn cài đặt (Local)

### 1. Clone the repository (Tải mã nguồn)
```bash
git clone <your-github-repo-url>
cd student-portfolio
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

### Option 1: Vercel (Highly Recommended / Khuyên dùng)
Vercel is the easiest way to deploy Next.js apps. *(Vercel là cách dễ nhất để deploy Next.js)*

1. Push your code to a GitHub repository. *(Đẩy code lên GitHub)*
2. Go to [Vercel.com](https://vercel.com/) and sign in with GitHub. *(Đăng nhập Vercel bằng GitHub)*
3. Click **Add New... -> Project**.
4. Import your GitHub repository. *(Nhập repo GitHub của bạn)*
5. In the **Environment Variables** section, add your `OPENAI_API_KEY`. *(Thêm biến môi trường OPENAI_API_KEY)*
6. Click **Deploy**. Your site will be live in minutes! *(Bấm Deploy và đợi vài phút)*

### Option 2: GitHub Pages (Static Export)
If you want to host on GitHub Pages, you need to export the Next.js app as static HTML. Note: API routes (like the AI summarizer) **will not work** on GitHub Pages because it requires a Node.js server.
*(Nếu dùng GitHub Pages, tính năng AI sẽ không hoạt động vì GitHub Pages không hỗ trợ server Node.js)*

1. Open `next.config.ts` and add `output: 'export'`:
   ```typescript
   const nextConfig: NextConfig = {
     output: 'export',
     // ... other config
   };
   ```
2. Update `package.json` scripts:
   ```bash
   npm install -D gh-pages
   ```
   Add to `package.json`:
   ```json
   "scripts": {
     "build": "next build",
     "deploy": "touch out/.nojekyll && gh-pages -d out"
   }
   ```
3. Run the deployment:
   ```bash
   npm run build
   npm run deploy
   ```

---
*Built with ❤️ for students.*
