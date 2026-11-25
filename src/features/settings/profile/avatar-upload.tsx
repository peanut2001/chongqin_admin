import { useRef } from 'react'
import { ImageUp, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { useAvatarStore } from '@/stores/avatar-store'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/user-avatar'

const MAX_SIZE = 1024 * 1024 // 1MB
const ACCEPT_TYPES = [
  'image/svg+xml',
  'image/gif',
  'image/png',
  'image/jpeg',
  'image/webp',
]
const ACCEPT_EXTENSIONS = /\.(svg|gif|png|jpe?g|webp)$/i

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function AvatarUpload() {
  const inputRef = useRef<HTMLInputElement>(null)
  const userId = useAuthStore((s) => s.auth.user?.id)
  const hasAvatar = useAvatarStore((s) => !!(userId && s.avatars[userId]))
  const setAvatar = useAvatarStore((s) => s.setAvatar)
  const removeAvatar = useAvatarStore((s) => s.removeAvatar)

  const handleFile = async (file: File | undefined) => {
    if (!file || !userId) return

    // 部分系统不会给 .svg 文件填写 MIME 类型，所以同时按扩展名判断
    if (
      !ACCEPT_TYPES.includes(file.type) &&
      !ACCEPT_EXTENSIONS.test(file.name)
    ) {
      toast.error('仅支持 SVG、GIF、PNG、JPG、WebP 格式的图片。')
      return
    }
    if (file.size > MAX_SIZE) {
      toast.error('图片不能超过 1MB。')
      return
    }

    let dataUrl = await readAsDataUrl(file)
    // 没有 MIME 类型的 SVG 会被读成 application/octet-stream，<img> 无法显示，这里修正
    if (
      /\.svg$/i.test(file.name) &&
      !dataUrl.startsWith('data:image/svg+xml')
    ) {
      dataUrl = dataUrl.replace(/^data:[^;]*;/, 'data:image/svg+xml;')
    }

    if (setAvatar(userId, dataUrl)) {
      toast.success('头像已更新')
    } else {
      toast.error('浏览器存储空间不足，请换一张更小的图片。')
    }
  }

  return (
    <div className='flex items-center gap-6'>
      <UserAvatar className='size-20' fallbackClassName='text-2xl' />
      <div className='space-y-2'>
        <div className='flex gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => inputRef.current?.click()}
          >
            <ImageUp /> 上传头像
          </Button>
          {hasAvatar && (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => {
                if (userId) removeAvatar(userId)
                toast.success('已恢复默认头像')
              }}
            >
              <RotateCcw /> 恢复默认
            </Button>
          )}
        </div>
        <p className='text-xs text-muted-foreground'>
          支持 SVG（含动画）、GIF、PNG、JPG、WebP，不超过 1MB。
        </p>
        <input
          ref={inputRef}
          type='file'
          accept='.svg,image/svg+xml,image/gif,image/png,image/jpeg,image/webp'
          className='hidden'
          onChange={(e) => {
            void handleFile(e.target.files?.[0])
            // 清空，保证再次选择同一个文件也能触发
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
