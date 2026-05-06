import { supabase } from './supabase.js'

const loginBtn = document.getElementById("login-btn")
const emailInput = document.getElementById("email")
const passwordInput = document.getElementById("password")
const errorMsg = document.getElementById("error-msg")

loginBtn.addEventListener("click", async () => {
  const input = emailInput.value.trim()
  const password = passwordInput.value.trim()

  if (!input || !password) {
    errorMsg.textContent = "Please fill in all fields."
    return
  }

  loginBtn.textContent = "Signing in..."
  loginBtn.disabled = true

  const email = input.includes("@") ? input : `${input}@jae.com.ph`

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    errorMsg.textContent = "Invalid credentials. Please try again."
    loginBtn.textContent = "Sign in"
    loginBtn.disabled = false
    return
  }

  // Fetch profile to get real name and email
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, employee_id, role')
    .eq('id', data.user.id)
    .single()

  sessionStorage.setItem("loggedIn", "true")
  sessionStorage.setItem("employeeId", profile?.employee_id || input)
  sessionStorage.setItem("user", JSON.stringify({
    id: data.user.id,
    email: profile?.email || email,        // real email
    name: profile?.full_name || input,     // real full name
    role: profile?.role || "employee",
    authEmail: email                        // keep auth email for admin check
  }))

  window.location.href = "index.html"
})

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginBtn.click()
})