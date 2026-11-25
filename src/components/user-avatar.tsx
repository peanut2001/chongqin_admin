import { useAuthStore } from '@/stores/auth-store'
import { roleDefaultAvatars } from '@/lib/permissions'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type UserAvatarProps = {
  className?: string
  fallbackClassName?: string
}

/**
 * 当前登录用户的头像：优先显示自己上传的图片，其次是角色默认头像，
 * 图片加载失败时显示名字首字母。
 * 注意：头像必须通过 <img> 渲染（AvatarImage），不能把 SVG 内容直接插入页面，
 * <img> 中的 SVG 不会执行脚本，但 CSS / SMIL 动画仍会正常播放。
 */
export function UserAvatar({ className, fallbackClassName }: UserAvatarProps) {
  const user = useAuthStore((s) => s.auth.user)
  // 头像地址来自后端（/api/media/avatars/<id>），未上传时用角色默认头像
  const src =
    user?.avatarUrl ?? (user ? roleDefaultAvatars[user.role] : undefined)
  const initial = (user?.name || '?').charAt(0).toUpperCase()

  return (
    <Avatar className={className}>
      {src && (
        <AvatarImage
          src={src}
          alt={user?.name ?? '头像'}
          className='object-cover'
        />
      )}
      <AvatarFallback className={fallbackClassName}>{initial}</AvatarFallback>
    </Avatar>
  )
}
