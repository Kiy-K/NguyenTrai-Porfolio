'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, Suspense, useRef } from 'react';
import { Menu, X } from 'lucide-react';

function NavigationContent() {
  const pathname = usePathname();
  
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const menuRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const breakpoint = window.matchMedia('(min-width: 640px)');
    const closeOnDesktop = () => { if (breakpoint.matches) menuRef.current?.close(); };
    breakpoint.addEventListener('change', closeOnDesktop);
    return () => breakpoint.removeEventListener('change', closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      setScrolled(currentScrollY > 20);
      
      if (currentScrollY > lastScrollY.current && currentScrollY > 80 && !isOpen) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      lastScrollY.current = currentScrollY;
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isOpen]);

  return (
    <nav className={`bg-[#2C1E16] text-[#F4EBD0] sticky z-50 font-playfair transition-all duration-300 ${scrolled ? 'shadow-lg py-0' : 'shadow-md py-1'} ${isVisible ? 'top-0' : '-top-24'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="text-3xl font-bold font-playfair tracking-wide hover:text-[#B8860B] transition-colors flex items-center gap-2 group">
              <span className="text-[#B8860B] opacity-80 motion-safe:group-hover:rotate-12 transition-transform duration-300">❦</span>
              Nguyễn Trãi
            </Link>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-8">
            <Link
              href="/admin" 
              className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-medium transition-all duration-300 font-playfair border-2 ${
                pathname === '/admin' 
                  ? 'bg-[#B8860B] text-[#2C1E16] border-[#B8860B] shadow-lg transform scale-105' 
                  : 'text-[#F4EBD0] border-transparent hover:border-[#B8860B] hover:text-[#B8860B] hover:bg-[#3E2723] hover:shadow-md motion-safe:hover:-translate-y-0.5'
              }`}
            >
              Thêm bài viết
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => { menuRef.current?.showModal(); setIsOpen(true); }}
              className="inline-flex items-center justify-center p-2 rounded-md hover:text-[#B8860B] hover:bg-[#3E2723] transition-colors"
              aria-expanded={isOpen}
              aria-controls="main-navigation-menu"
              aria-haspopup="dialog"
            >
              <span className="sr-only">Mở trình đơn chính</span>
              {isOpen ? (
                <X className="block h-7 w-7 motion-safe:animate-in motion-safe:spin-in-90 duration-200" />
              ) : (
                <Menu className="block h-7 w-7 motion-safe:animate-in motion-safe:spin-in-[-90deg] duration-200" />
              )}
            </button>
          </div>
        </div>
      </div>

      <dialog
        ref={menuRef}
        id="main-navigation-menu"
        aria-label="Trình đơn chính"
        onClose={() => setIsOpen(false)}
        onClick={event => {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
            event.currentTarget.close();
          }
        }}
        className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-[80vw] max-w-sm border-0 p-0 bg-[#3E2723] text-[#F4EBD0] shadow-2xl backdrop:bg-black/50 open:flex flex-col sm:hidden"
      >
        <div className="flex justify-between items-center p-6 border-b border-[#B8860B]/20">
          <span className="text-2xl font-bold font-playfair text-[#F4EBD0]">Menu</span>
          <button
            onClick={() => menuRef.current?.close()}
            aria-label="Đóng trình đơn"
            className="p-2 rounded-md hover:text-[#B8860B] hover:bg-[#2C1E16] transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          <Link
            href="/admin"
            onClick={() => menuRef.current?.close()}
            className={`block mx-6 px-6 py-4 rounded-full text-lg font-medium font-playfair transition-all duration-300 text-center border-2 ${
              pathname === '/admin'
                ? 'bg-[#B8860B] text-[#2C1E16] border-[#B8860B] shadow-lg transform scale-105'
                : 'bg-transparent text-[#B8860B] border-[#B8860B] hover:bg-[#B8860B] hover:text-[#2C1E16] hover:shadow-md motion-safe:hover:-translate-y-0.5'
            }`}
          >
            Thêm bài viết mới
          </Link>
        </div>
      </dialog>
    </nav>
  );
}

export default function Navigation() {
  return (
    <Suspense fallback={<nav className="bg-[#2C1E16] h-20 w-full sticky top-0 z-50"></nav>}>
      <NavigationContent />
    </Suspense>
  );
}
