import { useRef } from 'react'
import { ImageUp, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { apiErrorTitle } from '@/lib/api/client'
import { useDeleteAvatar, useUploadAvatar } from '@/lib/api/me'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/user-avatar'

const MAX_SIZE = 1024 * 1024 // 1MB，与后端限制一致

/**
 * 头像上传：文件发送到后端保存。后端按文件内容判断类型（不看扩展名），
 * 这里的大小检查只是为了更快给出提示。
 */
export function AvatarUpload() {
  const inputRef = useRef<HTMLInputElement>(null)
  const hasAvatar = useAuthStore((s) => !!s.auth.user?.avatarUrl)
  const upload = useUploadAvatar()
  const remove = useDeleteAvatar()
  const busy = upload.isPending || remove.isPending

  const handleFile = (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_SIZE) {
      toast.error('图片不能超过 1MB。')
      return
    }
    upload.mutate(file, {
      onSuccess: () => toast.success('头像已更新'),
      onError: (err) => toast.error(apiErrorTitle(err, '头像上传失败。')),
    })
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
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? (
              <Loader2 className='animate-spin' />
            ) : (
              <ImageUp />
            )}
            上传头像
          </Button>
          {hasAvatar && (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              disabled={busy}
              onClick={() =>
                remove.mutate(undefined, {
                  onSuccess: () => toast.success('已恢复默认头像'),
                })
              }
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
            handleFile(e.target.files?.[0])
            // 清空，保证再次选择同一个文件也能触发
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
