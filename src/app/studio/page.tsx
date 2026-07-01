"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Play, Sparkles, Video, Pause, AlertCircle, Download, Loader2, Edit3, ChevronRight, ChevronDown, ChevronUp, CheckCircle2, Image as ImageIcon, Globe, Mail, Link, XCircle, MessageSquare, Mic, Scissors, Zap, Music, Smartphone, Settings, PenTool, Volume2, Type, FileText, Upload, Trash2, Plus, Users, Eye } from 'lucide-react';

import Nav from '../../components/Nav';

interface Scene {
  imagePrompt: string;
  dialogue: string;
  imageUrl?: string;
  audioUrl?: string;
  isThumbnail?: boolean;
}

interface CharacterEntry {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  isGenerating?: boolean;
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
  // dialogue format: "StoryTitle - PartTitle, Part X" or "StoryTitle, Part X"
  // Parse the parts
  let storyName = dialogue;
  let partTitle = '';
  let partNum = part || 'PART 1';

  // Extract part number from dialogue if present (e.g., ", Part 1" or ", Part-1" or ", Part - 1" or ", PART-1")
  const partMatch = dialogue.match(/,\s*(Part[\s\-]*\d+)/i);
  if (partMatch) {
    partNum = partMatch[1].replace(/[\s\-]+/g, ' ').trim().toUpperCase();
    storyName = dialogue.replace(/,\s*Part[\s\-]*\d+/i, '').trim();
  }

  // Extract part title if present (after " - ")
  const titleMatch = storyName.match(/^(.+?)\s*-\s*(.+)$/);
  if (titleMatch) {
    storyName = titleMatch[1].trim();
    partTitle = titleMatch[2].trim();
  }

  // Dark gradient overlay on left side for text readability
  const gradient = isPortrait
    ? ctx.createLinearGradient(0, 0, 0, canvasHeight * 0.6)
    : ctx.createLinearGradient(0, 0, canvasWidth * 0.65, 0);

  gradient.addColorStop(0, "rgba(0,0,0,0.92)");
  gradient.addColorStop(0.6, "rgba(0,0,0,0.6)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const leftMargin = isPortrait ? canvasWidth / 2 : 60;
  ctx.textAlign = isPortrait ? "center" : "left";

  // === PART NUMBER — Red pill badge, top-left ===
  const pillW = 180;
  const pillH = 50;
  const pillX = isPortrait ? (canvasWidth - pillW) / 2 : leftMargin;
  const pillY = isPortrait ? 60 : 40;

  ctx.fillStyle = "#FF3B30";
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 25);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px 'Arial Black', Impact, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(partNum.toUpperCase(), pillX + pillW / 2, pillY + pillH / 2);

  // === STORY TITLE — Large white text with golden glow ===
  ctx.textAlign = isPortrait ? "center" : "left";
  ctx.textBaseline = "top";
  const titleFontSize = isPortrait ? 70 : 90;
  const titleY = isPortrait ? 140 : 120;

  ctx.font = `900 ${titleFontSize}px 'Arial Black', Impact, sans-serif`;

  // Black stroke for readability
  ctx.lineWidth = 12;
  ctx.strokeStyle = "black";
  ctx.strokeText(storyName, leftMargin, titleY);

  // Golden glow
  ctx.shadowColor = "rgba(255, 213, 79, 0.6)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // White fill
  ctx.fillStyle = "#ffffff";
  ctx.fillText(storyName, leftMargin, titleY);
  ctx.shadowColor = "transparent";

  // === PART TITLE — Black pill container with golden text ===
  if (partTitle) {
    const ptFontSize = isPortrait ? 36 : 42;
    ctx.font = `bold ${ptFontSize}px 'Arial Black', sans-serif`;
    const ptTextWidth = ctx.measureText(partTitle).width;
    const ptPillW = ptTextWidth + 50;
    const ptPillH = isPortrait ? 55 : 60;
    const ptY = titleY + titleFontSize + 30;
    const ptX = isPortrait ? (canvasWidth - ptPillW) / 2 : leftMargin;

    // Black pill background
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.beginPath();
    ctx.roundRect(ptX, ptY, ptPillW, ptPillH, 30);
    ctx.fill();

    // Golden border
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#FFD54F";
    ctx.beginPath();
    ctx.roundRect(ptX, ptY, ptPillW, ptPillH, 30);
    ctx.stroke();

    // Golden text
    ctx.fillStyle = "#FFD54F";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(partTitle, ptX + ptPillW / 2, ptY + ptPillH / 2);
  }

  // === BOTTOM — "Hindi Story" branding ===
  const brandY = canvasHeight - (isPortrait ? 80 : 60);
  const brandX = isPortrait ? canvasWidth / 2 : leftMargin;
  ctx.textAlign = isPortrait ? "center" : "left";
  ctx.textBaseline = "middle";

  ctx.font = "italic 24px Georgia, serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.fillText("✨ Hindi Story", brandX, brandY);
};

export default function Home() {
  const [storyTitle, setStoryTitle] = useState('');
  const [storyPart, setStoryPart] = useState('');
  const [partTitle, setPartTitle] = useState('');
  const [script, setScript] = useState('');
  const [visualStyle, setVisualStyle] = useState(VISUAL_STYLES[0]);
  const [bgmTrack, setBgmTrack] = useState(BGM_TRACKS[0].url);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [targetLanguage, setTargetLanguage] = useState(LANGUAGES[0]);
  const [characterProfile, setCharacterProfile] = useState('A young Indian boy with big expressive eyes, brown hair, wearing a simple brown shirt and a sling bag strap');
  const [locationProfile, setLocationProfile] = useState('A creepy 19th-century Victorian bungalow with broken windows and a red roof');
  const [globalSeed, setGlobalSeed] = useState(42);
  const [idea, setIdea] = useState('');
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [activeTab, setActiveTab] = useState<'script' | 'settings' | 'characters'>('script');
  const [isUniverseOpen, setIsUniverseOpen] = useState(false);
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);

  const [bgmVolume, setBgmVolume] = useState(15);
  const [voiceVolume, setVoiceVolume] = useState(100);
  const [subtitleStyle, setSubtitleStyle] = useState<'viral' | 'cinematic' | 'none'>('viral');

  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [isStoryboardMode, setIsStoryboardMode] = useState(false);
  const [storyboardScenes, setStoryboardScenes] = useState<Scene[]>([]);

  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generatingImageIdx, setGeneratingImageIdx] = useState<number | null>(null);
  const [status, setStatus] = useState('Idle');
  const [progress, setProgress] = useState(0);

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);

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

        const wordsPerChunk = 6; // Show 6 words at a time for full video subtitles
        const chunkIndex = Math.floor(activeWordIndex / wordsPerChunk);
        const chunk = words.slice(chunkIndex * wordsPerChunk, (chunkIndex + 1) * wordsPerChunk).join(' ');
        setActiveCaptionChunk(chunk);
      }, 100);
    } else {
      setActiveCaptionChunk('');
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentSceneIdx, sceneStartTime, scenes]);

  // Load characters from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('storyCharacters');
    if (saved) {
      try { setCharacters(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  // Save characters to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('storyCharacters', JSON.stringify(characters));
  }, [characters]);

  // Warning for visibility change during export
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isDownloading) {
        console.warn("Exporting in background tab. This will cause audio-video desync or cut-offs.");
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isDownloading]);

  // Prevent leaving page during export
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDownloading) {
        e.preventDefault();
        e.returnValue = 'Export is in progress. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDownloading]);

  const handleAddCharacter = () => {
    const newChar: CharacterEntry = {
      id: Date.now().toString(),
      name: '',
      description: '',
    };
    setCharacters([...characters, newChar]);
  };

  const handleUpdateCharacter = (id: string, field: 'name' | 'description', value: string) => {
    setCharacters(characters.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleDeleteCharacter = (id: string) => {
    setCharacters(characters.filter(c => c.id !== id));
  };

  const handleGenerateCharacterImage = async (id: string) => {
    const char = characters.find(c => c.id === id);
    if (!char || !char.description) return;

    setCharacters(characters.map(c => c.id === id ? { ...c, isGenerating: true } : c));

    try {
      const prompt = `Single character portrait, ONE person only, ${char.description}, standing in a simple neutral pose, looking at the camera, plain white background, clean studio lighting, full body visible, sharp details, 3D Pixar style, high quality character design, 8k resolution. IMPORTANT: Show only ONE single character, not multiple copies or multiple angles.`;

      const imgRes = await fetch('/api/image', {
        method: 'POST',
        body: JSON.stringify({ prompt, style: visualStyle, aspectRatio: '16:9', seed: globalSeed }),
        headers: { 'Content-Type': 'application/json' }
      });

      if (!imgRes.ok) throw new Error('Image generation failed');

      const blob = await imgRes.blob();
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        setCharacters(prev => prev.map(c => c.id === id ? { ...c, imageUrl: objectUrl, isGenerating: false } : c));
        showToast(`Character "${char.name}" image generated!`);
      }
    } catch (e: any) {
      console.error(e);
      setCharacters(prev => prev.map(c => c.id === id ? { ...c, isGenerating: false } : c));
      showToast("Error generating character image: " + e.message);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveSeries = () => {
    const universe = {
      characterProfile,
      locationProfile,
      visualStyle,
      globalSeed,
      characters
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
      if (universe.characters) setCharacters(universe.characters);
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

  // Generate the fixed thumbnail prompt template — only story name, part, part title change
  const getThumbnailPrompt = () => {
    // Use characters from Characters tab if available, otherwise fall back to characterProfile
    const mainChar = characters.find(c => c.name && c.description);
    const charDescription = mainChar
      ? `On the right side, ${mainChar.description}, holding or interacting with the KEY OBJECT from the story title "${storyTitle}". The key object must be PROMINENTLY VISIBLE and GLOWING.`
      : characterProfile
        ? `On the right side, ${characterProfile}, holding or interacting with the KEY OBJECT from the story title "${storyTitle}". The key object must be PROMINENTLY VISIBLE and GLOWING.`
        : '';

    const storyObject = storyTitle.trim();

    return `Cinematic YouTube thumbnail background image in 16:9 (1280x720). Dark, mysterious, high-contrast fantasy setting with dramatic volumetric lighting. 

MOST IMPORTANT: The story is called "${storyObject}" — the KEY OBJECT/CONCEPT from this title MUST be prominently visible and glowing in the image.

${charDescription}

The character should have a dramatic expression (shocked, curious, or amazed). Mysterious magical particles floating around. Fantasy atmosphere, cinematic rim lighting, dark moody background with magical glow. Leave the LEFT SIDE relatively empty/dark for text overlay space.

Style: Highly detailed digital painting, Pixar 3D quality, professional YouTube thumbnail composition, 8k, masterpiece.`;
  };

  // Save/Load thumbnail base from localStorage for consistent series look
  const saveThumbnailForSeries = (prompt: string) => {
    if (!storyTitle.trim()) return;
    const thumbnailData = {
      basePrompt: prompt,
      characterProfile,
      storyTitle: storyTitle.trim()
    };
    localStorage.setItem(`thumbnail_${storyTitle.trim()}`, JSON.stringify(thumbnailData));
  };

  const loadThumbnailForSeries = (): string | null => {
    if (!storyTitle.trim()) return null;
    const saved = localStorage.getItem(`thumbnail_${storyTitle.trim()}`);
    if (!saved) return null;
    try {
      const data = JSON.parse(saved);
      // Same story title — reuse the base prompt but update part number and part title
      if (data.storyTitle === storyTitle.trim()) {
        // Rebuild with updated part info
        return data.basePrompt
          .replace(/\"PART \d+\"/g, `"${storyPart || 'PART 1'}"`)
          .replace(/pill badge with white bold text \"[^"]*\"/g, `pill badge with white bold text "${storyPart || 'PART 1'}"`)
          .replace(/Below it medium golden yellow \(#FFD54F\) subtitle \"[^"]*\"/g, `Below it medium golden yellow (#FFD54F) subtitle "${partTitle}"`);
      }
    } catch { /* ignore parse errors */ }
    return null;
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
        body: JSON.stringify({ script, targetLanguage, characterProfile, locationProfile, characters: characters.filter(c => c.name && c.description) }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.details || data.error || 'Failed to generate scenes');
      if (!data.scenes || !Array.isArray(data.scenes)) throw new Error('Invalid response: no scenes array returned');

      // Always generate fresh thumbnail based on current story
      const thumbnailPrompt = getThumbnailPrompt();

      const thumbnailScene: Scene = {
        isThumbnail: true,
        imagePrompt: thumbnailPrompt,
        dialogue: `${storyTitle}${partTitle ? ' - ' + partTitle : ''}${storyPart ? ', ' + storyPart : ''}`
      };

      // Outro CTA scene — like, subscribe, bell icon
      const outroScene: Scene = {
        imagePrompt: `Dark cinematic background with glowing Subscribe button, bell notification icon, thumbs up like icon, and "Next Part Coming Soon" text. YouTube end screen style, vibrant red subscribe button, golden bell icon glowing, modern clean design, dark gradient background with magical particles, professional YouTube outro card, 8k, masterpiece.`,
        dialogue: `अगर यह कहानी पसंद आई तो Like करें, Subscribe करें, और Bell icon 🔔 जरूर दबाएं ताकि अगला part आते ही notification मिल जाए! अगला part जल्दी आ रहा है...`
      };

      setStoryboardScenes([thumbnailScene, ...data.scenes, outroScene]);
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

  const handleAddScene = (afterIndex: number) => {
    const newScene: Scene = {
      imagePrompt: '',
      dialogue: '',
    };
    const newScenes = [...storyboardScenes];
    newScenes.splice(afterIndex + 1, 0, newScene);
    setStoryboardScenes(newScenes);
    showToast(`New scene added after ${afterIndex === 0 && storyboardScenes[0]?.isThumbnail ? 'Thumbnail' : `Scene ${afterIndex + 1}`}`);
  };

  const handleDeleteScene = (index: number) => {
    if (storyboardScenes[index]?.isThumbnail) {
      showToast("Cannot delete thumbnail scene");
      return;
    }
    const newScenes = storyboardScenes.filter((_, i) => i !== index);
    setStoryboardScenes(newScenes);
    showToast(`Scene ${index + 1} deleted`);
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

    setGeneratingImageIdx(index);

    try {
      const imgRes = await fetch('/api/image', {
        method: 'POST',
        body: JSON.stringify({ prompt: scene.imagePrompt, style: visualStyle, aspectRatio, seed: globalSeed + index }),
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
    } finally {
      setGeneratingImageIdx(null);
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
              body: JSON.stringify({ prompt: scene.imagePrompt, style: visualStyle, aspectRatio, seed: globalSeed + i }),
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
          // Wait 3 seconds before asking for the next image to prevent Rate Limiting
          await new Promise(resolve => setTimeout(resolve, 3000));
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
          } catch (e) {
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
    setExportProgress(0);

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

      let options: MediaRecorderOptions = { mimeType: 'video/webm;codecs=vp9,opus' };
      if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')) {
        options = { mimeType: 'video/mp4;codecs=avc1,mp4a.40.2' };
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        options = { mimeType: 'video/webm;codecs=vp9,opus' };
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        options = { mimeType: 'video/webm;codecs=vp8,opus' };
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        options = { mimeType: 'video/webm' };
      }

      const recorder = new MediaRecorder(combinedStream, { ...options, videoBitsPerSecond: 5000000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.start(1000); // Collect data every 1 second for reliability

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
      let activeExportSceneIdx = 0;
      let activeExportSceneStartMs = 0;

      // Pre-calculate all scene durations BEFORE starting recording
      const sceneDurations: number[] = [];
      for (let i = 0; i < scenes.length; i++) {
        if (scenes[i].audioUrl) {
          try {
            const res = await fetch(scenes[i].audioUrl as string);
            const arrayBuffer = await res.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            sceneDurations.push(audioBuffer.duration * 1000);
          } catch {
            sceneDurations.push(3000);
          }
        } else {
          sceneDurations.push(3000);
        }
      }

      const drawFrame = () => {
        if (!isRecordingProcess) return;

        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const sceneIdx = activeExportSceneIdx;
        const elapsedInScene = activeExportSceneStartMs > 0 ? Date.now() - activeExportSceneStartMs : 0;
        const durationMs = sceneDurations[sceneIdx] || 3000;
        const progress = Math.min(1, elapsedInScene / durationMs);

        const scene = scenes[sceneIdx];
        const img = loadedImages[sceneIdx];

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
          const panDirX = sceneIdx % 2 === 0 ? 1 : -1;
          const panDirY = sceneIdx % 3 === 0 ? 1 : -1;

          // Move from center by up to 5% of dimensions
          const panOffsetX = (progress * (scaledWidth * 0.05)) * panDirX;
          const panOffsetY = (progress * (scaledHeight * 0.05)) * panDirY;

          ctx.drawImage(img, baseOffsetX + panOffsetX, baseOffsetY + panOffsetY, scaledWidth, scaledHeight);
        }

        if (scene) {
          if (scene.isThumbnail) {
            drawThumbnailText(ctx, canvas.width, canvas.height, scene.dialogue, storyPart, aspectRatio === '9:16');
          } else if (subtitleStyle !== 'none') {
            const words = scene.dialogue.split(' ');
            let activeWordIndex = Math.floor((elapsedInScene / durationMs) * words.length);
            if (isNaN(activeWordIndex) || activeWordIndex < 0) activeWordIndex = 0;
            if (activeWordIndex >= words.length) activeWordIndex = words.length - 1;

            if (subtitleStyle === 'viral') {
              ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
              ctx.fillRect(0, canvas.height - 120, canvas.width, 120);

              ctx.textAlign = "center";
              ctx.shadowColor = "black";
              ctx.shadowBlur = 4;

              const wordsPerChunk = 6;
              const chunkIndex = Math.floor(activeWordIndex / wordsPerChunk);
              const chunk = words.slice(chunkIndex * wordsPerChunk, (chunkIndex + 1) * wordsPerChunk).join(' ');

              ctx.fillStyle = "#fbbf24";
              ctx.font = "bold 40px Arial";
              ctx.fillText(chunk, canvas.width / 2, canvas.height - 45);
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

        if (!isRecordingProcess) {
          clearInterval(drawInterval);
          return;
        }
        requestAnimationFrame(drawFrame);
      };

      // Use setInterval as backup to prevent browser throttling on long exports
      const drawInterval = setInterval(() => {
        if (!isRecordingProcess) {
          clearInterval(drawInterval);
          return;
        }
        drawFrame();
      }, 33); // ~30fps backup via setInterval (doesn't get throttled)

      const processScene = async (idx: number) => {
        if (idx >= scenes.length) {
          isRecordingProcess = false;
          if (bgmSource) bgmSource.stop();
          recorder.stop();
          setExportProgress(100);
          return;
        }

        // Update export progress
        setExportProgress(Math.round((idx / scenes.length) * 100));

        const durationMs = sceneDurations[idx] || 3000;

        if (scenes[idx].audioUrl) {
          try {
            const res = await fetch(scenes[idx].audioUrl as string);
            const arrayBuffer = await res.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;

            const voiceGainNode = audioCtx.createGain();
            voiceGainNode.gain.value = voiceVolume / 100;

            source.connect(voiceGainNode);
            voiceGainNode.connect(dest);

            activeExportSceneIdx = idx;
            activeExportSceneStartMs = Date.now();

            source.start();

            setTimeout(() => processScene(idx + 1), durationMs);
          } catch (err) {
            console.error("Audio decode error", err);
            activeExportSceneIdx = idx;
            activeExportSceneStartMs = Date.now();
            setTimeout(() => processScene(idx + 1), 3000);
          }
        } else {
          activeExportSceneIdx = idx;
          activeExportSceneStartMs = Date.now();
          setTimeout(() => processScene(idx + 1), durationMs);
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
        // Use correct file extension based on actual format
        const ext = (options.mimeType || '').includes('mp4') ? 'mp4' : 'webm';
        a.download = `AI_StoryCraft_Video.${ext}`;
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


  const activeModalScene = modalImage
    ? (storyboardScenes.find(s => s.imageUrl === modalImage) || scenes.find(s => s.imageUrl === modalImage))
    : null;

  const activeModalIdx = activeModalScene
    ? (storyboardScenes.includes(activeModalScene) ? storyboardScenes.indexOf(activeModalScene) : scenes.indexOf(activeModalScene))
    : -1;

  const activeModalChar = modalImage
    ? characters.find(c => c.imageUrl === modalImage)
    : null;

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
                        className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === 'script' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'
                          }`}
                      >
                        <PenTool className="w-4 h-4" />
                        <span>Script</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('characters')}
                        className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === 'characters' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'
                          }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Characters</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('characters')}
                        className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === 'characters' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'
                          }`}
                      >
                        <Users className="w-4 h-4" />
                        <span>Characters</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'
                          }`}
                      >
                        <Settings className="w-4 h-4" />
                        <span>Settings</span>
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

                      {activeTab === 'characters' && (
                        <motion.div
                          key="characters-tab"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex flex-col flex-1 min-h-0 space-y-4 overflow-y-auto pr-2 custom-scrollbar"
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-300">Story Characters</h3>
                            <button
                              onClick={handleAddCharacter}
                              className="flex items-center space-x-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Character</span>
                            </button>
                          </div>

                          {characters.length === 0 && (
                            <div className="text-center py-12 text-slate-500">
                              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
                              <p className="text-sm">No characters yet. Add characters so AI can use correct visuals in each scene.</p>
                            </div>
                          )}

                          {characters.map((char) => (
                            <div key={char.id} className="bg-slate-950/50 rounded-xl border border-slate-800 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <input
                                  type="text"
                                  value={char.name}
                                  onChange={(e) => handleUpdateCharacter(char.id, 'name', e.target.value)}
                                  placeholder="Character name (e.g. मोहन, राजा)"
                                  className="flex-1 bg-slate-900/50 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500/50 font-bold"
                                />
                                <button
                                  onClick={() => handleDeleteCharacter(char.id)}
                                  className="ml-2 p-2 text-rose-400 hover:bg-rose-600/20 rounded-lg transition-colors"
                                  title="Delete character"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <textarea
                                value={char.description}
                                onChange={(e) => handleUpdateCharacter(char.id, 'description', e.target.value)}
                                placeholder="Visual description (e.g. A 13-year-old Indian boy with messy black hair, big brown eyes, torn brown shirt, cloth bag)"
                                rows={3}
                                className="w-full bg-slate-900/50 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500/50 resize-none"
                              />
                              {/* Character reference image */}
                              <div className="flex items-center space-x-3">
                                {char.imageUrl && (
                                  <div
                                    className="w-20 h-20 rounded-lg overflow-hidden border border-slate-700 shrink-0 cursor-pointer hover:border-violet-500 transition-colors"
                                    onClick={() => setModalImage(char.imageUrl!)}
                                  >
                                    <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <button
                                  onClick={() => handleGenerateCharacterImage(char.id)}
                                  disabled={char.isGenerating || !char.description}
                                  className="flex items-center space-x-1 text-xs font-bold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  {char.isGenerating ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Generating...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-3.5 h-3.5" />
                                      <span>{char.imageUrl ? 'Regenerate Look' : 'Generate Look'}</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}

                          <p className="text-xs text-slate-600 mt-2">
                            💡 AI will automatically detect character names in each scene's dialogue and inject the correct visual description into the image prompt.
                          </p>
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

                          <div className="flex flex-col space-y-3 shrink-0">
                            <input
                              type="text"
                              value={storyTitle}
                              onChange={(e) => setStoryTitle(e.target.value)}
                              placeholder="Story Name (e.g. जादुई चप्पल)"
                              className="w-full bg-slate-950/50 rounded-xl px-4 py-3 outline-none text-md font-medium text-slate-200 placeholder:text-slate-600 border border-transparent focus:border-indigo-500/30 transition-colors"
                            />
                            <div className="flex space-x-3">
                              <input
                                type="text"
                                value={storyPart}
                                onChange={(e) => setStoryPart(e.target.value)}
                                placeholder="Part (e.g. Part 1)"
                                className="w-1/3 bg-slate-950/50 rounded-xl px-4 py-3 outline-none text-md font-medium text-slate-200 placeholder:text-slate-600 border border-transparent focus:border-indigo-500/30 transition-colors"
                              />
                              <input
                                type="text"
                                value={partTitle}
                                onChange={(e) => setPartTitle(e.target.value)}
                                placeholder="Part Title (e.g. रहस्यमयी शुरुआत)"
                                className="w-2/3 bg-slate-950/50 rounded-xl px-4 py-3 outline-none text-md font-medium text-slate-200 placeholder:text-slate-600 border border-transparent focus:border-indigo-500/30 transition-colors"
                              />
                            </div>
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
                        <div key={idx}>
                          <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-500 bg-slate-900 px-2 py-1 rounded-md">{scene.isThumbnail ? 'THUMBNAIL' : `SCENE ${idx + 1}`}</span>
                              <div className="flex space-x-2">
                                {!scene.isThumbnail && (
                                  <button
                                    onClick={() => handleDeleteScene(idx)}
                                    className="text-xs font-bold bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white px-2 py-1 rounded-md transition-colors flex items-center space-x-1"
                                    title="Delete scene"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
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
                                  disabled={generatingImageIdx === idx}
                                  className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-70 text-white px-3 py-1 rounded-md transition-colors flex items-center space-x-1 shadow-lg"
                                >
                                  {generatingImageIdx === idx ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Generating...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-3.5 h-3.5" />
                                      <span>Generate Preview</span>
                                    </>
                                  )}
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
                                <div className="relative group/img w-full h-32 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 cursor-pointer" onClick={() => setModalImage(scene.imageUrl!)}>
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
                                  <div
                                    className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center space-x-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setModalImage(scene.imageUrl!); }}
                                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center space-x-1 shadow-lg cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>View</span>
                                    </button>
                                    <label
                                      className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center space-x-1 shadow-lg"
                                      onClick={(e) => e.stopPropagation()}
                                    >
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
                                      onClick={(e) => { e.stopPropagation(); handleRemoveImage(idx); }}
                                      className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center space-x-1 shadow-lg cursor-pointer"
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
                          {/* Add Scene button between scenes */}
                          <button
                            onClick={() => handleAddScene(idx)}
                            className="w-full flex items-center justify-center py-2 my-1 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg border border-dashed border-slate-800 hover:border-emerald-500/50 transition-all group"
                            title="Add new scene here"
                          >
                            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          </button>
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
                      key={'caption' + currentSceneIdx}
                      className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                    >
                      {scenes[currentSceneIdx]?.isThumbnail ? (
                        <div className={`absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-transparent flex flex-col ${aspectRatio === '9:16' ? 'items-center bg-gradient-to-b' : 'items-start'} justify-center p-12 space-y-4`}>
                          <div className="flex flex-col space-y-2">
                            {scenes[currentSceneIdx]?.dialogue.replace(/, Part \d+/i, '').split(' ').filter(Boolean).reduce((acc: string[][], word: string, i: number, arr: string[]) => {
                              if (arr.length <= 3) acc.push([word]);
                              else if (arr.length <= 6) {
                                if (i % 2 === 0) acc.push([word]);
                                else acc[acc.length - 1].push(word);
                              } else {
                                if (i % 3 === 0) acc.push([word]);
                                else acc[acc.length - 1].push(word);
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
                        {isPlaying && <motion.div className="h-full bg-indigo-500" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: scenes.length ? (1 / scenes.length) * 100 : 0 }} />}
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
              <span>{isDownloading ? `Exporting... ${exportProgress}%` : 'Export as MP4'}</span>
            </button>

            {isDownloading && (
              <div className="w-full sm:w-64 bg-slate-800 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            )}

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

      {/* Lightbox Modal for Full Image Preview */}
      <AnimatePresence>
        {modalImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalImage(null)}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl w-full bg-slate-900/95 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col cursor-default"
            >
              {/* Close Button */}
              <button
                onClick={() => setModalImage(null)}
                className="absolute top-4 right-4 bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-white p-2.5 rounded-full transition-colors z-10 border border-slate-700/30"
                title="Close"
              >
                <XCircle className="w-6 h-6" />
              </button>

              {/* Main Image Container */}
              <div className="p-6 flex flex-col items-center justify-center">
                <div className="relative w-full flex items-center justify-center rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
                  <img
                    src={modalImage}
                    alt="Full preview image"
                    className="max-h-[60vh] object-contain rounded-2xl"
                  />
                </div>
              </div>

              {/* Info panel for scenes */}
              {activeModalScene && (
                <div className="bg-slate-950/90 border-t border-slate-800/85 p-6 space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md">
                      {activeModalScene.isThumbnail ? 'THUMBNAIL' : `SCENE ${activeModalIdx + 1}`}
                    </span>
                  </div>
                  {activeModalScene.dialogue && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Dialogue</span>
                      <p className="text-md font-bold text-amber-400 leading-snug">{activeModalScene.dialogue}</p>
                    </div>
                  )}
                  {activeModalScene.imagePrompt && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Image Prompt</span>
                      <p className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800/40 select-all font-mono leading-relaxed max-h-24 overflow-y-auto custom-scrollbar">
                        {activeModalScene.imagePrompt}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Info panel for characters */}
              {activeModalChar && (
                <div className="bg-slate-950/90 border-t border-slate-800/85 p-6 space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-violet-400 bg-violet-950/30 border border-violet-900/50 px-2.5 py-1 rounded-md">
                      CHARACTER
                    </span>
                  </div>
                  {activeModalChar.name && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Name</span>
                      <p className="text-md font-bold text-violet-300 leading-snug">{activeModalChar.name}</p>
                    </div>
                  )}
                  {activeModalChar.description && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Visual Description</span>
                      <p className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800/40 select-all font-mono leading-relaxed max-h-24 overflow-y-auto custom-scrollbar">
                        {activeModalChar.description}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Progress Modal */}
      <AnimatePresence>
        {isDownloading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-6"
            >
              <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 animate-pulse border border-indigo-500/20">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Exporting Video</h3>
                <p className="text-sm text-slate-400">
                  We are rendering and compiling your scenes. This may take a few minutes.
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-400">
                  <span>Progress</span>
                  <span className="text-indigo-400">{exportProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700/50">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
              </div>

              {/* Warning Alert Box */}
              <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-left flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">Important</span>
                  <p className="text-xs text-amber-200/80 leading-relaxed">
                    Please **keep this tab active and visible**. Do not minimize this window or switch to other tabs. If the browser tab is hidden, the video generation will be throttled, resulting in a cut-off or out-of-sync download.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
