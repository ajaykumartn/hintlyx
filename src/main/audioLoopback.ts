import { desktopCapturer, session } from 'electron'

/**
 * Lets the overlay capture system audio (what comes out of the speakers, e.g. the other
 * person in a call) via getDisplayMedia with loopback audio. Chromium requires a video
 * source in the request, so we hand it a screen source; the renderer drops the video track
 * and keeps only the audio. No picker is shown.
 */
export function enableSystemAudioLoopback(): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen'] })
        .then((sources) => {
          callback(sources[0] ? { video: sources[0], audio: 'loopback' } : { video: undefined })
        })
        .catch(() => callback({ video: undefined }))
    },
    // We provide the source ourselves, so no system picker.
    { useSystemPicker: false }
  )
}
