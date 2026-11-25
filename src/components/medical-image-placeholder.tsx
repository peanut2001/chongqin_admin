import { FileImage } from 'lucide-react'
import { cn } from '@/lib/utils'

type MedicalImagePlaceholderProps = {
  label?: string
  className?: string
  children?: React.ReactNode
}

/**
 * 医学影像占位图（暂无真实影像资源时使用）
 * children 可用于叠加标注框等内容
 */
export function MedicalImagePlaceholder({
  label,
  className,
  children,
}: MedicalImagePlaceholderProps) {
  return (
    <div
      className={cn(
        'relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-[radial-gradient(circle_at_50%_45%,#52525b_0%,#27272a_45%,#09090b_100%)] text-zinc-400',
        className
      )}
    >
      <div className='flex flex-col items-center gap-1 text-xs'>
        <FileImage className='size-8 opacity-60' />
        {label && <span className='opacity-80'>{label}</span>}
      </div>
      {children}
    </div>
  )
}
