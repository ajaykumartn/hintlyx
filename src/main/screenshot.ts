import { desktopCapturer, screen, type NativeImage } from 'electron'

/** Longest edge of the screenshot sent to the vision model. Smaller = fewer tokens, faster. */
const MAX_EDGE = 1280

/**
 * Captures the display under the overlay and returns a downscaled PNG as base64.
 * The overlay window has content protection while invisible, so it is excluded from
 * this capture too, and never appears in the screenshot sent to the model.
 */
export async function captureScreenBase64(overlayBounds: { x: number; y: number }): Promise<string | null> {
  const display = screen.getDisplayNearestPoint(overlayBounds)
  const full = display.size
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: full.width, height: full.height }
  })
  const source =
    sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
  if (!source) return null

  let image: NativeImage = source.thumbnail
  if (image.isEmpty()) return null

  const size = image.getSize()
  const longest = Math.max(size.width, size.height)
  if (longest > MAX_EDGE) {
    const scale = MAX_EDGE / longest
    image = image.resize({ width: Math.round(size.width * scale), height: Math.round(size.height * scale) })
  }
  return image.toPNG().toString('base64')
}
