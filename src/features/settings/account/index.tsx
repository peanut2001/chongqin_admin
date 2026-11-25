import { ContentSection } from '../components/content-section'
import { AccountForm } from './account-form'

export function SettingsAccount() {
  return (
    <ContentSection title='账户' desc='修改登录密码。'>
      <AccountForm />
    </ContentSection>
  )
}
