/**
 * Blackjack 算牌特訓高手 - 核心邏輯 (穩定修正版)
 * 優化重點：
 * 1. 補回 stopTraining() 函數，確保隨時可以急煞車。
 * 2. 廢除 setInterval，改用遞迴 setTimeout 確保計時器絕對不會重疊暴走。
 */

// --- 基礎配置 ---
const canvas = document.getElementById('trainerCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('resultOverlay');

// 固定解析度確保比例正確
canvas.width = 1600;
canvas.height = 900;

const imgPath = './img/PNG/'; 
const backImgPath = './img/card_back.png'; 

const suits = ['H', 'S', 'C', 'D'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const cardImages = {};
let imagesLoaded = 0;
const totalImages = 53; // 52張 + 1卡背
let isReady = false;

// UI 元素
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const speedRange = document.getElementById('speedRange');
const speedValue = document.getElementById('speedValue');
const deckCountSelect = document.getElementById('deckCount');
const cardsPerDropSelect = document.getElementById('cardsPerDrop');
const statsLeft = document.getElementById('statsLeft');
const statsCount = document.getElementById('statsCount');
const realCountLabel = document.getElementById('realCountLabel');

// 訓練狀態
let deck = [];
let runningCount = 0;
let isTraining = false;
let trainingTimer = null; // 唯一計時器，取代 dropInterval
let startTime = null;
let endTime = null;
let currentOnScreenCards = [];

const cardW = 220;
const cardH = 330;

// --- 1. 圖片載入系統 ---
function preloadImages() {
    const backImg = new Image();
    backImg.src = backImgPath;
    backImg.onload = loader;
    backImg.onerror = () => { console.error("找不到卡背圖片:", backImgPath); loader(); };
    cardImages['back'] = backImg;

    suits.forEach(suit => {
        values.forEach(value => {
            const key = `${value}${suit}`;
            const img = new Image();
            img.src = `${imgPath}${key}.png`;
            img.onload = loader;
            img.onerror = () => { console.error("找不到卡片:", key); loader(); };
            cardImages[key] = img;
        });
    });
}

function loader() {
    imagesLoaded++;
    if (imagesLoaded >= totalImages) {
        isReady = true;
        console.log("所有圖片載入完成");
        drawScene();
    }
}

// --- 2. 算牌邏輯核心 ---
function getHiLoValue(val) {
    if (['2', '3', '4', '5', '6'].includes(val)) return 1;
    if (['7', '8', '9'].includes(val)) return 0;
    if (['10', 'J', 'Q', 'K', 'A'].includes(val)) return -1;
    return 0;
}

function createDeck(num) {
    let d = [];
    for (let i = 0; i < num; i++) {
        suits.forEach(s => {
            values.forEach(v => {
                d.push({ value: v, key: `${v}${s}` });
            });
        });
    }
    return d;
}

function shuffle(d) {
    for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
    }
}

// --- 3. 渲染系統 ---
function drawScene() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 繪製背景牌堆裝飾
    if (deck.length > 0) {
        for (let i = 0; i < Math.min(deck.length / 2, 20); i++) {
            ctx.drawImage(cardImages['back'], 50 + i * 2, 300 - i * 2, 150, 225);
        }
    }

    // 繪製展示卡片
    if (currentOnScreenCards.length > 0) {
        const spacing = cardW + 30;
        const totalW = (currentOnScreenCards.length * cardW) + ((currentOnScreenCards.length - 1) * 30);
        const startX = (canvas.width - totalW) / 2;

        currentOnScreenCards.forEach((card, idx) => {
            const img = cardImages[card.key];
            if (img) {
                ctx.shadowColor = 'rgba(0,0,0,0.4)';
                ctx.shadowBlur = 15;
                ctx.drawImage(img, startX + idx * spacing, (canvas.height - cardH) / 2, cardW, cardH);
                ctx.shadowColor = 'transparent';
            }
        });
    }
}

// --- 4. 絕對安全的訓練流程控制 ---

function startTraining() {
    if (!isReady || isTraining) return;

    isTraining = true;
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    overlay.classList.add('hidden');
    realCountLabel.classList.add('hidden');
    document.getElementById('answerFeedback').classList.add('hidden');
    document.getElementById('userCount').value = '';

    // 1. 建立包含多副牌的完整牌靴 (Shoe)
    let fullShoe = createDeck(parseInt(deckCountSelect.value));
    shuffle(fullShoe);

    // 2. 關鍵神級修正：從洗好的巨大牌堆中，精準「切」出 52 張來特訓！
    // 因為是從多副牌中隨機抽出的 52 張，最後的 Running Count 絕對不會是固定的 0。
    deck = fullShoe.slice(0, 52);
    
    runningCount = 0;
    currentOnScreenCards = [];
    
    updateStats();
    startTime = Date.now();

    // 開始第一次派牌
    scheduleNextDrop(0);
}

// 核心發牌排程器 (取代 setInterval)
function scheduleNextDrop(delay) {
    // 確保沒有殘留的計時器
    if (trainingTimer) clearTimeout(trainingTimer);

    trainingTimer = setTimeout(() => {
        if (!isTraining) return; // 安全鎖

        dropCards();

        // 如果還有牌，排程下一次發牌
        if (deck.length > 0) {
            const speed = parseFloat(speedRange.value) * 1000;
            scheduleNextDrop(speed);
        }
    }, delay);
}

function dropCards() {
    const num = parseInt(cardsPerDropSelect.value);
    currentOnScreenCards = [];

    // 抽牌
    for (let i = 0; i < num; i++) {
        if (deck.length > 0) {
            const card = deck.pop();
            currentOnScreenCards.push(card);
            runningCount += getHiLoValue(card.value);
        }
    }
    
    updateStats();
    drawScene();

    // 如果這是最後一次發牌，等半秒後結算 (讓玩家看清楚最後一張牌)
    if (deck.length === 0) {
        if (trainingTimer) clearTimeout(trainingTimer);
        trainingTimer = setTimeout(() => {
            endTraining(true);
        }, 500);
    }
}

// 強制停止函數 (這個上次漏掉了！)
function stopTraining() {
    endTraining(false);
}

function endTraining(finished) {
    if (!isTraining) return;
    isTraining = false;

    // 清理計時器，徹底煞車
    if (trainingTimer) {
        clearTimeout(trainingTimer);
        trainingTimer = null;
    }

    endTime = Date.now();
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');

    if (finished) {
        showResults();
    } else {
        // 如果是按停止，清空畫面
        currentOnScreenCards = [];
        drawScene();
    }
}

function updateStats() {
    statsLeft.innerText = deck.length;
}

function showResults() {
    overlay.classList.remove('hidden');
    const sec = (endTime - startTime) / 1000;
    document.getElementById('timeResult').innerHTML = `總耗時: <strong>${sec.toFixed(2)}</strong> 秒`;
    
    // 更新結算畫面的文字提示
    const numDecks = deckCountSelect.value;
    document.getElementById('deckResult').innerHTML = `從 ${numDecks} 副牌中隨機抽出 52 張`;
    
    statsCount.innerText = runningCount;
}

// --- 5. 交互與 UI 綁定 ---
function checkCount() {
    const userValInput = document.getElementById('userCount').value;
    if (userValInput === '') {
        alert("請輸入你計算的 Running Count!");
        return;
    }

    const userVal = parseInt(userValInput);
    const feedback = document.getElementById('answerFeedback');
    feedback.classList.remove('hidden');
    realCountLabel.classList.remove('hidden');

    if (userVal === runningCount) {
        feedback.innerText = "完全正確！數感極佳！";
        feedback.className = "correct";
    } else {
        const diff = Math.abs(userVal - runningCount);
        feedback.innerText = `錯誤，相差了 ${diff}。正確答案為 ${runningCount}`;
        feedback.className = "wrong";
    }
}

function prepareNewSession() {
    overlay.classList.add('hidden');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    deck = [];
    currentOnScreenCards = [];
    updateStats();
    drawScene();
}

// 監聽速度滑塊，動態更新顯示數字 (下一張牌自動套用新速度)
speedRange.addEventListener('input', (e) => {
    speedValue.innerText = e.target.value;
});

// 啟動加載
preloadImages();