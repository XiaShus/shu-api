import { createFileRoute } from '@tanstack/react-router'

import { Main } from '@/components/layout'
import { WechatBotSettings } from '@/features/wechat-bot'

export const Route = createFileRoute('/_authenticated/system-settings/wechat/')({
  component: WechatRoute,
})

function WechatRoute() {
  return (
    <Main>
      <WechatBotSettings />
    </Main>
  )
}
