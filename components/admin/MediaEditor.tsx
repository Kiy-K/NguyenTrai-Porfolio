'use client';

import { useState, useRef, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { UploadCloud, X } from 'lucide-react';
import Image from 'next/image';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import MuxVideoPlayer from '@/components/MuxVideoPlayer';
import type { AdminStatus, UploadedMuxVideo } from '@/components/admin/types';

interface Props {
  images: string[];
  setImages: Dispatch<SetStateAction<string[]>>;
  uploadedMuxVideos: UploadedMuxVideo[];
  setUploadedMuxVideos: Dispatch<SetStateAction<UploadedMuxVideo[]>>;
  setStatus: Dispatch<SetStateAction<AdminStatus>>;
  onBusyChange: Dispatch<SetStateAction<boolean>>;
}

export default function MediaEditor({ images, setImages, uploadedMuxVideos, setUploadedMuxVideos, setStatus, onBusyChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isVideoDragging, setIsVideoDragging] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const pollRetryCountRef = useRef(0);
  const stallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkPollRef = useRef<(() => void) | null>(null);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [dragOverImageIndex, setDragOverImageIndex] = useState<number | null>(null);
  const [imageToRemove, setImageToRemove] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const videoGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const imageControllerRef = useRef<AbortController | null>(null);
  const imageBusyRef = useRef(false);
  const [imageProgress, setImageProgress] = useState({ completed: 0, total: 0 });

  useEffect(() => {
    onBusyChange(isUploading || isImageUploading);
  }, [isUploading, isImageUploading, onBusyChange]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      videoGenerationRef.current = -1;
      xhrRef.current?.abort();
      imageControllerRef.current?.abort();
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
      checkPollRef.current = null;
    };
  }, []);

  // Warn user if they try to leave while an upload is in progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading || isImageUploading) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUploading, isImageUploading]);

  // Mux video upload state
  const [muxUploadState, setMuxUploadState] = useState<'idle' | 'uploading' | 'processing' | 'error'>('idle');
  const [muxUploadProgress, setMuxUploadProgress] = useState(0);

  // Resume polling immediately when user switches back to this tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && muxUploadState === 'processing') {
        if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
        checkPollRef.current?.();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [muxUploadState]);

  const cancelUpload = () => {
    videoGenerationRef.current++;
    xhrRef.current?.abort();
    xhrRef.current = null;
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
    checkPollRef.current = null;
    pollRetryCountRef.current = 0;
    setMuxUploadState('idle');
    setMuxUploadProgress(0);
    setIsUploading(false);
    setStatus({ type: null, message: '' });
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

  const uploadWithRetry = async (file: File, attempt = 1): Promise<string> => {
    const controller = new AbortController();
    imageControllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30_000); // 30s per image
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('resourceType', 'image');
      const res = await fetch('/api/upload', { method: 'POST', body: fd, signal: controller.signal });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      return data.secure_url;
    } catch (err: any) {
      if (mountedRef.current && attempt < 3 && err.name !== 'AbortError') {
        await new Promise(r => setTimeout(r, 2000 * attempt)); // 2s, 4s backoff
        if (!mountedRef.current) throw err;
        return uploadWithRetry(file, attempt + 1);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  };

  const processFiles = async (files: File[]) => {
    if (imageBusyRef.current) return;
    if (files.length === 0) {
      setStatus({ type: 'error', message: 'Vui lòng chọn tệp hình ảnh JPG, PNG hoặc GIF (tối đa 10MB/ảnh).' });
      return;
    }
    const validFiles = files.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        setStatus({ type: 'error', message: `File ${file.name} vượt quá dung lượng 10MB và sẽ bị bỏ qua.` });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    imageBusyRef.current = true;
    setIsImageUploading(true);
    setImageProgress({ completed: 0, total: validFiles.length });
    const failed: string[] = [];
    const uploaded: string[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      if (!mountedRef.current) return;
      const file = validFiles[i];
      setStatus({ type: 'loading', message: `Đang tải ảnh ${i + 1}/${validFiles.length}: ${file.name}` });
      try {
        const url = await uploadWithRetry(file);
        if (!mountedRef.current) return;
        uploaded.push(url);
        setImages(prev => [...prev, url]); // add each image as it finishes
      } catch {
        if (!mountedRef.current) return;
        failed.push(file.name);
      }
      setImageProgress({ completed: i + 1, total: validFiles.length });
    }

    imageBusyRef.current = false;
    setIsImageUploading(false);

    if (failed.length === 0) {
      setStatus({ type: 'success', message: `Tải lên thành công ${uploaded.length} ảnh!` });
    } else if (uploaded.length > 0) {
      setStatus({ type: 'error', message: `Tải lên ${uploaded.length} ảnh thành công. Thất bại: ${failed.join(', ')}` });
    } else {
      setStatus({ type: 'error', message: `Tải ảnh lên thất bại: ${failed.join(', ')}` });
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
    pollRetryCountRef.current = 0;

    const generation = videoGenerationRef.current;
    let inFlight = false;
    const check = async () => {
      if (generation !== videoGenerationRef.current || inFlight) return;
      inFlight = true;
      try {
        const res = await fetch(`/api/mux/asset/${uploadId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (generation !== videoGenerationRef.current) return;
        pollRetryCountRef.current = 0; // reset on success

        if (data.status === 'ready') {
          setUploadedMuxVideos((prev) => [
            ...prev,
            { muxPlaybackId: data.playbackId, muxAssetId: data.assetId },
          ]);
          setMuxUploadState('idle');
          setMuxUploadProgress(0);
          setStatus({ type: 'success', message: 'Video đã sẵn sàng! Bạn có thể tải thêm video.' });

          setIsUploading(false);
          return;
        }

        if (data.status === 'error') {
          setMuxUploadState('error');
          setStatus({ type: 'error', message: 'Mux xử lý video thất bại' });
          setIsUploading(false);
          return;
        }

        // Still processing — schedule next check
        pollTimeoutRef.current = setTimeout(check, 3000);
      } catch {
        if (generation !== videoGenerationRef.current) return;
        pollRetryCountRef.current++;
        if (pollRetryCountRef.current >= 4) {
          setMuxUploadState('error');
          setStatus({ type: 'error', message: 'Mất kết nối khi kiểm tra trạng thái video. Vui lòng thử lại.' });
          setIsUploading(false);
          return;
        }
        // Retry with backoff: 5s, 10s, 15s
        const delay = 5000 * pollRetryCountRef.current;
        setStatus({ type: 'loading', message: `Mất kết nối, thử lại sau ${delay / 1000}s... (lần ${pollRetryCountRef.current}/3)` });
        pollTimeoutRef.current = setTimeout(check, delay);
      } finally {
        inFlight = false;
      }
    };

    checkPollRef.current = check;
    check();
  };

  const processVideo = async (file?: File) => {
    if (isUploading) return;
    if (!file) {
      setStatus({ type: 'error', message: 'Vui lòng chọn một tệp video (MP4, WebM hoặc MOV).' });
      return;
    }
    const generation = ++videoGenerationRef.current;

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
      if (generation !== videoGenerationRef.current) return;

      // Step 2: PUT the file directly to Mux (bypasses our server — handles large files fine)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        // Stall detection: if no progress for 60s, warn (but keep uploading)
        const resetStall = () => {
          if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
          stallTimeoutRef.current = setTimeout(() => {
            setStatus({ type: 'loading', message: 'Kết nối chậm — đang tiếp tục tải lên, vui lòng đợi...' });
          }, 60_000);
        };
        resetStall();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && generation === videoGenerationRef.current) {
            setMuxUploadProgress(Math.round((e.loaded / e.total) * 100));
            resetStall();
          }
        });
        xhr.addEventListener('load', () => {
          if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload thất bại: HTTP ${xhr.status}`));
        });
        xhr.addEventListener('error', () => {
          if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
          reject(new Error('Lỗi mạng khi upload'));
        });
        xhr.addEventListener('abort', () => {
          if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
          reject(new Error('Upload đã bị hủy'));
        });
        xhr.open('PUT', uploadUrl);
        xhr.send(file);
      });

      if (generation !== videoGenerationRef.current) return;
      xhrRef.current = null;
      setMuxUploadProgress(100);
      setMuxUploadState('processing');
      setStatus({ type: 'loading', message: 'Video đã tải lên, đang xử lý...' });

      // Step 3: Poll until the asset is ready
      pollMuxStatus(uploadId);
    } catch (error: any) {
      if (generation !== videoGenerationRef.current) return;
      xhrRef.current = null;
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

  return (<>
            <div>
              <label htmlFor="admin-images" className="block text-lg font-bold text-[#2C1E16] mb-3 font-playfair">Hình ảnh (Tùy chọn - Kéo thả hoặc chọn ảnh)</label>
              
              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging ? 'border-[#B8860B] bg-[#E8D8B8]' : 'border-[#D4C4A8] hover:border-[#B8860B] bg-[#F4EBD0]'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                aria-label="Chọn hình ảnh"
                aria-disabled={isImageUploading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  multiple 
                  id="admin-images"
                  accept="image/*" 
                  className="hidden" 
                  aria-label="Chọn hình ảnh"
                  disabled={isImageUploading}
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                />
                <UploadCloud className={`mx-auto h-12 w-12 mb-4 ${isDragging ? 'text-[#B8860B]' : 'text-[#8B3A3A]/50'}`} />
                <p className="text-base text-[#5C4033] font-medium mb-1 font-playfair">
                  Kéo thả hình ảnh vào đây, hoặc <span className="text-[#8B3A3A] cursor-pointer hover:underline font-bold">nhấn để chọn</span>
                </p>
                <p className="text-sm text-[#5C4033]/70 italic">Hỗ trợ JPG, PNG, GIF (Tối đa 10MB/ảnh)</p>
              </div>

              {isImageUploading && (
                <p role="status" className="mt-3 text-sm text-[#5C4033]">
                  Đã xử lý {imageProgress.completed}/{imageProgress.total} ảnh. Mỗi ảnh tải thành công sẽ xuất hiện bên dưới.
                </p>
              )}

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
                        alt={`Ảnh đã tải ${index + 1}`} 
                        fill 
                        className="object-cover"
                      />
                      <button
                        type="button"
                        aria-label={`Xóa ảnh ${index + 1}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(index);
                        }}
                        className="absolute top-2 right-2 bg-white/80 hover:bg-red-500 hover:text-white text-gray-700 p-1.5 rounded-full backdrop-blur-sm transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
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
              <label htmlFor="admin-video" className="block text-lg font-bold text-[#2C1E16] mb-3 font-playfair">
                Video (Tùy chọn — Tải lên qua Mux, có thể thêm nhiều video)
              </label>

              {uploadedMuxVideos.length > 0 && (
                <div className="mb-4 space-y-3">
                  <p className="text-sm font-bold text-[#5C4033] font-playfair">
                    Đã tải {uploadedMuxVideos.length} video:
                  </p>
                  {uploadedMuxVideos.map((item, index) => (
                    <div key={`${item.muxPlaybackId}-${index}`} className="rounded-lg overflow-hidden bg-black aspect-video relative border-4 border-[#2C1E16] shadow-xl">
                      <button
                        type="button"
                        onClick={() =>
                          setUploadedMuxVideos((prev) =>
                            prev.filter((_, itemIndex) => itemIndex !== index)
                          )
                        }
                        className="absolute top-2 right-2 z-10 bg-white/90 text-red-700 px-2 py-1 rounded text-xs font-bold hover:bg-red-700 hover:text-white transition-colors"
                      >
                        Xóa
                      </button>
                      <MuxVideoPlayer playbackId={item.muxPlaybackId} />
                    </div>
                  ))}
                </div>
              )}

              {muxUploadState === 'idle' && (
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                    isVideoDragging ? 'border-[#B8860B] bg-[#E8D8B8]' : 'border-[#D4C4A8] hover:border-[#B8860B] bg-[#F4EBD0]'
                  }`}
                  onDragOver={handleVideoDragOver}
                  onDragLeave={handleVideoDragLeave}
                  onDrop={handleVideoDrop}
                  role="button"
                tabIndex={0}
                aria-label="Chọn video"
                aria-disabled={isUploading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    videoInputRef.current?.click();
                  }
                }}
                onClick={() => videoInputRef.current?.click()}
                >
                  <input
                    type="file"
                    id="admin-video"
                    accept="video/*"
                    className="hidden"
                    aria-label="Chọn video"
                  disabled={isUploading}
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
                  <progress aria-label="Tiến độ tải video" value={muxUploadProgress} max={100}
                    className="block w-full h-3 mb-2 accent-[#B8860B]">
                    {muxUploadProgress}%
                  </progress>
                  <p className="text-sm text-[#5C4033] text-center font-playfair mb-4">{muxUploadProgress}%</p>
                  <p className="text-xs text-[#5C4033]/70 text-center italic mb-3">Vui lòng không đóng tab này trong khi tải lên.</p>
                  <div className="text-center">
                    <button type="button" onClick={cancelUpload} className="text-sm text-red-600 hover:text-red-800 font-bold underline transition-colors">
                      Hủy upload
                    </button>
                  </div>
                </div>
              )}

              {muxUploadState === 'processing' && (
                <div className="border-2 border-[#D4C4A8] rounded-lg p-8 bg-[#F4EBD0] text-center">
                  <svg className="animate-spin mx-auto h-10 w-10 text-[#B8860B] mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-base font-bold text-[#2C1E16] font-playfair">Mux đang xử lý video...</p>
                  <p className="text-sm text-[#5C4033] italic mt-1 mb-4">Quá trình này có thể mất vài phút. Bạn có thể để tab này chạy nền.</p>
                  <button type="button" onClick={cancelUpload} className="text-sm text-red-600 hover:text-red-800 font-bold underline transition-colors">
                    Hủy và chọn video khác
                  </button>
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

      {/* Modal Xóa Ảnh */}
      {imageToRemove !== null && (
        <ConfirmDialog titleId="remove-image-title" onCancel={() => setImageToRemove(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full mx-auto border border-[#D4C4A8] animate-in zoom-in-95 duration-200">
            <h3 id="remove-image-title" className="text-xl font-bold text-[#2C1E16] mb-4 font-playfair text-center">Xóa Ảnh</h3>
            <p className="text-[#5C4033] mb-6 text-center">
              Bạn có chắc chắn muốn xóa ảnh này không?
            </p>
            <div className="flex justify-center gap-4">
              <button
                type="button"
                data-dialog-cancel
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
        </ConfirmDialog>
      )}
  </>);
}
