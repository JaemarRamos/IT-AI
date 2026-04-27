export function autoResizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export function setLoading(isLoading) {
  const lampButton = document.getElementById("lamp-button");
  const lampText = document.querySelector(".lamp-text");
  const userInput = document.getElementById("user-input");
  const outputContainer = document.getElementById("output-container");

  lampButton.disabled = isLoading;

  if (isLoading) {
    userInput.style.height = "auto";
    outputContainer.classList.add("hidden");
    outputContainer.classList.remove("visible");
    lampButton.classList.remove("compact");
    lampButton.classList.add("loading");
    lampText.textContent = "Summoning Gift Ideas...";
  } else {
    outputContainer.classList.remove("hidden");
    outputContainer.classList.add("visible");
    lampButton.classList.remove("loading");
    lampButton.classList.add("compact");
    lampText.textContent = "Rub the Lamp";
  }
}

export function checkEnvironment() {
  if (!import.meta.env.VITE_GROQ_API_KEY) {
    throw new Error("Missing VITE_GROQ_API_KEY.");
  }
  if (!import.meta.env.VITE_GROQ_API_URL) {
    throw new Error("Missing VITE_GROQ_API_URL.");
  }
  if (!import.meta.env.VITE_GROQ_API_MODEL) {
    throw new Error("Missing VITE_GROQ_API_MODEL.");
  }
  console.log("AI provider URL:", import.meta.env.VITE_GROQ_API_URL);
  console.log("AI model:", import.meta.env.VITE_GROQ_API_MODEL);
}

export function showStream() {
  const outputContainer = document.getElementById("output-container");
  outputContainer.classList.remove("hidden");
  outputContainer.classList.add("visible");
}