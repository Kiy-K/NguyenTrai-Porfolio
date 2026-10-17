module.exports = [
    ...Array.from({ length: 31 }, (_, i) => ({ id: `p0-${i + 1}`, title: ["Nguyễn Trãi và nhân nghĩa", "Bình Ngô đại cáo", "Di sản văn hóa"][i % 3] + ` ${String(i + 1).padStart(2, '0')}`, description: "Tìm hiểu tư tưởng và văn học Việt Nam qua những tác phẩm tiêu biểu.", fullDescription: "Nội dung do tác giả viết: Bảo tồn di sản qua nhiều thế hệ.", images: ["/nguyen-trai.jpg"], tags: i % 2 ? ["Văn học"] : ["Văn học", "Lịch sử"], section: "Tư tưởng nhân nghĩa", status: "published" })),
    { id: "draft", title: "Nguyễn Trãi bản nháp", description: "Riêng tư", images: [], tags: ["Riêng tư"], section: "Tư tưởng nhân nghĩa", status: "draft" },
    { id: "archived", title: "Nguyễn Trãi lưu trữ", description: "Riêng tư", images: [], section: "Tư tưởng nhân nghĩa", status: "archived" },
    { id: "other", title: "Bài viết chuyên mục khác", description: "Không thuộc chuyên mục này", images: [], section: "Cuộc đời và sự nghiệp", status: "published" }
];
