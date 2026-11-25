import { faker } from '@faker-js/faker'
import { type Role } from '@/lib/permissions'
import { type User } from './schema'

/** mock 环境下所有账号的默认登录密码 */
export const DEFAULT_PASSWORD = 'demo1234'

/** 内置演示账号：每个角色一个，登录页可一键填充 */
export const demoAccounts: User[] = (
  [
    ['admin', 'Admin', 'Wang'],
    ['teacher', 'Teacher', 'Zhang'],
    ['student', 'Student', 'Li'],
  ] as const
).map(([role, firstName, lastName], i) => ({
  id: `demo-${role}`,
  firstName,
  lastName,
  username: role,
  email: `${role}@demo.com`,
  phoneNumber: `+86 138 0000 000${i + 1}`,
  status: 'active',
  role,
  createdAt: new Date('2026-09-01T08:00:00'),
  updatedAt: new Date('2026-09-01T08:00:00'),
}))

// Set a fixed seed for consistent data generation
faker.seed(67890)

const generatedUsers: User[] = Array.from({ length: 500 }, () => {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  return {
    id: faker.string.uuid(),
    firstName,
    lastName,
    username: faker.internet
      .username({ firstName, lastName })
      .toLocaleLowerCase(),
    email: faker.internet.email({ firstName }).toLocaleLowerCase(),
    phoneNumber: faker.phone.number({ style: 'international' }),
    status: faker.helpers.arrayElement([
      'active',
      'inactive',
      'invited',
      'suspended',
    ]),
    // 学生占大多数，教师次之，管理员很少
    role: faker.helpers.weightedArrayElement<Role>([
      { weight: 2, value: 'admin' },
      { weight: 18, value: 'teacher' },
      { weight: 80, value: 'student' },
    ]),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
  }
})

export const users: User[] = [...demoAccounts, ...generatedUsers]
