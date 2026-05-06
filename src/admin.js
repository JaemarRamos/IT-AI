import { supabase, createEmployee } from './supabase.js'

// Redirect if not logged in or not admin
const user = JSON.parse(sessionStorage.getItem("user") || "{}")
if (!sessionStorage.getItem("loggedIn")) {
  window.location.href = "login.html"
}

const createBtn = document.getElementById("create-btn")
const errorMsg = document.getElementById("error-msg")
const successMsg = document.getElementById("success-msg")

createBtn.addEventListener("click", async () => {
  const employeeId = document.getElementById("employee-id").value.trim()
  const fullName = document.getElementById("full-name").value.trim()
  const email = document.getElementById("email").value.trim()
  const password = document.getElementById("password").value.trim()
  const role = document.getElementById("role").value

  // Validate
  if (!employeeId || !fullName || !email || !password) {
    errorMsg.textContent = "Please fill in all fields."
    successMsg.textContent = ""
    return
  }

  if (!/^\d+$/.test(employeeId)) {
    errorMsg.textContent = "Employee ID must be numbers only."
    return
  }

  createBtn.textContent = "Creating..."
  createBtn.disabled = true
  errorMsg.textContent = ""
  successMsg.textContent = ""

  try {
    await createEmployee(employeeId, password, fullName, email, role)
    successMsg.textContent = `✅ Employee ${fullName} (ID: ${employeeId}) created successfully!`
    
    // Clear form
    document.getElementById("employee-id").value = ""
    document.getElementById("full-name").value = ""
    document.getElementById("email").value = ""
    document.getElementById("password").value = ""

  } catch (err) {
    console.error(err)
    if (err.message.includes("already registered")) {
      errorMsg.textContent = "Employee ID already exists!"
    } else {
      errorMsg.textContent = "Failed to create employee. " + err.message
    }
  }

  createBtn.textContent = "Create Employee"
  createBtn.disabled = false
})

document.getElementById("logout-btn").addEventListener("click", async () => {
  const { logout } = await import('./supabase.js')
  await logout()
})