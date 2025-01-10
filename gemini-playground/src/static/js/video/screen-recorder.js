import { Logger } from '../utils/logger.js';
import { ApplicationError, ErrorCodes } from '../utils/error-boundary.js';

/**
 * @fileoverview Implements a screen recorder for capturing and processing screen frames.
 * It supports previewing the screen capture and sending frames to a callback function.
 */
export class ScreenRecorder {
    /**
     * Creates a new ScreenRecorder instance.
     * @param {Object} [options] - Configuration options for the recorder.
     * @param {number} [options.fps=5] - Frames per second for screen capture.
     * @param {number} [options.quality=0.8] - JPEG quality for captured frames (0.0 - 1.0).
     * @param {number} [options.width=1280] - Width of the captured video.
     * @param {number} [options.height=720] - Height of the captured video.
     * @param {number} [options.maxFrameSize=204800] - Maximum size of a frame in bytes (200KB).
     */
    constructor(options = {}) {
        this.stream = null;
        this.isRecording = false;
        this.onScreenData = null;
        this.frameCanvas = document.createElement('canvas');
        this.frameCtx = this.frameCanvas.getContext('2d');
        this.captureInterval = null;
        this.previewElement = null;
        this.options = {
            fps: 2, // Lower FPS for screen sharing
            quality: 0.8,
            width: 1280,
            height: 720,
            maxFrameSize: 200 * 1024, // 200KB max per frame
            ...options
        };
        this.frameCount = 0;
    }

    /**
     * Starts screen recording.
     * @param {HTMLVideoElement} previewElement - The video element to display the screen preview.
     * @param {Function} onScreenData - Callback function to receive screen frame data.
     * @throws {ApplicationError} Throws an error if screen sharing permission is denied or if the screen recording fails to start.
     */
    async start(previewElement, onScreenData) {
        try {
            this.onScreenData = onScreenData;
            this.previewElement = previewElement;

            // Request screen sharing access with audio
            this.stream = await navigator.mediaDevices.getDisplayMedia({ 
                video: {
                    width: { ideal: this.options.width },
                    height: { ideal: this.options.height },
                    frameRate: { ideal: this.options.fps }
                },
                audio: false // Set to true if you want to capture audio as well
            });

            // Set up preview
            if (this.previewElement) {
                this.previewElement.srcObject = this.stream;
                await new Promise((resolve) => {
                    this.previewElement.onloadedmetadata = () => {
                        this.previewElement.play()
                            .then(resolve)
                            .catch(error => {
                                Logger.error('Failed to play preview:', error);
                                resolve();
                            });
                    };
                });

                // Set canvas size based on video dimensions
                this.frameCanvas.width = this.previewElement.videoWidth;
                this.frameCanvas.height = this.previewElement.videoHeight;
            }

            // Start frame capture loop
            this.isRecording = true;
            this.startFrameCapture();
            
            // Handle stream stop
            this.stream.getVideoTracks()[0].addEventListener('ended', () => {
                this.stop();
            });

            Logger.info('Screen recording started');

        } catch (error) {
            if (error.name === 'NotAllowedError') {
                throw new ApplicationError(
                    'Screen sharing permission denied',
                    ErrorCodes.SCREEN_PERMISSION_DENIED,
                    { originalError: error }
                );
            }
            throw new ApplicationError(
                'Failed to start screen recording',
                ErrorCodes.SCREEN_START_FAILED,
                { originalError: error }
            );
        }
    }

    /**
     * Starts the frame capture loop.
     * @private
     */
    startFrameCapture() {
        const frameInterval = 1000 / this.options.fps;
        
        this.captureInterval = setInterval(() => {
            if (!this.isRecording || !this.previewElement || !this.onScreenData) return;
            
            try {
                // Ensure video is playing and ready
                if (this.previewElement.readyState >= this.previewElement.HAVE_CURRENT_DATA) {
                    // Update canvas size if needed
                    if (this.frameCanvas.width !== this.previewElement.videoWidth) {
                        this.frameCanvas.width = this.previewElement.videoWidth;
                        this.frameCanvas.height = this.previewElement.videoHeight;
                    }

                    // Draw current video frame to canvas
                    this.frameCtx.drawImage(
                        this.previewElement,
                        0, 0,
                        this.frameCanvas.width,
                        this.frameCanvas.height
                    );

                    // Convert to JPEG with quality setting
                    const jpegData = this.frameCanvas.toDataURL('image/jpeg', this.options.quality);
                    const base64Data = jpegData.split(',')[1];
                    
                    if (this.validateFrame(base64Data)) {
                        this.frameCount++;
                        Logger.debug(`Screen frame #${this.frameCount} captured`);
                        this.onScreenData(base64Data);
                    }
                }
            } catch (error) {
                Logger.error('Screen frame capture error:', error);
            }
        }, frameInterval);

        Logger.info(`Screen capture started at ${this.options.fps} FPS`);
    }

    /**
     * Stops screen recording.
     * @throws {ApplicationError} Throws an error if the screen recording fails to stop.
     */
    stop() {
        try {
            this.isRecording = false;
            
            if (this.captureInterval) {
                clearInterval(this.captureInterval);
                this.captureInterval = null;
            }

            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }

            if (this.previewElement) {
                this.previewElement.srcObject = null;
                this.previewElement = null;
            }

            Logger.info('Screen recording stopped');

        } catch (error) {
            Logger.error('Failed to stop screen recording:', error);
            throw new ApplicationError(
                'Failed to stop screen recording',
                ErrorCodes.SCREEN_STOP_FAILED,
                { originalError: error }
            );
        }
    }

    /**
     * Validates a captured frame.
     * @param {string} base64Data - Base64 encoded frame data.
     * @returns {boolean} True if the frame is valid, false otherwise.
     * @private
     */
    validateFrame(base64Data) {
        if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
            Logger.error('Invalid screen frame base64 data');
            return false;
        }
        
        if (base64Data.length < 1024) {
            Logger.error('Screen frame too small');
            return false;
        }
        
        return true;
    }

    /**
     * Checks if screen sharing is supported by the browser.
     * @returns {boolean} True if screen sharing is supported, false otherwise.
     * @throws {ApplicationError} Throws an error if screen sharing is not supported.
     * @static
     */
    static async checkBrowserSupport() {
        const isAndroid = /Android/i.test(navigator.userAgent);
        
        if (isAndroid) {
            // 檢查是否支援檔案分享 API
            if (navigator.share && navigator.canShare) {
                return 'SHARE_API';
            }
            
            // 檢查是否支援檔案選擇
            if (window.showOpenFilePicker) {
                return 'FILE_PICKER';
            }
            
            throw new ApplicationError(
                '很抱歉，您的設備不支援任何分享功能。請嘗試更新瀏覽器或使用桌面版瀏覽器。',
                ErrorCodes.SCREEN_NOT_SUPPORTED
            );
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            throw new ApplicationError(
                'Screen sharing is not supported in this browser',
                ErrorCodes.SCREEN_NOT_SUPPORTED
            );
        }

        return 'SCREEN_SHARE';
    }

    /**
     * 處理 Android 的替代分享方案
     * @param {Function} onScreenData - 接收圖片數據的回調函數
     * @returns {Promise<void>}
     */
    async handleAndroidShare(onScreenData) {
        const supportType = await ScreenRecorder.checkBrowserSupport();
        
        if (supportType === 'SHARE_API') {
            // 使用 Web Share API
            try {
                const shareData = {
                    title: '分享螢幕截圖',
                    text: '請選擇要分享的螢幕截圖',
                    files: []
                };
                
                if (navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                }
            } catch (error) {
                throw new ApplicationError(
                    '分享失敗，請重試',
                    ErrorCodes.SHARE_FAILED,
                    { originalError: error }
                );
            }
        } else if (supportType === 'FILE_PICKER') {
            // 使用檔案選擇器
            try {
                const [handle] = await window.showOpenFilePicker({
                    types: [{
                        description: '圖片檔案',
                        accept: {
                            'image/*': ['.png', '.jpg', '.jpeg']
                        }
                    }]
                });
                
                const file = await handle.getFile();
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    const base64Data = e.target.result.split(',')[1];
                    if (this.validateFrame(base64Data)) {
                        onScreenData(base64Data);
                    }
                };
                
                reader.readAsDataURL(file);
            } catch (error) {
                throw new ApplicationError(
                    '檔案選擇失敗，請重試',
                    ErrorCodes.FILE_PICK_FAILED,
                    { originalError: error }
                );
            }
        }
    }
} 