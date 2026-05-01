// Import the tools we need
import OpenAI from "openai"
import { marked } from "marked"
import DOMPurify from "dompurify"
import { checkEnvironment } from "./utils.js"

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

// Build system prompt from policy text
function buildSystemPrompt(policy) {
  return `You are IT artificial intelligence, an IT policy quiz assistant.

Your job has two phases:

PHASE 1 - SHOW POLICY:
- First, display the following IT policy in a clear, readable markdown format
- After showing the policy, ask the user if they are ready to start the quiz
- Wait for the user to confirm before starting

PHASE 2 - QUIZ:
- Ask one question at a time about the IT policy
- Wait for the user's answer
- Evaluate if their answer is correct based on the policy
- Give brief feedback (1-2 sentences) explaining if they're right or wrong and why
- Then ask the next question
- After 5 questions, give a final summary with their score out of 5

Passing score is 4 out of 5.

If the user PASSES (4 or 5 out of 5):
- Congratulate them warmly
- Tell them they have passed the IT policy quiz
- End with "RESULT: PASS"

If the user FAILS (3 or less out of 5):
- Encourage them kindly
- Tell them they need to retake the quiz
- End with "RESULT: FAIL"

Rules:
- Ask clear, specific questions about the do's and don'ts
- Randomize the questions each time the quiz is taken
- Avoid yes/no questions, ask open-ended ones that require explanation
- Use scenario-based open-ended questions
- Require the user to explain WHY, not just WHAT
- Be encouraging but accurate in your feedback
- Keep feedback brief and clear
- Always start your feedback with "Correct!" if the answer is right
- Always start your feedback with "Incorrect." if the answer is wrong
- Track the score internally and mention it in the final summary
- Format your final summary with markdown

Here is the IT policy to show and quiz about:
${policy}`
}

let questionCount = 0
let score = 0
let quizStarted = false
let idleTimer = null
let currentPolicy = IT_POLICY
const IDLE_LIMIT = 60000

const messages = [
  { role: "system", content: buildSystemPrompt(currentPolicy) }
]

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

  function resetIdleTimer() {
    clearTimeout(idleTimer)
    if (!quizStarted) return
    idleTimer = setTimeout(() => {
      const userMessage = userInput.value.trim()
      if (userMessage) {
        addBubble(userMessage, "user")
        userInput.value = ""
        document.getElementById("submit-btn").disabled = true
        askITMS(userMessage).then(() => {
          document.getElementById("submit-btn").disabled = false
        })
      } else {
        addBubble("⏱️ Time's up! No answer was submitted.", "user")
        document.getElementById("submit-btn").disabled = true
        askITMS("The user ran out of time and did not answer this question. Mark it as incorrect and move on.").then(() => {
          document.getElementById("submit-btn").disabled = false
        })
      }
    }, IDLE_LIMIT)
  }

  function trimMessages() {
    if (messages.length > 7) {
      messages.splice(1, messages.length - 7)
    }
  }

  function addBubble(text, type) {
    const row = document.createElement("div")
    row.className = `bubble-row ${type === "user" ? "user" : ""}`

    const avatar = document.createElement("div")
    avatar.className = `avatar ${type === "user" ? "user" : "genie"}`
    avatar.innerHTML = type === "user" ? "ME" : `<img src="/itms_baby/PNG/ITMS 32PX N.png" alt="ITMS" />`

    const bubble = document.createElement("div")
    bubble.className = `bubble ${type}`

    if (type === "genie") {
      bubble.innerHTML = DOMPurify.sanitize(marked.parse(text))
    } else {
      bubble.textContent = text
    }

    if (type === "user") {
      row.appendChild(bubble)
      row.appendChild(avatar)
    } else {
      row.appendChild(avatar)
      row.appendChild(bubble)
    }

    chat.appendChild(row)
    chat.scrollTop = chat.scrollHeight
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
  }

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
    const typing = document.getElementById("typing")
    if (typing) typing.remove()
  }

  async function askITMS(userMessage) {
    messages.push({ role: "user", content: userMessage })
    trimMessages()
    addTypingIndicator()

    function handleReply(reply) {
      messages.push({ role: "assistant", content: reply })
      removeTypingIndicator()
      addBubble(reply, "genie")

      if (quizStarted && questionCount < 5) {
        questionCount++
        const isCorrect = /^correct|^that'?s right|^great|^well done|^yes,|^absolutely/i.test(reply.trim())
        if (isCorrect) score++
        progressLabel.textContent = `Question ${questionCount} of 5`
        progressFill.style.width = `${(questionCount / 5) * 100}%`
        scoreLabel.textContent = `Score: ${score}`
      }

      if (questionCount >= 5) {
        const scoreMatch = reply.match(/(\d)\s*out\s*of\s*5/i)
        if (scoreMatch) score = parseInt(scoreMatch[1])

        const failed = reply.includes("RESULT: FAIL")

        if (failed) {
          setTimeout(() => {
            addBubble("Starting the quiz over. Good luck this time! 💪", "genie")
            messages.length = 0
            messages.push({ role: "system", content: buildSystemPrompt(currentPolicy) })
            questionCount = 0
            score = 0
            quizStarted = false
            progressFill.style.width = "0%"
            progressLabel.textContent = "Question 1 of 5"
            scoreLabel.textContent = "Score: 0"
            quizForm.classList.add("hidden")
            readySection.classList.remove("hidden")
            setTimeout(() => askITMS("Please show me the IT policy."), 1500)
          }, 2000)
        } else {
          setTimeout(() => {
            inputSection.classList.add("hidden")
            resultSection.classList.remove("hidden")
            finalScore.textContent = `${score}/5`
          }, 1000)
        }
      }
    }

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
            const retryResponse = await openai.chat.completions.create({
              model: fallbackModel,
              messages,
            })
            handleReply(retryResponse.choices[0].message.content)
          } catch (retryErr) {
            addBubble("⚠️ Both models are unavailable. Please try again later.", "genie")
          }
        } else {
          addBubble("⚠️ Rate limit reached. Please wait a few minutes and try again.", "genie")
        }
      } else if (err.status === 401) {
        addBubble("⚠️ API key error. Please check your .env file and restart.", "genie")
      } else if (err.status === 503 || err.status === 500) {
        addBubble("⚠️ The AI service is temporarily unavailable. Please try again in a moment.", "genie")
      } else {
        addBubble("⚠️ Something went wrong. Please try again.", "genie")
      }
    }
  }

  // Event listeners
  userInput.addEventListener("copy", (e) => e.preventDefault())
  userInput.addEventListener("paste", (e) => e.preventDefault())
  userInput.addEventListener("cut", (e) => e.preventDefault())
  userInput.addEventListener("keydown", resetIdleTimer)
  userInput.addEventListener("click", resetIdleTimer)
  document.addEventListener("mousemove", resetIdleTimer)

  readyBtn.addEventListener("click", async () => {
    chat.innerHTML = ""
    readySection.classList.add("hidden")
    quizForm.classList.remove("hidden")
    questionCount = 0
    quizStarted = true
    await askITMS("I have read the policy and I am ready to start the quiz!")
  })

  quizForm.addEventListener("submit", async (e) => {
    e.preventDefault()
    const userMessage = userInput.value.trim()
    if (!userMessage) return
    addBubble(userMessage, "user")
    userInput.value = ""
    document.getElementById("submit-btn").disabled = true
    await askITMS(userMessage)
    document.getElementById("submit-btn").disabled = false
  })

  restartBtn.addEventListener("click", () => {
    quizStarted = false
    messages.length = 0
    messages.push({ role: "system", content: buildSystemPrompt(currentPolicy) })
    questionCount = 0
    score = 0
    chat.innerHTML = ""
    progressFill.style.width = "0%"
    progressLabel.textContent = "Question 1 of 5"
    scoreLabel.textContent = "Score: 0"
    inputSection.classList.remove("hidden")
    resultSection.classList.add("hidden")
    quizForm.classList.add("hidden")
    readySection.classList.remove("hidden")
    askITMS("Please show me the IT policy.")
  })

  closeBtn.addEventListener("click", () => {
    sidebar.classList.add("closed")
    openBtn.classList.remove("hidden")
  })

  openBtn.addEventListener("click", () => {
    sidebar.classList.remove("closed")
    openBtn.classList.add("hidden")
  })

  document.querySelectorAll(".module-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".module-item").forEach(i => i.classList.remove("active"))
      item.classList.add("active")
    })
  })

  // Handle PDF upload
  uploadDocBtn.addEventListener("click", () => {
    const fileInput = document.createElement("input")
    fileInput.type = "file"
    fileInput.accept = ".pdf"
    fileInput.click()

    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0]
      if (!file) return

      const activeModule = document.querySelector(".module-item.active .module-name")?.textContent || "General"

      addBubble(`📄 Uploading "${file.name}"...`, "genie")

      try {
        const { extractPDFText, uploadPolicy } = await import('./supabase.js')

        addBubble("Reading PDF content...", "genie")
        const policyText = await extractPDFText(file)

        await uploadPolicy(file, activeModule)

        // Save new policy and update system prompt
        currentPolicy = policyText
        messages[0] = {
          role: "system",
          content: buildSystemPrompt(currentPolicy)
        }

        addBubble(`✅ "${file.name}" uploaded! The quiz will now be based on this policy.`, "genie")

        // Reset quiz state
        messages.length = 0
        messages.push({ role: "system", content: buildSystemPrompt(currentPolicy) })
        questionCount = 0
        score = 0
        quizStarted = false
        progressFill.style.width = "0%"
        progressLabel.textContent = "Question 1 of 5"
        scoreLabel.textContent = "Score: 0"
        quizForm.classList.add("hidden")
        readySection.classList.remove("hidden")
        chat.innerHTML = ""

        askITMS("Please show me the uploaded IT policy.")

      } catch (err) {
        console.error(err)
        addBubble("❌ Failed to upload PDF. Please try again.", "genie")
      }
    })
  })

  document.querySelector(".module-item").classList.add("active")
  askITMS("Please show me the IT policy.")
})