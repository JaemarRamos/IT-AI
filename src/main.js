import OpenAI from "openai"
import { checkEnvironment } from "./utils.js"
import { addBubble, addTypingIndicator, removeTypingIndicator } from "./ui.js"
import { openPDFOverlay, closePDFOverlay } from "./pdf.js"
import { loadExistingModules, markPassedModules, subscribeToNewModules } from "./modules.js"
import { showAdminDashboard } from "./admin-dashboard.js"

if (!sessionStorage.getItem("loggedIn")) {
  window.location.href = "/login.html"
}

checkEnvironment()

const currentUser = JSON.parse(sessionStorage.getItem("user") || "{}")
const isAdmin = Boolean(
  currentUser?.authEmail?.includes("admin") ||
  currentUser?.email?.includes("admin")
)

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

const TOTAL_QUESTIONS = 5 // change to 25 in production
const IDLE_LIMIT = 60000

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

const adminLink = document.getElementById("admin-link")
if (isAdmin) adminLink?.classList.remove("hidden")

window.onblur = () => {
  const quizForm = document.getElementById("quiz-form")
  const overlay = document.getElementById("blur-overlay")
  if (!quizForm || quizForm.classList.contains("hidden")) return
  overlay.style.cssText = "display:flex!important;position:fixed;inset:0;background:rgba(245,243,239,0.88);backdrop-filter:blur(16px);z-index:9999;align-items:center;justify-content:center;"
}

window.onfocus = () => {
  const overlay = document.getElementById("blur-overlay")
  if (overlay) overlay.style.cssText = "display:none;"
}

document.addEventListener("DOMContentLoaded", () => {
  // DOM refs
  const chat          = document.getElementById("chat")
  const userInput     = document.getElementById("user-input")
  const quizForm      = document.getElementById("quiz-form")
  const inputSection  = document.getElementById("input-section")
  const resultSection = document.getElementById("result-section")
  const progressFill  = document.getElementById("progress-fill")
  const progressLabel = document.getElementById("progress-label")
  const scoreLabel    = document.getElementById("score-label")
  const finalScore    = document.getElementById("final-score")
  const restartBtn    = document.getElementById("restart-btn")
  const readySection  = document.getElementById("ready-section")
  const readyBtn      = document.getElementById("ready-btn")
  const openBtn       = document.getElementById("open-btn")
  const sidebar       = document.getElementById("sidebar")
  const uploadDocBtn  = document.querySelector(".upload-doc-btn")
  const pdfViewer     = document.getElementById("pdf-viewer")
  const acctChip      = document.getElementById("acct-chip")
  const acctDropdown  = document.getElementById("acct-dropdown")
  const pdfBackBtn    = document.getElementById("pdf-back-btn")
  const pdfReadyBtn   = document.getElementById("pdf-ready-btn")
  const headerCenter  = document.querySelector(".header-center")
  const ddEmail       = document.getElementById("dd-email")
  const ddFullname    = document.getElementById("dd-fullname")
  const acctName      = document.querySelector(".acct-name")
  const acctAv        = document.querySelector(".acct-av")
  const sbAvatar      = document.querySelector(".sb-avatar")

  // Hide progress bar on landing
  headerCenter.classList.add("hidden")

  // Hide employee view immediately for admin
  if (isAdmin) {
    document.getElementById("ready-section").innerHTML = `
      <div class="landing-welcome">
        <div>
          <h2 class="landing-title">Admin Dashboard</h2>
          <p class="landing-sub">Loading results...</p>
        </div>
      </div>
    `
    document.getElementById("ready-btn")?.classList.add("hidden")
    document.getElementById("input-section")?.classList.add("hidden")
  }

  // Hide upload button for non-admins
  if (!isAdmin && uploadDocBtn) uploadDocBtn.style.display = "none"

  // Populate account info
  if (currentUser?.email) {
    if (ddEmail)    ddEmail.textContent    = currentUser.email
    if (ddFullname) ddFullname.textContent = currentUser.name || currentUser.email

    const nameParts = (currentUser.name || currentUser.email || "ME").split(/[\s@]/).filter(Boolean)
    const initials = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : nameParts[0].slice(0, 2).toUpperCase()

    if (acctName)  acctName.textContent = currentUser.name || "Account"
    if (acctAv)    acctAv.textContent   = initials
    if (sbAvatar)  sbAvatar.textContent = initials
  }

  // ── Core functions ──────────────────────────────────────────

  function resetQuiz(newPolicy = null) {
    if (newPolicy !== null) currentPolicy = newPolicy
    messages.length = 0
    messages.push({ role: "system", content: buildSystemPrompt(currentPolicy) })
    questionCount = 0
    score = 0
    quizStarted = false
    progressFill.style.width = "0%"
    progressLabel.textContent = `Question 1 of ${TOTAL_QUESTIONS}`
    scoreLabel.textContent = "Score: 0"
    chat.innerHTML = ""
    headerCenter.classList.add("hidden")
  }

  function resetIdleTimer() {
    clearTimeout(idleTimer)
    if (!quizStarted) return
    idleTimer = setTimeout(() => {
      addBubble(chat, "⏱️ You've been idle for a while. Please type your answer to continue!", "genie")
    }, IDLE_LIMIT)
  }

  function trimMessages() {
    if (messages.length > 7) messages.splice(1, messages.length - 7)
  }

  async function saveResult(passed) {
    try {
      const { saveQuizResult, supabase } = await import('./supabase.js')
      const { data } = await supabase.auth.getUser()
      const activeModule = document.querySelector(".module-item.active .module-name")?.textContent || "General"
      const fullName = currentUser?.name || data.user?.email
      
    await saveQuizResult(
      data.user?.email,
      sessionStorage.getItem("employeeId") || data.user?.email,
      fullName,
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

  function handleReply(reply) {
    messages.push({ role: "assistant", content: reply })
    removeTypingIndicator()
    addBubble(chat, reply, "genie", acctAv?.textContent || "ME")

    const hasResult = reply.includes("RESULT: PASS") || reply.includes("RESULT: FAIL")

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

    if (questionCount >= TOTAL_QUESTIONS && !hasResult) {
      askITMS(`All ${TOTAL_QUESTIONS} questions have been answered. Give the final summary now. Correct answers: ${score} out of ${TOTAL_QUESTIONS}. End with RESULT: PASS or RESULT: FAIL.`)
      return
    }

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

  async function askITMS(userMessage) {
    messages.push({ role: "user", content: userMessage })
    trimMessages()
    addTypingIndicator(chat)

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
          addBubble(chat, "⚠️ Switching to backup model, please wait...", "genie")
          try {
            const strictMessages = [
              messages[0],
              { role: "system", content: `REMINDER: Ask EXACTLY ${TOTAL_QUESTIONS} questions. Current count: ${questionCount}. Always start feedback with "Correct!" or "Incorrect." End with RESULT: PASS or RESULT: FAIL after all questions.` },
              ...messages.slice(1)
            ]
            const retryResponse = await openai.chat.completions.create({ model: fallbackModel, messages: strictMessages })
            handleReply(retryResponse.choices[0].message.content)
          } catch {
            addBubble(chat, "⚠️ Both models are unavailable. Please try again later.", "genie")
          }
        } else {
          addBubble(chat, "⚠️ Rate limit reached. Please wait a few minutes.", "genie")
        }
      } else if (err.status === 401) {
        addBubble(chat, "⚠️ API key error. Please check your .env file.", "genie")
      } else if (err.status === 503 || err.status === 500) {
        addBubble(chat, "⚠️ AI service temporarily unavailable. Please try again.", "genie")
      } else {
        addBubble(chat, "⚠️ Something went wrong. Please try again.", "genie")
      }
    }
  }

  async function initView() {
    if (isAdmin) {
      await showAdminDashboard(TOTAL_QUESTIONS)
    } else {
      await loadExistingModules(isAdmin, TOTAL_QUESTIONS, resetQuiz)
      subscribeToNewModules(isAdmin, TOTAL_QUESTIONS, resetQuiz)
    }
  }

  // ── Event listeners ─────────────────────────────────────────

  // Account dropdown
  acctChip?.addEventListener("click", () => {
    acctDropdown?.classList.toggle("hidden")
  })

  document.addEventListener("click", (e) => {
    if (!document.getElementById("acct-wrap")?.contains(e.target)) {
      acctDropdown?.classList.add("hidden")
    }
  })

  document.getElementById("dd-logout")?.addEventListener("click", async () => {
    const { logout } = await import('./supabase.js')
    await logout()
  })

  // Prevent copy/paste in quiz
  userInput.addEventListener("copy",    (e) => e.preventDefault())
  userInput.addEventListener("paste",   (e) => e.preventDefault())
  userInput.addEventListener("cut",     (e) => e.preventDefault())
  userInput.addEventListener("keydown", resetIdleTimer)
  userInput.addEventListener("click",   resetIdleTimer)
  document.addEventListener("mousemove", resetIdleTimer)

  // PDF overlay
  pdfBackBtn.addEventListener("click", () => closePDFOverlay())

  pdfReadyBtn.addEventListener("click", async () => {
    closePDFOverlay()
    chat.innerHTML = ""
    readySection.classList.add("hidden")
    quizForm.classList.remove("hidden")
    questionCount = 0
    quizStarted = true
    headerCenter.classList.remove("hidden")
    await askITMS("I have read the policy and I am ready to start the quiz!")
  })

  // Built-in module cards
  document.querySelectorAll(".module-item[data-module-name]").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".module-item").forEach(i => i.classList.remove("active"))
      item.classList.add("active")
      pdfViewer.classList.add("hidden")
      resetQuiz(IT_POLICY)
    })
  })

  // Ready button
  readyBtn.addEventListener("click", async () => {
    chat.innerHTML = ""
    readySection.classList.add("hidden")
    quizForm.classList.remove("hidden")
    questionCount = 0
    quizStarted = true
    headerCenter.classList.remove("hidden")
    pdfViewer?.classList.add("hidden")
    await askITMS("I have read the policy and I am ready to start the quiz!")
  })

  // Submit answer
  quizForm.addEventListener("submit", async (e) => {
    e.preventDefault()
    const userMessage = userInput.value.trim()
    if (!userMessage) return

    // 🔧 CHEAT CODE — remove in production!
    if (userMessage.toLowerCase() === "cheat") {
      score         = TOTAL_QUESTIONS
      questionCount = TOTAL_QUESTIONS
      quizStarted   = false
      progressFill.style.width  = "100%"
      progressLabel.textContent = `Question ${TOTAL_QUESTIONS} of ${TOTAL_QUESTIONS}`
      scoreLabel.textContent    = `Score: ${score}`
      await saveResult(true)
      inputSection.classList.add("hidden")
      resultSection.classList.remove("hidden")
      finalScore.textContent = `${score}/${TOTAL_QUESTIONS}`
      restartBtn.textContent = "Back to Home"
      restartBtn.onclick = () => window.location.href = "landing.html"
      score = 0
      return
    }

    addBubble(chat, userMessage, "user", acctAv?.textContent || "ME")
    userInput.value = ""
    document.getElementById("submit-btn").disabled = true
    await askITMS(userMessage)
    document.getElementById("submit-btn").disabled = false
  })

  // Restart button
  restartBtn.addEventListener("click", () => {
    restartBtn.textContent = "Start over"
    restartBtn.onclick = null
    resetQuiz()
    inputSection.classList.remove("hidden")
    resultSection.classList.add("hidden")
    quizForm.classList.add("hidden")
    readySection.classList.remove("hidden")
    pdfViewer.classList.add("hidden")
  })

  // Sidebar toggle
  openBtn?.addEventListener("click", () => {
    sidebar.classList.toggle("closed")
  })

  // Upload PDF
  uploadDocBtn?.addEventListener("click", () => {
    if (!isAdmin) return

    const fileInput  = document.createElement("input")
    fileInput.type   = "file"
    fileInput.accept = ".pdf"
    fileInput.click()

    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0]
      if (!file) return

      try {
        const { supabase, extractPDFText, uploadPolicy } = await import('./supabase.js')

        const { data: existing } = await supabase
          .from('policies')
          .select('id, module_name')
          .eq('file_name', file.name)
          .maybeSingle()

        if (existing) {
          const confirmOverwrite = confirm(`"${file.name}" already exists as "${existing.module_name}". Replace it?`)
          if (!confirmOverwrite) return
        }

        const defaultName = file.name.replace(/\.pdf$/i, '')
        const customName = prompt("Enter a name for this module:", defaultName)
        if (customName === null) return

        const customDesc = prompt("Enter a short description for this module:", "Uploaded policy document")
        if (customDesc === null) return

        const moduleName = customName.trim() || defaultName
        const moduleDesc = customDesc.trim() || "Uploaded policy document"

        const policyText = await extractPDFText(file)
        const fileUrl    = await uploadPolicy(file, moduleName, policyText, moduleDesc)

        currentPolicy = policyText

        if (isAdmin) {
          await showAdminDashboard(TOTAL_QUESTIONS)
        } else {
          resetQuiz()
          // addModuleToSidebar is handled by real-time subscription
        }

      } catch (err) {
        console.error("Upload error:", err.message)
        addBubble(chat, "❌ Failed to upload PDF. Please try again.", "genie")
      }
    })
  })

  // Init
  const firstModule = document.querySelector(".module-item")
  if (firstModule) firstModule.classList.add("active")

  initView()
})