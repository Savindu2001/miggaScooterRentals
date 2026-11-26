// Shop tablet / admin helpers: document preview popup, in-page camera for inspections, card fee hint.
(function () {
  'use strict'
  var $ = function (s, r) { return (r || document).querySelector(s) }
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)) }

  // ---------------- preview popup ----------------
  var lb = $('#lightbox'), stage = $('#lb-stage'), items = [], idx = 0, rot = 0, zoom = false
  function isPdf(url, el) { return /\.pdf($|\?)/i.test(url) || (el && el.getAttribute('data-type') === 'pdf') }
  function show() {
    var a = items[idx], url = a.getAttribute('href')
    rot = 0; zoom = false
    stage.innerHTML = ''
    stage.classList.remove('zoom')
    if (isPdf(url, a)) {
      var f = document.createElement('iframe'); f.src = url; f.title = 'Document preview'; stage.appendChild(f)
    } else {
      var img = document.createElement('img'); img.src = url; img.alt = a.getAttribute('data-title') || 'Preview'; stage.appendChild(img)
    }
    $('#lb-title').textContent = (a.getAttribute('data-title') || a.textContent.trim() || 'Preview') + (items.length > 1 ? '  ·  ' + (idx + 1) + ' / ' + items.length : '')
    $('#lb-open').href = url
    $$('[data-lb="prev"],[data-lb="next"]', lb).forEach(function (b) { b.hidden = items.length < 2 })
  }
  function open(a) {
    var box = a.closest('.photo-grid, .card, table') || document
    items = $$('a[data-preview]', box)
    idx = Math.max(0, items.indexOf(a))
    show(); lb.hidden = false; document.body.style.overflow = 'hidden'
  }
  function close() { lb.hidden = true; stage.innerHTML = ''; document.body.style.overflow = '' }
  if (lb) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[data-preview]')
      if (a && !e.metaKey && !e.ctrlKey) { e.preventDefault(); open(a) }
    })
    lb.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-lb')
      if (e.target === lb || e.target === stage || act === 'close') return close()
      if (act === 'prev') { idx = (idx - 1 + items.length) % items.length; show() }
      if (act === 'next') { idx = (idx + 1) % items.length; show() }
      var img = $('img', stage)
      if (act === 'rotate' && img) { rot = (rot + 90) % 360; img.style.transform = 'rotate(' + rot + 'deg)' }
      if (act === 'zoom' && img) { zoom = !zoom; stage.classList.toggle('zoom', zoom) }
    })
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight' && items.length > 1) { idx = (idx + 1) % items.length; show() }
      if (e.key === 'ArrowLeft' && items.length > 1) { idx = (idx - 1 + items.length) % items.length; show() }
    })
  }

  // ---------------- photos: compress + preview ----------------
  var MAX = 1600, Q = 0.82
  function setFile(input, blob, name) {
    try {
      var dt = new DataTransfer()
      dt.items.add(new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }))
      input.files = dt.files
      return true
    } catch (e) { return false }
  }
  function preview(box, src) {
    var p = $('.cam-preview', box); p.src = src; p.hidden = false; box.classList.add('done')
  }
  function shrink(file, cb) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400000) return cb(null)
    var img = new Image(), url = URL.createObjectURL(file)
    img.onload = function () {
      var s = Math.min(1, MAX / Math.max(img.width, img.height)), c = document.createElement('canvas')
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      c.toBlob(function (b) { cb(b && b.size < file.size ? b : null) }, 'image/jpeg', Q)
    }
    img.onerror = function () { cb(null) }
    img.src = url
  }
  $$('[data-cam] input[type=file]').forEach(function (input) {
    input.addEventListener('change', function () {
      var f = input.files && input.files[0], box = input.closest('[data-cam]')
      if (!f) return
      preview(box, URL.createObjectURL(f))
      if (input.dataset.fromCamera) { delete input.dataset.fromCamera; return }
      shrink(f, function (b) { if (b) setFile(input, b, (input.name || 'photo') + '.jpg') })
    })
  })

  // ---------------- live camera ----------------
  var camBox = $('#camera'), video = $('#cam-video'), shot = $('#cam-shot'), stream = null, target = null, facing = 'environment', lastBlob = null
  var canCam = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext && typeof DataTransfer !== 'undefined'
  function stopStream() { if (stream) { stream.getTracks().forEach(function (t) { t.stop() }); stream = null } }
  function mode(taken) {
    video.hidden = taken; shot.hidden = !taken
    $('[data-camx="shoot"]', camBox).hidden = taken
    $('[data-camx="retake"]', camBox).hidden = !taken
    $('[data-camx="use"]', camBox).hidden = !taken
  }
  function start() {
    stopStream()
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(function (s) { stream = s; video.srcObject = s; mode(false) })
  }
  function openCam(input) {
    target = input
    $('#cam-title').textContent = 'Photo: ' + (input.closest('[data-cam]').querySelector('b').textContent)
    camBox.hidden = false; document.body.style.overflow = 'hidden'
    start().catch(function () {
      closeCam()
      alert('Camera not available. Allow camera access in the browser settings, or use Upload.')
    })
  }
  function closeCam() { stopStream(); camBox.hidden = true; document.body.style.overflow = ''; lastBlob = null }
  if (camBox && canCam) {
    $$('[data-cam-open]').forEach(function (b) {
      b.hidden = false
      b.addEventListener('click', function () { openCam(b.closest('[data-cam]').querySelector('input[type=file]')) })
    })
    camBox.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-camx')
      if (act === 'close') return closeCam()
      if (act === 'switch') { facing = facing === 'environment' ? 'user' : 'environment'; start().catch(function () {}) }
      if (act === 'retake') { lastBlob = null; mode(false) }
      if (act === 'shoot') {
        var w = video.videoWidth, h = video.videoHeight
        if (!w) return
        var s = Math.min(1, MAX / Math.max(w, h)), c = document.createElement('canvas')
        c.width = Math.round(w * s); c.height = Math.round(h * s)
        c.getContext('2d').drawImage(video, 0, 0, c.width, c.height)
        c.toBlob(function (b) { lastBlob = b; shot.src = URL.createObjectURL(b); mode(true) }, 'image/jpeg', Q)
      }
      if (act === 'use' && lastBlob && target) {
        if (setFile(target, lastBlob, (target.name || 'photo') + '.jpg')) {
          target.dataset.fromCamera = '1'
          target.dispatchEvent(new Event('change'))
        }
        closeCam()
      }
    })
  }

  // ---------------- card fee hint ----------------
  var hint = $('[data-card-hint]')
  if (hint) {
    var form = hint.closest('form'), pct = parseFloat(hint.getAttribute('data-pct')) || 0
    var method = $('select[name="method"]', form), amount = $('input[name="amount"]', form), waive = $('input[name="waive_fee"]', form)
    var fmt = function (n) { return 'LKR ' + Math.round(n).toLocaleString('en-US') }
    var update = function () {
      var a = parseInt(amount.value, 10) || 0, showIt = method.value === 'card' && pct > 0 && a > 0
      hint.hidden = !showIt
      if (!showIt) return
      var fee = waive.checked ? 0 : Math.ceil(a * pct / (100 - pct))
      $('[data-swipe]', hint).textContent = fmt(a + fee)
      $('[data-base]', hint).textContent = fmt(a)
      $('[data-fee]', hint).textContent = fmt(fee)
    }
    ;[method, amount, waive].forEach(function (el) { el.addEventListener('input', update); el.addEventListener('change', update) })
    update()
  }
})()
