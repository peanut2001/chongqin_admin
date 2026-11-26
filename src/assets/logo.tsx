import { type ImgHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import emblem from './images/hospital-logo.svg'

export const APP_NAME = '重庆医科大学附属第二医院'
export const APP_SHORT_NAME = '重医附二院'
export const APP_SUBTITLE = '智慧课程平台'

export function Logo({
  className,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src={emblem}
      alt={APP_NAME}
      className={cn('size-6 object-contain', className)}
      {...props}
    />
  )
}
