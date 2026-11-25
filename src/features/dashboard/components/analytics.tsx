import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChapterMasteryChart,
  ModuleUsageChart,
  WeeklyTrendChart,
} from '@/features/learning-stats/components/stats-charts'

/** 教学分析：复用学情统计图表 */
export function Analytics() {
  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle>学习趋势</CardTitle>
          <CardDescription>
            各教学周练习次数、AI 判读次数与平均正确率
          </CardDescription>
        </CardHeader>
        <CardContent className='ps-2'>
          <WeeklyTrendChart height={300} />
        </CardContent>
      </Card>
      <div className='grid gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>章节掌握度</CardTitle>
            <CardDescription>班级平均正确率</CardDescription>
          </CardHeader>
          <CardContent>
            <ChapterMasteryChart />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>模块使用分布</CardTitle>
            <CardDescription>累计学习时长（小时）</CardDescription>
          </CardHeader>
          <CardContent>
            <ModuleUsageChart />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
