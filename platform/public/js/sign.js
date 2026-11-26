// Signature pad: draws on a canvas and puts a PNG data URL into the hidden input before submit.
(function () {
  document.querySelectorAll('canvas.sigpad').forEach(function (cv) {
    var form = cv.closest('form')
    var input = form.querySelector('input[name="signature"]')
    var ctx = cv.getContext('2d')
    var drawing = false, drawn = false, last = null
    function size() {
      var r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1
      var img = drawn ? cv.toDataURL() : null
      cv.width = r.width * d; cv.height = r.height * d
      ctx.scale(d, d); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#17241C'
      if (img) { var i = new Image(); i.onload = function () { ctx.drawImage(i, 0, 0, r.width, r.height) }; i.src = img }
    }
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
    cv.addEventListener('pointerdown', function (e) { drawing = true; last = pos(e); cv.setPointerCapture(e.pointerId) })
    cv.addEventListener('pointermove', function (e) {
      if (!drawing) return
      var p = pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; drawn = true
    })
    ;['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { cv.addEventListener(t, function () { drawing = false }) })
    var clear = form.querySelector('[data-clear]')
    if (clear) clear.addEventListener('click', function () { ctx.clearRect(0, 0, cv.width, cv.height); drawn = false })
    form.addEventListener('submit', function (e) {
      if (!drawn) { e.preventDefault(); alert('Please sign in the box first.'); return }
      input.value = cv.toDataURL('image/png')
    })
    size(); window.addEventListener('resize', size)
  })
})()
