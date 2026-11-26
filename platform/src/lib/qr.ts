import qrcode from 'qrcode-generator'

/** SVG QR code (for web pages). */
export function qrSvg(text: string, cell = 6): string {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  return qr.createSvgTag({ cellSize: cell, margin: 2, scalable: true })
}

/** GIF QR code bytes (for emails: Gmail does not display SVG). */
export function qrGif(text: string, cell = 6): Uint8Array<ArrayBuffer> {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const url = qr.createDataURL(cell, 8)
  const b64 = url.slice(url.indexOf(',') + 1)
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}
