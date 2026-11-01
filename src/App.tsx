import { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  MessageSquare,
  Link as LinkIcon,
  Image as ImageIcon,
  QrCode,
  ArrowRight,
  Upload,
  Camera,
  Download,
  LoaderCircle,
} from 'lucide-react';
import { normalizeUrl } from '../lib/detection.js';
import { combineAssessment } from '../lib/assessment.js';
import { applySemanticAssessment } from '../lib/semantic-assessment.js';
import { inspectFileBytes } from '../lib/file-validation.js';
import { inspectImageProvenance } from '../lib/image-provenance.js';
import ImageProvenance from './components/ImageProvenance';
import { assessContent } from '../lib/content-assessment.js';
import Assessment from './components/Assessment';
import CheckLoading from './components/CheckLoading';
import {
  imageQuality,
  preprocessCanvas,
  bitmapCanvas,
  ocrCanvas,
  rotateCanvas,
} from '../lib/image-tools';
import { recognizeImage } from '../lib/ocr.js';
import ImageEditor from './components/ImageEditor';
import Readiness from './components/Readiness';

const tabs = [
  { name: 'Text message', icon: MessageSquare },
  { name: 'Link', icon: LinkIcon },
  { name: 'Image', icon: ImageIcon },
  { name: 'QR code', icon: QrCode },
];
export default function App() {
  const [tab, setTab] = useState(0),
    [input, setInput] = useState(''),
    [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [online, setOnline] = useState(true),
    [configured, setConfigured] = useState(false),
    [consent, setConsent] = useState(false),
    [verification, setVerification] = useState<any>(null),
    [preview, setPreview] = useState(''),
    [extracted, setExtracted] = useState(''),
    [qr, setQr] = useState(''),
    [quality, setQuality] = useState<string[]>([]),
    [confidence, setConfidence] = useState<number | null>(null),
    [camera, setCamera] = useState(false),
    [offline, setOffline] = useState(''),
    [preprocess, setPreprocess] = useState(true);
  const [aiConsent, setAiConsent] = useState(false),
    [aiConfigured, setAiConfigured] = useState(false),
    [semantic, setSemantic] = useState<any>(null);
  const [aiService, setAiService] = useState<any>({
      provider: 'Contextual AI',
      providerId: '',
      freeOnly: false,
    }),
    [provenance, setProvenance] = useState<any>(null);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [fileInfo, setFileInfo] = useState(''),
    [qualityStats, setQualityStats] = useState<any>(null),
    [elapsed, setElapsed] = useState<number | null>(null),
    [stage, setStage] = useState(''),
    [liveQuality, setLiveQuality] = useState<any>(null);
  const originalRef = useRef<HTMLCanvasElement | null>(null),
    workerLoading = useRef<Promise<any> | null>(null),
    scanning = useRef(false),
    mounted = useRef(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null),
    started = useRef(0),
    resultRef = useRef<HTMLElement | null>(null);
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    worker = useRef<any>(null),
    fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    change();
    window.addEventListener('online', change);
    window.addEventListener('offline', change);
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.getRegistration().then((r) => {
        if (r?.active) {
          setOffline('Offline resources previously installed.');
          if (navigator.onLine) r.update().catch(() => {});
        }
      });
    return () => {
      window.removeEventListener('online', change);
      window.removeEventListener('offline', change);
      mounted.current = false;
      stream.current?.getTracks().forEach((t) => t.stop());
      worker.current?.terminate();
    };
  }, []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 5000);
    Promise.allSettled([
      fetch('/api/verify', { signal: controller.signal })
        .then((r) => r.json())
        .then((d) => {
          if (active) {
            setConfigured(d.configured === true);
            setConsent(d.configured === true);
          }
        }),
      fetch('/api/assess', { signal: controller.signal })
        .then((r) => r.json())
        .then((d) => {
          if (active) {
            setAiConfigured(d.configured === true);
            setAiConsent(d.configured === true);
            setAiService(d);
          }
        }),
    ]).finally(() => {
      clearTimeout(timer);
      if (active) setServicesLoading(false);
    });
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);
  useEffect(() => {
    if (camera && video.current && stream.current) {
      video.current.srcObject = stream.current;
      video.current.play().catch(() => {});
    }
  }, [camera]);
  useEffect(() => {
    if (!camera) return;
    let cancelled = false,
      running = false;
    const timer = setInterval(async () => {
      const v = video.current;
      if (running || !v?.videoWidth) return;
      running = true;
      try {
        const c = document.createElement('canvas');
        c.width = 480;
        c.height = Math.round((480 * v.videoHeight) / v.videoWidth);
        c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
        const q = await imageQuality(c, false);
        if (!cancelled) setLiveQuality(q);
      } finally {
        running = false;
      }
    }, 1800);
    return () => {
      cancelled = true;
      clearInterval(timer);
      setLiveQuality(null);
    };
  }, [camera]);
  useEffect(() => {
    if (tab === 2) getOcrWorker().catch(() => {});
  }, [tab]);
  async function getOcrWorker() {
    if (worker.current) return worker.current;
    if (!workerLoading.current)
      workerLoading.current = (async () => {
        const { createWorker } = await import('tesseract.js');
        let timer: ReturnType<typeof setTimeout> | undefined,
          failed = false;
        const instance = await new Promise<any>((resolve, reject) => {
          const fail = () => {
            failed = true;
            reject(
              Error(
                'The text reader could not load. Reconnect and try again, or paste the message as text.',
              ),
            );
          };
          timer = setTimeout(fail, 60000);
          createWorker('eng', 1, {
            workerPath: '/ocr/worker.min.js',
            corePath: '/ocr',
            langPath: '/ocr',
            cachePath: 'surfare-lstm-v2',
            errorHandler: fail,
            logger: (m: any) => {
              if (scanning.current && m.status)
                setBusy(m.status + ' ' + Math.round((m.progress || 0) * 100) + '%');
            },
          }).then((instance) => {
            if (failed) instance.terminate();
            else resolve(instance);
          }, fail);
        }).finally(() => clearTimeout(timer));
        if (!mounted.current) {
          await instance.terminate();
          throw Error('OCR was closed.');
        }
        worker.current = instance;
        return instance;
      })().catch((e) => {
        workerLoading.current = null;
        throw e;
      });
    return workerLoading.current;
  }
  function stopCamera() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera(false);
  }
  function reset(next = tab) {
    setProvenance(null);
    setSemantic(null);
    canvasRef.current = null;
    originalRef.current = null;
    setFileInfo('');
    setQualityStats(null);
    setElapsed(null);
    setStage('');
    stopCamera();
    setTab(next);
    setInput('');
    setResult(null);
    setVerification(null);
    setError('');
    setPreview('');
    setExtracted('');
    setQr('');
    setQuality([]);
    setConfidence(null);
    if (fileRef.current) fileRef.current.value = '';
  }
  async function assess(text: string, urls: string[] = [], uncertain = false) {
    const kind = tab === 3 ? 'qr' : tab === 2 ? 'image' : tab === 1 ? 'link' : 'message';
    setStage('Checking warning signs');
    const local = assessContent({ text, urls, kind, uncertain });
    setResult(null);
    setVerification(null);
    let ai: any = {
        status: 'not_checked',
        message: !aiConsent
          ? 'Contextual AI was not selected. Local rules do not establish the meaning or safety of this message.'
          : !navigator.onLine
            ? 'Contextual AI is unavailable offline. Local findings only.'
            : 'Contextual AI has not completed.',
      },
      reputation: any = null;
    setSemantic(null);
    const tasks: Promise<void>[] = [];
    if (aiConsent && aiConfigured && navigator.onLine && text.trim())
      tasks.push(
        (async () => {
          setBusy('Reading message meaning…');
          setStage('Reading meaning and intent');
          try {
            const response = await fetch('/api/assess', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, kind, consent: true, provider: aiService.providerId }),
              signal: AbortSignal.timeout(45000),
            });
            ai = await response.json();
            if (!['completed', 'unavailable', 'not_checked'].includes(ai.status)) throw Error();
          } catch {
            ai = {
              status: 'unavailable',
              message:
                'Contextual AI could not complete this check. No meaning-based low-risk verdict is available.',
            };
          }
        })(),
      );
    if (consent && configured && local.urls.length && navigator.onLine)
      tasks.push(
        (async () => {
          if (!aiConsent) {
            setBusy('Checking URL reputation…');
            setStage('Checking link reputation');
          }
          try {
            const response = await fetch('/api/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ urls: local.urls.map((u: any) => u.url) }),
              signal: AbortSignal.timeout(15000),
            });
            reputation = await response.json();
          } catch {
            reputation = {
              status: 'unavailable',
              message: 'No connection to the reputation service. Local findings remain available.',
            };
          }
        })(),
      );
    await Promise.allSettled(tasks);
    setSemantic(ai);
    setVerification(reputation);
    setResult(combineAssessment(applySemanticAssessment(local, ai), reputation));
  }
  function finish() {
    setBusy('');
    setStage('Complete');
    setElapsed(Math.round(performance.now() - started.current));
    if (window.innerWidth < 851)
      setTimeout(() => {
        if (resultRef.current?.querySelector('.result-reveal'))
          resultRef.current.scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 'auto'
              : 'smooth',
            block: 'start',
          });
      }, 100);
  }
  async function run() {
    setError('');
    setResult(null);
    setVerification(null);
    started.current = performance.now();
    setBusy('Starting check…');
    try {
      if (tab >= 2) {
        if (!canvasRef.current) throw Error('Choose an image or use your camera first.');
        await processCanvas(canvasRef.current);
      } else {
        if (!input.trim()) throw Error('Add a message or link first.');
        if (tab === 1) {
          normalizeUrl(input);
          await assess(input.trim(), [input.trim()]);
        } else await assess(input);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      finish();
    }
  }
  async function stageCanvas(c: HTMLCanvasElement, name: string, remember = true) {
    if (remember) setProvenance(null);
    setResult(null);
    setVerification(null);
    setExtracted('');
    setQr('');
    setConfidence(null);
    setError('');
    setElapsed(null);
    setBusy('Checking image quality...');
    canvasRef.current = c;
    if (remember) originalRef.current = c;
    const thumb = document.createElement('canvas'),
      scale = Math.min(1, 900 / Math.max(c.width, c.height));
    thumb.width = Math.max(1, Math.round(c.width * scale));
    thumb.height = Math.max(1, Math.round(c.height * scale));
    thumb.getContext('2d')!.drawImage(c, 0, 0, thumb.width, thumb.height);
    setPreview(thumb.toDataURL('image/jpeg', 0.85));
    setFileInfo(name + ' · ' + c.width + ' × ' + c.height);
    try {
      const q = await imageQuality(c);
      setQuality(q.warnings);
      setQualityStats(q);
    } finally {
      setBusy('');
      setStage('Image ready. Crop to the message if needed, then scan.');
    }
  }
  async function cropImage(crop: { left: number; top: number; right: number; bottom: number }) {
    const source = canvasRef.current;
    if (!source) return;
    const c = document.createElement('canvas');
    const left = Math.round(crop.left * source.width),
      top = Math.round(crop.top * source.height);
    c.width = Math.max(1, Math.round((crop.right - crop.left) * source.width));
    c.height = Math.max(1, Math.round((crop.bottom - crop.top) * source.height));
    c.getContext('2d')!.drawImage(source, left, top, c.width, c.height, 0, 0, c.width, c.height);
    await stageCanvas(c, 'Cropped image', false);
  }
  async function rotateImage() {
    const source = canvasRef.current;
    if (!source) return;
    await stageCanvas(rotateCanvas(source, 1), 'Rotated image', false);
  }
  async function decodeQr(canvas: HTMLCanvasElement) {
    const sample = document.createElement('canvas'),
      scale = Math.min(1, 1400 / Math.max(canvas.width, canvas.height));
    sample.width = Math.max(1, Math.round(canvas.width * scale));
    sample.height = Math.max(1, Math.round(canvas.height * scale));
    const ctx = sample.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(canvas, 0, 0, sample.width, sample.height);
    const pixels = ctx.getImageData(0, 0, sample.width, sample.height),
      { default: jsQR } = await import('jsqr');
    const decoded =
      jsQR(pixels.data, sample.width, sample.height, { inversionAttempts: 'attemptBoth' })?.data ||
      '';
    if (!decoded && scale < 1) {
      const full = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      return (
        jsQR(full.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' })?.data ||
        ''
      );
    }
    return decoded;
  }
  async function processCanvas(canvas: HTMLCanvasElement) {
    scanning.current = true;
    setBusy('Reading image...');
    setError('');
    setResult(null);
    setVerification(null);
    setQr('');
    setExtracted('');
    setConfidence(null);
    try {
      setStage('Reading image and embedded QR');
      const decoded = await decodeQr(canvas);
      setQr(decoded);
      if (tab === 3) {
        if (!decoded) {
          setResult({
            level: 'Insufficient evidence',
            indicators: [],
            urls: [],
            limitations: ['No readable QR code found.'],
            recommendation:
              'Try a sharp, straight-on image showing the entire QR code and its white border.',
          });
          return;
        }
        await assess(decoded);
        return;
      }
      setStage('Recognizing image text');
      setBusy('Preparing text reader...');
      const engine = await getOcrWorker(),
        source = ocrCanvas(canvas);
      const data = await recognizeImage(engine, source, {
        retry: preprocess,
        prepareRetry: (image: HTMLCanvasElement) => preprocessCanvas(image),
        checkOrientation: true,
        prepareRotation: async (turn: number, full: boolean) =>
          rotateCanvas(source, turn, full ? Infinity : 1400),
        onOrientation: (degrees: number) => {
          if (degrees) {
            setStage('Text orientation corrected by ' + degrees + ' degrees');
          } else {
            setStage('Checking sideways and upside-down text');
            setBusy('Checking text orientation...');
          }
        },
        onRetry: () => {
          setStage('Trying another text layout for this difficult image');
          setBusy('Improving text reading...');
        },
      });
      setExtracted(data.text.trim());
      setConfidence(data.confidence);
      if (!data.text.trim())
        setQuality((q) => [
          ...q,
          'No readable text found. Upload an original screenshot, or crop closer and retake the photo in focus.',
        ]);
      await assess(data.text + '\n' + decoded, [], data.confidence < 65 || !data.text.trim());
    } catch (e: any) {
      setError(
        e.message || 'Could not process this image. Try an original screenshot or a clearer photo.',
      );
    } finally {
      scanning.current = false;
      setBusy('');
    }
  }
  async function loadFile(file: File) {
    stopCamera();
    setError('');
    setProvenance(null);
    setBusy('Opening image...');
    try {
      const type = inspectFileBytes(
        new Uint8Array(await file.slice(0, 16).arrayBuffer()),
        file.size,
      );
      const originalMetadata = inspectImageProvenance(
        new Uint8Array(await file.arrayBuffer()),
        type,
      );
      const bitmap = await createImageBitmap(new Blob([file], { type }), {
        imageOrientation: 'from-image',
      });
      let c: HTMLCanvasElement;
      try {
        c = bitmapCanvas(bitmap);
      } finally {
        bitmap.close();
      }
      await stageCanvas(c, file.name + ' · ' + (file.size / 1024).toFixed(0) + ' KB');
      setProvenance(originalMetadata);
    } catch (e: any) {
      canvasRef.current = null;
      originalRef.current = null;
      setPreview('');
      setFileInfo('');
      setQuality([]);
      setQualityStats(null);
      setResult(null);
      setExtracted('');
      setQr('');
      setError(e.message);
      setBusy('');
    }
  }
  async function demoImage() {
    if (tab === 3) {
      setBusy('Loading example…');
      try {
        const r = await fetch('/examples/qr.png');
        await loadFile(new File([await r.blob()], 'qr.png', { type: 'image/png' }));
      } catch {
        setBusy('');
        setError('Example image could not be loaded.');
      }
      return;
    }
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 500;
    const x = c.getContext('2d')!;
    x.fillStyle = 'white';
    x.fillRect(0, 0, 1200, 500);
    x.fillStyle = '#111';
    x.font = '36px Arial';
    [
      'GCash advisory: Your account will be blocked today.',
      'Send your OTP now to verify your account.',
      'Visit https://gcash.com.verify-account.example/login',
    ].forEach((t, i) => x.fillText(t, 40, 120 + i * 85));
    await stageCanvas(c, 'Generated screenshot example');
  }
  async function startCamera() {
    stopCamera();
    setBusy('Opening camera...');
    setError('');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 2560 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      const track = stream.current.getVideoTracks()[0],
        capabilities = track.getCapabilities?.() as any;
      if (capabilities?.focusMode?.includes('continuous'))
        await track
          .applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] })
          .catch(() => {});
      setCamera(true);
    } catch {
      setError(
        'Camera access was unavailable. Allow camera permission or upload an original screenshot instead.',
      );
    } finally {
      setBusy('');
    }
  }
  async function capture() {
    const v = video.current,
      track = stream.current?.getVideoTracks()[0];
    if (!v?.videoWidth || !track) return;
    setBusy('Taking photo...');
    try {
      let c: HTMLCanvasElement | null = null;
      const Capture = (window as any).ImageCapture;
      if (Capture) {
        try {
          const shot = await new Capture(track).takePhoto();
          const bitmap = await createImageBitmap(shot, { imageOrientation: 'from-image' });
          try {
            c = bitmapCanvas(bitmap);
          } finally {
            bitmap.close();
          }
        } catch {}
      }
      if (!c) {
        c = document.createElement('canvas');
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        c.getContext('2d')!.drawImage(v, 0, 0);
      }
      stopCamera();
      await stageCanvas(c, 'Camera photo');
    } catch {
      setError('The photo could not be captured. Try uploading a screenshot.');
    } finally {
      setBusy('');
    }
  }
  async function prepareOffline() {
    setOffline('Downloading app and OCR resources…');
    try {
      const { Workbox } = await import('workbox-window');
      const wb = new Workbox('/sw.js');
      await wb.register();
      await Promise.race([
        wb.active,
        new Promise((_, reject) => setTimeout(() => reject(Error()), 120000)),
      ]);
      setOffline(
        'Offline resources installed on this device. Reopen this page once before disconnecting.',
      );
    } catch {
      setOffline('Offline installation unavailable. Try again online on the published app.');
    }
  }

  const aiEnabled = aiConfigured && aiConsent,
    linksEnabled = configured && consent;
  const aiRecipient =
    aiService.providerId === 'openrouter' ? 'OpenRouter and its model provider' : 'Google Gemini';
  const sharingNotice = !online
    ? 'Offline: only on-device checks will run.'
    : aiEnabled && linksEnabled
      ? 'Check sends text to ' + aiRecipient + ' and detected URLs to Google. Images stay here.'
      : aiEnabled
        ? 'Check sends text to ' + aiRecipient + '. Images stay here.'
        : linksEnabled
          ? 'Check sends detected URLs to Google. Other checks stay on this device.'
          : 'Only on-device checks are enabled.';
  return (
    <main>
      <header>
        <a className="brand" href="/">
          <img className="brand-icon" src="/brand/icon.webp" alt="" />
          Surfare<span className="beta">DETECTOR</span>
        </a>
        <div className="header-tools">
          <span className={'connection ' + (!online ? 'disconnected' : '')}>
            <i />
            {online ? 'Online' : 'Offline'}
          </span>
        </div>
      </header>
      <section className="intro">
        <div className="intro-copy">
          <span className="eyebrow">
            <span /> A LITTLE CLARITY GOES A LONG WAY.
          </span>
          <h1>A second look.</h1>
          <p>Messages, links, images and QR codes. Check before you trust.</p>
        </div>
        <div className="hero-art detector-art" aria-hidden="true">
          <div className="detector-orbit">
            <ShieldCheck size={54} />
          </div>
        </div>
      </section>
      <Readiness
        online={online}
        configured={configured}
        aiConfigured={aiConfigured}
        aiProvider={aiService.provider}
        offline={offline}
        onPrepare={prepareOffline}
      />
      <div className="workspace">
        <section className="panel input-panel">
          <div className="panel-heading">
            <h2>What feels off?</h2>
            <span>01 / CHECK</span>
          </div>
          <nav aria-label="Content type">
            {tabs.map((t, i) => (
              <button
                key={t.name}
                disabled={!!busy}
                className={tab === i ? 'active' : ''}
                onClick={() => reset(i)}
                aria-pressed={tab === i}
              >
                <t.icon size={18} />
                {t.name}
              </button>
            ))}
          </nav>
          {tab < 2 ? (
            <div className="entry">
              <label htmlFor="content">{tab === 0 ? 'Paste the message' : 'Website address'}</label>
              <textarea
                disabled={!!busy}
                id="content"
                maxLength={12000}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setResult(null);
                  setVerification(null);
                  setSemantic(null);
                  setStage('');
                  setElapsed(null);
                }}
                placeholder={
                  tab === 0 ? 'Paste something you’re unsure about…' : 'https://example.com'
                }
                rows={tab === 0 ? 5 : 3}
              />
              <div className="under-input">
                <span>
                  {tab === 0 ? 'English · Filipino · Taglish' : 'Checked without opening the link'}
                </span>
                <span>{input.length.toLocaleString()} / 12,000</span>
              </div>
              <details className="input-disclosure">
                <summary>Try an example</summary>
                <div className="examples">
                  {(tab === 0
                    ? ['Suspicious message', 'Everyday message']
                    : ['Misleading domain', 'Official domain']
                  ).map((name, i) => (
                    <button
                      key={name}
                      disabled={!!busy}
                      onClick={() => {
                        setResult(null);
                        setVerification(null);
                        setInput(
                          tab === 0
                            ? i
                              ? 'Hi Kai, our meeting is at 4 PM. Please bring your notes.'
                              : 'GCash advisory: Your account will be blocked today. Send your OTP now to verify your account.'
                            : i
                              ? 'https://www.gcash.com'
                              : 'https://gcash.com.verify-account.example/login',
                        );
                      }}
                    >
                      {name}
                    </button>
                  ))}
                  {tab === 0 && (
                    <button
                      disabled={!!busy}
                      onClick={() => {
                        setResult(null);
                        setVerification(null);
                        setInput('sendan moko ng pera ngayon o papatayin kita 095583723');
                      }}
                    >
                      Tagalog threat
                    </button>
                  )}
                  {tab === 1 && (
                    <button
                      disabled={!!busy}
                      onClick={() => {
                        setInput(
                          'http://testsafebrowsing.appspot.com/apiv4/ANY_PLATFORM/SOCIAL_ENGINEERING/URL/',
                        );
                        setResult(null);
                        setVerification(null);
                      }}
                    >
                      Google phishing test
                    </button>
                  )}
                </div>
                {tab === 1 && (
                  <p className="test-instruction">Enable link checks to run the Google test.</p>
                )}
              </details>
            </div>
          ) : (
            <div className="entry">
              <label>{tab === 2 ? 'Screenshot or photo' : 'QR image'}</label>
              <button
                disabled={!!busy}
                className="dropzone"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!busy && e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
                }}
              >
                <Upload size={27} />
                <strong>Drop an image or browse</strong>
                <span>PNG, JPG, WebP · up to 10 MB</span>
              </button>
              <input
                ref={fileRef}
                aria-label="Upload image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => {
                  if (e.target.files?.[0]) loadFile(e.target.files[0]);
                }}
              />
              <div className="capture-actions">
                <button className="camera-button" disabled={!!busy} onClick={startCamera}>
                  <Camera size={16} />
                  Camera
                </button>
                <button className="camera-button" disabled={!!busy} onClick={demoImage}>
                  Try an example
                </button>
              </div>
              <details className="input-disclosure">
                <summary>Image tips & options</summary>
                <p className="capture-tip">
                  An original screenshot reads best. For photos, crop to the message and avoid blur
                  or glare.
                </p>
                {tab === 2 && (
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={preprocess}
                      disabled={!!busy}
                      onChange={(e) => setPreprocess(e.target.checked)}
                    />
                    Retry weak text recognition
                  </label>
                )}
                {qualityStats && (
                  <p className="file-info">
                    Brightness {Math.round(qualityStats.brightness)}/255 · Focus{' '}
                    {qualityStats.sharpness === null
                      ? 'unavailable'
                      : qualityStats.sharpness < 60
                        ? 'check for blur'
                        : 'usable'}
                  </p>
                )}
              </details>
              {camera && (
                <div className="camera">
                  <video ref={video} playsInline muted autoPlay />
                  <div className="live-coach" role="status">
                    <p>
                      {liveQuality
                        ? liveQuality.warnings.length
                          ? liveQuality.warnings.join(' ')
                          : 'Looking good. Hold steady.'
                        : 'Checking focus…'}
                    </p>
                  </div>
                  <button disabled={!!busy} onClick={capture}>
                    Use photo
                  </button>
                  <button disabled={!!busy} onClick={stopCamera}>
                    Cancel
                  </button>
                </div>
              )}
              {preview && (
                <>
                  <ImageEditor
                    key={preview}
                    src={preview}
                    disabled={!!busy || camera}
                    onCrop={cropImage}
                    onRotate={rotateImage}
                    onRestore={() => {
                      if (originalRef.current)
                        stageCanvas(originalRef.current, 'Original image', false);
                    }}
                  />
                  <p className="file-info">{fileInfo}</p>
                </>
              )}
              {quality.map((n) => (
                <p className="quality" key={n}>
                  {n}
                </p>
              ))}
              {!busy && qr && (
                <details className="input-disclosure">
                  <summary>Decoded QR content</summary>
                  <pre className="qr-content">{qr}</pre>
                </details>
              )}
              {!busy && extracted && (
                <details className="input-disclosure extracted">
                  <summary>Review extracted text · {confidence?.toFixed(0)}% OCR</summary>
                  <label htmlFor="ocr">Extracted text</label>
                  <textarea
                    id="ocr"
                    value={extracted}
                    onChange={(e) => {
                      setExtracted(e.target.value);
                      setResult(null);
                      setVerification(null);
                    }}
                  />
                  <button
                    disabled={servicesLoading}
                    aria-describedby="check-sharing"
                    onClick={async () => {
                      setResult(null);
                      started.current = performance.now();
                      setBusy('Checking corrected text…');
                      try {
                        await assess(extracted + '\n' + qr);
                      } finally {
                        finish();
                      }
                    }}
                  >
                    Check corrected text
                  </button>
                </details>
              )}
            </div>
          )}
          <div className="action-area">
            <div className="automatic-checks" aria-label="Selected checks">
              {servicesLoading ? (
                <span>Connecting checks…</span>
              ) : (
                <>
                  <span className={aiEnabled && online ? 'enabled' : ''}>
                    <ShieldCheck size={12} />
                    {!online
                      ? 'AI offline'
                      : !aiConfigured
                        ? 'AI unavailable'
                        : aiEnabled
                          ? 'AI context on'
                          : 'AI context off'}
                  </span>
                  <span className={linksEnabled && online ? 'enabled' : ''}>
                    <LinkIcon size={12} />
                    {!online
                      ? 'Links offline'
                      : !configured
                        ? 'Link reputation unavailable'
                        : linksEnabled
                          ? 'Link checks on'
                          : 'Link checks off'}
                  </span>
                </>
              )}
            </div>
            <details className="input-disclosure privacy-options">
              <summary>Options & privacy</summary>
              <div className="check-options">
                <label className="checkbox consent option-row">
                  <input
                    aria-label="Understand the message with contextual AI"
                    type="checkbox"
                    disabled={!!busy || servicesLoading || !aiConfigured}
                    checked={aiConsent}
                    onChange={(e) => setAiConsent(e.target.checked)}
                  />
                  <span>
                    <strong>
                      AI context{' '}
                      <em>
                        {aiConfigured
                          ? aiService.providerId === 'openrouter'
                            ? 'OpenRouter · free'
                            : 'Gemini'
                          : 'Unavailable'}
                      </em>
                    </strong>
                    <small>Reads meaning and implied threats in every submitted message.</small>
                  </span>
                </label>
                <label className="checkbox consent option-row">
                  <input
                    aria-label="Check links with Google Safe Browsing"
                    disabled={!!busy || servicesLoading || !configured}
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    <strong>
                      Link reputation <em>{configured ? 'Google' : 'Not configured'}</em>
                    </strong>
                    <small>Looks up detected URLs when present.</small>
                  </span>
                </label>
              </div>
              <p>
                Available services are on by default. Changes apply to your next check. Remove
                private details before sending text.
              </p>
              <p>
                {aiService.providerId === 'openrouter'
                  ? 'Free models have usage limits. Paid models are disabled. OpenRouter and its model provider’s privacy policies apply.'
                  : 'Google may use free-tier content to improve its products.'}{' '}
                <a
                  href={
                    aiService.providerId === 'openrouter'
                      ? 'https://openrouter.ai/privacy'
                      : 'https://ai.google.dev/gemini-api/docs/pricing'
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Provider terms
                </a>
              </p>
              <p>
                Link checks send full URLs, including query parameters. No scan history is saved by
                this app.
              </p>
            </details>
            <p id="check-sharing" className="submission-disclosure">
              {servicesLoading
                ? 'Checking service availability. Nothing has been sent.'
                : sharingNotice}
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button
              className="primary"
              aria-describedby="check-sharing"
              disabled={!!busy || camera || servicesLoading}
              onClick={run}
            >
              {busy || servicesLoading ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <ShieldCheck size={18} />
              )}{' '}
              {busy
                ? 'Checking…'
                : servicesLoading
                  ? 'Getting ready…'
                  : 'Check ' +
                    (tab === 0 ? 'message' : tab === 1 ? 'link' : tab === 2 ? 'image' : 'QR code')}
              {!busy && !servicesLoading && <ArrowRight size={18} />}
            </button>
            <p className="privacy">No scan history. Never a guarantee of safety.</p>
          </div>
        </section>
        <section
          ref={resultRef}
          tabIndex={-1}
          className="panel results-panel"
          aria-live="polite"
          aria-busy={!!busy}
        >
          <div className="panel-heading">
            <h2>Your result</h2>
            <span>{busy ? 'TAKING A LOOK' : '02 / REVIEW'}</span>
          </div>
          {busy ? (
            <CheckLoading stage={stage && stage !== 'Complete' ? stage : busy} />
          ) : result ? (
            <div className="result-reveal" key={result.sourceText + '|' + elapsed}>
              <Assessment
                result={result}
                semantic={semantic}
                verification={verification}
                elapsed={elapsed}
                sourceLabel={
                  tab === 2
                    ? 'Extracted text · OCR'
                    : tab === 3
                      ? 'Decoded QR'
                      : tab === 1
                        ? 'Link'
                        : 'Your message'
                }
                online={online}
                consent={consent}
                busy={false}
                onError={setError}
                onReset={() => {
                  reset();
                  document.getElementById('content')?.focus();
                }}
              />
              {provenance && (
                <div className="result-provenance">
                  <ImageProvenance result={provenance} />
                </div>
              )}
            </div>
          ) : (
            <div className="empty">
              <div className="empty-shield">
                <ShieldCheck size={42} strokeWidth={1.4} />
              </div>
              <h3>Ready when you are.</h3>
              <p>
                Add something to check.
                <br />
                We’ll take a closer look.
              </p>
            </div>
          )}
        </section>
      </div>
      <footer>
        <div>
          <ShieldCheck size={17} />
          <span>Surfare · Team g(OAT)ed</span>
        </div>
        <button onClick={prepareOffline} disabled={offline.startsWith('Downloading')}>
          <Download size={15} />
          Save for offline
        </button>
      </footer>
      {offline && (
        <p role="status" className="offline-status">
          {offline}
        </p>
      )}
      <details className="technical">
        <summary>How Surfare works</summary>
        <p>
          Local rules and a small SMS model look for known warning signs. Optional AI checks meaning
          and context in English, Filipino and Taglish. Google Safe Browsing checks URL reputation.
          AI and local checks can make mistakes; no result guarantees safety.
        </p>
        <p>
          Images are read locally with Tesseract.js OCR and jsQR. Review recognized text before
          relying on it. Metadata checks inspect original-file markers; they do not authenticate
          images or detect AI from pixels. Screenshots can remove provenance.
        </p>
        <p>
          Offline resources include the app and OCR model, approximately 18 MB. Contextual AI and
          URL reputation need a connection.
        </p>
      </details>
    </main>
  );
}
