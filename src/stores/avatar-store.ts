import { create } from 'zustand'

/**
 * 用户头像（mock）：按用户 id 以 data URL 形式保存在 localStorage。
 * 接入后端后，改为上传到服务器并保存返回的图片地址即可。
 */
const STORAGE_KEY = 'user_avatars'

type Avatars = Record<string, string>

function load(): Avatars {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Avatars
  } catch {
    return {}
  }
}

/** 写入 localStorage，空间不足时返回 false */
function save(avatars: Avatars): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(avatars))
    return true
  } catch {
    return false
  }
}

type AvatarState = {
  avatars: Avatars
  /** 保存成功返回 true；浏览器存储空间不足时返回 false 且不做修改 */
  setAvatar: (userId: string, dataUrl: string) => boolean
  removeAvatar: (userId: string) => void
}

export const useAvatarStore = create<AvatarState>()((set, get) => ({
  avatars: load(),
  setAvatar: (userId, dataUrl) => {
    const avatars = { ...get().avatars, [userId]: dataUrl }
    if (!save(avatars)) return false
    set({ avatars })
    return true
  },
  removeAvatar: (userId) => {
    const { [userId]: _removed, ...avatars } = get().avatars
    save(avatars)
    set({ avatars })
  },
}))
