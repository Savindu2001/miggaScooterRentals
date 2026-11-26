/** Photo input for inspections: live camera on tablets/phones, or upload a file. Works without JavaScript too. */
export function CamInput(p: { name: string; label: string; required?: boolean; before?: string }) {
  return (
    <div class="cam" data-cam>
      <b style="text-transform:capitalize">{p.label}</b>
      {p.before && (
        <a href={p.before} data-preview class="cam-before" title="Photo at pickup">
          <img src={p.before} alt={`${p.label} at pickup`} loading="lazy" />
          <span class="tiny muted">At pickup · take the same photo now</span>
        </a>
      )}
      <img class="cam-preview" alt={`${p.label} photo`} hidden />
      <div class="row" style="gap:8px">
        <button type="button" class="btn sm dark" data-cam-open hidden>Camera</button>
        <label class="btn sm ghost">
          Upload
          <input class="vh" type="file" name={p.name} accept="image/*" capture="environment" required={p.required} />
        </label>
      </div>
    </div>
  )
}
