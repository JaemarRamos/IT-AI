// Import the tools we need
import OpenAI from "openai"
import { marked } from "marked"
import DOMPurify from "dompurify"
import { checkEnvironment } from "./utils.js"

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

const SYSTEM_PROMPT = `You are IT Genie, an IT policy quiz assistant.

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
- Randomize questions every session
- Use scenario-based open-ended questions
- Require the user to explain WHY, not just WHAT
- Be encouraging but accurate in your feedback
- Keep feedback brief and clear
- Track the score internally and mention it in the final summary
- Format your final summary with markdown

Here is the IT policy to show and quiz about:
${IT_POLICY}`

const messages = [
  { role: "system", content: SYSTEM_PROMPT }
]

let questionCount = 0
let score = 0
let quizStarted = false  

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

  function addBubble(text, type) {
    const row = document.createElement("div")
    row.className = `bubble-row ${type === "user" ? "user" : ""}`

    const avatar = document.createElement("div")
    avatar.className = `avatar ${type === "user" ? "user" : "genie"}`
    avatar.textContent = type === "user" ? "ME" : "🧞"

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
    avatar.textContent = "🧞"

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

  async function askGenie(userMessage) {
    messages.push({ role: "user", content: userMessage })
    addTypingIndicator()

    try {
      const response = await openai.chat.completions.create({
        model: import.meta.env.VITE_GROQ_API_MODEL,
        messages,
      })

      const reply = response.choices[0].message.content
      messages.push({ role: "assistant", content: reply })
      removeTypingIndicator()
      addBubble(reply, "genie")

      if (quizStarted) {
            questionCount++
            progressLabel.textContent = `Question ${Math.min(questionCount, 5)} of 5`
            progressFill.style.width = `${Math.min((questionCount / 5) * 100, 100)}%`
          }

      if (questionCount >= 5) {
        const scoreMatch = reply.match(/(\d)\s*out\s*of\s*5/i)
        if (scoreMatch) {
          score = parseInt(scoreMatch[1])
        }

        const failed = reply.includes("RESULT: FAIL")

        if (failed) {
          setTimeout(() => {
            addBubble("Starting the quiz over. Good luck this time! 💪", "genie")
            messages.length = 1
            questionCount = 0
            score = 0
            quizStarted = false
            progressFill.style.width = "0%"
            progressLabel.textContent = "Question 1 of 5"
            scoreLabel.textContent = "Score: 0"
            quizForm.classList.add("hidden")
            readySection.classList.remove("hidden")
            setTimeout(() => askGenie("Please show me the IT policy."), 1500)
          }, 2000)
        } else {
          setTimeout(() => {
            inputSection.classList.add("hidden")
            resultSection.classList.remove("hidden")
            finalScore.textContent = `${score}/5`
          }, 1000)
        }
      }

    } catch (err) {
      removeTypingIndicator()
      console.error(err)
      addBubble("Sorry, something went wrong. Please try again.", "genie")
    }
  }

readyBtn.addEventListener("click", async () => {
  chat.innerHTML = ""
  readySection.classList.add("hidden")
  quizForm.classList.remove("hidden")
  questionCount = 0
  await askGenie("I have read the policy and I am ready to start the quiz!")
  quizStarted = true 
})

  quizForm.addEventListener("submit", async (e) => {
    e.preventDefault()
    const userMessage = userInput.value.trim()
    if (!userMessage) return

    addBubble(userMessage, "user")
    userInput.value = ""
    document.getElementById("submit-btn").disabled = true
    await askGenie(userMessage)
    document.getElementById("submit-btn").disabled = false
  })

  restartBtn.addEventListener("click", () => {
    quizStarted = false
    messages.length = 1
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
    askGenie("Please show me the IT policy.")
  })

  askGenie("Please show me the IT policy.")
})