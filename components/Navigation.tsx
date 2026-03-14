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
              <span className="text-[#B8860B] opacity-80 group-hover:rotate-12 transition-transform duration-300">❦</span>
              Nguyễn Trãi
            </Link>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-8">
            <Link 
              href="/admin" 
              className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-medium transition-all duration-300 font-playfair border-2 ${
                pathname === '/admin' 
                  ? 'bg-[#B8860B] text-[#2C1E16] border-[#B8860B] shadow-lg transform scale-105' 
                  : 'text-[#F4EBD0] border-transparent hover:border-[#B8860B] hover:text-[#B8860B] hover:bg-[#3E2723] hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              Thêm bài viết
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md hover:text-[#B8860B] hover:bg-[#3E2723] transition-colors focus:outline-none"
              aria-expanded={isOpen}
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? (
                <X className="block h-7 w-7 animate-in spin-in-90 duration-300" />
              ) : (
                <Menu className="block h-7 w-7 animate-in spin-in-[-90deg] duration-300" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 z-40 sm:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={() => setIsOpen(false)}
      />

      {/* Mobile Menu Panel */}
      <div 
        className={`fixed top-0 right-0 bottom-0 w-[80%] max-w-sm bg-[#3E2723] shadow-2xl z-50 sm:hidden transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex justify-between items-center p-6 border-b border-[#B8860B]/20">
          <span className="text-2xl font-bold font-playfair text-[#F4EBD0]">Menu</span>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-md hover:text-[#B8860B] hover:bg-[#2C1E16] transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          <Link
            href="/admin"
            onClick={() => setIsOpen(false)}
            className={`block mx-6 px-6 py-4 rounded-full text-lg font-medium font-playfair transition-all duration-300 text-center border-2 ${
              pathname === '/admin'
                ? 'bg-[#B8860B] text-[#2C1E16] border-[#B8860B] shadow-lg transform scale-105'
                : 'bg-transparent text-[#B8860B] border-[#B8860B] hover:bg-[#B8860B] hover:text-[#2C1E16] hover:shadow-md hover:-translate-y-0.5'
            }`}
          >
            Thêm bài viết mới
          </Link>
        </div>
      </div>
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
