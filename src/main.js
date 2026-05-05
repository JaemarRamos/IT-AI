import OpenAI from "openai"
import { marked } from "marked"
import DOMPurify from "dompurify"
import { checkEnvironment } from "./utils.js"

// Auth check
if (!sessionStorage.getItem("loggedIn")) {
  window.location.href = "/login.html"
}

checkEnvironment()

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  baseURL: import.meta.env.VITE_GROQ_API_URL,
  dangerouslyAllowBrowser: true,
})

const IT_POLICY = `
COMPANY IT POLICY - DO'S AND DON'TS

DO'S:
- Use strong passwords with at least 12 characters including numbers and symbols
- Lock your computer screen when leaving your desk
- Report suspicious emails to the IT security team immediately
- Use the company VPN when accessing company systems on public Wi-Fi
- Keep your software and operating system updated
- Store company files only on approved company storage systems
- Get IT approval before installing any software on work devices
- Use only company-approved communication tools for work matters

DON'TS:
- Never share your login credentials with anyone, including IT staff
- Never use personal email to send confidential company data
- Never plug in unknown USB drives or external devices
- Never install unauthorized software on work computers
- Never access company systems on public Wi-Fi without a VPN
- Never leave your computer unlocked and unattended
- Never click on suspicious links or download attachments from unknown senders
- Never store sensitive company data on personal devices or cloud storage
`

// Constants
const TOTAL_QUESTIONS = 5 // change to 25 in production
const IDLE_LIMIT = 60000

// State
let questionCount = 0
let score = 0
let quizStarted = false
let idleTimer = null
let currentPolicy = IT_POLICY

function buildSystemPrompt(policy) {
  return `You are an IT policy quiz assistant.

STRICT RULES - YOU MUST FOLLOW THESE EXACTLY:
1. Ask questions ONE AT A TIME
2. ALWAYS wait for the user to respond before moving to the next question
3. NEVER skip questions or mark them as "not answered"
4. NEVER show a final summary until the user has answered ALL ${TOTAL_QUESTIONS} questions
5. After each answer, start your response with EXACTLY "Correct!" or "Incorrect."
6. Count questions carefully - ask exactly ${TOTAL_QUESTIONS} questions total
7. Only after question ${TOTAL_QUESTIONS} is answered, give the final summary ending with RESULT: PASS or RESULT: FAIL

QUIZ:
- Ask one scenario-based question at a time
- Wait for the user's answer
- Start feedback with "Correct!" or "Incorrect."
- Give 1-2 sentences of explanation
- Then ask the next question
- After ALL ${TOTAL_QUESTIONS} questions are answered, give final summary

Passing score is ${Math.ceil(TOTAL_QUESTIONS * 0.8)} out of ${TOTAL_QUESTIONS}.

If the user PASSES:
- Congratulate them warmly
- End with "RESULT: PASS"

If the user FAILS:
- Encourage them kindly
- End with "RESULT: FAIL"

Here is the IT policy to quiz about:
${policy}`
}

const messages = [
  { role: "system", content: buildSystemPrompt(currentPolicy) }
]

// Show admin link if admin
const currentUser = JSON.parse(sessionStorage.getItem("user") || "{}")
const adminLink = document.getElementById("admin-link")
if (currentUser?.email?.includes("admin")) {
  adminLink?.classList.remove("hidden")
}

// Blur when window loses focus during quiz
window.onblur = () => {
  const quizForm = document.getElementById("quiz-form")
  const overlay = document.getElementById("blur-overlay")
  if (!quizForm || quizForm.classList.contains("hidden")) return
  overlay.style.cssText = "display: flex !important; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15,17,23,0.85); backdrop-filter: blur(12px); z-index: 9999; align-items: center; justify-content: center; flex-direction: column;"
}

window.onfocus = () => {
  const overlay = document.getElementById("blur-overlay")
  if (overlay) overlay.style.cssText = "display: none;"
}

document.addEventListener("DOMContentLoaded", () => {
  // DOM elements
  const chat = document.getElementById("chat")
  const userInput = document.getElementById("user-input")
  const quizForm = document.getElementById("quiz-form")
  const inputSection = document.getElementById("input-section")
  const resultSection = document.getElementById("result-section")
  const progressFill = document.getElementById("progress-fill")
  const progressLabel = document.getElementById("progress-label")
  const scoreLabel = document.getElementById("score-label")
  const finalScore = document.getElementById("final-score")
  const restartBtn = document.getElementById("restart-btn")
  const readySection = document.getElementById("ready-section")
  const readyBtn = document.getElementById("ready-btn")
  const closeBtn = document.getElementById("close-btn")
  const openBtn = document.getElementById("open-btn")
  const sidebar = document.getElementById("sidebar")
  const uploadDocBtn = document.querySelector(".upload-doc-btn")
  const pdfViewer = document.getElementById("pdf-viewer")
  const pdfFrame = document.getElementById("pdf-frame")

  // Idle timer — warns user if inactive during quiz
  function resetIdleTimer() {
    clearTimeout(idleTimer)
    if (!quizStarted) return
    idleTimer = setTimeout(() => {
      addBubble("⏱️ You've been idle for a while. Please type your answer to continue!", "genie")
    }, IDLE_LIMIT)
  }

  // Trim messages to avoid token limit
  function trimMessages() {
    if (messages.length > 7) {
      messages.splice(1, messages.length - 7)
    }
  }

  // Add chat bubble
  function addBubble(text, type) {
    const row = document.createElement("div")
    row.className = `bubble-row ${type === "user" ? "user" : ""}`

    const avatar = document.createElement("div")
    avatar.className = `avatar ${type === "user" ? "user" : "genie"}`
    avatar.innerHTML = type === "user" ? "ME" : `<img src="/itms_baby/PNG/ITMS 32PX N.png" alt="ITMS" />`

    const bubble = document.createElement("div")
    bubble.className = `bubble ${type}`
    bubble.innerHTML = type === "genie"
      ? DOMPurify.sanitize(marked.parse(text))
      : ""
    if (type !== "genie") bubble.textContent = text

    if (type === "user") {
      row.appendChild(bubble)
      row.appendChild(avatar)
    } else {
      row.appendChild(avatar)
      row.appendChild(bubble)
    }

    chat.appendChild(row)
    chat.scrollTop = chat.scrollHeight
  }

  // Typing indicator
  function addTypingIndicator() {
    const row = document.createElement("div")
    row.className = "bubble-row"
    row.id = "typing"
    const avatar = document.createElement("div")
    avatar.className = "avatar genie"
    avatar.innerHTML = `<img src="/itms_baby/PNG/ITMS 32PX N.png" alt="ITMS" />`
    const bubble = document.createElement("div")
    bubble.className = "bubble genie typing"
    bubble.innerHTML = "<span></span><span></span><span></span>"
    row.appendChild(avatar)
    row.appendChild(bubble)
    chat.appendChild(row)
    chat.scrollTop = chat.scrollHeight
  }

  function removeTypingIndicator() {
    document.getElementById("typing")?.remove()
  }

  // Save quiz result to Supabase
  async function saveResult(passed) {
    try {
      const { saveQuizResult, supabase } = await import('./supabase.js')
      const { data } = await supabase.auth.getUser()
      const activeModule = document.querySelector(".module-item.active .module-name")?.textContent || "General"

      await saveQuizResult(
        data.user?.email,
        sessionStorage.getItem("employeeId") || data.user?.email,
        activeModule,
        score,
        TOTAL_QUESTIONS,
        passed
      )

      await markPassedModules()
    } catch (err) {
      console.error("Failed to save result:", err)
    }
  }

  // Reset quiz state
  function resetQuiz() {
    messages.length = 0
    messages.push({ role: "system", content: buildSystemPrompt(currentPolicy) })
    questionCount = 0
    score = 0
    quizStarted = false
    progressFill.style.width = "0%"
    progressLabel.textContent = `Question 1 of ${TOTAL_QUESTIONS}`
    scoreLabel.textContent = "Score: 0"
    chat.innerHTML = ""
  }

  // Handle AI reply
  function handleReply(reply) {
    messages.push({ role: "assistant", content: reply })
    removeTypingIndicator()
    addBubble(reply, "genie")

    const hasResult = reply.includes("RESULT: PASS") || reply.includes("RESULT: FAIL")

    // Track score and question count
    if (quizStarted && !hasResult) {
      const isCorrect = /^correct!/i.test(reply.trim())
      if (isCorrect) {
        score++
        scoreLabel.textContent = `Score: ${score}`
      }
      const isFeedback = /^correct!|^incorrect\./i.test(reply.trim())
      if (isFeedback && questionCount < TOTAL_QUESTIONS) {
        questionCount++
        progressLabel.textContent = `Question ${questionCount} of ${TOTAL_QUESTIONS}`
        progressFill.style.width = `${(questionCount / TOTAL_QUESTIONS) * 100}%`
      }
    }

    // Force final summary if all questions done
    if (questionCount >= TOTAL_QUESTIONS && !hasResult) {
      askITMS(`All ${TOTAL_QUESTIONS} questions have been answered. 
      Give the final summary now. 
      Correct answers: ${score} out of ${TOTAL_QUESTIONS}.
      End with RESULT: PASS or RESULT: FAIL.`)
      return
    }

    // Show results
    if (hasResult) {
      const failed = reply.includes("RESULT: FAIL")
      saveResult(!failed)

      if (failed) {
        setTimeout(() => {
          resetQuiz()
          inputSection.classList.add("hidden")
          resultSection.classList.remove("hidden")
          finalScore.textContent = `${score}/${TOTAL_QUESTIONS}`
          restartBtn.textContent = "Review Policy & Retry"
          if (pdfViewer) pdfViewer.classList.add("hidden")
          score = 0
        }, 2000)
      } else {
        setTimeout(() => {
          inputSection.classList.add("hidden")
          resultSection.classList.remove("hidden")
          finalScore.textContent = `${score}/${TOTAL_QUESTIONS}`
          restartBtn.textContent = "Back to Home"
          restartBtn.onclick = () => window.location.href = "landing.html"
          score = 0
        }, 1000)
      }
    }
  }

  // Send message to AI
  async function askITMS(userMessage) {
    messages.push({ role: "user", content: userMessage })
    trimMessages()
    addTypingIndicator()

    try {
      const response = await openai.chat.completions.create({
        model: import.meta.env.VITE_GROQ_API_MODEL,
        messages,
      })
      handleReply(response.choices[0].message.content)

    } catch (err) {
      removeTypingIndicator()
      console.error(err)

      if (err.status === 429) {
        const fallbackModel = import.meta.env.VITE_GROQ_API_MODEL_FALLBACK
        if (fallbackModel) {
          addBubble("⚠️ Switching to backup model, please wait...", "genie")
          try {
            const strictMessages = [
              messages[0],
              {
                role: "system",
                content: `REMINDER: Ask EXACTLY ${TOTAL_QUESTIONS} questions. 
                Current count: ${questionCount}.
                Always start feedback with "Correct!" or "Incorrect."
                End with RESULT: PASS or RESULT: FAIL after all questions.`
              },
              ...messages.slice(1)
            ]
            const retryResponse = await openai.chat.completions.create({
              model: fallbackModel,
              messages: strictMessages,
            })
            handleReply(retryResponse.choices[0].message.content)
          } catch {
            addBubble("⚠️ Both models are unavailable. Please try again later.", "genie")
          }
        } else {
          addBubble("⚠️ Rate limit reached. Please wait a few minutes.", "genie")
        }
      } else if (err.status === 401) {
        addBubble("⚠️ API key error. Please check your .env file.", "genie")
      } else if (err.status === 503 || err.status === 500) {
        addBubble("⚠️ AI service temporarily unavailable. Please try again.", "genie")
      } else {
        addBubble("⚠️ Something went wrong. Please try again.", "genie")
      }
    }
  }

  // Add module to sidebar
  function addModuleToSidebar(name, policyText, fileUrl) {
    const container = document.getElementById("uploaded-modules")
    const item = document.createElement("div")
    item.className = "module-item"
    item.dataset.policy = policyText
    item.dataset.url = fileUrl

    const dot = document.createElement("div")
    dot.className = "module-dot"

    const nameSpan = document.createElement("span")
    nameSpan.className = "module-name"
    nameSpan.textContent = name

    const badge = document.createElement("span")
    badge.className = "module-badge"
    badge.textContent = `${TOTAL_QUESTIONS} Q`

    // Double click to rename
    nameSpan.addEventListener("dblclick", () => {
      const input = document.createElement("input")
      input.className = "edit-input"
      input.value = nameSpan.textContent
      nameSpan.replaceWith(input)
      input.focus()
      input.addEventListener("blur", () => {
        nameSpan.textContent = input.value || name
        input.replaceWith(nameSpan)
      })
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") input.blur()
        if (e.key === "Escape") { nameSpan.textContent = name; input.replaceWith(nameSpan) }
      })
    })

    // Click to select module
    item.addEventListener("click", () => {
      document.querySelectorAll(".module-item").forEach(i => i.classList.remove("active"))
      item.classList.add("active")
      currentPolicy = item.dataset.policy
      resetQuiz()
      quizForm.classList.add("hidden")
      readySection.classList.remove("hidden")
      if (item.dataset.url) {
        pdfFrame.src = item.dataset.url + '#toolbar=0'
        pdfViewer.classList.remove("hidden")
      }
    })

    item.appendChild(dot)
    item.appendChild(nameSpan)
    item.appendChild(badge)
    container.appendChild(item)
    item.click()
  }

  // Load existing modules from Supabase
  async function loadExistingModules() {
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
        addModuleToSidebar(policy.module_name, policy.policy_text || '', policy.file_url)
      }

      // Mark passed modules AFTER all modules are loaded
      await markPassedModules()
    } catch (err) {
      console.error("Failed to load modules:", err)
    }
  }

  // Mark passed modules green
  async function markPassedModules() {
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
    } catch (err) {
      console.error("Failed to load passed modules:", err)
    }
  }

  // ============================================================
  // Event Listeners
  // ============================================================

  // Prevent copy/paste
  userInput.addEventListener("copy", (e) => e.preventDefault())
  userInput.addEventListener("paste", (e) => e.preventDefault())
  userInput.addEventListener("cut", (e) => e.preventDefault())
  userInput.addEventListener("keydown", resetIdleTimer)
  userInput.addEventListener("click", resetIdleTimer)
  document.addEventListener("mousemove", resetIdleTimer)

  // Ready button
  readyBtn.addEventListener("click", async () => {
    chat.innerHTML = ""
    readySection.classList.add("hidden")
    quizForm.classList.remove("hidden")
    questionCount = 0
    quizStarted = true
    if (pdfViewer) pdfViewer.classList.add("hidden")
    await askITMS("I have read the policy and I am ready to start the quiz!")
  })

  // Submit answer
  quizForm.addEventListener("submit", async (e) => {
    e.preventDefault()
    const userMessage = userInput.value.trim()
    if (!userMessage) return

    // 🔧 CHEAT CODE - remove in production!
    if (userMessage.toLowerCase() === "cheat") {
      score = TOTAL_QUESTIONS
      questionCount = TOTAL_QUESTIONS
      quizStarted = false
      progressFill.style.width = "100%"
      progressLabel.textContent = `Question ${TOTAL_QUESTIONS} of ${TOTAL_QUESTIONS}`
      scoreLabel.textContent = `Score: ${score}`
      const activeModule = document.querySelector(".module-item.active .module-name")?.textContent || "General"
      await saveResult(true)
      inputSection.classList.add("hidden")
      resultSection.classList.remove("hidden")
      finalScore.textContent = `${score}/${TOTAL_QUESTIONS}`
      restartBtn.textContent = "Back to Home"
      restartBtn.onclick = () => window.location.href = "landing.html"
      score = 0
      return
    }

    addBubble(userMessage, "user")
    userInput.value = ""
    document.getElementById("submit-btn").disabled = true
    await askITMS(userMessage)
    document.getElementById("submit-btn").disabled = false
  })

  // Restart / Review button
  restartBtn.addEventListener("click", () => {
    restartBtn.textContent = "Start over"
    restartBtn.onclick = null
    resetQuiz()
    inputSection.classList.remove("hidden")
    resultSection.classList.add("hidden")
    quizForm.classList.add("hidden")
    readySection.classList.remove("hidden")
    if (pdfFrame?.src && pdfFrame.src !== window.location.href) {
      pdfViewer.classList.remove("hidden")
    }
  })

  // Sidebar toggle
  closeBtn.addEventListener("click", () => {
    sidebar.classList.add("closed")
    openBtn.classList.remove("hidden")
  })

  openBtn.addEventListener("click", () => {
    sidebar.classList.remove("closed")
    openBtn.classList.add("hidden")
  })

  // Static module items click
  document.querySelectorAll(".module-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".module-item").forEach(i => i.classList.remove("active"))
      item.classList.add("active")
      const url = item.dataset.url
      if (url) {
        pdfFrame.src = url + '#toolbar=0'
        pdfViewer.classList.remove("hidden")
      } else {
        pdfViewer.classList.add("hidden")
      }
    })
  })

  // Upload PDF
  uploadDocBtn.addEventListener("click", () => {
    const fileInput = document.createElement("input")
    fileInput.type = "file"
    fileInput.accept = ".pdf"
    fileInput.click()

    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0]
      if (!file) return

      try {
        const { supabase, extractPDFText, uploadPolicy } = await import('./supabase.js')

        // Check for duplicate
        const { data: existing } = await supabase
          .from('policies')
          .select('id, module_name')
          .eq('file_name', file.name)
          .single()

        if (existing) {
          const confirmOverwrite = confirm(`"${file.name}" already exists as "${existing.module_name}". Replace it?`)
          if (!confirmOverwrite) return
        }

        const defaultName = file.name.replace('.pdf', '')
        const customName = prompt("Enter a name for this module:", defaultName)
        if (customName === null) return

        const moduleName = customName.trim() || defaultName
        const policyText = await extractPDFText(file)
        const fileUrl = await uploadPolicy(file, moduleName, policyText)

        currentPolicy = policyText
        resetQuiz()
        quizForm.classList.add("hidden")
        readySection.classList.remove("hidden")
        pdfFrame.src = fileUrl + '#toolbar=0'
        pdfViewer.classList.remove("hidden")
        addModuleToSidebar(moduleName, policyText, fileUrl)

      } catch (err) {
        console.error(err)
        addBubble("❌ Failed to upload PDF. Please try again.", "genie")
      }
    })
  })

  // Init
  document.querySelector(".module-item").classList.add("active")
  addBubble("👋 Welcome! Upload a policy PDF from the sidebar or select a module, then click <strong>I'm ready</strong> to start the quiz.", "genie")
  loadExistingModules()
})