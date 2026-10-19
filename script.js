const BOARD_SIZE = 9;
const MINE_TOTAL = 10;

const boardElement = document.querySelector("#board");
const mineCountElement = document.querySelector("#mine-count");
const timerElement = document.querySelector("#timer");
const resetButton = document.querySelector("#reset-button");
const resultMessage = document.querySelector("#result-message");

let cells = [];
let flags = 0;
let revealedSafeCells = 0;
let gameState = "ready";
let seconds = 0;
let timerId = null;

function createBoard() {
  boardElement.innerHTML = "";
  cells = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => ({
    index,
    isMine: false,
    isRevealed: false,
    isFlagged: false,
    adjacentMines: 0,
  }));

  cells.forEach((cell) => {
    const button = document.createElement("button");
    button.className = "cell";
    button.type = "button";
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `${getRow(cell.index) + 1}행 ${getColumn(cell.index) + 1}열, 닫힌 칸`);
    let chordHandled = false;
    let simultaneousClickPending = false;
    button.addEventListener("mousedown", (event) => {
      const leftAndRightPressed = (event.buttons & 3) === 3;
      if (event.button === 1 || leftAndRightPressed) {
        event.preventDefault();
        chord(cell.index);
        chordHandled = leftAndRightPressed;
        simultaneousClickPending = leftAndRightPressed;
      }
    });
    button.addEventListener("click", () => {
      if (simultaneousClickPending) {
        simultaneousClickPending = false;
        chordHandled = false;
        return;
      }
      if (chordHandled) {
        chordHandled = false;
        return;
      }
      revealCell(cell.index);
    });
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (chordHandled) {
        chordHandled = false;
        simultaneousClickPending = false;
        return;
      }
      toggleFlag(cell.index);
    });
    cell.element = button;
    boardElement.appendChild(button);
  });
}

function getRow(index) {
  return Math.floor(index / BOARD_SIZE);
}

function getColumn(index) {
  return index % BOARD_SIZE;
}

function getNeighbors(index) {
  const row = getRow(index);
  const column = getColumn(index);
  const neighbors = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) continue;
      const neighborRow = row + rowOffset;
      const neighborColumn = column + columnOffset;
      if (
        neighborRow >= 0 &&
        neighborRow < BOARD_SIZE &&
        neighborColumn >= 0 &&
        neighborColumn < BOARD_SIZE
      ) {
        neighbors.push(neighborRow * BOARD_SIZE + neighborColumn);
      }
    }
  }
  return neighbors;
}

function placeMines(firstIndex) {
  const safeIndexes = new Set([firstIndex, ...getNeighbors(firstIndex)]);
  const availableIndexes = cells
    .map((cell) => cell.index)
    .filter((index) => !safeIndexes.has(index));

  for (let index = availableIndexes.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [availableIndexes[index], availableIndexes[randomIndex]] = [
      availableIndexes[randomIndex],
      availableIndexes[index],
    ];
  }

  availableIndexes.slice(0, MINE_TOTAL).forEach((index) => {
    cells[index].isMine = true;
  });

  cells.forEach((cell) => {
    cell.adjacentMines = getNeighbors(cell.index).filter(
      (neighborIndex) => cells[neighborIndex].isMine,
    ).length;
  });
}

function revealCell(index) {
  const cell = cells[index];
  if (gameState === "won" || gameState === "lost" || cell.isRevealed || cell.isFlagged) {
    return;
  }

  if (gameState === "ready") {
    placeMines(index);
    gameState = "playing";
    startTimer();
  }

  if (cell.isMine) {
    cell.isRevealed = true;
    cell.element.classList.add("revealed", "mine", "exploded");
    cell.element.textContent = "✹";
    endGame(false);
    return;
  }

  revealSafeArea(index);
  if (revealedSafeCells === cells.length - MINE_TOTAL) {
    endGame(true);
  }
}

function chord(index) {
  const cell = cells[index];
  if (
    gameState === "ready" ||
    gameState === "won" ||
    gameState === "lost" ||
    !cell.isRevealed ||
    cell.adjacentMines === 0
  ) {
    return;
  }

  const neighbors = getNeighbors(index);
  const flaggedNeighbors = neighbors.filter(
    (neighborIndex) => cells[neighborIndex].isFlagged,
  ).length;
  if (flaggedNeighbors !== cell.adjacentMines) return;

  neighbors
    .filter((neighborIndex) => !cells[neighborIndex].isFlagged)
    .forEach((neighborIndex) => revealCell(neighborIndex));
}

function revealSafeArea(startIndex) {
  const queue = [startIndex];
  const visited = new Set();

  while (queue.length > 0) {
    const index = queue.shift();
    const cell = cells[index];
    if (visited.has(index) || cell.isRevealed || cell.isFlagged || cell.isMine) continue;
    visited.add(index);
    cell.isRevealed = true;
    revealedSafeCells += 1;
    renderCell(cell);

    if (cell.adjacentMines === 0) {
      getNeighbors(index).forEach((neighborIndex) => {
        if (!visited.has(neighborIndex)) queue.push(neighborIndex);
      });
    }
  }
}

function toggleFlag(index) {
  const cell = cells[index];
  if (gameState === "won" || gameState === "lost" || cell.isRevealed) return;
  if (gameState === "ready") {
    gameState = "playing";
    startTimer();
  }
  if (!cell.isFlagged && flags >= MINE_TOTAL) return;

  cell.isFlagged = !cell.isFlagged;
  flags += cell.isFlagged ? 1 : -1;
  renderCell(cell);
  updateMineCount();
}

function renderCell(cell, showMine = false) {
  const element = cell.element;
  element.className = "cell";
  element.textContent = "";

  if (showMine || (cell.isRevealed && cell.isMine)) {
    element.classList.add("revealed", "mine");
    element.textContent = "✹";
  } else if (cell.isFlagged) {
    element.classList.add("flagged");
    element.textContent = "⚑";
  } else if (cell.isRevealed) {
    element.classList.add("revealed");
    if (cell.adjacentMines > 0) {
      element.classList.add(`number-${cell.adjacentMines}`);
      element.textContent = cell.adjacentMines;
    }
  }

  const stateLabel = cell.isFlagged
    ? "깃발 표시"
    : cell.isRevealed
      ? cell.isMine
        ? "지뢰"
        : cell.adjacentMines === 0
          ? "빈 칸"
          : `주변 지뢰 ${cell.adjacentMines}개`
      : "닫힌 칸";
  element.setAttribute(
    "aria-label",
    `${getRow(cell.index) + 1}행 ${getColumn(cell.index) + 1}열, ${stateLabel}`,
  );
}

function endGame(won) {
  gameState = won ? "won" : "lost";
  stopTimer();
  if (!won) {
    cells.filter((cell) => cell.isMine).forEach((cell) => renderCell(cell, true));
  } else {
    cells.filter((cell) => cell.isMine && !cell.isFlagged).forEach((cell) => {
      cell.isFlagged = true;
      flags += 1;
      renderCell(cell);
    });
    updateMineCount();
  }
  resultMessage.textContent = won ? "완벽해요! 모든 지뢰를 찾았습니다." : "지뢰를 밟았습니다. 다시 도전해보세요.";
  resultMessage.classList.toggle("lose", !won);
  resultMessage.classList.add("visible");
}

function startTimer() {
  if (timerId) return;
  timerId = setInterval(() => {
    seconds = Math.min(seconds + 1, 999);
    timerElement.textContent = String(seconds).padStart(3, "0");
  }, 1000);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function updateMineCount() {
  mineCountElement.textContent = String(MINE_TOTAL - flags).padStart(2, "0");
}

function resetGame() {
  stopTimer();
  flags = 0;
  revealedSafeCells = 0;
  seconds = 0;
  gameState = "ready";
  timerElement.textContent = "000";
  updateMineCount();
  resultMessage.classList.remove("visible", "lose");
  createBoard();
}

resetButton.addEventListener("click", resetGame);
resetGame();
