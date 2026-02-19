import { Capacitor } from '@capacitor/core'

export async function initCapacitor() {
  if (!Capacitor.isNativePlatform()) return

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setOverlaysWebView({ overlay: true })

    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#00000000' })
    }
  } catch (e) {
    console.warn('StatusBar plugin error:', e)
  }
}
