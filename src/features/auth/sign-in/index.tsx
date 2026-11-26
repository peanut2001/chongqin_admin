import { useSearch } from '@tanstack/react-router'
import hospitalEmblem from '@/assets/images/hospital-logo.svg'
import hospitalLogo from '@/assets/images/hospital_logo.svg'
import loginBg from '@/assets/images/login-bg.png'
import { APP_NAME, APP_SUBTITLE } from '@/assets/logo'
import { UserAuthForm } from './components/user-auth-form'

/** 用单色图片做遮罩，配合 bg-* 给图标任意着色 */
function maskStyle(url: string): React.CSSProperties {
  return {
    maskImage: `url(${url})`,
    maskRepeat: 'no-repeat',
    maskSize: 'contain',
    WebkitMaskImage: `url(${url})`,
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: 'contain',
  }
}

/** 圆角三角形（朝右），用描边 + round linejoin 实现圆角；颜色跟随 currentColor */
function RoundedTriangle({
  className,
  opacity,
}: {
  className?: string
  opacity: number
}) {
  return (
    <svg
      viewBox='0 0 100 100'
      className={className}
      style={{ opacity }}
      aria-hidden
    >
      <polygon
        points='14,8 92,50 14,92'
        fill='currentColor'
        stroke='currentColor'
        strokeWidth='14'
        strokeLinejoin='round'
      />
    </svg>
  )
}

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <div className='relative flex min-h-svh items-center justify-center bg-muted/40 p-4 sm:p-8'>
      {/* 页面背景图（浅色模式），深色模式下隐藏沿用 muted 底色 */}
      <img
        src={loginBg}
        alt=''
        aria-hidden
        className='pointer-events-none absolute inset-0 size-full object-cover object-bottom select-none dark:hidden'
      />
      <div className='relative flex w-full max-w-[68rem] overflow-hidden rounded-2xl border border-white/70 bg-card shadow-[0_30px_80px_-24px_rgba(24,79,149,0.35)] lg:h-[min(680px,calc(100svh-4rem))] lg:bg-primary lg:bg-linear-135 lg:from-[#2b6bb8] lg:to-[#153f7a] dark:border-border dark:shadow-sm dark:lg:bg-muted dark:lg:bg-none'>
        {/* 右侧品牌区底纹：复用页面背景图，以柔光叠加，让波浪延续进卡片 */}
        <img
          src={loginBg}
          alt=''
          aria-hidden
          className='pointer-events-none absolute inset-0 hidden size-full object-cover object-bottom opacity-50 mix-blend-soft-light select-none lg:block dark:hidden'
        />
        {/* 右侧品牌区：主题主色 + 低透明度层叠三角 */}
        <div
          aria-hidden
          className='absolute inset-y-0 right-0 hidden w-[52%] items-center justify-center text-primary-foreground lg:flex dark:text-foreground'
        >
          <div className='relative aspect-square w-[76%] max-w-[450px]'>
            <RoundedTriangle
              opacity={0.06}
              className='absolute inset-0 translate-x-[10%] -translate-y-[6%] rotate-[-14deg]'
            />
            <RoundedTriangle
              opacity={0.05}
              className='absolute inset-0 translate-x-[16%] translate-y-[8%] rotate-[10deg]'
            />
            <RoundedTriangle
              opacity={0.08}
              className='absolute inset-0 -translate-x-[2%] rotate-[-4deg]'
            />
          </div>
          {/* 院徽 + 平台名，斜切边右侧可视区内居中；院徽原为蓝色，用 mask 着色为文字色 */}
          <div className='absolute top-1/2 left-[57%] flex w-[70%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center'>
            <div
              className='aspect-[432/320] w-48 bg-current'
              style={maskStyle(hospitalEmblem)}
            />
            <div className='mt-8 text-4xl font-bold tracking-[0.15em]'>
              {APP_SUBTITLE}
            </div>
            <div className='mt-3 text-xs tracking-[0.3em] uppercase opacity-60'>
              Smart Medical Education Platform
            </div>
            <div className='my-4 h-px w-10 bg-current opacity-40' />
            <div className='text-base tracking-[0.2em] opacity-80'>
              智慧教学 · 数字赋能
            </div>
          </div>
        </div>

        {/* 左侧面板：旋转的大圆角方块形成斜切边 */}
        <div
          aria-hidden
          className='absolute right-[38%] bottom-[18%] hidden size-[1800px] origin-bottom-right -rotate-[22deg] rounded-[3rem] bg-card shadow-lg lg:block'
        />

        {/* 登录表单 */}
        <div className='relative z-10 flex w-full flex-col justify-center px-6 py-10 sm:px-12 lg:w-[44%] lg:px-16'>
          <div className='mx-auto w-full max-w-md'>
            {/* 横版院标（院徽 + 中英文院名）。原文件为白色，用 mask 着色以适配浅色面板 */}
            <div
              role='img'
              aria-label={APP_NAME}
              className='aspect-[479/56] w-full max-w-[360px] bg-[#1f58a5] dark:bg-foreground'
              style={maskStyle(hospitalLogo)}
            />
            <h1 className='mt-10 text-3xl font-bold tracking-tight'>
              欢迎登录
            </h1>
            <p className='mt-2 mb-8 text-sm text-muted-foreground'>
              登录{APP_SUBTITLE}，开启您的学习之旅
            </p>

            <UserAuthForm redirectTo={redirect} />

            <p className='mt-6 text-center text-xs text-muted-foreground'>
              点击登录即表示你同意我们的{' '}
              <a
                href='/terms'
                className='underline underline-offset-4 hover:text-primary'
              >
                服务条款
              </a>{' '}
              和{' '}
              <a
                href='/privacy'
                className='underline underline-offset-4 hover:text-primary'
              >
                隐私政策
              </a>
              。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
