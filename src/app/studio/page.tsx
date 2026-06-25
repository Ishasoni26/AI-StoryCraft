"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Play, Sparkles, Video, Pause, AlertCircle, Download, Loader2, Edit3, ChevronRight, ChevronDown, ChevronUp, CheckCircle2, Image as ImageIcon, Globe, Mail, Link, XCircle, MessageSquare, Mic, Scissors, Zap, Music, Smartphone, Settings, PenTool, Volume2, Type, FileText, Upload, Trash2 } from 'lucide-react';

import Nav from '../../components/Nav';

interface Scene {
  imagePrompt: string;
  dialogue: string;
  imageUrl?: string;
  audioUrl?: string;
  isThumbnail?: boolean;
}

const VISUAL_STYLES = [
  "Pixar 3D Cartoon",
  "Japanese Anime",
  "Cinematic Realistic",
  "Watercolor Sketch",
  "Cyberpunk Neon",
  "Dark Fantasy"
];

const BGM_TRACKS = [
  { name: "None", url: "" },
  { name: "Epic Cinematic", url: "https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3" },
  { name: "Dark Mystery", url: "https://cdn.pixabay.com/audio/2022/03/15/audio_c8b8175b9f.mp3" },
  { name: "Lofi Chill", url: "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf589.mp3" }
];

const LANGUAGES = ["Hindi", "English", "Spanish", "German"];

const drawThumbnailText = (ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, dialogue: string, part: string, isPortrait: boolean) => {
    const gradient = isPortrait 
        ? ctx.createLinearGradient(0, 0, 0, canvasHeight * 0.6)
        : ctx.createLinearGradient(0, 0, canvasWidth * 0.7, 0);
        
    gradient.addColorStop(0, "rgba(0,0,0,0.95)");
    gradient.addColorStop(0.5, "rgba(0,0,0,0.7)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const isCenter = isPortrait;
    ctx.textAlign = isCenter ? "center" : "left";
    ctx.textBaseline = "top";
    
    const words = dialogue.replace(/, Part \d+/i, '').split(' ').filter(w => w.trim() !== '');
    let lines = [];
    if (words.length <= 3) {
       lines = words;
    } else if (words.length <= 6) {
       lines.push(words.slice(0, 2).join(' '));
       lines.push(words.slice(2, 4).join(' '));
       if (words.length > 4) lines.push(words.slice(4).join(' '));
    } else {
       const m1 = Math.ceil(words.length / 3);
       const m2 = Math.ceil((words.length * 2) / 3);
       lines.push(words.slice(0, m1).join(' '));
       lines.push(words.slice(m1, m2).join(' '));
       lines.push(words.slice(m2).join(' '));
    }

    let startY = isPortrait ? 100 : 80;
    const leftMargin = isPortrait ? canvasWidth / 2 : 60;
    const fontSize = isPortrait ? 60 : 85;
    const lineHeight = isPortrait ? 80 : 100;
    
    lines.forEach((line, i) => {
        ctx.font = `900 ${fontSize}px 'Arial Black', Impact, sans-serif`;
        ctx.fillStyle = i % 2 !== 0 ? "#fbbf24" : "#ffffff";
        
        ctx.lineWidth = 10;
        ctx.strokeStyle = "black";
        ctx.strokeText(line, leftMargin, startY);
        
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        
        ctx.fillText(line, leftMargin, startY);
        ctx.shadowColor = "transparent";
        
        startY += lineHeight;
    });

    const badgeW = 200;
    const badgeH = 60;
    const partY = canvasHeight - (isPortrait ? 180 : 120);
    const partX = isPortrait ? (canvasWidth - badgeW)/2 : leftMargin;

    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.roundRect(partX, partY, badgeW, badgeH, 10);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#fbbf24";
    ctx.stroke();
    
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 36px 'Arial Black', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(part, partX + badgeW/2, partY + badgeH/2);
};

export default function Home() {
  const [storyTitle, setStoryTitle] = useState('जादुई चप्पल');
  const [storyPart, setStoryPart] = useState('Part 1');
  const [script, setScript] = useState('एक छोटे से गाँव में मोहन नाम का एक गरीब लड़का रहता था। वह अपनी बूढ़ी माँ के साथ एक टूटी-फूटी झोपड़ी में रहता था...');
  const [visualStyle, setVisualStyle] = useState(VISUAL_STYLES[0]);
  const [bgmTrack, setBgmTrack] = useState(BGM_TRACKS[0].url);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [targetLanguage, setTargetLanguage] = useState(LANGUAGES[0]);
  const [characterProfile, setCharacterProfile] = useState('A young Indian boy with big expressive eyes, brown hair, wearing a simple brown shirt and a sling bag strap');
  const [locationProfile, setLocationProfile] = useState('A creepy 19th-century Victorian bungalow with broken windows and a red roof');
  const [globalSeed, setGlobalSeed] = useState(42);
  const [idea, setIdea] = useState('');
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [activeTab, setActiveTab] = useState<'script' | 'settings'>('script');
  const [isUniverseOpen, setIsUniverseOpen] = useState(false);
  
  const [bgmVolume, setBgmVolume] = useState(15);
  const [voiceVolume, setVoiceVolume] = useState(100);
  const [subtitleStyle, setSubtitleStyle] = useState<'viral' | 'cinematic' | 'none'>('viral');
  
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [isStoryboardMode, setIsStoryboardMode] = useState(false);
  const [storyboardScenes, setStoryboardScenes] = useState<Scene[]>([]);

  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [progress, setProgress] = useState(0);

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sceneStartTime, setSceneStartTime] = useState<number>(0);
  const [activeCaptionChunk, setActiveCaptionChunk] = useState<string>('');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && scenes[currentSceneIdx] && !scenes[currentSceneIdx].isThumbnail) {
      interval = setInterval(() => {
         const scene = scenes[currentSceneIdx];
         const durationMs = (audioRef.current && audioRef.current.duration) ? audioRef.current.duration * 1000 : 3000;
         const elapsed = Date.now() - sceneStartTime;
         const words = scene.dialogue.split(' ');
         
         // Safe active word index
         let activeWordIndex = Math.floor((elapsed / durationMs) * words.length);
         if (isNaN(activeWordIndex) || activeWordIndex < 0) activeWordIndex = 0;
         if (activeWordIndex >= words.length) activeWordIndex = words.length - 1;
         
         const wordsPerChunk = 2; // 2 words at a time
         const chunkIndex = Math.floor(activeWordIndex / wordsPerChunk);
         const chunk = words.slice(chunkIndex * wordsPerChunk, (chunkIndex + 1) * wordsPerChunk).join(' ');
         setActiveCaptionChunk(chunk);
      }, 100);
    } else {
      setActiveCaptionChunk('');
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentSceneIdx, sceneStartTime, scenes]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveSeries = () => {
    const universe = {
      characterProfile,
      locationProfile,
      visualStyle,
      globalSeed
    };
    localStorage.setItem('storyUniverse', JSON.stringify(universe));
    showToast("Series Settings Saved! You can load them for Part 2.");
  };

  const handleLoadSeries = () => {
    const saved = localStorage.getItem('storyUniverse');
    if (saved) {
      const universe = JSON.parse(saved);
      if (universe.characterProfile) setCharacterProfile(universe.characterProfile);
      if (universe.locationProfile) setLocationProfile(universe.locationProfile);
      if (universe.visualStyle) setVisualStyle(universe.visualStyle);
      if (universe.globalSeed) setGlobalSeed(universe.globalSeed);
      showToast("Series Settings Loaded! Ready for the next part.");
    } else {
      showToast("No saved series found.");
    }
  };

  const handleBrainstorm = async () => {
    if (!idea) return;
    setIsBrainstorming(true);
    showToast("Brainstorming a viral script...");
    try {
      const res = await fetch('/api/brainstorm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, characterProfile, locationProfile })
      });
      const data = await res.json();
      if (res.ok && data.script) {
         setScript(data.script);
         showToast("Script generated! You can edit it below.");
      } else {
         throw new Error(data.error || 'Failed to brainstorm');
      }
    } catch (e: any) {
      console.error(e);
      showToast("Error generating script: " + e.message);
    } finally {
      setIsBrainstorming(false);
    }
  };

  const handleGenerateStoryboard = async () => {
    if (!script.trim()) return;
    setIsGeneratingStoryboard(true);
    setError(null);
    setStoryboardScenes([]);
    setIsStoryboardMode(false);
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        body: JSON.stringify({ script, targetLanguage, characterProfile, locationProfile }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to generate scenes');
      
      const thumbnailScene: Scene = {
        isThumbnail: true,
        imagePrompt: `A highly expressive 3D animated character looking shocked or surprised in the foreground. THE CHARACTER MUST LOOK EXACTLY LIKE: "${characterProfile}". Cinematic lighting, Pixar style, high quality YouTube thumbnail, deep depth of field. Background based on this story: ${script.slice(0, 150)}...`,
        dialogue: `${storyTitle}, ${storyPart}`
      };
      
      setStoryboardScenes([thumbnailScene, ...data.scenes]);
      setIsStoryboardMode(true);
      showToast("Storyboard Generated! Review and Edit.");
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsGeneratingStoryboard(false);
    }
  };

  const updateScene = (index: number, field: 'imagePrompt' | 'dialogue', value: string) => {
    const newScenes = [...storyboardScenes];
    newScenes[index][field] = value;
    setStoryboardScenes(newScenes);
  };

  const handleImageUpload = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      const newScenes = [...storyboardScenes];
      newScenes[index] = {
        ...newScenes[index],
        imageUrl: objectUrl
      };
      setStoryboardScenes(newScenes);
      showToast("Custom image uploaded for Scene " + (index + 1));
    }
  };

  const handleRemoveImage = (index: number) => {
    const newScenes = [...storyboardScenes];
    delete newScenes[index].imageUrl;
    setStoryboardScenes(newScenes);
    showToast("Reverted Scene " + (index + 1) + " back to AI generation.");
  };

  const handleDownloadThumbnailImage = (index: number) => {
    const scene = storyboardScenes[index];
    if (!scene.imageUrl) return;
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const cvs = document.createElement('canvas');
      cvs.width = aspectRatio === '9:16' ? 576 : 1024;
      cvs.height = aspectRatio === '9:16' ? 1024 : 576;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;
      
      // Draw image
      ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
      
      // Draw gradient and text just like video export
      drawThumbnailText(ctx, cvs.width, cvs.height, scene.dialogue, storyPart, aspectRatio === '9:16');
      
      const link = document.createElement('a');
      link.download = `Thumbnail_${storyTitle}.png`;
      link.href = cvs.toDataURL("image/png");
      link.click();
      showToast("Thumbnail downloaded successfully!");
    };
    img.src = scene.imageUrl;
  };

  const handleGenerateSingleImage = async (index: number) => {
    const scene = storyboardScenes[index];
    if (!scene.imagePrompt) return;
    
    showToast(`Generating AI preview for ${scene.isThumbnail ? 'Thumbnail' : `Scene ${index + 1}`}...`);
    
    try {
      const imgRes = await fetch('/api/image', {
        method: 'POST',
        body: JSON.stringify({ prompt: scene.imagePrompt, style: visualStyle, aspectRatio, seed: globalSeed }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!imgRes.ok) throw new Error('Image generation failed');
      
      const blob = await imgRes.blob();
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        const newScenes = [...storyboardScenes];
        newScenes[index] = {
          ...newScenes[index],
          imageUrl: objectUrl
        };
        setStoryboardScenes(newScenes);
        showToast("Image generated! This will be used in the final video.");
      }
    } catch (e: any) {
      console.error(e);
      showToast("Error generating image: " + e.message);
    }
  };

  const handleGenerateVideo = async () => {
    if (storyboardScenes.length === 0) return;
    setIsGeneratingVideo(true);
    setError(null);
    setScenes([]);
    setIsStoryboardMode(false);
    
    try {
      setStatus('Generating Assets...');
      setProgress(0);
      
      const scenesWithAssets = [];
      const totalScenes = storyboardScenes.length;
      let completed = 0;

      // Process sequentially (1 by 1) instead of batching to avoid Pollinations 429 Rate Limit
      for (let i = 0; i < totalScenes; i++) {
          const scene = storyboardScenes[i];
          
          let imageUrl: string | undefined = undefined;
          let audioUrl: string | undefined = undefined;
          
          const skipImageGen = !!scene.imageUrl;
          
          const [imgRes, audioRes] = await Promise.all([
              skipImageGen
                ? Promise.resolve({ ok: true })
                : fetch('/api/image', {
                    method: 'POST',
                    body: JSON.stringify({ prompt: scene.imagePrompt, style: visualStyle, aspectRatio }),
                    headers: { 'Content-Type': 'application/json' }
                }).catch(e => ({ ok: false, statusText: e.message, blob: async () => null })),
              fetch('/api/tts', {
                  method: 'POST',
                  body: JSON.stringify({ text: scene.dialogue }),
                  headers: { 'Content-Type': 'application/json' }
              }).catch(e => ({ ok: false, json: async () => ({}) }))
          ]);

          if (skipImageGen) {
             imageUrl = scene.imageUrl;
          } else if (imgRes.ok) {
             const blob = await (imgRes as any).blob();
             if (blob) imageUrl = URL.createObjectURL(blob);
          }
          
          if (audioRes.ok) {
             const audioData = await (audioRes as any).json();
             if (audioData.audioUrl) audioUrl = audioData.audioUrl;
          }

          scenesWithAssets.push({ ...scene, imageUrl, audioUrl });
          
          completed += 1;
          let currentProgress = Math.round((completed / totalScenes) * 100);
          setProgress(currentProgress);
          setStatus(`Generating Scene ${completed} of ${totalScenes} (${currentProgress}%)`);
          
          if (completed < totalScenes && !skipImageGen) {
              // Wait 1.5 seconds before asking for the next image to prevent Rate Limiting
              await new Promise(resolve => setTimeout(resolve, 1500));
          }
      }
      
      setProgress(100);
      setStatus('Finalizing Video...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setScenes(scenesWithAssets);
      setStatus('Ready');
      setCurrentSceneIdx(0);
      showToast("Video Generation Complete!");
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setStatus('Error');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handlePlay = () => {
    if (scenes.length === 0) return;
    if (isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      if (bgmAudioRef.current) bgmAudioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    if (bgmTrack && bgmAudioRef.current) {
        bgmAudioRef.current.src = bgmTrack;
        bgmAudioRef.current.volume = bgmVolume / 100;
        bgmAudioRef.current.loop = true;
        bgmAudioRef.current.play();
    }
    playScene(currentSceneIdx === scenes.length - 1 ? 0 : currentSceneIdx);
  };

  const playScene = (index: number) => {
    if (index >= scenes.length) {
      setIsPlaying(false);
      if (bgmAudioRef.current) bgmAudioRef.current.pause();
      setCurrentSceneIdx(0);
      return;
    }

    setCurrentSceneIdx(index);
    setSceneStartTime(Date.now());
    const scene = scenes[index];

    if (scene.audioUrl && audioRef.current) {
        audioRef.current.src = scene.audioUrl;
        audioRef.current.volume = voiceVolume / 100;
        audioRef.current.play();
        audioRef.current.onended = () => {
            playScene(index + 1);
        };
    } else {
        setTimeout(() => playScene(index + 1), 3000);
    }
  };

  const handleDownloadSRT = async () => {
    if (scenes.length === 0) return;
    setIsDownloading(true);
    try {
        let srtContent = '';
        let currentTimeMs = 0;

        const formatTime = (ms: number) => {
            const totalSeconds = Math.floor(ms / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            const milliseconds = Math.floor(ms % 1000);
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
        };

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

        for (let index = 0; index < scenes.length; index++) {
            const scene = scenes[index];
            let durationMs = 3000;
            if (scene.audioUrl) {
                try {
                    const res = await fetch(scene.audioUrl as string);
                    const arrayBuffer = await res.arrayBuffer();
                    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                    durationMs = audioBuffer.duration * 1000;
                } catch(e) {
                    durationMs = scene.dialogue.split(' ').length * 350 + 500;
                }
            }
            
            const startTime = formatTime(currentTimeMs);
            const endTime = formatTime(currentTimeMs + durationMs);
            
            srtContent += `${index + 1}\n`;
            srtContent += `${startTime} --> ${endTime}\n`;
            srtContent += `${scene.dialogue}\n\n`;
            
            currentTimeMs += durationMs;
        }

        const blob = new Blob([srtContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${storyTitle || 'story'}_subtitles.srt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error("SRT Generation failed", err);
    } finally {
        setIsDownloading(false);
    }
  };

  const handleDownload = async () => {
    if (scenes.length === 0 || isDownloading) return;
    setIsDownloading(true);
    
    try {
        const canvas = canvasRef.current;
        if (!canvas) throw new Error("Canvas not found");
        
        canvas.width = aspectRatio === '9:16' ? 576 : 1024;
        canvas.height = aspectRatio === '9:16' ? 1024 : 576;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas ctx not found");

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        
        let bgmSource: AudioBufferSourceNode | null = null;
        if (bgmTrack) {
            try {
                const response = await fetch(bgmTrack);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                
                bgmSource = audioCtx.createBufferSource();
                bgmSource.buffer = audioBuffer;
                bgmSource.loop = true;
                
                const gainNode = audioCtx.createGain();
                gainNode.gain.value = bgmVolume / 100;
                
                bgmSource.connect(gainNode);
                gainNode.connect(dest);
                bgmSource.start();
            } catch (err) {
                console.error("Failed to load BGM for export:", err);
            }
        }

        // @ts-ignore
        const videoStream = canvas.captureStream(30); 
        
        const combinedStream = new MediaStream([
            ...videoStream.getVideoTracks(),
            ...dest.stream.getAudioTracks()
        ]);

        let options: MediaRecorderOptions = { mimeType: 'video/mp4' };
        if (!MediaRecorder.isTypeSupported('video/mp4')) {
            options = { mimeType: 'video/webm' }; // Fallback for browsers that don't support mp4 encoding
        }
        const recorder = new MediaRecorder(combinedStream, options);
        const chunks: Blob[] = [];
        recorder.ondataavailable = e => chunks.push(e.data);
        
        recorder.start();

        const loadedImages = await Promise.all(scenes.map(s => {
            return new Promise<HTMLImageElement>((resolve) => {
                const img = new Image();
                if (s.imageUrl && !s.imageUrl.startsWith('blob:') && !s.imageUrl.startsWith('data:')) {
                    img.crossOrigin = "anonymous";
                }
                img.src = s.imageUrl || '';
                img.onload = () => resolve(img);
                img.onerror = () => resolve(img);
            });
        }));

        let isRecordingProcess = true;
        let scale = 1.0;
        let currentDrawIdx = 0;
        let exportSceneStartMs = Date.now();
        let exportSceneDurationMs = 3000;

        const drawFrame = () => {
            if (!isRecordingProcess) return;
            
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const scene = scenes[currentDrawIdx];
            const img = loadedImages[currentDrawIdx];

            const elapsedMs = Date.now() - exportSceneStartMs;
            const progress = Math.min(1, elapsedMs / exportSceneDurationMs);

            if (img && img.width > 0) {
                const canvasRatio = canvas.width / canvas.height;
                const imgRatio = img.width / img.height;
                
                let drawWidth, drawHeight;
                if (canvasRatio > imgRatio) {
                    drawWidth = canvas.width;
                    drawHeight = canvas.width / imgRatio;
                } else {
                    drawHeight = canvas.height;
                    drawWidth = canvas.height * imgRatio;
                }
                
                // Apply Ken Burns zoom (15% zoom over scene duration)
                const kbZoom = 1.0 + (progress * 0.15); 
                const scaledWidth = drawWidth * kbZoom;
                const scaledHeight = drawHeight * kbZoom;
                
                // Base offset to center the image
                const baseOffsetX = (canvas.width - scaledWidth) / 2;
                const baseOffsetY = (canvas.height - scaledHeight) / 2;
                
                // Ken Burns pan (alternating direction per scene)
                const panDirX = currentDrawIdx % 2 === 0 ? 1 : -1;
                const panDirY = currentDrawIdx % 3 === 0 ? 1 : -1;
                
                // Move from center by up to 5% of dimensions
                const panOffsetX = (progress * (scaledWidth * 0.05)) * panDirX;
                const panOffsetY = (progress * (scaledHeight * 0.05)) * panDirY;
                
                ctx.drawImage(img, baseOffsetX + panOffsetX, baseOffsetY + panOffsetY, scaledWidth, scaledHeight);
            }

            if (scene) {
                if (scene.isThumbnail) {
                    drawThumbnailText(ctx, canvas.width, canvas.height, scene.dialogue, storyPart, aspectRatio === '9:16');
                } else if (subtitleStyle !== 'none') {
                    const elapsed = Date.now() - exportSceneStartMs;
                    const words = scene.dialogue.split(' ');
                    let activeWordIndex = Math.floor((elapsed / exportSceneDurationMs) * words.length);
                    if (isNaN(activeWordIndex) || activeWordIndex < 0) activeWordIndex = 0;
                    if (activeWordIndex >= words.length) activeWordIndex = words.length - 1;
                    
                    if (subtitleStyle === 'viral') {
                        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
                        ctx.fillRect(0, canvas.height - 120, canvas.width, 120);
                        
                        ctx.textAlign = "center";
                        ctx.shadowColor = "black";
                        ctx.shadowBlur = 4;
                        
                        const wordsPerChunk = 2;
                        const chunkIndex = Math.floor(activeWordIndex / wordsPerChunk);
                        const chunk = words.slice(chunkIndex * wordsPerChunk, (chunkIndex + 1) * wordsPerChunk).join(' ');
                        
                        ctx.fillStyle = "#fbbf24"; 
                        ctx.font = "bold 56px Arial";
                        ctx.fillText(chunk.toUpperCase(), canvas.width / 2, canvas.height - 45);
                    } else if (subtitleStyle === 'cinematic') {
                        ctx.textAlign = "center";
                        ctx.shadowColor = "black";
                        ctx.shadowBlur = 8;
                        
                        const wordsPerChunk = 5;
                        const chunkIndex = Math.floor(activeWordIndex / wordsPerChunk);
                        const chunk = words.slice(chunkIndex * wordsPerChunk, (chunkIndex + 1) * wordsPerChunk).join(' ');
                        
                        ctx.fillStyle = "white"; 
                        ctx.font = "italic 32px Arial";
                        ctx.fillText(chunk, canvas.width / 2, canvas.height - 40);
                    }
                }
            }

            requestAnimationFrame(drawFrame);
        };

        const processScene = async (idx: number) => {
            if (idx >= scenes.length) {
                isRecordingProcess = false;
                if (bgmSource) bgmSource.stop();
                recorder.stop();
                return;
            }
            
            currentDrawIdx = idx;
            scale = 1.0;
            exportSceneStartMs = Date.now();
            exportSceneDurationMs = 3000;
            
            if (scenes[idx].audioUrl) {
                try {
                    const res = await fetch(scenes[idx].audioUrl as string);
                    const arrayBuffer = await res.arrayBuffer();
                    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                    exportSceneDurationMs = audioBuffer.duration * 1000;
                    
                    const source = audioCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    
                    const voiceGainNode = audioCtx.createGain();
                    voiceGainNode.gain.value = voiceVolume / 100;
                    
                    source.connect(voiceGainNode);
                    voiceGainNode.connect(dest);
                    
                    source.start();
                    
                    setTimeout(() => processScene(idx + 1), audioBuffer.duration * 1000);
                } catch (err) {
                    console.error("Audio decode error", err);
                    setTimeout(() => processScene(idx + 1), 3000);
                }
            } else {
                setTimeout(() => processScene(idx + 1), 3000);
            }
        };

        audioCtx.resume().then(() => {
            drawFrame();
            processScene(0);
        });

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: options.mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'AI_StoryCraft_Video.mp4'; // Always save with .mp4 extension
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            setIsDownloading(false);
            showToast("Video Exported Successfully!");
        };

    } catch (e) {
        console.error(e);
        alert("Failed to export video.");
        setIsDownloading(false);
    }
  };

  const handleEditVideo = () => {
    setIsStoryboardMode(true);
    setStatus('Idle');
    setScenes([]);
    setCurrentSceneIdx(0);
    showToast("Editing mode activated. Modify your scenes and regenerate!");
  };


  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-indigo-500/30">
      <audio ref={audioRef} className="hidden" />
      <canvas ref={canvasRef} width={800} height={600} className="hidden" />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-slate-700 text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-2"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="font-medium text-sm">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/20 blur-[120px] rounded-full" />
      </div>

      {/* NAVBAR */}
      <Nav />

      {/* MAIN APP SECTION */}
      <section id="app-section" className="relative max-w-7xl mx-auto px-6 pt-32 pb-12 min-h-screen flex flex-col justify-start">
        <div className="grid lg:grid-cols-2 gap-12 w-full">
          
          {/* LEFT SIDE: SCRIPT / SCENE EDITOR */}
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {!isStoryboardMode ? (
                <motion.div 
                  key="script-editor"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="relative group flex-1 flex flex-col min-h-0"
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/50 to-purple-500/50 rounded-3xl blur opacity-25 transition duration-1000" />
                  <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 p-6 shadow-2xl flex flex-col h-[calc(100vh-12rem)] min-h-[600px]">
                    
                    {/* Tabs Header */}
                    <div className="flex space-x-2 border-b border-slate-800 pb-4 mb-4">
                      <button
                        onClick={() => setActiveTab('script')}
                        className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg font-medium text-sm transition-all ${
                          activeTab === 'script' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <PenTool className="w-4 h-4" />
                        <span>Script & Idea</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg font-medium text-sm transition-all ${
                          activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <Settings className="w-4 h-4" />
                        <span>Settings & Audio</span>
                      </button>
                    </div>

                    {/* Tab Content */}
                    <AnimatePresence mode="wait">
                      {activeTab === 'settings' && (
                        <motion.div
                          key="settings-tab"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="grid grid-cols-1 sm:grid-cols-2 gap-6 overflow-y-auto pr-2 custom-scrollbar"
                        >
                          <div className="flex flex-col space-y-2">
                            <label className="text-sm font-medium flex items-center space-x-2 text-slate-300">
                              <ImageIcon className="w-4 h-4 text-indigo-400" />
                              <span>Visual Style</span>
                            </label>
                            <select 
                              value={visualStyle}
                              onChange={(e) => setVisualStyle(e.target.value)}
                              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 cursor-pointer"
                            >
                              {VISUAL_STYLES.map(style => <option key={style} value={style}>{style}</option>)}
                            </select>
                          </div>
                          <div className="flex flex-col space-y-2">
                            <label className="text-sm font-medium flex items-center space-x-2 text-slate-300">
                              <Music className="w-4 h-4 text-pink-400" />
                              <span>Background Music</span>
                            </label>
                            <select 
                              value={bgmTrack}
                              onChange={(e) => setBgmTrack(e.target.value)}
                              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 cursor-pointer"
                            >
                              {BGM_TRACKS.map(track => <option key={track.name} value={track.url}>{track.name}</option>)}
                            </select>
                          </div>
                          <div className="flex flex-col space-y-2">
                            <label className="text-sm font-medium flex items-center space-x-2 text-slate-300">
                              <Smartphone className="w-4 h-4 text-emerald-400" />
                              <span>Aspect Ratio</span>
                            </label>
                            <select 
                              value={aspectRatio}
                              onChange={(e) => setAspectRatio(e.target.value as any)}
                              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 cursor-pointer"
                            >
                              <option value="16:9">YouTube (16:9)</option>
                              <option value="9:16">Shorts/Reels (9:16)</option>
                            </select>
                          </div>
                          <div className="flex flex-col space-y-2">
                            <label className="text-sm font-medium flex items-center space-x-2 text-slate-300">
                              <Globe className="w-4 h-4 text-cyan-400" />
                              <span>Dubbing Lang</span>
                            </label>
                            <select 
                              value={targetLanguage}
                              onChange={(e) => setTargetLanguage(e.target.value)}
                              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 cursor-pointer"
                            >
                              {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                            </select>
                          </div>
                          <div className="flex flex-col space-y-2">
                            <label className="text-sm font-medium flex items-center space-x-2 text-slate-300">
                              <Volume2 className="w-4 h-4 text-orange-400" />
                              <span>BGM Volume: {bgmVolume}%</span>
                            </label>
                            <input 
                              type="range" min="0" max="100" value={bgmVolume} onChange={(e) => setBgmVolume(Number(e.target.value))}
                              className="w-full accent-orange-500 cursor-pointer"
                            />
                          </div>
                          <div className="flex flex-col space-y-2">
                            <label className="text-sm font-medium flex items-center space-x-2 text-slate-300">
                              <Mic className="w-4 h-4 text-violet-400" />
                              <span>Voice Volume: {voiceVolume}%</span>
                            </label>
                            <input 
                              type="range" min="0" max="100" value={voiceVolume} onChange={(e) => setVoiceVolume(Number(e.target.value))}
                              className="w-full accent-violet-500 cursor-pointer"
                            />
                          </div>
                          <div className="flex flex-col space-y-2 sm:col-span-2">
                            <label className="text-sm font-medium flex items-center space-x-2 text-slate-300">
                              <Type className="w-4 h-4 text-yellow-400" />
                              <span>Subtitle Style</span>
                            </label>
                            <select 
                              value={subtitleStyle}
                              onChange={(e) => setSubtitleStyle(e.target.value as any)}
                              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 cursor-pointer"
                            >
                              <option value="viral">Viral Shorts (Big & Yellow)</option>
                              <option value="cinematic">Cinematic (Subtle & White)</option>
                              <option value="none">None (Hide Subtitles)</option>
                            </select>
                          </div>
                          {/* Character profile moved to Script & Idea tab */}
                        </motion.div>
                      )}

                      {activeTab === 'script' && (
                        <motion.div
                          key="script-tab"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex flex-col flex-1 min-h-0 space-y-4 overflow-y-auto pr-2 custom-scrollbar"
                        >
                          {/* Brainstorm Engine */}
                          <div className="bg-indigo-900/20 rounded-2xl border border-indigo-500/30 overflow-hidden shrink-0">
                            {/* Collapsible Header */}
                            <button 
                              onClick={() => setIsUniverseOpen(!isUniverseOpen)}
                              className="w-full flex items-center justify-between p-4 bg-indigo-950/30 hover:bg-indigo-900/40 transition-colors border-b border-indigo-500/20"
                            >
                              <div className="flex items-center space-x-2">
                                <Globe className="w-5 h-5 text-indigo-400" />
                                <span className="font-bold text-indigo-200">Story Universe Settings</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 ml-2 border border-indigo-500/30">Optional</span>
                              </div>
                              {isUniverseOpen ? <ChevronUp className="w-5 h-5 text-indigo-400" /> : <ChevronDown className="w-5 h-5 text-indigo-400" />}
                            </button>

                            {/* Collapsible Content */}
                            <AnimatePresence>
                              {isUniverseOpen && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="px-5 py-4 space-y-4 border-b border-indigo-500/30 bg-slate-950/20"
                                >
                                  <div className="flex flex-col space-y-2">
                                    <label className="text-sm font-bold flex items-center space-x-2 text-indigo-300">
                                      <ImageIcon className="w-4 h-4" />
                                      <span>Main Characters</span>
                                    </label>
                                    <textarea 
                                      value={characterProfile}
                                      onChange={(e) => setCharacterProfile(e.target.value)}
                                      placeholder="Describe your main character here to keep them EXACTLY same in all images... (e.g. A 20yr old Indian boy with messy hair, wearing a white shirt)"
                                      rows={2}
                                      className="w-full bg-slate-900/50 border border-indigo-500/50 text-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 resize-none"
                                    />
                                  </div>

                                  <div className="flex flex-col space-y-2">
                                    <label className="text-sm font-bold flex items-center space-x-2 text-indigo-300">
                                      <Globe className="w-4 h-4" />
                                      <span>Main Location</span>
                                    </label>
                                    <textarea 
                                      value={locationProfile}
                                      onChange={(e) => setLocationProfile(e.target.value)}
                                      placeholder="Describe the environment to keep it consistent... (e.g. A creepy old Victorian bungalow with a red roof)"
                                      rows={2}
                                      className="w-full bg-slate-900/50 border border-indigo-500/50 text-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 resize-none"
                                    />
                                  </div>

                                  <div className="flex flex-wrap items-center justify-between pt-4 border-t border-indigo-500/20 gap-y-3 gap-x-2">
                                    <div className="flex items-center space-x-2 text-sm text-slate-300">
                                      <Settings className="w-4 h-4 text-indigo-400 shrink-0" />
                                      <span className="font-semibold whitespace-nowrap">Global Seed: </span>
                                      <input type="number" value={globalSeed} onChange={e => setGlobalSeed(Number(e.target.value))} className="bg-slate-900 border border-indigo-500/50 rounded-lg px-2 py-1.5 w-24 text-center outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" />
                                      <button onClick={() => setGlobalSeed(Math.floor(Math.random() * 1000000))} className="bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg p-1.5 transition-colors shrink-0" title="Generate Random Seed">↻</button>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <button onClick={handleSaveSeries} className="text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition-all shadow-lg whitespace-nowrap">Save Universe</button>
                                      <button onClick={handleLoadSeries} className="text-xs font-bold bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-lg transition-all shadow-lg whitespace-nowrap">Load Universe</button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Always visible Brainstorm Idea */}
                            <div className="p-5 flex flex-col space-y-2">
                              <label className="text-sm font-bold flex items-center space-x-2 text-indigo-300">
                                <Sparkles className="w-4 h-4" />
                                <span>Magic Brainstorm Idea</span>
                              </label>
                              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                                <input 
                                  type="text"
                                  placeholder="E.g., A horror story about a cursed mirror..."
                                  value={idea}
                                  onChange={(e) => setIdea(e.target.value)}
                                  className="flex-1 bg-slate-900/50 border border-indigo-500/50 text-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                                  onKeyDown={(e) => e.key === 'Enter' && handleBrainstorm()}
                                />
                                <button 
                                  onClick={handleBrainstorm}
                                  disabled={isBrainstorming || !idea}
                                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] disabled:shadow-none flex items-center justify-center space-x-2 whitespace-nowrap"
                                >
                                  {isBrainstorming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                  <span>Generate Script</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex space-x-4 shrink-0">
                            <input
                              type="text"
                              value={storyTitle}
                              onChange={(e) => setStoryTitle(e.target.value)}
                              placeholder="Story Title (e.g. रहस्यमयी गुफा)"
                              className="w-2/3 bg-slate-950/50 rounded-xl px-4 py-3 outline-none text-md font-medium text-slate-200 placeholder:text-slate-600 border border-transparent focus:border-indigo-500/30 transition-colors"
                            />
                            <input
                              type="text"
                              value={storyPart}
                              onChange={(e) => setStoryPart(e.target.value)}
                              placeholder="Part 1"
                              className="w-1/3 bg-slate-950/50 rounded-xl px-4 py-3 outline-none text-md font-medium text-slate-200 placeholder:text-slate-600 border border-transparent focus:border-indigo-500/30 transition-colors"
                            />
                          </div>

                          <textarea
                            value={script}
                            onChange={(e) => setScript(e.target.value)}
                            placeholder="एक छोटे से गाँव में..."
                            className="w-full flex-1 min-h-[200px] bg-slate-950/50 rounded-xl p-4 resize-none outline-none text-lg text-slate-200 placeholder:text-slate-600 custom-scrollbar border border-transparent focus:border-indigo-500/30 transition-colors"
                          />
                          
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800 shrink-0">
                            <span className="text-sm text-slate-500 font-medium">
                              {script.length} characters
                            </span>
                            <button
                              onClick={handleGenerateStoryboard}
                              disabled={isGeneratingStoryboard || !script.trim()}
                              className="relative overflow-hidden group px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-all font-medium flex items-center space-x-2 shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                            >
                              <span className="relative z-10">{isGeneratingStoryboard ? 'Analyzing Script...' : 'Generate Storyboard'}</span>
                              {!isGeneratingStoryboard && <ChevronRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="scene-editor"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="relative group flex-1 flex flex-col min-h-0"
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/50 to-teal-500/50 rounded-3xl blur opacity-25 transition duration-1000" />
                  <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 p-6 shadow-2xl flex flex-col h-[calc(100vh-12rem)] min-h-[600px]">
                    
                    <div className="flex items-center justify-between mb-4">
                       <h3 className="text-lg font-semibold flex items-center space-x-2">
                         <Edit3 className="w-5 h-5 text-emerald-400" />
                         <span>Scene Editor</span>
                       </h3>
                       <button onClick={() => setIsStoryboardMode(false)} className="text-sm text-slate-400 hover:text-white transition-colors">
                          &larr; Back to Script
                       </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                      {storyboardScenes.map((scene, idx) => (
                        <div key={idx} className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-3">
                           <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-500 bg-slate-900 px-2 py-1 rounded-md">{scene.isThumbnail ? 'THUMBNAIL' : `SCENE ${idx + 1}`}</span>
                              <div className="flex space-x-2">
                                {scene.isThumbnail && scene.imageUrl && (
                                  <button 
                                    onClick={() => handleDownloadThumbnailImage(idx)}
                                    className="text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded-md transition-colors flex items-center space-x-1 shadow-lg"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download</span>
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleGenerateSingleImage(idx)}
                                  className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-md transition-colors flex items-center space-x-1 shadow-lg"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>Generate Preview</span>
                                </button>
                              </div>
                           </div>
                           <div className="space-y-1">
                              <label className="text-xs text-slate-400 ml-1">Dialogue (Hindi)</label>
                              <input 
                                type="text" 
                                value={scene.dialogue}
                                onChange={(e) => updateScene(idx, 'dialogue', e.target.value)}
                                className="w-full bg-slate-800/50 rounded-lg px-3 py-2 text-sm outline-none border border-transparent focus:border-emerald-500/50 text-slate-200"
                              />
                           </div>
                           <div className="space-y-1">
                              <label className="text-xs text-slate-400 ml-1">Image Prompt (English)</label>
                              <textarea 
                                value={scene.imagePrompt}
                                onChange={(e) => updateScene(idx, 'imagePrompt', e.target.value)}
                                rows={2}
                                className="w-full bg-slate-800/50 rounded-lg px-3 py-2 text-sm outline-none border border-transparent focus:border-emerald-500/50 resize-none text-slate-200"
                              />
                           </div>
                           
                           {/* Custom Image Upload */}
                           <div className="space-y-1">
                              <label className="text-xs text-slate-400 ml-1 flex items-center space-x-1">
                                 <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                                 <span>Custom Image (Optional)</span>
                              </label>
                              
                              {scene.imageUrl ? (
                                 <div className="relative group/img w-full h-32 rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                                    <img 
                                       src={scene.imageUrl} 
                                       alt={`Scene ${idx + 1} Custom Image`} 
                                       className="w-full h-full object-cover"
                                    />
                                    {scene.isThumbnail && (
                                       <div className="absolute inset-0 flex flex-col items-start justify-center p-4 pointer-events-none bg-gradient-to-r from-black/95 via-black/50 to-transparent space-y-1">
                                          {scene.dialogue.replace(/, Part \d+/i, '').split(' ').slice(0, 5).map((w, i) => (
                                            <span key={i} className={`text-xl font-black ${i % 2 !== 0 ? 'text-amber-400' : 'text-white'} drop-shadow-[0_3px_3px_rgba(0,0,0,1)] uppercase leading-none`} style={{ WebkitTextStroke: '1.5px black' }}>
                                              {w}
                                            </span>
                                          ))}
                                          <div className="bg-black px-3 py-1 mt-3 rounded-lg border-2 border-amber-400 shadow-xl">
                                             <span className="text-xs font-black text-amber-400">{storyPart}</span>
                                          </div>
                                       </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center space-x-3">
                                       <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center space-x-1 shadow-lg">
                                          <Upload className="w-3.5 h-3.5" />
                                          <span>Change</span>
                                          <input 
                                             type="file" 
                                             accept="image/*" 
                                             className="hidden" 
                                             onChange={(e) => handleImageUpload(idx, e)}
                                          />
                                       </label>
                                       <button 
                                          onClick={() => handleRemoveImage(idx)}
                                          className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center space-x-1 shadow-lg"
                                       >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          <span>Remove</span>
                                       </button>
                                    </div>
                                 </div>
                              ) : (
                                 <label className="flex flex-col items-center justify-center w-full h-20 border border-dashed border-slate-700 hover:border-emerald-500/50 rounded-lg cursor-pointer bg-slate-900/30 hover:bg-slate-900/50 transition-all group/upload">
                                    <div className="flex flex-col items-center justify-center space-y-1">
                                       <Upload className="w-5 h-5 text-slate-500 group-hover/upload:text-emerald-400 transition-colors" />
                                       <span className="text-xs text-slate-400 group-hover/upload:text-slate-300">Click to upload custom image</span>
                                    </div>
                                    <input 
                                       type="file" 
                                       accept="image/*" 
                                       className="hidden" 
                                       onChange={(e) => handleImageUpload(idx, e)}
                                    />
                                 </label>
                              )}
                           </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-800 flex justify-end">
                      <button
                        onClick={handleDownloadSRT}
                        disabled={isGeneratingVideo}
                        className="mr-3 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 transition-all font-medium flex items-center space-x-2 text-slate-200"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Export .SRT</span>
                      </button>
                      <button
                        onClick={handleGenerateVideo}
                        disabled={isGeneratingVideo}
                        className="relative overflow-hidden group px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-all font-medium flex items-center space-x-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                      >
                        <span className="relative z-10">{isGeneratingVideo ? 'Generating Video...' : 'Create Video'}</span>
                        {!isGeneratingVideo && <Wand2 className="w-4 h-4 relative z-10 group-hover:rotate-12 transition-transform" />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT SIDE: VIDEO PLAYER */}
          <div className="flex flex-col">
            <div className="flex-1 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-3xl relative overflow-hidden flex items-center justify-center h-[calc(100vh-12rem)] min-h-[600px] shadow-2xl">
              
              <AnimatePresence mode="wait">
                {isGeneratingVideo ? (
                  <motion.div
                    key="generating"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center text-center space-y-6 z-10"
                  >
                    <div className="relative w-24 h-24 mb-6">
                      <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-30 animate-pulse rounded-full" />
                      <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-800" />
                        <motion.circle 
                          cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" 
                          strokeDasharray="283" strokeDashoffset={283 - (283 * progress) / 100}
                          className="text-indigo-500 transition-all duration-500 ease-out" 
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
                        {progress}%
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{status}</h3>
                      <p className="text-slate-400 text-sm">Please wait while the AI works its magic.</p>
                    </div>
                  </motion.div>
                ) : status === 'Ready' && scenes.length > 0 ? (
                  <motion.div
                    key="ready"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-black overflow-hidden flex flex-col items-center justify-center group"
                  >
                    {scenes[currentSceneIdx]?.imageUrl ? (
                      <motion.img 
                        key={currentSceneIdx}
                        src={scenes[currentSceneIdx].imageUrl} 
                        alt="Story Scene" 
                        className="absolute inset-0 w-full h-full object-cover"
                        initial={{ scale: 1, opacity: 0 }}
                        animate={{ scale: isPlaying ? 1.05 : 1, opacity: 1 }}
                        transition={{ scale: { duration: 8, ease: "linear" }, opacity: { duration: 0.5 } }}
                      />
                    ) : (
                       <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-slate-400 text-sm">
                         Image Failed to Load
                       </div>
                    )}
                    
                    {/* Controls Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center space-y-6">
                       <button 
                         onClick={handlePlay}
                         className="w-20 h-20 bg-indigo-500/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.4)] hover:scale-105 transition-transform"
                       >
                         {isPlaying ? (
                           <Pause className="w-8 h-8 text-white" />
                         ) : (
                           <Play className="w-8 h-8 ml-1 text-white" />
                         )}
                       </button>
                    </div>

                    {/* Captions & Titles */}
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      key={'caption'+currentSceneIdx}
                      className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                    >
                       {scenes[currentSceneIdx]?.isThumbnail ? (
                         <div className={`absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-transparent flex flex-col ${aspectRatio === '9:16' ? 'items-center bg-gradient-to-b' : 'items-start'} justify-center p-12 space-y-4`}>
                           <div className="flex flex-col space-y-2">
                             {scenes[currentSceneIdx]?.dialogue.replace(/, Part \d+/i, '').split(' ').filter(Boolean).reduce((acc: string[][], word: string, i: number, arr: string[]) => {
                                if (arr.length <= 3) acc.push([word]);
                                else if (arr.length <= 6) {
                                  if (i % 2 === 0) acc.push([word]);
                                  else acc[acc.length-1].push(word);
                                } else {
                                  if (i % 3 === 0) acc.push([word]);
                                  else acc[acc.length-1].push(word);
                                }
                                return acc;
                             }, []).map((lineWords, i) => (
                               <h1 key={i} className={`text-6xl md:text-8xl font-black ${i % 2 !== 0 ? 'text-amber-400' : 'text-white'} drop-shadow-[0_5px_5px_rgba(0,0,0,1)] uppercase tracking-tight`} style={{ WebkitTextStroke: '3px black', lineHeight: '1.1' }}>
                                 {lineWords.join(' ')}
                               </h1>
                             ))}
                           </div>
                           <div className="bg-black px-6 py-3 rounded-xl border-4 border-amber-400 shadow-[0_5px_15px_rgba(0,0,0,0.8)] mt-6 inline-block">
                             <span className="text-2xl md:text-3xl font-black text-amber-400">
                               {storyPart}
                             </span>
                           </div>
                         </div>
                       ) : (
                         <div className="absolute bottom-16 left-8 right-8 text-center flex flex-col items-center">
                           <p className="text-3xl md:text-5xl font-black text-amber-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] uppercase">
                             {isPlaying ? activeCaptionChunk : scenes[currentSceneIdx]?.dialogue}
                           </p>
                         </div>
                       )}
                    </motion.div>

                    <div className="absolute bottom-6 left-6 right-6 flex items-center space-x-4">
                      {isPlaying && (
                        <div className="flex space-x-1 items-end h-4 mr-2">
                           <motion.div animate={{ height: ["4px", "16px", "4px"] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 bg-white rounded-t-sm" />
                           <motion.div animate={{ height: ["8px", "12px", "8px"] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-1 bg-white rounded-t-sm" />
                           <motion.div animate={{ height: ["12px", "6px", "12px"] }} transition={{ repeat: Infinity, duration: 0.9 }} className="w-1 bg-white rounded-t-sm" />
                        </div>
                      )}
                      <div className="h-1 flex-1 bg-slate-800/80 rounded-full overflow-hidden backdrop-blur-md">
                        {isPlaying && <motion.div className="h-full bg-indigo-500" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: scenes.length ? (1/scenes.length) * 100 : 0 }} />}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center text-slate-500 space-y-4"
                  >
                    <div className="p-4 bg-slate-800/30 rounded-2xl">
                      <Video className="w-8 h-8 opacity-50" />
                    </div>
                    <p>Your generated video will appear here</p>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>
        </div>

        {/* BOTTOM ACTIONS (EXPORT MP4 & EDIT) */}
        {status === 'Ready' && scenes.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6"
          >
             <button 
               onClick={handleDownload}
               disabled={isDownloading}
               className="flex items-center space-x-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-full font-bold transition-all shadow-[0_0_30px_rgba(79,70,229,0.4)] disabled:opacity-50 text-lg w-full sm:w-auto justify-center hover:scale-105"
             >
               {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
               <span>{isDownloading ? 'Rendering MP4...' : 'Export as MP4'}</span>
             </button>
             
             <button 
               onClick={handleEditVideo}
               className="flex items-center space-x-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full font-bold transition-all w-full sm:w-auto justify-center text-lg hover:scale-105 text-slate-300 hover:text-white"
             >
               <Edit3 className="w-5 h-5" />
               <span>Edit Scenes & Regenerate</span>
             </button>
          </motion.div>
        )}
      </section>
    </div>
  );
}
