/** 与后端 User.display_name 规则一致：中文姓名按「姓名」且不加空格，西文按「名 姓」 */
export function displayName(u: {
  firstName: string
  lastName: string
  username?: string
}) {
  const hasCjk = /[一-鿿]/.test(u.firstName + u.lastName)
  const name = hasCjk
    ? `${u.lastName}${u.firstName}`
    : `${u.firstName} ${u.lastName}`.trim()
  return name || u.username || ''
}
