import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import type { MenuItem } from '../lib/types';
import { mnt } from '../lib/format';
import { SmartImage } from './ui';

/**
 * Editorial хоолны карт: зураг дээрээ, доор нь хайрцаггүй мэдээлэл.
 * Hover үед зураг зөөлөн ойртож, нэмэх тэмдэг илэрнэ.
 */
export function DishCard({ item, index = 0 }: { item: MenuItem; index?: number }) {
  const { slug = '' } = useParams();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8%' }}
      transition={{
        delay: Math.min(index, 8) * 0.06,
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <Link to={`/t/${slug}/item/${item.id}`} className="group block">
        <div className="relative aspect-4/3 overflow-hidden bg-paper">
          <SmartImage
            src={item.imageUrl}
            alt={item.name}
            className="size-full transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-ink/0 transition-colors duration-500 group-hover:bg-ink/10" />

          <span className="absolute right-4 bottom-4 grid size-10 translate-y-2 place-items-center rounded-full bg-bg text-ink opacity-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 group-hover:opacity-100">
            <Plus size={16} strokeWidth={1.5} />
          </span>

          {item.isPopular && (
            <span className="label absolute top-4 left-4 bg-bg px-2 py-1">Эрэлттэй</span>
          )}
        </div>

        <div className="rule mt-4 flex items-baseline justify-between gap-4 pt-3">
          <h3 className="text-[16px] tracking-[-0.02em]">{item.name}</h3>
          <span className="numeral shrink-0 text-[15px]">{mnt(item.price)}</span>
        </div>

        {item.description && (
          <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-muted">
            {item.description}
          </p>
        )}
      </Link>
    </motion.div>
  );
}
