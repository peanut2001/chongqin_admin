import {
  // Construction,
  LayoutDashboard,
  // Bug,
  // ListTodo,
  // FileX,
  // HelpCircle,
  // Lock,
  // Package,
  Palette,
  // ServerOff,
  Settings,
  Wrench,
  UserCog,
  // UserX,
  Users,
  School,
  CalendarRange,
  // MessagesSquare,
  // ShieldCheck,
  FolderHeart,
  ClipboardList,
  ScanEye,
  ChartNoAxesCombined,
  Bot,
} from 'lucide-react'
import { APP_NAME, APP_SUBTITLE, Logo } from '@/assets/logo'
import { type SidebarData } from '../types'

// 菜单的角色可见性由 src/lib/permissions.ts 的路由规则统一控制
export const sidebarData: SidebarData = {
  teams: [
    {
      name: APP_NAME,
      logo: Logo,
      plan: APP_SUBTITLE,
    },
  ],
  navGroups: [
    {
      title: '通用',
      items: [
        {
          title: '教学总览',
          url: '/',
          icon: LayoutDashboard,
        },
        // ===== 模板示例功能，暂时隐藏 =====
        // {
        //   title: '任务',
        //   url: '/tasks',
        //   icon: ListTodo,
        // },
        // {
        //   title: '应用',
        //   url: '/apps',
        //   icon: Package,
        // },
        // {
        //   title: '聊天',
        //   url: '/chats',
        //   badge: '3',
        //   icon: MessagesSquare,
        // },
        {
          title: '用户',
          url: '/users',
          icon: Users,
        },
        {
          title: '班级',
          url: '/classes',
          icon: School,
        },
        {
          title: '学期',
          url: '/semesters',
          icon: CalendarRange,
        },
      ],
    },
    {
      title: '智慧课程',
      items: [
        {
          title: '病例库浏览',
          url: '/cases',
          icon: FolderHeart,
        },
        {
          title: '题库练习',
          url: '/question-bank',
          icon: ClipboardList,
        },
        {
          title: 'AI 图像判读',
          url: '/ai-reading',
          icon: ScanEye,
        },
        {
          title: '学情统计',
          url: '/learning-stats',
          icon: ChartNoAxesCombined,
        },
      ],
    },
    // ===== 模板示例页面，暂时隐藏 =====
    // {
    //   title: '页面',
    //   items: [
    //     {
    //       title: '认证',
    //       icon: ShieldCheck,
    //       items: [
    //         { title: '登录', url: '/sign-in' },
    //         { title: '登录（双栏）', url: '/sign-in-2' },
    //         { title: '忘记密码', url: '/forgot-password' },
    //       ],
    //     },
    //     {
    //       title: '错误',
    //       icon: Bug,
    //       items: [
    //         { title: '未授权', url: '/errors/unauthorized', icon: Lock },
    //         { title: '禁止访问', url: '/errors/forbidden', icon: UserX },
    //         { title: '页面未找到', url: '/errors/not-found', icon: FileX },
    //         {
    //           title: '服务器内部错误',
    //           url: '/errors/internal-server-error',
    //           icon: ServerOff,
    //         },
    //         {
    //           title: '维护中',
    //           url: '/errors/maintenance-error',
    //           icon: Construction,
    //         },
    //       ],
    //     },
    //   ],
    // },
    {
      title: '其他',
      items: [
        {
          title: '设置',
          icon: Settings,
          items: [
            {
              title: '个人资料',
              url: '/settings',
              icon: UserCog,
            },
            {
              title: '账户',
              url: '/settings/account',
              icon: Wrench,
            },
            {
              title: '外观',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: 'AI 模型',
              url: '/settings/ai-model',
              icon: Bot,
            },
          ],
        },
        // {
        //   title: '帮助中心',
        //   url: '/help-center',
        //   icon: HelpCircle,
        // },
      ],
    },
  ],
}
