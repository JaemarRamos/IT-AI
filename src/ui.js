import { marked } from "marked"
import DOMPurify from "dompurify"

export function addBubble(chat, text, type, userInitials = "ME") {
  const row = document.createElement("div")
  row.className = `bubble-row ${type === "user" ? "user" : ""}`

  const avatar = document.createElement("div")
  avatar.className = `avatar ${type === "user" ? "user" : "genie"}`
  avatar.innerHTML = type === "user"
    ? userInitials
    : `<img src="/itms_baby/PNG/ITMS 32PX N.png" alt="ITMS" />`

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
}

export function addTypingIndicator(chat) {
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

export function removeTypingIndicator() {
  document.getElementById("typing")?.remove()
}
