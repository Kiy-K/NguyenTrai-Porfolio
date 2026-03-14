import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import SummarizeButton from '@/components/SummarizeButton';
import ShareButton from '@/components/ShareButton';

interface ProjectCardProps {
  id: string | number;
  title: string;
  description: string;
  imageUrl?: string;
  linkHref?: string;
  linkText?: string;
  tags?: string[];
}

export default function ProjectCard({ 
  id, 
  title, 
  description, 
  imageUrl,
  linkHref,
  linkText = 'Xem chi tiết',
  tags = []
}: ProjectCardProps) {
  const href = linkHref || `/products/${id}`;

  return (
    <div className="group/card bg-white rounded-sm overflow-hidden shadow-sm hover:shadow-[0_20px_40px_rgb(139,58,58,0.15)] hover:-translate-y-2 transition-all duration-500 ease-out flex flex-col h-full font-playfair border border-[#D4C4A8]">
      <Link href={href} className="block relative overflow-hidden">
        {/* Project Image */}
        <div className="relative h-56 w-full overflow-hidden bg-[#F4EBD0] flex items-center justify-center border-b border-[#D4C4A8]">
          {imageUrl ? (
            <>
              <Image
                src={imageUrl}
                alt={title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover group-hover/card:scale-110 transition-transform duration-700 ease-out"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/20 group-hover/card:bg-black/0 transition-colors duration-500" />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center transform group-hover/card:scale-110 transition-transform duration-700 ease-out">
              <div className="text-[#B8860B] font-playfair italic text-xl mb-2">Nguyễn Trãi</div>
            </div>
          )}
        </div>
      </Link>
      
      {/* Project Details */}
      <div className="p-6 flex flex-col flex-grow relative">
        <Link href={href} className="group/title block mb-3">
          <h3 className="text-xl font-bold text-[#2C1E16] group-hover/title:text-[#8B3A3A] transition-colors font-playfair leading-tight">
            {title}
          </h3>
        </Link>
        
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag, index) => (
              <span 
                key={index} 
                className="inline-flex items-center px-2 py-1 text-xs font-bold uppercase tracking-wider bg-[#F4EBD0] text-[#8B3A3A] border border-[#D4C4A8]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        
        <div className="relative mb-6">
          <p className="text-base text-[#5C4033] line-clamp-3 leading-relaxed font-playfair">
            {description}
          </p>
        </div>
        
        <SummarizeButton text={description} compact={true} />
        
        <div className="mt-auto pt-4 border-t border-[#D4C4A8] flex items-center justify-between text-sm font-bold text-[#8B3A3A] uppercase tracking-wider font-playfair">
          <Link href={href} className="group/link inline-flex items-center hover:text-[#B8860B] transition-colors">
            <span className="relative after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 after:bg-[#B8860B] after:transition-all after:duration-300 group-hover/link:after:w-full">
              {linkText}
            </span>
            <ChevronRight className="ml-1 w-4 h-4 group-hover/link:translate-x-1 transition-transform duration-300" />
          </Link>
          <ShareButton url={href} />
        </div>
      </div>
    </div>
  );
}
