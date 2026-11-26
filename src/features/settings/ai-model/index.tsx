import { ContentSection } from '../components/content-section'
import { AiModelForm } from './ai-model-form'

export function SettingsAiModel() {
  return (
    <ContentSection
      title='AI 模型'
      desc='配置「AI 图像判读」使用的大模型，支持 Anthropic 与 OpenAI 两种接口格式。'
    >
      <AiModelForm />
    </ContentSection>
  )
}
