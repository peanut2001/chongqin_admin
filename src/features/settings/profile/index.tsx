import { Separator } from '@/components/ui/separator'
import { ContentSection } from '../components/content-section'
import { AvatarUpload } from './avatar-upload'
import { ProfileForm } from './profile-form'

export function SettingsProfile() {
  return (
    <ContentSection title='个人资料' desc='这是其他人在网站上看到的你的信息。'>
      <div className='space-y-8'>
        <AvatarUpload />
        <Separator />
        <ProfileForm />
      </div>
    </ContentSection>
  )
}
