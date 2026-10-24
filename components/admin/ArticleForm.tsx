'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { SECTIONS } from '@/lib/constants';
import MediaEditor from '@/components/admin/MediaEditor';
import StatusMessage from '@/components/admin/StatusMessage';
import type { AdminStatus, MutationState, UploadedMuxVideo } from '@/components/admin/types';
import type { ArticleReference } from '@/data/products';
import { articleReferencesSchema } from '@/lib/article-references';

export default function ArticleForm({ isMutationPending, setIsMutationPending }: MutationState) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    fullDescription: '',
    video: '',
    teamMembers: '',
    section: SECTIONS[0].name
  });
  const [images, setImages] = useState<string[]>([]);
  const [uploadedMuxVideos, setUploadedMuxVideos] = useState<UploadedMuxVideo[]>([]);
  const [status, setStatus] = useState<AdminStatus>({ type: null, message: '' });
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaKey, setMediaKey] = useState(0);
  const [references, setReferences] = useState<(ArticleReference & { key: number })[]>([]);
  const [referenceErrors, setReferenceErrors] = useState<Record<string, string>>({});
  const nextReferenceKey = useRef(0);
  const referenceFocus = useRef<string | null>(null);
  useEffect(() => {
    if (referenceFocus.current) {
      document.getElementById(referenceFocus.current)?.focus();
      referenceFocus.current = null;
    }
  }, [references]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setStatus({ type: 'error', message: 'Vui lòng nhập tiêu đề bài viết / tên dự án.' });
      return;
    }

    if (!formData.description.trim()) {
      setStatus({ type: 'error', message: 'Vui lòng nhập mô tả ngắn.' });
      return;
    }

    if (mediaBusy || isMutationPending) return;
    const parsedReferences = articleReferencesSchema.safeParse(references);
    if (!parsedReferences.success) {
      setReferenceErrors(Object.fromEntries(parsedReferences.error.issues.map(issue => [issue.path.join('.'), issue.message])));
      setStatus({ type: 'error', message: 'Vui lòng kiểm tra nguồn tham khảo.' });
      const [row, field] = parsedReferences.error.issues[0].path;
      document.getElementById(`reference-${references[Number(row)]?.key}-${String(field)}`)?.focus();
      return;
    }
    setReferenceErrors({});
    setIsMutationPending(true);
    setStatus({ type: 'loading', message: 'Đang lưu bài viết. Vui lòng đợi...' });

    const videos = [
      ...(formData.video.trim() ? [{ video: formData.video.trim() }] : []),
      ...uploadedMuxVideos.map((item) => ({
        muxAssetId: item.muxAssetId,
        muxPlaybackId: item.muxPlaybackId,
      })),
    ];
    const primaryMuxVideo = uploadedMuxVideos[0];

    const newProduct = {
      title: formData.title,
      description: formData.description,
      fullDescription: formData.fullDescription,
      images: images,
      video: formData.video || undefined,
      muxAssetId: primaryMuxVideo?.muxAssetId || undefined,
      muxPlaybackId: primaryMuxVideo?.muxPlaybackId || undefined,
      videos: videos.length > 0 ? videos : undefined,
      teamMembers: formData.teamMembers || undefined,
      references: parsedReferences.data.length ? parsedReferences.data : undefined,
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
      setMediaKey(key => key + 1);
      setUploadedMuxVideos([]);
      setReferences([]);

      setTimeout(() => {
        router.push(sectionPath);
      }, 1500);

    } catch (error: any) {
      setIsMutationPending(false);
      setStatus({ type: 'error', message: `${error.message || 'Không thể lưu bài viết.'} Nội dung đã nhập vẫn được giữ lại. Vui lòng thử lưu lại.` });
    }
  };

  return (
        <div className="bg-white rounded-sm shadow-sm border border-[#D4C4A8] overflow-hidden p-8 sm:p-12 relative animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-bold text-[#2C1E16] mb-4 font-playfair">Thêm Bài Viết Mới</h1>
            <p className="text-[#5C4033] text-lg italic">
              Điền thông tin bên dưới để thêm một bài viết mới hoặc nộp dự án của nhóm.
            </p>
            <div className="w-24 h-[1px] bg-[#B8860B] mx-auto mt-6"></div>
          </div>
          
          <StatusMessage status={status} />

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="article-section" className="block text-lg font-bold text-[#2C1E16] mb-3 font-playfair">Chuyên mục *</label>
              <select 
                id="article-section"
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
              <label htmlFor="article-title" className="block text-lg font-bold text-[#2C1E16] mb-3 font-playfair">Tiêu đề bài viết / Tên dự án *</label>
              <div className="relative">
                <input 
                  required 
                  type="text" 
                  id="article-title"
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
                      aria-label="Đóng gợi ý tiêu đề"
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
              <label htmlFor="article-teamMembers" className="block text-lg font-bold text-[#2C1E16] mb-3 font-playfair flex items-center gap-2">
                Thành viên nhóm (Tùy chọn)
              </label>
              <input 
                type="text" 
                id="article-teamMembers"
                name="teamMembers" 
                value={formData.teamMembers} 
                onChange={handleChange} 
                className="w-full px-4 py-4 border-2 border-[#D4C4A8] rounded-lg focus:ring-2 focus:ring-[#B8860B] focus:border-[#B8860B] outline-none transition-all bg-[#F4EBD0] placeholder-[#8B3A3A]/50 text-[#2C1E16] font-playfair text-lg shadow-inner" 
                placeholder="Nguyễn Văn A, Trần Thị B..." 
              />
            </div>

            <div>
              <label htmlFor="article-description" className="block text-lg font-bold text-[#2C1E16] mb-3 font-playfair">Mô tả ngắn *</label>
              <input 
                required 
                type="text" 
                id="article-description"
                name="description" 
                value={formData.description} 
                onChange={handleChange} 
                className="w-full px-4 py-4 border-2 border-[#D4C4A8] rounded-lg focus:ring-2 focus:ring-[#B8860B] focus:border-[#B8860B] outline-none transition-all bg-[#F4EBD0] placeholder-[#8B3A3A]/50 text-[#2C1E16] font-playfair text-lg shadow-inner" 
                placeholder="Tóm tắt ngắn gọn (1-2 câu)..." 
              />
            </div>

            <div>
              <label htmlFor="article-fullDescription" className="block text-lg font-bold text-[#2C1E16] mb-3 font-playfair">Mô tả chi tiết</label>
              <textarea 
                id="article-fullDescription"
                name="fullDescription" 
                value={formData.fullDescription} 
                onChange={handleChange} 
                rows={8} 
                className="w-full px-4 py-4 border-2 border-[#D4C4A8] rounded-lg focus:ring-2 focus:ring-[#B8860B] focus:border-[#B8860B] outline-none transition-all bg-[#F4EBD0] placeholder-[#8B3A3A]/50 text-[#2C1E16] font-playfair text-lg shadow-inner leading-relaxed" 
                placeholder="Mô tả đầy đủ về tác phẩm, ý nghĩa, phân tích..."
              ></textarea>
            </div>

            <fieldset disabled={isMutationPending} className="space-y-4 min-w-0 scroll-mt-24">
              <legend className="text-lg font-bold text-[#2C1E16] mb-2">Nguồn tham khảo (Tùy chọn)</legend>
              <p className="text-sm text-[#5C4033]">Tối đa 20 nguồn, theo thứ tự hiển thị. Sách in không cần URL.</p>
              {references.map((reference, index) => (
                <fieldset key={reference.key} className="min-w-0 border border-[#D4C4A8] rounded-sm p-4 space-y-3">
                  <legend className="px-1 font-bold text-[#2C1E16]">Nguồn {index + 1}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    ['title', 'Tên nguồn *', 300],
                    ['url', 'URL (Tùy chọn)', 2048],
                    ['author', 'Tác giả / Cơ quan (Tùy chọn)', 200],
                    ['publisher', 'Nhà xuất bản / Ấn bản (Tùy chọn)', 200],
                  ] as const).map(([field, label, maxLength]) => {
                    const id = `reference-${reference.key}-${field}`;
                    const error = referenceErrors[`${index}.${field}`];
                    return (
                      <div key={field} className="min-w-0">
                        <label htmlFor={id} className="block text-sm font-bold text-[#2C1E16] mb-1">{label}</label>
                        <input id={id} type="text" inputMode={field === 'url' ? 'url' : 'text'}
                          maxLength={maxLength} value={reference[field] || ''} aria-required={field === 'title'}
                          aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
                          onChange={event => {
                            setReferences(references.map(item => item.key === reference.key ? { ...item, [field]: event.target.value } : item));
                            setReferenceErrors({});
                          }}
                          className="w-full min-w-0 px-3 py-2 border border-[#D4C4A8] rounded-sm bg-[#F4EBD0] text-[#2C1E16]" />
                        {error && <p id={`${id}-error`} role="alert" className="text-sm text-[#8B3A3A] mt-1">{error}</p>}
                      </div>
                    );
                  })}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#8B3A3A]">
                    {([-1, 1] as const).map(direction => (
                      <button key={direction} type="button" disabled={index + direction < 0 || index + direction >= references.length}
                        aria-label={`Chuyển nguồn ${index + 1} ${direction < 0 ? 'lên' : 'xuống'}`}
                        title={direction < 0 ? 'Chuyển lên' : 'Chuyển xuống'}
                        className="h-11 w-11 shrink-0 inline-flex items-center justify-center border border-[#D4C4A8] rounded-sm disabled:opacity-50"
                        onClick={() => {
                          const reordered = [...references];
                          [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
                          referenceFocus.current = `reference-${reference.key}-title`;
                          setReferences(reordered);
                          setReferenceErrors({});
                        }}>{direction < 0 ? <ArrowUp aria-hidden="true" className="h-4 w-4" /> : <ArrowDown aria-hidden="true" className="h-4 w-4" />}</button>
                    ))}
                    <button type="button" aria-label={`Xóa nguồn ${index + 1}`} className="ml-auto min-h-11 px-2 py-2 underline whitespace-nowrap"
                      onClick={() => {
                        referenceFocus.current = 'add-article-reference';
                        setReferences(references.filter(item => item.key !== reference.key));
                        setReferenceErrors({});
                      }}>Xóa nguồn</button>
                  </div>
                </fieldset>
              ))}
              <button id="add-article-reference" type="button" disabled={references.length >= 20}
                className="px-4 py-2 border border-[#8B3A3A] rounded-sm text-[#8B3A3A] disabled:opacity-50"
                onClick={() => {
                  const key = nextReferenceKey.current++;
                  referenceFocus.current = `reference-${key}-title`;
                  setReferences([...references, { key, title: '' }]);
                  setReferenceErrors({});
                }}>Thêm nguồn tham khảo</button>
            </fieldset>

            <MediaEditor key={mediaKey} images={images} setImages={setImages}
              uploadedMuxVideos={uploadedMuxVideos} setUploadedMuxVideos={setUploadedMuxVideos}
              setStatus={setStatus} onBusyChange={setMediaBusy} />

            <div className="pt-6">
              <button
                type="submit"
                disabled={isMutationPending || mediaBusy}
                className={`w-full bg-[#B8860B] text-[#FFFDF5] font-bold text-xl py-4 px-6 rounded-lg border-2 border-[#8B3A3A] transition-all duration-300 shadow-lg font-playfair flex justify-center items-center uppercase tracking-widest ${isMutationPending || mediaBusy ? 'opacity-70 cursor-not-allowed' : 'hover:bg-[#8B3A3A] hover:text-[#FFFDF5] hover:border-[#B8860B]'}`}
              >
                {isMutationPending || mediaBusy ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {mediaBusy ? 'Đợi tải phương tiện hoàn tất...' : 'Đang lưu bài viết...'}
                  </span>
                ) : 'Thêm Bài Viết'}
              </button>
            </div>
          </form>
        </div>
  );
}
