import { openPDFOverlay } from './pdf.js'

export function addModuleToSidebar(name, desc, policyText, fileUrl, isAdmin, TOTAL_QUESTIONS, resetQuiz) {
  const container = document.getElementById("uploaded-modules")
  if (!container) return

  const item = document.createElement("div")
  item.className = "module-item"
  item.dataset.policy = policyText
  item.dataset.url = fileUrl || ""

  const dot = document.createElement("div")
  dot.className = "module-dot"

  const info = document.createElement("div")
  info.className = "module-item-info"

  const nameSpan = document.createElement("span")
  nameSpan.className = "module-name"
  nameSpan.textContent = name

  const descSpan = document.createElement("span")
  descSpan.className = "module-desc"
  descSpan.textContent = desc || "Uploaded policy document"

  info.appendChild(nameSpan)
  info.appendChild(descSpan)

  const badge = document.createElement("span")
  badge.className = "module-badge"
  badge.textContent = `${TOTAL_QUESTIONS} Q`

  if (isAdmin) {
    nameSpan.title = "Double-click to rename"
    nameSpan.addEventListener("dblclick", (e) => {
      e.stopPropagation()
      const input = document.createElement("input")
      input.className = "edit-input"
      input.value = nameSpan.textContent
      nameSpan.replaceWith(input)
      input.focus()
      input.select()
      const finish = () => {
        nameSpan.textContent = input.value.trim() || name
        input.replaceWith(nameSpan)
      }
      input.addEventListener("blur", finish)
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") input.blur()
        if (ev.key === "Escape") { nameSpan.textContent = name; input.replaceWith(nameSpan) }
      })
    })

    descSpan.title = "Double-click to edit description"
    descSpan.addEventListener("dblclick", (e) => {
      e.stopPropagation()
      const input = document.createElement("input")
      input.className = "edit-input"
      input.value = descSpan.textContent
      descSpan.replaceWith(input)
      input.focus()
      input.select()
      const finish = () => {
        descSpan.textContent = input.value.trim() || (desc || "Uploaded policy document")
        input.replaceWith(descSpan)
      }
      input.addEventListener("blur", finish)
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") input.blur()
        if (ev.key === "Escape") { descSpan.textContent = desc; input.replaceWith(descSpan) }
      })
    })
  }

  item.addEventListener("click", () => {
    document.querySelectorAll(".module-item").forEach(i => i.classList.remove("active"))
    item.classList.add("active")
    resetQuiz(policyText)
    if (fileUrl) openPDFOverlay(fileUrl, name)
  })

  item.appendChild(dot)
  item.appendChild(info)
  item.appendChild(badge)
  container.appendChild(item)
}

export async function loadExistingModules(isAdmin, TOTAL_QUESTIONS, resetQuiz) {
  try {
    const { supabase } = await import('./supabase.js')
    const { data, error } = await supabase
      .from('policies')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error || !data) return

    const seen = new Set()
    for (const policy of data) {
      if (seen.has(policy.file_url)) continue
      seen.add(policy.file_url)
      const desc = policy.module_description || "Uploaded policy document"
      addModuleToSidebar(policy.module_name, desc, policy.policy_text || "", policy.file_url, isAdmin, TOTAL_QUESTIONS, resetQuiz)
    }

    await markPassedModules()
  } catch (err) {
    console.error("Failed to load modules:", err)
  }
}

export async function markPassedModules() {
  try {
    const { getPassedModules } = await import('./supabase.js')
    const passedModules = await getPassedModules()
    document.querySelectorAll(".module-item").forEach(item => {
      const moduleName = item.querySelector(".module-name")?.textContent
      if (passedModules.includes(moduleName)) {
        item.classList.add("passed")
        const badge = item.querySelector(".module-badge")
        if (badge) badge.textContent = "✓"
      }
    })
    await updateComplianceBadge()
  } catch (err) {
    console.error("Failed to load passed modules:", err)
  }
}

export async function updateComplianceBadge() {
  try {
    const { getPassedModules } = await import('./supabase.js')
    const passedModules = await getPassedModules()
    const totalModules = document.querySelectorAll(".module-item").length
    const pending = totalModules - passedModules.length

    const badge = document.getElementById("compliance-badge")
    const text = document.getElementById("compliance-text")
    const dot = badge?.querySelector(".compliance-dot")

    if (pending <= 0) {
      if (text) text.textContent = "All modules complete"
      if (dot) dot.style.background = "var(--green)"
      if (badge) badge.style.borderColor = "var(--green-border)"
      if (badge) badge.style.background = "var(--green-light)"
      if (text) text.style.color = "var(--green)"
    } else {
      if (text) text.textContent = `${pending} module${pending > 1 ? 's' : ''} pending`
    }
  } catch (err) {
    console.error("Failed to update compliance badge:", err)
  }
}

export function subscribeToNewModules(isAdmin, TOTAL_QUESTIONS, resetQuiz) {
  import('./supabase.js').then(({ supabase }) => {
    supabase
      .channel('policies-changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'policies' },
        (payload) => {
          const policy = payload.new
          if (!policy.is_active) return
          const existing = document.querySelector(`[data-url="${policy.file_url}"]`)
          if (existing) return
          const desc = policy.module_description || "Uploaded policy document"
          addModuleToSidebar(policy.module_name, desc, policy.policy_text || "", policy.file_url, isAdmin, TOTAL_QUESTIONS, resetQuiz)
        }
      )
      .subscribe()
  })
}