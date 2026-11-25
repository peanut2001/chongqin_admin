import { toast } from 'sonner'
import { type BulkResult } from './data/schema'

const skipReasons: Record<BulkResult['skipped'][number]['reason'], string> = {
  self: '不能操作当前登录的自己',
  last_admin: '不能停用或删除最后一个启用的管理员',
  not_found: '用户已不存在',
}

/** 批量操作结果提示：成功数量 + 被跳过的原因 */
export function reportBulkResult(result: BulkResult, verb: string) {
  toast.success(`已${verb} ${result.affected} 个用户`)
  const reasons = [...new Set(result.skipped.map((s) => skipReasons[s.reason]))]
  if (reasons.length) {
    toast.warning(`已跳过 ${result.skipped.length} 个：${reasons.join('；')}`)
  }
}
