import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { AxiosError } from 'axios'
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { setSessionExpiredHandler } from '@/lib/api/client'
import { handleServerError } from '@/lib/handle-server-error'
import { DirectionProvider } from './context/direction-provider'
import { FontProvider } from './context/font-provider'
import { ThemeProvider } from './context/theme-provider'
// Generated Routes
import { routeTree } from './routeTree.gen'
// Styles
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // eslint-disable-next-line no-console
        if (import.meta.env.DEV) console.log({ failureCount, error })

        if (failureCount >= 0 && import.meta.env.DEV) return false
        if (failureCount > 3 && import.meta.env.PROD) return false

        return !(
          error instanceof AxiosError &&
          [401, 403].includes(error.response?.status ?? 0)
        )
      },
      refetchOnWindowFocus: import.meta.env.PROD,
      staleTime: 10 * 1000, // 10s
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // meta.silent：由表单自行展示字段错误；401 由 API 拦截器统一处理
      if (mutation.meta?.silent) return
      if (error instanceof AxiosError && error.response?.status === 401) return
      handleServerError(error)

      if (error instanceof AxiosError) {
        if (error.response?.status === 304) {
          toast.error('内容未修改！')
        }
      }
    },
  }),
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof AxiosError) {
        // 401 由 src/lib/api/client.ts 的拦截器统一处理（自动刷新 / 会话失效跳转）
        if (error.response?.status === 500) {
          toast.error('服务器内部错误！')
          // Only navigate to error page in production to avoid disrupting HMR in development
          if (import.meta.env.PROD) {
            router.navigate({ to: '/500' })
          }
        }
        if (error.response?.status === 403) {
          // router.navigate("/forbidden", { replace: true });
        }
      }
    },
  }),
})

// Create a new router instance
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

// 头像已改为保存在后端；清理旧版存在浏览器 localStorage 里的头像数据
localStorage.removeItem('user_avatars')

// 会话失效（refresh 失败、账号被停用、令牌被吊销）：清缓存并回到登录页
setSessionExpiredHandler((reason) => {
  queryClient.clear()
  const { pathname, href } = router.history.location
  if (pathname.startsWith('/sign-in')) return
  toast.error(reason ?? '登录已失效，请重新登录。')
  router.navigate({ to: '/sign-in', search: { redirect: href } })
})

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { silent?: boolean }
  }
}

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Render the app
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <FontProvider>
            <DirectionProvider>
              <RouterProvider router={router} />
            </DirectionProvider>
          </FontProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
