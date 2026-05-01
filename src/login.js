import { supabase } from './supabase.js'

const loginBtn = document.getElementById("login-btn")
const emailInput = document.getElementById("email")
const passwordInput = document.getElementById("password")
const errorMsg = document.getElementById("error-msg")

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim()
  const password = passwordInput.value.trim()

  if (!email || !password) {
    errorMsg.textContent = "Please fill in all fields."
    return
  }

  loginBtn.textContent = "Signing in..."
  loginBtn.disabled = true

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    errorMsg.textContent = "Invalid credentials. Please try again."
    loginBtn.textContent = "Sign in"
    loginBtn.disabled = false
    return
  }

  sessionStorage.setItem("loggedIn", "true")
  sessionStorage.setItem("user", JSON.stringify(data.user))
  window.location.href = "index.html"
})

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginBtn.click()
})
