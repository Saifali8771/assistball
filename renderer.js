const ballView = document.getElementById("ballView");
const chatView = document.getElementById("chatView");
const ballButton = document.getElementById("ballButton");

const closeButton = document.getElementById("closeButton");
const minimizeButton = document.getElementById("minimizeButton");
const sendButton = document.getElementById("sendButton");
const recaptureButton = document.getElementById("recaptureButton");

const questionInput = document.getElementById("questionInput");
const messages = document.getElementById("messages");
const statusText = document.getElementById("statusText");

const isChatMode =
  new URLSearchParams(window.location.search).get("mode") === "chat";

if (isChatMode) {
  ballView.classList.add("hidden");
  chatView.classList.remove("hidden");
}

/*
  Custom drag:
  - Pointer capture keeps receiving pointer events after the cursor leaves
    the 72x72 Electron window.
  - A small movement threshold distinguishes dragging from clicking.
*/
let pointerId = null;
let dragging = false;
let dragStarted = false;

ballButton?.addEventListener("pointerdown", async (event) => {
  if (event.button !== 0) return;

  pointerId = event.pointerId;
  dragStarted = false;
  dragging = false;

  ballButton.setPointerCapture(pointerId);

  await window.assistBall.startBallDrag(event.screenX, event.screenY);
});

ballButton?.addEventListener("pointermove", async (event) => {
  if (event.pointerId !== pointerId) return;

  const dx = event.movementX || 0;
  const dy = event.movementY || 0;

  if (!dragStarted && Math.hypot(dx, dy) > 2) {
    dragStarted = true;
    dragging = true;
    ballButton.classList.add("dragging");
  }

  if (dragStarted) {
    await window.assistBall.moveBall(event.screenX, event.screenY);
  }
});

ballButton?.addEventListener("pointerup", async (event) => {
  if (event.pointerId !== pointerId) return;

  if (ballButton.hasPointerCapture(pointerId)) {
    ballButton.releasePointerCapture(pointerId);
  }

  const result = await window.assistBall.endBallDrag();

  pointerId = null;
  dragging = false;
  ballButton.classList.remove("dragging");

  // A click opens the assistant; a drag only moves the ball.
  if (!result.moved && !dragStarted) {
    const captureResult = await window.assistBall.openAssistant();

    if (!captureResult.ok) {
      alert(`AssistBall could not capture the screen:\n${captureResult.message}`);
    }
  }

  dragStarted = false;
});

ballButton?.addEventListener("pointercancel", async () => {
  await window.assistBall.endBallDrag();
  pointerId = null;
  dragging = false;
  dragStarted = false;
  ballButton.classList.remove("dragging");
});

closeButton?.addEventListener("click", async () => {
  await window.assistBall.closeChat();
});

minimizeButton?.addEventListener("click", async () => {
  await window.assistBall.closeChat();
});

recaptureButton?.addEventListener("click", async () => {
  statusText.textContent = "Capturing screen...";
  recaptureButton.disabled = true;
  sendButton.disabled = true;

  const result = await window.assistBall.recapture();

  recaptureButton.disabled = false;
  sendButton.disabled = false;

  if (result.ok) {
    statusText.textContent = "Screen captured";
  } else {
    statusText.textContent = "Capture failed";
    addMessage("ai", `I couldn't capture the screen: ${result.message}`);
  }
});

sendButton?.addEventListener("click", sendQuestion);

questionInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendQuestion();
  }
});

function addMessage(type, text) {
  const welcome = messages.querySelector(".welcome");
  if (welcome) welcome.remove();

  const message = document.createElement("div");
  message.className =
    type === "user" ? "message user-message" : "message ai-message";

  message.textContent = text;
  messages.appendChild(message);
  messages.scrollTop = messages.scrollHeight;
}

async function sendQuestion() {
  const question = questionInput.value.trim();

  if (!question) {
    questionInput.focus();
    return;
  }

  addMessage("user", question);
  questionInput.value = "";

  sendButton.disabled = true;
  recaptureButton.disabled = true;
  statusText.textContent = "Analyzing your screen...";

  try {
    const screenshot = await window.assistBall.getScreenshot();

    if (!screenshot.ok) throw new Error(screenshot.message);

    const answer = await getAIResponse(question, screenshot);

    addMessage("ai", answer);
    statusText.textContent = "Ready";
  } catch (error) {
    addMessage("ai", `Something went wrong: ${error.message}`);
    statusText.textContent = "Error";
  } finally {
    sendButton.disabled = false;
    recaptureButton.disabled = false;
  }
}

async function getAIResponse(question, screenshot) {
  const response = await fetch("http://127.0.0.1:8000/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      image_base64: screenshot.base64
    })
  });

  if (!response.ok) {
    throw new Error(`Backend returned HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.answer || "The AI returned no answer.";
}
