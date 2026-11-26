import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorTitle, apiFieldErrors } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { PasswordInput } from '@/components/password-input'
import {
  type AiProvider,
  type ModelOption,
  useAiModelConfig,
  useFetchModels,
  useSaveAiModel,
} from './api'

const providers: {
  value: AiProvider
  label: string
  desc: string
  placeholder: string
}[] = [
  {
    value: 'anthropic',
    label: 'Anthropic 格式',
    desc: 'Messages API（/v1/messages）',
    placeholder: 'https://api.anthropic.com',
  },
  {
    value: 'openai',
    label: 'OpenAI 格式',
    desc: 'Chat Completions API（/chat/completions）',
    placeholder: 'https://api.openai.com/v1',
  },
]

const formSchema = z.object({
  provider: z.enum(['anthropic', 'openai']),
  baseUrl: z
    .string()
    .trim()
    .max(300, '地址不能超过 300 个字符。')
    .refine(
      (v) => v === '' || /^https?:\/\/[^\s/]+\S*$/.test(v),
      '请填写以 http:// 或 https:// 开头的地址。'
    ),
  apiKey: z.string().trim().max(500, 'API Key 过长。'),
  model: z.string().trim().max(200, '模型名称过长。'),
  enabled: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

export function AiModelForm() {
  const { data: cfg, isLoading } = useAiModelConfig()
  const save = useSaveAiModel()
  const fetchModels = useFetchModels()
  const [models, setModels] = useState<ModelOption[]>([])
  const [manual, setManual] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      provider: 'anthropic',
      baseUrl: '',
      apiKey: '',
      model: '',
      enabled: false,
    },
  })

  // 配置加载后填入表单（API Key 不回显）
  useEffect(() => {
    if (cfg) {
      form.reset({
        provider: cfg.provider,
        baseUrl: cfg.baseUrl,
        apiKey: '',
        model: cfg.model,
        enabled: cfg.enabled,
      })
    }
  }, [cfg, form])

  const provider = useWatch({ control: form.control, name: 'provider' })
  const model = useWatch({ control: form.control, name: 'model' })
  const current = providers.find((p) => p.value === provider) ?? providers[0]

  const applyFieldErrors = (err: unknown) => {
    const fields = apiFieldErrors(err)
    const keys = Object.keys(fields).filter((k) => k in form.getValues())
    keys.forEach((k) =>
      form.setError(k as keyof FormValues, { message: fields[k] })
    )
    if (!keys.length) toast.error(apiErrorTitle(err))
  }

  const onFetchModels = async () => {
    const ok = await form.trigger(['baseUrl', 'apiKey'])
    if (!ok) return
    const { provider, baseUrl, apiKey } = form.getValues()
    fetchModels.mutate(
      { provider, baseUrl, apiKey },
      {
        onSuccess: (list) => {
          setModels(list)
          setManual(false)
          if (list.length) toast.success(`获取到 ${list.length} 个模型`)
          else toast.info('该服务没有返回可用模型，请手动填写模型名称。')
        },
        onError: applyFieldErrors,
      }
    )
  }

  const onSubmit = (values: FormValues) =>
    save.mutate(values, {
      onSuccess: (saved) => {
        form.reset({ ...values, apiKey: '', baseUrl: saved.baseUrl })
        toast.success(
          saved.enabled
            ? `已保存，AI 判读将使用 ${saved.model}`
            : '已保存，AI 判读当前使用演示结果'
        )
      },
      onError: applyFieldErrors,
    })

  if (isLoading || !cfg) {
    return <p className='text-sm text-muted-foreground'>正在加载配置…</p>
  }

  // 已获取模型列表时用下拉选择；当前模型不在列表中也保留为一个选项
  const showSelect = models.length > 0 && !manual
  const options =
    model && !models.some((m) => m.id === model)
      ? [{ id: model, name: model }, ...models]
      : models

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <FormField
          control={form.control}
          name='provider'
          render={({ field }) => (
            <FormItem>
              <FormLabel>接口格式</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v)
                    setModels([])
                  }}
                  className='grid gap-3 sm:grid-cols-2'
                >
                  {providers.map((p) => (
                    <label
                      key={p.value}
                      className='flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[[data-state=checked]]:border-primary'
                    >
                      <RadioGroupItem value={p.value} className='mt-0.5' />
                      <span className='space-y-0.5'>
                        <span className='block text-sm font-medium'>
                          {p.label}
                        </span>
                        <span className='block text-xs text-muted-foreground'>
                          {p.desc}
                        </span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormDescription>
                不确定时选 OpenAI 格式，多数中转服务都支持。使用自定义服务地址时，
                若所选格式被服务拒绝，判读会自动改用另一种格式并保存。
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='baseUrl'
          render={({ field }) => (
            <FormItem>
              <FormLabel>服务地址</FormLabel>
              <FormControl>
                <Input placeholder={current.placeholder} {...field} />
              </FormControl>
              <FormDescription>
                留空使用官方地址。
                {provider === 'anthropic'
                  ? 'Anthropic 格式填写到域名即可，不需要 /v1。'
                  : 'OpenAI 格式一般以 /v1 结尾。'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='apiKey'
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Key</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete='off'
                  placeholder={
                    cfg.hasApiKey
                      ? `已保存（${cfg.apiKeyHint}），留空则不修改`
                      : '请输入 API Key'
                  }
                  {...field}
                />
              </FormControl>
              <FormDescription>
                加密保存在服务器，保存后不会再显示完整内容。
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='model'
          render={({ field }) => (
            <FormItem>
              <FormLabel>模型</FormLabel>
              <div className='flex gap-2'>
                {showSelect ? (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder='请选择模型' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {options.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name === m.id ? m.id : `${m.name}（${m.id}）`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <FormControl>
                    <Input
                      placeholder='点击「获取模型」选择，或直接填写模型名称'
                      {...field}
                    />
                  </FormControl>
                )}
                <Button
                  type='button'
                  variant='outline'
                  disabled={fetchModels.isPending}
                  onClick={onFetchModels}
                >
                  {fetchModels.isPending ? (
                    <LoaderCircle className='animate-spin' />
                  ) : (
                    <RefreshCw />
                  )}
                  获取模型
                </Button>
              </div>
              <FormDescription>
                需选择支持图像输入的多模态模型。
                {models.length > 0 && (
                  <Button
                    type='button'
                    variant='link'
                    className='h-auto p-0 ps-1 text-xs'
                    onClick={() => setManual((v) => !v)}
                  >
                    {manual ? '从列表选择' : '手动填写'}
                  </Button>
                )}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='enabled'
          render={({ field }) => (
            <FormItem className='flex items-center justify-between gap-4 rounded-md border p-4'>
              <div className='space-y-0.5'>
                <FormLabel>启用模型判读</FormLabel>
                <FormDescription>
                  开启后「AI 图像判读」调用该模型；关闭则返回演示结果。
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type='submit' disabled={save.isPending}>
          {save.isPending && <LoaderCircle className='animate-spin' />}
          保存配置
        </Button>
      </form>
    </Form>
  )
}
