'use client';

import { useState, useRef, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import { SECTIONS } from '@/lib/constants';
import Footer from '@/components/Footer';
import { useRouter } from 'next/navigation';
import { UploadCloud, X, ArrowLeft, Users } from 'lucide-react';
import Image from 'next/image';
import VideoPlayer from '@/components/VideoPlayer';
import MuxVideoPlayer from '@/components/MuxVideoPlayer';
import BackButton from '@/components/BackButton';

export default function AdminPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    fullDescription: '',
    video: '',
    teamMembers: '',
    section: SECTIONS[0].name
  });
  const [images, setImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isVideoDragging, setIsVideoDragging] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [dragOverImageIndex, setDragOverImageIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'loading' | null, message: string }>({ type: null, message: '' });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [imageToRemove, setImageToRemove] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Warn user if they try to leave while an upload is in progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUploading]);

  // Mux video upload state
  const [muxUploadState, setMuxUploadState] = useState<'idle' | 'uploading' | 'processing' | 'ready' | 'error'>('idle');
  const [muxUploadProgress, setMuxUploadProgress] = useState(0);
  const [muxUploadId, setMuxUploadId] = useState('');
  const [muxPlaybackId, setMuxPlaybackId] = useState('');
  const [muxAssetId, setMuxAssetId] = useState('');

  const uploadToCloudinary = async (file: File, resourceType: 'image' | 'video' = 'image') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('resourceType', resourceType);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Lỗi khi tải lên server');
    }

    const data = await response.json();
    return data.secure_url;
  };

  // AI Title Suggestions State
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [isSuggestingTitle, setIsSuggestingTitle] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Debounced AI Title Suggestion
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (formData.title.trim().length < 3) {
        setTitleSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsSuggestingTitle(true);
      try {
        const res = await fetch('/api/suggest-title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: formData.title, section: formData.section })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.suggestions && data.suggestions.length > 0) {
            setTitleSuggestions(data.suggestions);
            setShowSuggestions(true);
          }
        }
      } catch (error) {
        console.error('Failed to fetch title suggestions:', error);
      } finally {
        setIsSuggestingTitle(false);
      }
    };

    const timeoutId = setTimeout(() => {
      // Only fetch if the user is focused on the title input
      if (document.activeElement === titleInputRef.current) {
        fetchSuggestions();
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(timeoutId);
  }, [formData.title, formData.section]);

  // Handle clicking outside suggestions to close them
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (titleInputRef.current && !titleInputRef.current.contains(event.target as Node)) {
        // Delay closing slightly to allow clicking a suggestion
        setTimeout(() => setShowSuggestions(false), 200);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSuggestionClick = (suggestion: string) => {
    setFormData({ ...formData, title: suggestion });
    setShowSuggestions(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    processFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
      processFiles(files);
    }
  };

  const processFiles = async (files: File[]) => {
    const validFiles = files.filter(file => {
      if (file.size > 5 * 1024 * 1024) {
        setStatus({ type: 'error', message: `File ${file.name} vượt quá dung lượng 5MB và sẽ bị bỏ qua.` });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setIsUploading(true);
    setStatus({ type: 'loading', message: 'Đang tải ảnh lên Cloudinary...' });

    try {
      const uploadPromises = validFiles.map(file => uploadToCloudinary(file, 'image'));
      const uploadedUrls = await Promise.all(uploadPromises);
      
      setImages(prev => [...prev, ...uploadedUrls]);
      setStatus({ type: 'success', message: 'Tải ảnh lên thành công!' });
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message || 'Lỗi khi tải ảnh lên.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsVideoDragging(true);
  };

  const handleVideoDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsVideoDragging(false);
  };

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsVideoDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('video/'));
    processVideo(files[0]);
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).filter(file => file.type.startsWith('video/'));
      processVideo(files[0]);
    }
  };

  const pollMuxStatus = (uploadId: string) => {
    const check = async () => {
      try {
        const res = await fetch(`/api/mux/asset/${uploadId}`);
        const data = await res.json();

        if (data.status === 'ready') {
          setMuxPlaybackId(data.playbackId);
          setMuxAssetId(data.assetId);
          setMuxUploadState('ready');
          setStatus({ type: 'success', message: 'Video đã sẵn sàng!' });
          setTimeout(() => setStatus({ type: null, message: '' }), 3000);
          setIsUploading(false);
          return;
        }

        if (data.status === 'error') {
          setMuxUploadState('error');
          setStatus({ type: 'error', message: 'Mux xử lý video thất bại' });
          setIsUploading(false);
          return;
        }

        // Still processing — schedule next check (non-recursive, cancellable)
        pollTimeoutRef.current = setTimeout(check, 3000);
      } catch (error: any) {
        setMuxUploadState('error');
        setStatus({ type: 'error', message: error.message || 'Lỗi khi xử lý video.' });
        setIsUploading(false);
      }
    };

    check();
  };

  const processVideo = async (file?: File) => {
    if (!file) return;

    // Mux supports up to 2GB for direct uploads by default; no hard limit enforced here
    setIsUploading(true);
    setMuxUploadState('uploading');
    setMuxUploadProgress(0);
    setStatus({ type: 'loading', message: 'Đang chuẩn bị tải video lên Mux...' });

    // Cancel any previous poll before starting a new upload
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);

    try {
      // Step 1: Get a one-time direct upload URL from our server (credentials stay server-side)
      const urlRes = await fetch('/api/mux/upload-url', { method: 'POST' });
      if (!urlRes.ok) throw new Error('Không thể tạo upload URL');
      const { uploadUrl, uploadId } = await urlRes.json();
      setMuxUploadId(uploadId);

      // Step 2: PUT the file directly to Mux (bypasses our server — handles large files fine)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setMuxUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload thất bại: HTTP ${xhr.status}`));
        });
        xhr.addEventListener('error', () => reject(new Error('Lỗi mạng khi upload')));
        xhr.open('PUT', uploadUrl);
        xhr.send(file);
      });

      setMuxUploadProgress(100);
      setMuxUploadState('processing');
      setStatus({ type: 'loading', message: 'Video đã tải lên, đang xử lý...' });

      // Step 3: Poll until the asset is ready
      pollMuxStatus(uploadId);
    } catch (error: any) {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      setMuxUploadState('error');
      setStatus({ type: 'error', message: error.message || 'Lỗi khi tải video lên.' });
      setIsUploading(false);
    }
  };

  const handleImageDragStart = (e: React.DragEvent, index: number) => {
    setDraggedImageIndex(index);
  };

  const handleImageDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverImageIndex !== index) {
      setDragOverImageIndex(index);
    }
  };

  const handleImageDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedImageIndex === null) return;
    
    if (draggedImageIndex !== targetIndex) {
      setImages(prev => {
        const newImages = [...prev];
        const draggedItem = newImages[draggedImageIndex];
        newImages.splice(draggedImageIndex, 1);
        newImages.splice(targetIndex, 0, draggedItem);
        return newImages;
      });
    }
    
    setDraggedImageIndex(null);
    setDragOverImageIndex(null);
  };

  const handleImageDragEnd = () => {
    setDraggedImageIndex(null);
    setDragOverImageIndex(null);
  };

  const removeImage = (index: number) => {
    setImageToRemove(index);
  };

  const confirmRemoveImage = () => {
    if (imageToRemove !== null) {
      setImages(prev => prev.filter((_, i) => i !== imageToRemove));
      setImageToRemove(null);
    }
  };

  const handleClearDatabase = () => {
    setShowClearConfirm(true);
  };

  const confirmClearDatabase = async () => {
    setShowClearConfirm(false);
    setStatus({ type: 'loading', message: 'Đang xóa dữ liệu...' });

    try {
      const res = await fetch('/api/products', {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Có lỗi xảy ra khi xóa dữ liệu');
      }

      setStatus({ type: 'success', message: 'Đã xóa toàn bộ dữ liệu thành công!' });

      setTimeout(() => {
        router.push('/');
      }, 1500);

    } catch (error: any) {
      setStatus({ type: 'error', message: error.message });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setStatus({ type: 'error', message: 'Vui lòng nhập tên dự án.' });
      return;
    }

    if (!formData.description.trim()) {
      setStatus({ type: 'error', message: 'Vui lòng nhập mô tả ngắn.' });
      return;
    }

    setStatus({ type: 'loading', message: 'Đang lưu sản phẩm...' });

    const newProduct = {
      title: formData.title,
      description: formData.description,
      fullDescription: formData.fullDescription,
      images: images,
      video: formData.video || undefined,
      muxAssetId: muxAssetId || undefined,
      muxPlaybackId: muxPlaybackId || undefined,
      teamMembers: formData.teamMembers || undefined,
      section: formData.section
    };

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Có lỗi xảy ra khi thêm sản phẩm');
      }

      setStatus({ type: 'success', message: 'Thêm bài viết thành công! Đang chuyển hướng...' });

      // Capture the section path BEFORE resetting the form
      const targetSection = formData.section;
      const sectionPath = SECTIONS.find(s => s.name === targetSection)?.path || '/';

      setFormData({ title: '', description: '', fullDescription: '', video: '', teamMembers: '', section: SECTIONS[0].name });
      setImages([]);
      setMuxUploadState('idle');
      setMuxUploadProgress(0);
      setMuxUploadId('');
      setMuxPlaybackId('');
      setMuxAssetId('');

      setTimeout(() => {
        router.push(sectionPath);
      }, 1500);

    } catch (error: any) {
      setStatus({ type: 'error', message: error.message });
    }
  };

  return (
    <div className="min-h-screen bg-[#F4EBD0] font-playfair">
      <Navigation />
      
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 flex justify-between items-center animate-in fade-in slide-in-from-left-4 duration-500">
          <BackButton fallbackUrl="/" />
          <button
            type="button"
            onClick={handleClearDatabase}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium text-sm shadow-sm"
          >
            Xóa toàn bộ dữ liệu (Clear DB)
          </button>
        </div>

        <div className="bg-white rounded-sm shadow-sm border border-[#D4C4A8] overflow-hidden p-8 sm:p-12 relative animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-bold text-[#2C1E16] mb-4 font-playfair">Thêm Bài Viết Mới</h1>
            <p className="text-[#5C4033] text-lg italic">
              Điền thông tin bên dưới để thêm một bài viết mới hoặc nộp dự án của nhóm.
            </p>
            <div className="w-24 h-[1px] bg-[#B8860B] mx-auto mt-6"></div>
          </div>
          
          {status.type && (
            <div className={`p-4 mb-8 rounded-xl text-sm font-medium ${
              status.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
              status.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
              'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              {status.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-lg font-bold text-[#2C1E16] mb-3 font-playfair">Chuyên mục *</label>
              <select 
                name="section" 
                value={formData.section} 
                onChange={handleChange} 
                className="w-full px-4 py-4 border-2 border-[#D4C4A8] rounded-lg focus:ring-2 focus:ring-[#B8860B] focus:border-[#B8860B] outline-none transition-all bg-[#F4EBD0] text-[#2C1E16] font-playfair text-lg shadow-inner" 
              >
                {SECTIONS.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <label className="block text-lg font-bold text-[#2C1E16] mb-3 font-playfair">Tiêu đề bài viết / Tên dự án *</label>
              <div className="relative">
                <input 
                  required 
                  type="text" 
                  name="title" 
                  ref={titleInputRef}
                  value={formData.title} 
                  onChange={handleChange} 
                  onFocus={() => {
                    if (titleSuggestions.length > 0) setShowSuggestions(true);
                  }}
                  className="w-full px-4 py-4 pr-10 border-2 border-[#D4C4A8] rounded-lg focus:ring-2 focus:ring-[#B8860B] focus:border-[#B8860B] outline-none transition-all bg-[#F4EBD0] placeholder-[#8B3A3A]/50 text-[#2C1E16] font-playfair text-lg shadow-inner" 
                  placeholder="Nhập tiêu đề..." 
                />
                {isSuggestingTitle && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="animate-spin h-5 w-5 text-[#B8860B]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>
              
              {/* AI Suggestions Dropdown */}
              {showSuggestions && titleSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-white border-2 border-[#D4C4A8] rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="bg-[#F4EBD0] px-4 py-2 border-b border-[#D4C4A8] flex items-center justify-between">
                    <span className="text-xs font-bold text-[#8B3A3A] uppercase tracking-wider flex items-center gap-1">
                      <span className="text-[#B8860B]">✦</span> Gợi ý từ AI
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setShowSuggestions(false)}
                      className="text-[#5C4033] hover:text-[#8B3A3A]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <ul className="max-h-60 overflow-y-auto">
                    {titleSuggestions.map((suggestion, index) => (
                      <li key={index}>
                        <button
                          type="button"
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="w-full text-left px-4 py-3 text-[#2C1E16] hover:bg-[#F4EBD0] hover:text-[#8B3A3A] transition-colors border-b border-[#D4C4A8]/30 last:border-0 font-playfair text-lg"
                        >
                          {suggestion}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-lg font-bold text-[#2C1E16] mb-3 font-playfair flex items-center gap-2">
                Thành viên nhóm (Tùy chọn)
              </label>
              <input 
                type="text" 
                name="teamMembers" 
                value={formData.teamMembers} 
                onChange={handleChange} 
                className="w-full px-4 py-4 border-2 border-[#D4C4A8] rounded-lg focus:ring-2 focus:ring-[#B8860B] focus:border-[#B8860B] outline-none transition-all bg-[#F4EBD0] placeholder-[#8B3A3A]/50 text-[#2C1E16] font-playfair text-lg shadow-inner" 
                placeholder="Nguyễn Văn A, Trần Thị B..." 
              />
            </div>

            <div>
              <label className="block text-lg font-bold text-[#2C1E16] mb-3 font-playfair">Mô tả ngắn *</label>
              <input 
                required 
                type="text" 
                name="description" 
                value={formData.description} 
                onChange={handleChange} 
                className="w-full px-4 py-4 border-2 border-[#D4C4A8] rounded-lg focus:ring-2 focus:ring-[#B8860B] focus:border-[#B8860B] outline-none transition-all bg-[#F4EBD0] placeholder-[#8B3A3A]/50 text-[#2C1E16] font-playfair text-lg shadow-inner" 
                placeholder="Tóm tắt ngắn gọn (1-2 câu)..." 
              />
            </div>

            <div>
              <label className="block text-lg font-bold text-[#2C1E16] mb-3 font-playfair">Mô tả chi tiết</label>
              <textarea 
                name="fullDescription" 
                value={formData.fullDescription} 
                onChange={handleChange} 
                rows={8} 
                className="w-full px-4 py-4 border-2 border-[#D4C4A8] rounded-lg focus:ring-2 focus:ring-[#B8860B] focus:border-[#B8860B] outline-none transition-all bg-[#F4EBD0] placeholder-[#8B3A3A]/50 text-[#2C1E16] font-playfair text-lg shadow-inner leading-relaxed" 
                placeholder="Mô tả đầy đủ về tác phẩm, ý nghĩa, phân tích..."
              ></textarea>
            </div>

            <div>
              <label className="block text-lg font-bold text-[#2C1E16] mb-3 font-playfair">Hình ảnh (Tùy chọn - Kéo thả hoặc chọn ảnh)</label>
              
              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging ? 'border-[#B8860B] bg-[#E8D8B8]' : 'border-[#D4C4A8] hover:border-[#B8860B] bg-[#F4EBD0]'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                />
                <UploadCloud className={`mx-auto h-12 w-12 mb-4 ${isDragging ? 'text-[#B8860B]' : 'text-[#8B3A3A]/50'}`} />
                <p className="text-base text-[#5C4033] font-medium mb-1 font-playfair">
                  Kéo thả hình ảnh vào đây, hoặc <span className="text-[#8B3A3A] cursor-pointer hover:underline font-bold">nhấn để chọn</span>
                </p>
                <p className="text-sm text-[#5C4033]/70 italic">Hỗ trợ JPG, PNG, GIF (Tối đa 5MB/ảnh)</p>
              </div>

              {/* Image Preview Grid */}
              {images.length > 0 && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {images.map((img, index) => (
                    <div 
                      key={index} 
                      draggable
                      onDragStart={(e) => handleImageDragStart(e, index)}
                      onDragOver={(e) => handleImageDragOver(e, index)}
                      onDrop={(e) => handleImageDrop(e, index)}
                      onDragEnd={handleImageDragEnd}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 group cursor-move transition-all ${
                        dragOverImageIndex === index ? 'border-indigo-500 scale-105' : 'border-gray-200'
                      } ${draggedImageIndex === index ? 'opacity-50' : 'opacity-100'}`}
                    >
                      <Image 
                        src={img} 
                        alt={`Preview ${index}`} 
                        fill 
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(index);
                        }}
                        className="absolute top-2 right-2 bg-white/80 hover:bg-red-500 hover:text-white text-gray-700 p-1.5 rounded-full backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm opacity-0 group-hover:opacity-100">
                        Kéo để sắp xếp
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-lg font-bold text-[#2C1E16] mb-3 font-playfair">Video (Tùy chọn — Tải lên qua Mux)</label>

              {muxUploadState === 'idle' && (
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                    isVideoDragging ? 'border-[#B8860B] bg-[#E8D8B8]' : 'border-[#D4C4A8] hover:border-[#B8860B] bg-[#F4EBD0]'
                  }`}
                  onDragOver={handleVideoDragOver}
                  onDragLeave={handleVideoDragLeave}
                  onDrop={handleVideoDrop}
                  onClick={() => videoInputRef.current?.click()}
                >
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    ref={videoInputRef}
                    onChange={handleVideoSelect}
                  />
                  <UploadCloud className={`mx-auto h-12 w-12 mb-4 ${isVideoDragging ? 'text-[#B8860B]' : 'text-[#8B3A3A]/50'}`} />
                  <p className="text-base text-[#5C4033] font-medium mb-1 font-playfair">
                    Kéo thả video vào đây, hoặc <span className="text-[#8B3A3A] cursor-pointer hover:underline font-bold">nhấn để chọn</span>
                  </p>
                  <p className="text-sm text-[#5C4033]/70 italic">Hỗ trợ MP4, WebM, MOV — file lớn (1–2 GB) được chấp nhận</p>
                </div>
              )}

              {muxUploadState === 'uploading' && (
                <div className="border-2 border-[#D4C4A8] rounded-lg p-8 bg-[#F4EBD0]">
                  <p className="text-base font-bold text-[#2C1E16] mb-3 font-playfair text-center">Đang tải lên Mux...</p>
                  <div className="w-full bg-[#D4C4A8] rounded-full h-3 mb-2">
                    <div
                      className="bg-[#B8860B] h-3 rounded-full transition-all duration-300"
                      style={{ width: `${muxUploadProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-[#5C4033] text-center font-playfair">{muxUploadProgress}%</p>
                </div>
              )}

              {muxUploadState === 'processing' && (
                <div className="border-2 border-[#D4C4A8] rounded-lg p-8 bg-[#F4EBD0] text-center">
                  <svg className="animate-spin mx-auto h-10 w-10 text-[#B8860B] mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-base font-bold text-[#2C1E16] font-playfair">Mux đang xử lý video...</p>
                  <p className="text-sm text-[#5C4033] italic mt-1">Quá trình này có thể mất vài phút.</p>
                </div>
              )}

              {muxUploadState === 'ready' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-base font-bold text-[#2C1E16] font-playfair">Xem trước Video (Mux):</p>
                    <button
                      type="button"
                      onClick={() => {
                        setMuxUploadState('idle');
                        setMuxUploadProgress(0);
                        setMuxUploadId('');
                        setMuxPlaybackId('');
                        setMuxAssetId('');
                      }}
                      className="text-sm text-red-600 hover:text-red-800 font-bold transition-colors"
                    >
                      Xóa Video
                    </button>
                  </div>
                  <div className="rounded-lg overflow-hidden bg-black aspect-video relative border-4 border-[#2C1E16] shadow-xl">
                    <MuxVideoPlayer playbackId={muxPlaybackId} />
                  </div>
                </div>
              )}

              {muxUploadState === 'error' && (
                <div className="border-2 border-red-300 rounded-lg p-6 bg-red-50 text-center">
                  <p className="text-red-700 font-bold font-playfair mb-3">Tải video lên thất bại.</p>
                  <button
                    type="button"
                    onClick={() => setMuxUploadState('idle')}
                    className="px-4 py-2 bg-[#B8860B] text-white rounded-lg hover:bg-[#8B3A3A] transition-colors font-playfair font-bold text-sm"
                  >
                    Thử lại
                  </button>
                </div>
              )}
            </div>

            <div className="pt-6">
              <button 
                type="submit" 
                disabled={status.type === 'loading' || isUploading} 
                className={`w-full bg-[#B8860B] text-[#FFFDF5] font-bold text-xl py-4 px-6 rounded-lg border-2 border-[#8B3A3A] transition-all duration-300 shadow-lg font-playfair flex justify-center items-center uppercase tracking-widest ${status.type === 'loading' || isUploading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-[#8B3A3A] hover:text-[#FFFDF5] hover:border-[#B8860B]'}`}
              >
                {status.type === 'loading' || isUploading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isUploading ? 'Đang tải file lên...' : 'Đang xử lý...'}
                  </span>
                ) : 'Thêm Bài Viết'}
              </button>
            </div>
          </form>
        </div>
      </main>
      <Footer />

      {/* Modal Xóa Toàn Bộ Dữ Liệu */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4 border-2 border-[#8B3A3A] animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-bold text-[#8B3A3A] mb-4 font-playfair text-center">Cảnh Báo Nguy Hiểm!</h3>
            <p className="text-[#2C1E16] mb-6 text-center text-lg">
              Bạn có chắc chắn muốn xóa <strong>TOÀN BỘ</strong> dữ liệu? Hành động này không thể hoàn tác!
            </p>
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-6 py-3 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition-colors font-playfair"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={confirmClearDatabase}
                className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors font-playfair shadow-md"
              >
                Xóa Dữ Liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xóa Ảnh */}
      {imageToRemove !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 border border-[#D4C4A8] animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-[#2C1E16] mb-4 font-playfair text-center">Xóa Ảnh</h3>
            <p className="text-[#5C4033] mb-6 text-center">
              Bạn có chắc chắn muốn xóa ảnh này không?
            </p>
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => setImageToRemove(null)}
                className="px-5 py-2 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition-colors font-playfair"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmRemoveImage}
                className="px-5 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors font-playfair shadow-md"
              >
                Xóa Ảnh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
