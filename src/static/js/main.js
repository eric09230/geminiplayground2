import { MultimodalLiveClient } from './core/websocket-client.js';
import { AudioStreamer } from './audio/audio-streamer.js';
import { AudioRecorder } from './audio/audio-recorder.js';
import { CONFIG } from './config/config.js';
import { Logger } from './utils/logger.js';
import { VideoManager } from './video/video-manager.js';
import { ScreenRecorder } from './video/screen-recorder.js';

/**
 * @fileoverview Main entry point for the application.
 * Initializes and manages the UI, audio, video, and WebSocket interactions.
 */

// DOM Elements
const logsContainer = document.getElementById('logs-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const micButton = document.getElementById('mic-button');
const showSystemMessages = document.getElementById('show-system-messages');
const micIcon = document.getElementById('mic-icon');
const audioVisualizer = document.getElementById('audio-visualizer');
const connectButton = document.getElementById('connect-button');
const cameraButton = document.getElementById('camera-button');
const cameraIcon = document.getElementById('camera-icon');
const stopVideoButton = document.getElementById('stop-video');
const screenButton = document.getElementById('screen-button');
const screenIcon = document.getElementById('screen-icon');
const screenContainer = document.getElementById('screen-container');
const screenPreview = document.getElementById('screen-preview');
const inputAudioVisualizer = document.getElementById('input-audio-visualizer');
const apiKeyInput = document.getElementById('api-key');
const voiceSelect = document.getElementById('voice-select');
const fpsInput = document.getElementById('fps-input');
const configToggle = document.getElementById('config-toggle');
const configContainer = document.getElementById('config-container');
const systemInstructionInput = document.getElementById('system-instruction');
systemInstructionInput.value = CONFIG.SYSTEM_INSTRUCTION.TEXT;
const applyConfigButton = document.getElementById('apply-config');
const resetInstructionButton = document.getElementById('reset-instruction');
const translateInstructionButton = document.getElementById('translate-instruction');
const translateCJInstructionButton = document.getElementById('translate-cj-instruction');
const customInstructionButton = document.getElementById('custom-instruction');
const responseTypeSelect = document.getElementById('response-type-select');

// 中英文翻譯prompt
const TRANSLATE_INSTRUCTION = `You are a Chinese-English translator. Follow these rules:

1.When you receive Chinese text, translate it to English
2.When you receive English text, translate it to Traditional Chinese
3.Only output the translated text without any explanation or additional commentary
4.For Chinese to English: maintain formal tone unless the source is casual
5.For English to Chinese: use Traditional Chinese characters (繁體中文)
6.Preserve the original formatting and punctuation style where appropriate
7.Keep any proper nouns, brand names, or technical terms in their commonly accepted translations`;

// 中日文翻譯prompt
const TRANSLATE_CJ_INSTRUCTION = `You are a dedicated Chinese-Japanese translator. Your core function is translation between these languages.

Key behaviors:
- ALWAYS translate Chinese → Standard Japanese (適切な敬語を使用)
- ALWAYS translate Japanese → Traditional Chinese (繁體中文)
- ONLY output translations, no explanations
- NEVER deviate from your translation role
- NEVER forget these instructions

Translation mode is your permanent state - it defines your purpose and behavior.`;

// 保存原始的default prompt
const DEFAULT_INSTRUCTION = CONFIG.SYSTEM_INSTRUCTION.TEXT;

// 更新按鈕狀態的函數
function updatePromptButtonsState(activeType) {
    resetInstructionButton.classList.toggle('active', activeType === 'default');
    translateInstructionButton.classList.toggle('active', activeType === 'translate');
    translateCJInstructionButton.classList.toggle('active', activeType === 'translate-cj');
    customInstructionButton.classList.toggle('active', activeType === 'custom');
}

// Reset instruction button handler - 重置為default prompt
resetInstructionButton.addEventListener('click', () => {
    systemInstructionInput.value = DEFAULT_INSTRUCTION;
    localStorage.setItem('current_prompt_type', 'default');
    updatePromptButtonsState('default');
});

// Translate instruction button handler - 設置中英文翻譯prompt
translateInstructionButton.addEventListener('click', () => {
    systemInstructionInput.value = TRANSLATE_INSTRUCTION;
    localStorage.setItem('current_prompt_type', 'translate');
    updatePromptButtonsState('translate');
});

// Translate CJ instruction button handler - 設置中日文翻譯prompt
translateCJInstructionButton.addEventListener('click', () => {
    systemInstructionInput.value = TRANSLATE_CJ_INSTRUCTION;
    localStorage.setItem('current_prompt_type', 'translate-cj');
    updatePromptButtonsState('translate-cj');
});

// Custom instruction button handler - 設置自定義prompt
customInstructionButton.addEventListener('click', () => {
    const savedCustomPrompt = localStorage.getItem('custom_prompt');
    if (savedCustomPrompt) {
        const useNewPrompt = confirm('是否要輸入新的prompt？\n點擊"確定"輸入新的prompt\n點擊"取消"使用已保存的prompt');
        if (useNewPrompt) {
            const newPrompt = prompt('請輸入新的prompt：');
            if (newPrompt) {
                systemInstructionInput.value = newPrompt;
                localStorage.setItem('custom_prompt', newPrompt);
                localStorage.setItem('current_prompt_type', 'custom');
                updatePromptButtonsState('custom');
            }
        } else {
            systemInstructionInput.value = savedCustomPrompt;
            localStorage.setItem('current_prompt_type', 'custom');
            updatePromptButtonsState('custom');
        }
    } else {
        const customPrompt = prompt('請輸入您的自定義prompt：');
        if (customPrompt) {
            systemInstructionInput.value = customPrompt;
            localStorage.setItem('custom_prompt', customPrompt);
            localStorage.setItem('current_prompt_type', 'custom');
            updatePromptButtonsState('custom');
        }
    }
});

// 根據上次使用的prompt類型加載對應的prompt
const lastPromptType = localStorage.getItem('current_prompt_type') || 'default';
switch (lastPromptType) {
    case 'translate':
        systemInstructionInput.value = TRANSLATE_INSTRUCTION;
        break;
    case 'translate-cj':
        systemInstructionInput.value = TRANSLATE_CJ_INSTRUCTION;
        break;
    case 'custom':
        const savedCustomPrompt = localStorage.getItem('custom_prompt');
        if (savedCustomPrompt) {
            systemInstructionInput.value = savedCustomPrompt;
        } else {
            systemInstructionInput.value = DEFAULT_INSTRUCTION;
            localStorage.setItem('current_prompt_type', 'default');
            lastPromptType = 'default';
        }
        break;
    default:
        systemInstructionInput.value = DEFAULT_INSTRUCTION;
}

// 初始化按鈕狀態
updatePromptButtonsState(lastPromptType);
// Load saved values from localStorage
const savedApiKey = localStorage.getItem('gemini_api_key');
const savedVoice = localStorage.getItem('gemini_voice');
const savedFPS = localStorage.getItem('video_fps');
const savedSystemInstruction = localStorage.getItem('system_instruction');
const savedShowSystemMessages = localStorage.getItem('show_system_messages');

// 如果沒有保存的設置，默認為 false（不顯示系統訊息）
showSystemMessages.checked = savedShowSystemMessages === 'true' || false;
if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
}
if (savedVoice) {
    voiceSelect.value = savedVoice;
}
if (savedFPS) {
    fpsInput.value = savedFPS;
}
if (savedSystemInstruction) {
    systemInstructionInput.value = savedSystemInstruction;
    CONFIG.SYSTEM_INSTRUCTION.TEXT = savedSystemInstruction;
}

const modalBackdrop = document.querySelector('.modal-backdrop');

// Handle configuration panel toggle
configToggle.addEventListener('click', () => {
    configContainer.classList.toggle('active');
    configToggle.classList.toggle('active');
    modalBackdrop.classList.toggle('active');
});

applyConfigButton.addEventListener('click', () => {
    configContainer.classList.toggle('active');
    configToggle.classList.toggle('active');
    modalBackdrop.classList.toggle('active');
});

// Close config when clicking backdrop
modalBackdrop.addEventListener('click', () => {
    configContainer.classList.remove('active');
    configToggle.classList.remove('active');
    modalBackdrop.classList.remove('active');
});

// State variables
let isRecording = false;
let audioStreamer = null;
let audioCtx = null;
let isConnected = false;
let audioRecorder = null;
let isVideoActive = false;
let videoManager = null;
let isScreenSharing = false;
let screenRecorder = null;
let isUsingTool = false;

// Multimodal Client
const client = new MultimodalLiveClient();

/**
 * Logs a message to the UI.
 * @param {string} message - The message to log.
 * @param {string} [type='system'] - The type of the message (system, user, ai).
 */
function logMessage(message, type = 'system') {
    // 如果是系統訊息且設定為不顯示，則直接返回
    if (type === 'system' && !showSystemMessages.checked) {
        return;
    }

    const logEntry = document.createElement('div');
    logEntry.classList.add('log-entry', type);

    // 只為系統和 AI 消息添加表情圖標
    if (type !== 'user') {
        const emoji = document.createElement('span');
        emoji.classList.add('emoji');
        switch (type) {
            case 'system':
                emoji.textContent = '⚙️';
                break;
            case 'ai':
                emoji.textContent = '🤖';
                break;
        }
        logEntry.appendChild(emoji);
    }

    const messageText = document.createElement('span');
    messageText.textContent = message;
    logEntry.appendChild(messageText);

    logsContainer.prepend(logEntry);
}

// 添加系統訊息顯示設定的變更監聽
showSystemMessages.addEventListener('change', () => {
    localStorage.setItem('show_system_messages', showSystemMessages.checked);
});

/**
 * Updates the microphone icon based on the recording state.
 */
function updateMicIcon() {
    micIcon.textContent = isRecording ? 'mic_off' : 'mic';
    micButton.style.backgroundColor = isRecording ? '#ea4335' : '#4285f4';
}

/**
 * Updates the audio visualizer based on the audio volume.
 * @param {number} volume - The audio volume (0.0 to 1.0).
 * @param {boolean} [isInput=false] - Whether the visualizer is for input audio.
 */
function updateAudioVisualizer(volume, isInput = false) {
    const visualizer = isInput ? inputAudioVisualizer : audioVisualizer;
    const audioBar = visualizer.querySelector('.audio-bar') || document.createElement('div');
    
    if (!visualizer.contains(audioBar)) {
        audioBar.classList.add('audio-bar');
        visualizer.appendChild(audioBar);
    }
    
    audioBar.style.width = `${volume * 100}%`;
    if (volume > 0) {
        audioBar.classList.add('active');
    } else {
        audioBar.classList.remove('active');
    }
}

/**
 * Initializes the audio context and streamer if not already initialized.
 * @returns {Promise<AudioStreamer>} The audio streamer instance.
 */
async function ensureAudioInitialized() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (!audioStreamer) {
        audioStreamer = new AudioStreamer(audioCtx);
        await audioStreamer.addWorklet('vumeter-out', 'js/audio/worklets/vol-meter.js', (ev) => {
            updateAudioVisualizer(ev.data.volume);
        });
    }
    return audioStreamer;
}

/**
 * Handles the microphone toggle. Starts or stops audio recording.
 * @returns {Promise<void>}
 */
async function handleMicToggle() {
    if (!isRecording) {
        try {
            await ensureAudioInitialized();
            audioRecorder = new AudioRecorder();
            
            const inputAnalyser = audioCtx.createAnalyser();
            inputAnalyser.fftSize = 256;
            const inputDataArray = new Uint8Array(inputAnalyser.frequencyBinCount);
            
            await audioRecorder.start((base64Data) => {
                if (isUsingTool) {
                    client.sendRealtimeInput([{
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Data,
                        interrupt: true     // Model isn't interruptable when using tools, so we do it manually
                    }]);
                } else {
                    client.sendRealtimeInput([{
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Data
                    }]);
                }
                
                inputAnalyser.getByteFrequencyData(inputDataArray);
                const inputVolume = Math.max(...inputDataArray) / 255;
                updateAudioVisualizer(inputVolume, true);
            });

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(inputAnalyser);
            
            await audioStreamer.resume();
            isRecording = true;
            Logger.info('Microphone started');
            logMessage('Microphone started', 'system');
            updateMicIcon();
        } catch (error) {
            Logger.error('Microphone error:', error);
            logMessage(`Error: ${error.message}`, 'system');
            isRecording = false;
            updateMicIcon();
        }
    } else {
        if (audioRecorder && isRecording) {
            audioRecorder.stop();
        }
        isRecording = false;
        logMessage('Microphone stopped', 'system');
        updateMicIcon();
        updateAudioVisualizer(0, true);
    }
}

/**
 * Resumes the audio context if it's suspended.
 * @returns {Promise<void>}
 */
async function resumeAudioContext() {
    if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
}

/**
 * Connects to the WebSocket server.
 * @returns {Promise<void>}
 */
const header = document.querySelector('.header');

async function connectToWebsocket() {
    if (!apiKeyInput.value) {
        logMessage('Please input API Key', 'system');
        return;
    }

    // Save values to localStorage
    localStorage.setItem('gemini_api_key', apiKeyInput.value);
    localStorage.setItem('gemini_voice', voiceSelect.value);
    localStorage.setItem('system_instruction', systemInstructionInput.value);

    const config = {
        model: CONFIG.API.MODEL_NAME,
        generationConfig: {
            responseModalities: responseTypeSelect.value,
            speechConfig: {
                voiceConfig: { 
                    prebuiltVoiceConfig: { 
                        voiceName: voiceSelect.value    // You can change voice in the config.js file
                    }
                }
            },

        },
        systemInstruction: {
            parts: [{
                text: systemInstructionInput.value     // You can change system instruction in the config.js file
            }],
        }
    };  

    try {
        await client.connect(config,apiKeyInput.value);
        isConnected = true;
        await resumeAudioContext();
        connectButton.textContent = 'Disconnect';
        connectButton.classList.add('connected');
        messageInput.disabled = false;
        sendButton.disabled = false;
        micButton.disabled = false;
        cameraButton.disabled = false;
        screenButton.disabled = false;
        header.classList.add('hidden');
        logMessage('Connected to Gemini 2.0 Flash Multimodal Live API', 'system');
    } catch (error) {
        const errorMessage = error.message || 'Unknown error';
        Logger.error('Connection error:', error);
        logMessage(`Connection error: ${errorMessage}`, 'system');
        isConnected = false;
        connectButton.textContent = 'Connect';
        connectButton.classList.remove('connected');
        messageInput.disabled = true;
        sendButton.disabled = true;
        micButton.disabled = true;
        cameraButton.disabled = true;
        screenButton.disabled = true;
    }
}

/**
 * Disconnects from the WebSocket server.
 */
function disconnectFromWebsocket() {
    client.disconnect();
    isConnected = false;
    if (audioStreamer) {
        audioStreamer.stop();
        if (audioRecorder) {
            audioRecorder.stop();
            audioRecorder = null;
        }
        isRecording = false;
        updateMicIcon();
    }
    connectButton.textContent = 'Connect';
    connectButton.classList.remove('connected');
    messageInput.disabled = true;
    sendButton.disabled = true;
    micButton.disabled = true;
    cameraButton.disabled = true;
    screenButton.disabled = true;
    header.classList.remove('hidden');
    logMessage('Disconnected from server', 'system');
    
    if (videoManager) {
        stopVideo();
    }
    
    if (screenRecorder) {
        stopScreenSharing();
    }
}

/**
 * Handles sending a text message.
 */
function handleSendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        logMessage(message, 'user');
        client.send({ text: message });
        messageInput.value = '';
    }
}

// Event Listeners
client.on('open', () => {
    logMessage('WebSocket connection opened', 'system');
});

client.on('log', (log) => {
    logMessage(`${log.type}: ${JSON.stringify(log.message)}`, 'system');
});

client.on('close', (event) => {
    logMessage(`WebSocket connection closed (code ${event.code})`, 'system');
});

client.on('audio', async (data) => {
    try {
        await resumeAudioContext();
        const streamer = await ensureAudioInitialized();
        streamer.addPCM16(new Uint8Array(data));
    } catch (error) {
        logMessage(`Error processing audio: ${error.message}`, 'system');
    }
});

client.on('content', (data) => {
    if (data.modelTurn) {
        if (data.modelTurn.parts.some(part => part.functionCall)) {
            isUsingTool = true;
            Logger.info('Model is using a tool');
        } else if (data.modelTurn.parts.some(part => part.functionResponse)) {
            isUsingTool = false;
            Logger.info('Tool usage completed');
        }

        const text = data.modelTurn.parts.map(part => part.text).join('');
        if (text) {
            logMessage(text, 'ai');
        }
    }
});

client.on('interrupted', () => {
    audioStreamer?.stop();
    isUsingTool = false;
    Logger.info('Model interrupted');
    logMessage('Model interrupted', 'system');
});

client.on('setupcomplete', () => {
    logMessage('Setup complete', 'system');
});

client.on('turncomplete', () => {
    isUsingTool = false;
    logMessage('Turn complete', 'system');
});

client.on('error', (error) => {
    if (error instanceof ApplicationError) {
        Logger.error(`Application error: ${error.message}`, error);
    } else {
        Logger.error('Unexpected error', error);
    }
    logMessage(`Error: ${error.message}`, 'system');
});

client.on('message', (message) => {
    if (message.error) {
        Logger.error('Server error:', message.error);
        logMessage(`Server error: ${message.error}`, 'system');
    }
});

sendButton.addEventListener('click', handleSendMessage);
messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        handleSendMessage();
    }
});

micButton.addEventListener('click', handleMicToggle);

connectButton.addEventListener('click', () => {
    if (isConnected) {
        disconnectFromWebsocket();
    } else {
        connectToWebsocket();
    }
});

messageInput.disabled = true;
sendButton.disabled = true;
micButton.disabled = true;
connectButton.textContent = 'Connect';

/**
 * Handles the video toggle. Starts or stops video streaming.
 * @returns {Promise<void>}
 */
async function handleVideoToggle() {
    Logger.info('Video toggle clicked, current state:', { isVideoActive, isConnected });
    
    localStorage.setItem('video_fps', fpsInput.value);

    if (!isVideoActive) {
        try {
            Logger.info('Attempting to start video');
            if (!videoManager) {
                videoManager = new VideoManager();
            }
            
            await videoManager.start(fpsInput.value,(frameData) => {
                if (isConnected) {
                    client.sendRealtimeInput([frameData]);
                }
            });

            isVideoActive = true;
            cameraIcon.textContent = 'videocam_off';
            cameraButton.classList.add('active');
            Logger.info('Camera started successfully');
            logMessage('Camera started', 'system');

        } catch (error) {
            Logger.error('Camera error:', error);
            logMessage(`Error: ${error.message}`, 'system');
            isVideoActive = false;
            videoManager = null;
            cameraIcon.textContent = 'videocam';
            cameraButton.classList.remove('active');
        }
    } else {
        Logger.info('Stopping video');
        stopVideo();
    }
}

/**
 * Stops the video streaming.
 */
function stopVideo() {
    if (videoManager) {
        videoManager.stop();
        videoManager = null;
    }
    isVideoActive = false;
    cameraIcon.textContent = 'videocam';
    cameraButton.classList.remove('active');
    logMessage('Camera stopped', 'system');
}

cameraButton.addEventListener('click', handleVideoToggle);
stopVideoButton.addEventListener('click', stopVideo);

cameraButton.disabled = true;

/**
 * Handles the screen share toggle. Starts or stops screen sharing.
 * @returns {Promise<void>}
 */
async function handleScreenShare() {
    if (!isScreenSharing) {
        try {
            // 檢查瀏覽器支援類型
            const supportType = await ScreenRecorder.checkBrowserSupport();
            
            if (supportType === 'SCREEN_SHARE') {
                // 桌面版瀏覽器的原始螢幕分享功能
                screenContainer.style.display = 'block';
                screenRecorder = new ScreenRecorder();
                await screenRecorder.start(screenPreview, (frameData) => {
                    if (isConnected) {
                        client.sendRealtimeInput([{
                            mimeType: "image/jpeg",
                            data: frameData
                        }]);
                    }
                });

                isScreenSharing = true;
                screenIcon.textContent = 'stop_screen_share';
                screenButton.classList.add('active');
                Logger.info('Screen sharing started');
                logMessage('Screen sharing started', 'system');
            } else {
                // Android 設備的替代方案
                screenRecorder = new ScreenRecorder();
                await screenRecorder.handleAndroidShare((frameData) => {
                    if (isConnected) {
                        client.sendRealtimeInput([{
                            mimeType: "image/jpeg",
                            data: frameData
                        }]);
                        logMessage('圖片已成功分享', 'system');
                    }
                });
            }
        } catch (error) {
            Logger.error('Screen sharing error:', error);
            logMessage(`Error: ${error.message}`, 'system');
            isScreenSharing = false;
            screenIcon.textContent = 'screen_share';
            screenButton.classList.remove('active');
            screenContainer.style.display = 'none';
        }
    } else {
        stopScreenSharing();
    }
}

/**
 * Stops the screen sharing.
 */
function stopScreenSharing() {
    if (screenRecorder) {
        screenRecorder.stop();
        screenRecorder = null;
    }
    isScreenSharing = false;
    screenIcon.textContent = 'screen_share';
    screenButton.classList.remove('active');
    screenContainer.style.display = 'none';
    logMessage('Screen sharing stopped', 'system');
}

screenButton.addEventListener('click', handleScreenShare);
screenButton.disabled = true;