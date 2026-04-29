document.getElementById("login-btn").addEventListener("click", () => {
  sessionStorage.setItem("loggedIn", "true")
  window.location.href = "index.html"
})